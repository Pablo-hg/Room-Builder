#!/usr/bin/env python3
"""Respaldo por proveedores cloud gratuitos para OpenCode. Stdlib only.

AVISO: el programa no puede demostrar si el usuario habilito facturacion
remota. Activa cada proveedor SOLO despues de confirmar nivel gratuito sin
facturacion. Nunca inserta ni invoca modelos fuera de la lista permitida.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = Path(__file__).with_name("free_chain.json")
STATE_PATH = ROOT / ".ai" / "FREE_CHAIN_STATE.json"
# Allowlist deliberadamente cerrada. No habilitar rutas de cobro.
APPROVED = {
    "opencode": {"opencode/deepseek-v4.1-flash-free"},
    "google": {"google/gemma-4-31b-it"},
    "groq": {"groq/openai/gpt-oss-120b"},
    "openrouter": {"openrouter/openrouter/free"},
}
QUOTA = re.compile(
    r"\b429\b|\brate.?limit\b|\bresource_exhausted\b|\bquota\b|"
    r"free limit reached|used today.s free messages|free messages.*reset|"
    r"daily (?:message|request|token) limit|too many requests|"
    r"insufficient_quota|limit exceeded|exceeded.*limit|"
    r"free tier.*(?:exhausted|limit)", re.I,
)
# Some free tiers reject a single request larger than their TPM budget.
# Waiting for the next minute cannot make an individual oversized request fit.
REQUEST_TOO_LARGE_TPM = re.compile(
    r"request too large for model.*tokens per minute\s*\(TPM\).*"
    r"limit\s*[\d,]+\s*,\s*requested\s*[\d,]+", re.I | re.S,
)
ACCESS = re.compile(
    r"\b401\b|\b403\b|\b404\b|not authorized|unauthori[sz]ed|"
    r"model.*not found|providermodelnotfound|not configured|"
    r"api key.*(?:missing|invalid)|payment required|billing.*required|"
    r"\b402\b|no provider found|credentials.*missing", re.I,
)


def load_routes(path: Path = CONFIG_PATH) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    routes = data.get("routes", [])
    if not isinstance(routes, list) or not routes:
        raise ValueError("free_chain.json debe contener routes no vacio")
    used = set()
    for r in routes:
        provider = r.get("provider", "")
        model = r.get("model", "")
        if model not in APPROVED.get(provider, set()):
            raise ValueError(f"Modelo NO autorizado: {provider}/{model}. No se ejecuta nada.")
        if not isinstance(r.get("enabled"), bool):
            raise ValueError(f"enabled debe ser true/false para {provider}")
        if provider in used:
            raise ValueError(f"Proveedor duplicado: {provider}; las cuotas pueden ser compartidas")
        used.add(provider)
    return routes


def parse_json_line(line: str):
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return None


def error_report(output: str, returncode: int) -> tuple[bool, str]:
    """(success, reason). Exige identificar fallo para pasar a otra cuenta."""
    errors = []
    for line in output.splitlines():
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(e, dict):
            continue
        typ = str(e.get("type", "")).lower()
        props = e.get("properties") or {}
        if not isinstance(props, dict):
            props = {}
        part = props.get("part") or {}
        if not isinstance(part, dict):
            part = {}
        # No interpretar el texto ordinario del agente como si fuera un error.
        if typ in ("error", "session.error", "session.failed", "step.error") or part.get("type") == "error":
            errors.append(json.dumps(e, ensure_ascii=False)[-6000:])
        elif typ == "message.updated":
            info = props.get("info") or {}
            if isinstance(info, dict) and info.get("error"):
                errors.append(json.dumps(info["error"], ensure_ascii=False)[-6000:])
    if not errors and returncode == 0 and output.strip():
        # Algunos clientes imprimen solo un error plano aun devolviendo rc=0.
        # No interpretamos como error el texto ordinario de eventos JSON del modelo.
        has_structured_events = any(
            isinstance(ev, dict) and "type" in ev
            for line in output.splitlines()
            for ev in [parse_json_line(line)]
        )
        if not has_structured_events and REQUEST_TOO_LARGE_TPM.search(output):
            return False, "petición supera TPM"
        if not has_structured_events and QUOTA.search(output):
            return False, "cuota"
        if not has_structured_events and ACCESS.search(output):
            return False, "acceso/modelo no disponible"
        return True, "completado"
    detail = "\n".join(errors) if errors else output[-7000:]
    if REQUEST_TOO_LARGE_TPM.search(detail):
        return False, "petición supera TPM"
    if QUOTA.search(detail):
        return False, "cuota"
    if ACCESS.search(detail):
        return False, "acceso/modelo no disponible"
    return False, "error no reconocido; no se cambia de proveedor automáticamente"


def safe_git(args: list[str]) -> str:
    try:
        r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                           text=True, timeout=8, check=False)
        return (r.stdout or "").strip()[:2500] if r.returncode == 0 else "no disponible"
    except (OSError, subprocess.TimeoutExpired):
        return "no disponible"


def save_state(original_prompt: str, completed: list, session: str | None) -> None:
    STATE_PATH.parent.mkdir(exist_ok=True, parents=True)
    data = {
        "task": original_prompt,
        "attempts": completed,
        "session": session,
        "git_branch": safe_git(["branch", "--show-current"]),
        "git_status": safe_git(["status", "--short"]),
        "git_head": safe_git(["log", "-1", "--format=%h %s"]),
    }
    STATE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def session_id(output: str) -> str | None:
    for line in output.splitlines():
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(e, dict):
            continue
        prop = e.get("properties", {})
        if not isinstance(prop, dict):
            prop = {}
        sid = prop.get("sessionID") or e.get("sessionID")
        if isinstance(sid, str) and re.fullmatch(r"ses_[a-zA-Z0-9_-]+", sid):
            return sid
    return None


def resume_prompt(task: str, prior: list) -> str:
    prefix = """RETOMA SEGURA TRAS AGOTAR LA CUOTA DE OTRO PROVEEDOR.
Lee .ai/CODEX_HANDOFF.md o .ai/TASK_HANDOFF.md si existen. Comprueba Git antes de editar.
Conserva TODOS los cambios locales y commits, no repitas trabajo ni pruebas ya válidas.
No hagas commit, merge, push ni instalaciones con costes. No uses otros agentes o APIs pagados.
Si un paso quedó parcialmente ejecutado, verifica el estado actual y termina solo lo pendiente.
"""
    if prior:
        prefix += "Proveedores anteriores agotados/no disponibles: " + ", ".join(x["provider"] for x in prior) + ".\n"
    return prefix + "\nTAREA ORIGINAL: " + task


def check_models(routes: list[dict]) -> int:
    """Verifica los IDs publicados por el CLI compatible con la version local."""
    result = subprocess.run(['opencode', 'models'], cwd=ROOT,
                            capture_output=True, text=True, timeout=25,
                            check=False)
    if result.returncode != 0:
        print('Error al consultar opencode models: ' + (result.stderr or '')[-1000:])
        return 2
    ids = {line.strip() for line in (result.stdout or '').splitlines()}
    missing = 0
    for route in routes:
        if not route['enabled']:
            continue
        provider, model = route['provider'], route['model']
        ok = model in ids
        print(f"{'OK' if ok else 'REVISAR'} {provider}: {model}")
        if not ok:
            missing += 1
            print('  Este ID no figura en el catalogo: opencode models')
    print('Esta comprobacion NO verifica el estado Free de facturacion ni ejecuta la IA.')
    return 0 if missing == 0 else 2


def execute(args: argparse.Namespace) -> int:
    routes = load_routes()
    enabled = [x for x in routes if x["enabled"]]
    if args.list or args.dry_run:
        for x in routes:
            print(("ACTIVO  " if x["enabled"] else "INACTIVO") + "  " + x["provider"] + "  " + x["model"])
        if not enabled:
            print("No hay proveedores activados. Configura free_chain.json primero.")
        if args.list or args.dry_run:
            if args.dry_run:
                print("Simulación: NO se enviarán peticiones.")
            return 0
    if getattr(args, 'check_models', False):
        if not shutil.which('opencode'):
            print("No encuentro 'opencode' en PATH", file=sys.stderr)
            return 2
        return check_models(routes)
    if not args.task:
        print("Falta la tarea. Ejemplo: python3 scripts/ai/free_chain.py 'Continúa R2.7'", file=sys.stderr)
        return 2
    if not enabled:
        print("No hay rutas activas; revisa free_chain.json", file=sys.stderr)
        return 2
    if not shutil.which("opencode"):
        print("No encuentro 'opencode' en PATH", file=sys.stderr)
        return 2
    tried = []
    sid = args.session
    for i, route in enumerate(enabled):
        prompt = resume_prompt(args.task, tried)
        cmd = ["opencode", "run", "--format", "json", "--agent", "build", "--model", route["model"]]
        if sid:
            cmd += ["--session", sid]
        cmd += [prompt]
        print(f"\n[{i+1}/{len(enabled)}] Intentando {route['provider']} -> {route['model']} ...", flush=True)
        try:
            r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True,
                               encoding="utf-8", errors="replace", timeout=args.timeout)
        except subprocess.TimeoutExpired:
            print("Tiempo agotado sin resultado. No hay cambio automático por seguridad: podría seguir ejecutándose trabajo.")
            save_state(args.task, tried + [{"provider": route["provider"], "status": "timeout"}], sid)
            return 3
        ok, reason = error_report(r.stdout + "\n" + r.stderr, r.returncode)
        discovered = session_id(r.stdout)
        if discovered:
            sid = discovered
        if ok:
            print("\nCompletado por " + route["provider"] + ".")
            print("Sesión: " + (sid or "no detectada"))
            print("--- Salida (extracto) ---")
            print(r.stdout[-9000:])
            save_state(args.task, tried + [{"provider": route["provider"], "status": "ok"}], sid)
            return 0
        tried.append({"provider": route["provider"], "model": route["model"], "status": reason})
        save_state(args.task, tried, sid)
        print("Fallo: " + reason)
        if reason not in {"cuota", "petición supera TPM", "acceso/modelo no disponible"}:
            print("DETENIDO: fallo desconocido; evita duplicar acciones o ignorar errores reales.")
            print("Revisa .ai/FREE_CHAIN_STATE.json")
            return 3
        if i < len(enabled) - 1:
            print("Probando siguiente proveedor gratuito permitido; sin pasar a proveedores de pago.")
    print("Todos los proveedores GRATUITOS habilitados han fallado o agotado sus cuotas.")
    print("Estado recuperable en .ai/FREE_CHAIN_STATE.json. No se ha invocado ningún modelo de pago.")
    return 4


def main() -> int:
    parser = argparse.ArgumentParser(description="Cadena cloud gratuita de OpenCode (sin modelos locales)")
    parser.add_argument("task", nargs="?", help="Tarea de desarrollo")
    parser.add_argument("--list", action="store_true", help="Listar rutas aprobadas y activación")
    parser.add_argument("--dry-run", action="store_true", help="No ejecutar peticiones")
    parser.add_argument("--check-models", action="store_true", help="Verificar IDs con el catalogo CLI; no consume tokens")
    parser.add_argument("--session", help="ID de sesión OpenCode que se quiere continuar, ses_...")
    parser.add_argument("--timeout", type=int, default=1800, help="Timeout por proveedor en segundos")
    args = parser.parse_args()
    if args.session and not re.fullmatch(r"ses_[a-zA-Z0-9_-]+", args.session):
        parser.error("ID de sesión inválido")
    try:
        return execute(args)
    except (ValueError, OSError) as exc:
        print("Configuración inválida: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
