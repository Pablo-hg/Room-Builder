#!/usr/bin/env python3
"""Punto de control local Codex -> OpenCode (sin llamadas a modelos ni dependencias pip).

Lee eventos de hooks por stdin. Usa codex app-server para consultar la cuota, cuando
está disponible. Guarda solo datos mínimos de la tarea y el estado de Git.
"""
import json
import os
from pathlib import Path
import re
import select
import shutil
import subprocess
import sys
import tempfile
import time

THRESHOLD_USED = 95.0   # 5 % restante
POLL_SECONDS = 45       # limitar invocaciones al app-server
TIMEOUT_SECONDS = 9
MAX_PROMPT = 1600
MAX_ASSISTANT = 2000


def git(root, *args):
    try:
        proc = subprocess.run(["git", *args], cwd=root, stdout=subprocess.PIPE,
                              stderr=subprocess.DEVNULL, text=True, timeout=3)
        if proc.returncode == 0:
            return proc.stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        pass
    return "(no disponible)"


def atomic_write(path, contents):
    fd, tmp = tempfile.mkstemp(prefix=".codex-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            out.write(contents)
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def redact(text, n):
    """El traspaso es local, pero evita reproducir credenciales evidentes."""
    text = str(text or "")
    patterns = [
        r'(?i)(authorization\s*:\s*bearer\s+)[^\s]+',
        r'(?i)((?:api[_-]?key|password|token|secret)\s*[:=]\s*)[^\s,;}]+',
        r'gh[pousr]_[A-Za-z0-9_]{15,}',
        r'sk-[A-Za-z0-9_-]{15,}',
    ]
    for p in patterns:
        text = re.sub(p, lambda m: (m.group(1) if m.lastindex else "") + "[OCULTO]", text)
    return text[:n].replace("\x00", "")


def make_dir(root):
    ai = root / ".ai"
    ai.mkdir(exist_ok=True)
    if not ai.is_dir():
        raise RuntimeError(".ai no es un directorio")
    # Ignorar .ai en el clon local, también si estamos en un git worktree.
    # --git-path resuelve el directorio Git común cuando .git es un archivo.
    exclude_path = git(root, "rev-parse", "--git-path", "info/exclude")
    if exclude_path != "(no disponible)":
        exclude = (root / exclude_path).resolve()
        exclude.parent.mkdir(parents=True, exist_ok=True)
        existing = exclude.read_text(encoding="utf-8") if exclude.exists() else ""
        if ".ai/" not in existing.splitlines():
            with exclude.open("a", encoding="utf-8") as f:
                f.write(("" if existing.endswith("\n") or not existing else "\n") + ".ai/\n")
    return ai


def get_quota():
    """Consulta no generativa. Se basa en el protocolo oficial JSONL de Codex."""
    if not shutil.which("codex"):
        return None
    try:
        proc = subprocess.Popen(["codex", "app-server"], stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                text=True, bufsize=1)
    except OSError:
        return None
    try:
        msgs = [
            {"method": "initialize", "id": 1, "params": {"clientInfo": {
                "name": "room_builder_quota_guard", "title": "Room Builder Quota Guard", "version": "0.1.0"}}},
            {"method": "initialized", "params": {}},
            {"method": "account/rateLimits/read", "id": 2},
        ]
        for m in msgs:
            proc.stdin.write(json.dumps(m) + "\n")
        proc.stdin.flush()
        end = time.monotonic() + TIMEOUT_SECONDS
        pending = b""
        answer = None
        while time.monotonic() < end and answer is None:
            ready, _, _ = select.select([proc.stdout], [], [], max(0.05, end - time.monotonic()))
            if not ready:
                break
            chunk = os.read(proc.stdout.fileno(), 65536)
            if not chunk:
                break
            pending += chunk
            while b"\n" in pending:
                line, pending = pending.split(b"\n", 1)
                try:
                    message = json.loads(line)
                except (ValueError, UnicodeDecodeError):
                    continue
                if message.get("id") == 2:
                    answer = message
                    break
        if answer is not None:
            result = answer.get("result")
            if not isinstance(result, dict):
                return None
            buckets = result.get("rateLimitsByLimitId") or {}
            # Solo cuota general Codex; no frenar por cuotas ajenas.
            target = buckets.get("codex") if isinstance(buckets, dict) else None
            if not isinstance(target, dict):
                target = result.get("rateLimits")
            if not isinstance(target, dict):
                return None
            windows = []
            for key in ("primary", "secondary"):
                value = target.get(key)
                if isinstance(value, dict) and isinstance(value.get("usedPercent"), (int, float)):
                    windows.append({"kind": key, "used": float(value["usedPercent"]),
                                    "mins": value.get("windowDurationMins")})
            if not windows:
                return None
            return {"windows": windows, "low": any(x["used"] >= THRESHOLD_USED for x in windows),
                    "checkedAt": time.time()}
    except (OSError, ValueError, BrokenPipeError):
        return None
    finally:
        try:
            proc.terminate()
            proc.communicate(timeout=0.6)
        except (OSError, subprocess.TimeoutExpired):
            proc.kill()
            try:
                proc.communicate(timeout=0.5)
            except Exception:
                pass


def load_state(path):
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def write_handoff(root, state):
    branch = git(root, "branch", "--show-current")
    commit = git(root, "rev-parse", "--short", "HEAD")
    changes = git(root, "status", "--short", "--untracked-files=normal")
    stats = git(root, "diff", "--stat")
    staged = git(root, "diff", "--cached", "--stat")
    status = state.get("quota")
    if status and status.get("windows"):
        quota = "; ".join(f"{w['kind']}: {100-w['used']:.1f}% restante ({w['mins']} min)"
                           for w in status["windows"])
    else:
        quota = "No se pudo leer; no se aplica bloqueo por porcentaje."
    content = f"""# Traspaso temporal Codex → OpenCode

> Snapshot **local y automático**: NO es una exportación completa del chat.
> Comprobar el estado real de archivos antes de continuar.

- Guardado: {time.strftime('%Y-%m-%d %H:%M:%S %Z')}
- Rama: `{branch}`
- Commit observado: `{commit}` (no implica que sea la base inicial de la tarea)
- Cuota Codex: {quota}
- Modelo conocido por el hook: `{redact(state.get('model') or 'desconocido', 80)}`

## Última petición conocida de Codex

{redact(state.get('prompt') or '(No disponible; preguntar al usuario cuál era el objetivo).', MAX_PROMPT)}

## Última respuesta visible del asistente

{redact(state.get('assistant') or '(No disponible; puede haber quedado interrumpido).', MAX_ASSISTANT)}

## Git status --short

```text
{changes[:4500]}
```

## Resumen de diferencias sin confirmar

```text
{stats[:2200]}
```

## Cambios preparados para commit

```text
{staged[:2200]}
```

## Continuación recomendada

1. Leer `AGENTS.md` y documentación solo de las áreas implicadas.
2. Revisar esta nota y el código real para entender lo hecho, no suponer que el chat de Codex es accesible.
3. Identificar decisiones y criterios que falten; preguntar al usuario únicamente si son imprescindibles.
4. Seguir con un modelo `-free` adecuado, sin sobrescribir cambios locales.
5. Al terminar usar `/traspaso-codex` para que Codex revise el trabajo cuando vuelva su cuota.

**Notas:** este archivo puede contener extractos de instrucciones de la sesión. No subir a Git ni compartirlo sin revisar su contenido.
"""
    atomic_write(root / ".ai" / "CODEX_HANDOFF.md", content)


def handle(event, root, state, quota=None):
    name = event.get("hook_event_name")
    state["model"] = event.get("model") or state.get("model")
    state["session"] = event.get("session_id") or state.get("session")
    if name == "UserPromptSubmit" and event.get("prompt"):
        state["prompt"] = redact(event["prompt"], MAX_PROMPT)
    if name == "Stop" and event.get("last_assistant_message"):
        state["assistant"] = redact(event["last_assistant_message"], MAX_ASSISTANT)
    if quota is not None:
        state["quota"] = quota
    write_handoff(root, state)
    low = bool(state.get("quota", {}).get("low"))
    path = ".ai/CODEX_HANDOFF.md"
    if low and name == "UserPromptSubmit":
        return {"decision": "block", "reason": f"Queda un 5 % o menos de cuota Codex. Traspaso guardado en {path}. Continúa con OpenCode: /gratis-auto Lee {path} y continúa. Comprueba la cuota al restablecerse."}
    if low and name == "PostToolUse":
        return {"systemMessage": f"Cuota de Codex al 5 % o menos. Snapshot en {path}. Termina cuanto antes en un punto seguro y entrega el estado.",
                "hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext":
                    "Se ha detectado 5 % o menos de cuota disponible. Finaliza en un punto seguro; no inicies nuevas subtareas ni pruebas largas. El traspaso local ya existe."}}
    if low and name == "Stop":
        return {"continue": False, "stopReason": f"Cuota Codex <=5 %. Traspaso local en {path}."}
    return {}


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--check-quota":
        quota = get_quota()
        if quota is None:
            print("No se pudo leer la cuota de Codex. No actives el bloqueo automático todavía.")
            return 2
        for window in quota["windows"]:
            remaining = 100.0 - window["used"]
            print(f"{window['kind']}: {remaining:.1f}% restante (ventana: {window['mins']} min)")
        print("Umbral alcanzado: " + ("SÍ" if quota["low"] else "NO"))
        return 0
    if len(sys.argv) > 1 and sys.argv[1] == "--manual":
        root = Path.cwd()
        if git(root, "rev-parse", "--show-toplevel") == "(no disponible)":
            print("Ejecuta dentro del repositorio Git", file=sys.stderr)
            return 1
        root = Path(git(root, "rev-parse", "--show-toplevel"))
        ai = make_dir(root)
        state = load_state(ai / ".codex_handoff_state.json")
        write_handoff(root, state)
        print(f"Traspaso: {ai / 'CODEX_HANDOFF.md'}")
        return 0
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return 0
    root_text = git(Path(event.get("cwd") or os.getcwd()), "rev-parse", "--show-toplevel")
    if root_text == "(no disponible)":
        return 0
    root = Path(root_text)
    ai = make_dir(root)
    statepath = ai / ".codex_handoff_state.json"
    state = load_state(statepath)
    # Nunca reutilizar el contexto previo si cambió la sesión de Codex.
    session = event.get("session_id")
    if session and state.get("session") != session:
        state = {}
    quota = None
    last = state.get("quota", {}).get("checkedAt", 0)
    if time.time() - last >= POLL_SECONDS:
        quota = get_quota()
        if quota is None:
            state.pop("quota", None)  # fallar abierto si el dato deja de estar disponible
            quota = None
    result = handle(event, root, state, quota)
    atomic_write(statepath, json.dumps(state, ensure_ascii=False, indent=2))
    if result:
        print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        # Los hooks no deben inutilizar el IDE por un error del monitor.
        print(f"[codex-quota-handoff] No se pudo preparar el traspaso: {e}", file=sys.stderr)
        raise SystemExit(0)
