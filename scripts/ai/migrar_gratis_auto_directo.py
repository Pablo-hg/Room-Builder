#!/usr/bin/env python3
"""Transforma /gratis-auto en agente de desarrollo directo con respaldo gratuito.

Solo edita opencode.jsonc después de --apply. No cambia los otros comandos,
configuración de plugin, otras definiciones de agente ni credenciales.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import os
import pathlib
import re
import shutil
import sys
import tempfile

PRIMARY = "opencode/glm-5.3-flash-free"
SAFE_FALLBACK = ["google/gemma-4-31b-it", "openrouter/openrouter/free"]
NEW_NAME = "gratis-auto"
OLD_NAME = "selector-gratuito"

NEW_TEMPLATE = (
    "MODO GRATUITO — EJECUCION DIRECTA, SIN SUBAGENTES. "
    "Solicitud del usuario: $ARGUMENTS. "
    "Tu función es ejecutar la tarea directamente; NO delegues a subagentes ni lances agentes paralelos. "
    "Si el usuario pide RETOMAR una tarea de Codex o la tarea actual carece de contexto, "
    "lee .ai/CODEX_HANDOFF.md (o, si no existe, .ai/TASK_HANDOFF.md); "
    "si es una tarea nueva y está clara, no leas esos documentos por rutina. "
    "Antes de modificar archivos, comprueba la rama y git status --short, después inspecciona "
    "solo el código y documentación relacionados. Conserva TODO trabajo local, incluidos archivos sin seguimiento. "
    "Compara los requisitos con el código actual y desarrolla únicamente lo que falte. "
    "Las imágenes solo pueden verificarse si son accesibles en esta sesión; si no, identifica "
    "la limitación y trabaja solo sobre lo comprobable. "
    "Aplica cambios mínimos, comprueba lo relevante con pruebas focalizadas y evita repetir suites "
    "caras que sigan siendo válidas. "
    "Cuando un proveedor gratuito falle por cuota o disponibilidad, deja que el plugin "
    "opencode-fallback gestione el cambio en esta misma sesión; no cambies de proveedor "
    "por tu cuenta, no reinicies la tarea desde cero y verifica el estado de los archivos "
    "antes de reanudar cualquier operación. "
    "Usa exclusivamente los modelos gratuitos configurados; nunca modelos facturables, "
    "recargas ni subagentes. No hagas commits, merges, push o publicaciones sin permiso. "
    "Al terminar, resume: realizado, pruebas ejecutadas, resultado y pendientes. "
    "Si la petición es ambigua en un punto esencial, pregunta solo por ese punto; "
    "no inventes objetivos o resultados de pruebas."
)


def parse_jsonc(text: str) -> dict:
    """Parse JSONC con comentarios/trailing commas, sin ejecutar código."""
    out = []
    pos, in_string, escaped = 0, False, False
    while pos < len(text):
        c = text[pos]
        n = text[pos + 1] if pos + 1 < len(text) else ""
        if in_string:
            out.append(c)
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == '"':
                in_string = False
            pos += 1
        elif c == '"':
            in_string = True
            out.append(c)
            pos += 1
        elif c == "/" and n == "/":
            pos += 2
            while pos < len(text) and text[pos] not in "\r\n":
                pos += 1
        elif c == "/" and n == "*":
            end = text.find("*/", pos + 2)
            if end < 0:
                raise ValueError("Comentario JSONC sin cerrar")
            pos = end + 2
        else:
            out.append(c)
            pos += 1

    clean = "".join(out)
    # Eliminar comas finales únicamente fuera de cadenas JSON.
    cleaned = []
    pos, in_string, escaped = 0, False, False
    while pos < len(clean):
        c = clean[pos]
        if in_string:
            cleaned.append(c)
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == '"':
                in_string = False
        elif c == '"':
            in_string = True
            cleaned.append(c)
        elif c == ",":
            nxt = pos + 1
            while nxt < len(clean) and clean[nxt].isspace():
                nxt += 1
            if nxt >= len(clean) or clean[nxt] not in "}]":
                cleaned.append(c)
        else:
            cleaned.append(c)
        pos += 1
    result = json.loads("".join(cleaned))
    if not isinstance(result, dict):
        raise ValueError("El archivo debe ser un objeto JSONC")
    return result


def free_only(models: list[str]) -> bool:
    return (
        isinstance(models, list)
        and bool(models)
        and all(isinstance(x, str) and x in SAFE_FALLBACK for x in models)
    )


def migrate(source: dict) -> dict:
    obj = copy.deepcopy(source)
    commands = obj.get("commands")
    if not isinstance(commands, dict) or not isinstance(commands.get(NEW_NAME), dict):
        raise ValueError("No existe el comando /gratis-auto; no se realizan cambios")
    cmd = commands[NEW_NAME]
    current = cmd.get("agent")
    if current not in (OLD_NAME, NEW_NAME):
        raise ValueError(f"Agente de /gratis-auto inesperado: {current!r}")
    if cmd.get("model") != PRIMARY:
        raise ValueError("El modelo inicial de /gratis-auto no es el gratuito esperado")

    # OpenCode 2.x en esta instalación usa 'agent', pero se acepta el esquema
    # anterior 'agents' si contiene la definición buscada.
    candidate_keys = [key for key in ("agent", "agents") if isinstance(obj.get(key), dict) and (OLD_NAME in obj[key] or NEW_NAME in obj[key])]
    if len(candidate_keys) != 1:
        raise ValueError("No se identifica de forma unívoca el bloque del agente. Comprueba agent/agents")
    agents = obj[candidate_keys[0]]
    if OLD_NAME in agents and NEW_NAME in agents:
        raise ValueError("Ya existen ambos agentes; no se sobrescribirá ninguno")
    agent = agents.get(OLD_NAME, agents.get(NEW_NAME))
    if not isinstance(agent, dict) or agent.get("model") != PRIMARY:
        raise ValueError("El agente base no utiliza el modelo gratuito esperado")
    current_fallback = agent.get("fallback_models", SAFE_FALLBACK)
    if not free_only(current_fallback):
        raise ValueError("Fallback ausente, vacío o contiene modelos no autorizados")

    # No eliminamos permisos adicionales específicos de seguridad. Solo se
    # reemplaza el bloqueo global de edición del selector y se prohíbe delegar.
    perms = agent.get("permissions", [])
    if not isinstance(perms, list) or any(not isinstance(p, dict) for p in perms):
        raise ValueError("Permisos del agente en un formato no previsto")
    retained = []
    for p in perms:
        action = p.get("action")
        if action == "subagent":
            continue
        if action == "edit" and p.get("resource") == "*" and p.get("effect") == "deny":
            continue
        retained.append(p)
    retained.append({"action": "subagent", "resource": "*", "effect": "deny"})

    new_agent = copy.deepcopy(agent)
    new_agent.update({
        "description": "Desarrolla directamente con modelos gratuitos y respaldo automático; sin subagentes.",
        "mode": "primary",
        "model": PRIMARY,
        "fallback_models": list(current_fallback),
        "permissions": retained,
    })
    agents.pop(OLD_NAME, None)
    agents[NEW_NAME] = new_agent

    cmd.update({
        "description": "Retoma o ejecuta tareas directamente con respaldo automático entre proveedores gratuitos",
        "agent": NEW_NAME,
        "model": PRIMARY,
        "subagent": False,
        "template": NEW_TEMPLATE,
    })
    return obj


def run(root: pathlib.Path, apply: bool = False) -> str:
    path = root / "opencode.jsonc"
    before = path.read_text(encoding="utf-8")
    parsed = parse_jsonc(before)
    changed = migrate(parsed)
    if parsed == changed:
        return "YA ACTUALIZADO: /gratis-auto es directo. No se ha modificado nada."
    if not apply:
        return (
            "SIMULACIÓN OK. /gratis-auto pasará a ejecutar directamente, sin subagentes, "
            "con fallback: " + " → ".join([PRIMARY, *SAFE_FALLBACK]) + ". "
            "No se ha modificado ningún archivo."
        )

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backups = root / ".ai" / "backups"
    backups.mkdir(parents=True, exist_ok=True)
    backup = backups / f"opencode.jsonc.antes-gratis-auto-directo.{stamp}.bak"
    if backup.exists():
        raise FileExistsError(f"Copia de seguridad existente: {backup}")
    shutil.copy2(path, backup)
    encoded = json.dumps(changed, ensure_ascii=False, indent=2) + "\n"
    if parse_jsonc(encoded) != changed:
        raise ValueError("Falló la validación de salida. No se modifica la configuración")
    fd, tmpname = tempfile.mkstemp(prefix=".opencode-gratis-auto-", suffix=".jsonc", dir=root)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(encoded)
        os.replace(tmpname, path)
    finally:
        pathlib.Path(tmpname).unlink(missing_ok=True)
    return f"ACTUALIZADO: {path}. Backup: {backup}. Reinicia OpenCode para utilizar /gratis-auto."


def main() -> int:
    parser = argparse.ArgumentParser(description="Elimina la delegación obligatoria de /gratis-auto")
    parser.add_argument("--root", type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[2])
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        print(run(args.root.resolve(), args.apply))
        return 0
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"NO SE HA APLICADO: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
