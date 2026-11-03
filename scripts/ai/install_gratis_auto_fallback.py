#!/usr/bin/env python3
"""Safely add OpenCode free-only automatic fallback to existing /gratis-auto.

Only modifies project opencode.jsonc and .opencode/opencode-fallback.jsonc
when --apply is explicitly passed. All provider/model strings are allowlisted.
Third-party plugin is NOT installed by this program; OpenCode downloads it
on startup if configured. Review the plugin trust implications before use.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import re
import shutil
import sys
from pathlib import Path

PLUGIN = 'opencode-runtime-fallback'
PRIMARIES = {
    'selector-gratuito': 'opencode/glm-5.3-flash-free',
    'rb-gratis-rapido': 'opencode/glm-5.3-flash-free',
    'rb-gratis-desarrollo': 'opencode/deepseek-v4.1-flash-free',
    'rb-gratis-alternativa': 'opencode/mimo-v2.6-flash-free',
    'rb-gratis-profundo': 'opencode/nemotron-3-ultra-free',
    'rb-gratis-visual': 'opencode/nemotron-3.5-super-vl-free',
}
# Fixed free-only models confirmed present in this user's opencode models listing.
GENERAL = ['google/gemma-4-31b-it', 'openrouter/openrouter/free']
VISUAL = ['openrouter/nvidia/nemotron-3.5-super-vl:free', 'google/gemma-4-31b-it']
FALLBACKS = {name: (VISUAL if name == 'rb-gratis-visual' else GENERAL) for name in PRIMARIES}
SAFE = set(PRIMARIES.values()) | set(GENERAL) | set(VISUAL)
PLUGIN_CONFIG = {
    'enabled': True,
    'fallback_models': [], # Never apply globally: Build/Codex should not be affected
    'retry_on_errors': [429, 500, 502, 503, 504],
    'retryable_error_patterns': [
        'free.tier.input.token.count',
        'quota.*exceeded',
        'free limit reached',
        'used today.*free messages',
        'request too large for model.*tokens per minute',
    ],
    'max_fallback_attempts': 2, # Google + OpenRouter; no infinite retry
    'cooldown_seconds': 300,
    'timeout_seconds': 0, # Don't abort slower free models and duplicate work
    'notify_on_fallback': True,
}


def jsonc_load(text: str):
    """Strip JS comments and trailing commas, respecting quoted strings.

    We only accept top-level JSON objects and do not eval JS expressions.
    """
    out = []
    i = 0
    string = False
    escaped = False
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ''
        if string:
            out.append(ch)
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == '"':
                string = False
            i += 1
        elif ch == '"':
            string = True; out.append(ch); i += 1
        elif ch == '/' and nxt == '/':
            i += 2
            while i < len(text) and text[i] not in '\r\n':
                i += 1
        elif ch == '/' and nxt == '*':
            end = text.find('*/', i + 2)
            if end == -1:
                raise ValueError('Comentario /* sin cerrar')
            i = end + 2
        else:
            out.append(ch); i += 1
    # Delete trailing commas outside strings by scanning a backwards-lookahead.
    src = ''.join(out)
    out = []
    i = 0
    string = False; escaped = False
    while i < len(src):
        ch = src[i]
        if string:
            out.append(ch)
            if escaped: escaped = False
            elif ch == '\\': escaped = True
            elif ch == '"': string = False
        elif ch == '"':
            string = True; out.append(ch)
        elif ch == ',':
            j = i + 1
            while j < len(src) and src[j].isspace(): j += 1
            if j < len(src) and src[j] in '}]':
                i += 1
                continue
            out.append(ch)
        else:
            out.append(ch)
        i += 1
    data = json.loads(''.join(out))
    if not isinstance(data, dict):
        raise ValueError('La configuración debe ser un objeto JSONC')
    return data


def update_config(source: dict) -> dict:
    data = copy.deepcopy(source)
    cmds = data.get('commands')
    agents = data.get('agents')
    if not isinstance(cmds, dict) or not isinstance(agents, dict):
        raise ValueError('No encuentro commands/agents de OpenCode v2; no modificaré la configuración.')
    command = cmds.get('gratis-auto')
    if not isinstance(command, dict) or command.get('agent') != 'selector-gratuito':
        raise ValueError('No encuentro /gratis-auto con selector-gratuito. No sobrescribiré tu configuración.')
    # Respect custom commands, models and prompts; only add free-only fallbacks.
    for name, expected in PRIMARIES.items():
        entry = agents.get(name)
        if not isinstance(entry, dict):
            raise ValueError(f'Falta agente {name}; no cambio nada')
        actual = entry.get('model')
        if actual != expected:
            raise ValueError(f'Modelo inesperado en {name}: {actual}. Para por seguridad; revisa tu config.')
        if entry.get('fallback_models') not in (None, FALLBACKS[name]):
            raise ValueError(f'{name} ya tiene fallback personalizado; no voy a sobrescribirlo')
        entry['fallback_models'] = list(FALLBACKS[name])
    if command.get('model') != PRIMARIES['selector-gratuito']:
        raise ValueError('El /gratis-auto usa un modelo diferente al gratuito validado.')
    existing = data.get('plugin', [])
    if not isinstance(existing, list) or any(not isinstance(x, str) for x in existing):
        raise ValueError('Campo plugin inesperado; no modificaré el archivo')
    if not any(x.split('@')[0] == PLUGIN for x in existing):
        existing.append(PLUGIN)
    data['plugin'] = existing
    check = set()
    for name in PRIMARIES:
        check.add(data['agents'][name]['model'])
        check.update(data['agents'][name]['fallback_models'])
    if not check.issubset(SAFE):
        raise ValueError('Se detectó un modelo no autorizado en la cadena gratuita')
    return data


def run(root: Path, apply: bool = False) -> str:
    config = root / 'opencode.jsonc'
    plugin_file = root / '.opencode' / 'opencode-fallback.jsonc'
    if not config.is_file():
        raise ValueError('No existe opencode.jsonc en la ruta indicada')
    current_text = config.read_text(encoding='utf-8')
    current = jsonc_load(current_text)
    result = update_config(current)
    if plugin_file.exists():
        old_plugin = jsonc_load(plugin_file.read_text(encoding='utf-8'))
        if old_plugin != PLUGIN_CONFIG:
            raise ValueError('Ya existe .opencode/opencode-fallback.jsonc con otra configuración. No sobrescribo.')
    if not apply:
        return 'SIMULACIÓN OK. /gratis-auto y los seis agentes gratuitos recibirán solo fallbacks gratuitos. Nada modificado.'
    timestamp = dt.datetime.now().strftime('%Y%m%d-%H%M%S')
    backups = root / '.ai' / 'backups'
    backups.mkdir(parents=True, exist_ok=True)
    backup = backups / ('opencode.jsonc.backup-' + timestamp)
    shutil.copy2(config, backup)
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    # Validate again before replacing current configuration.
    check_config = jsonc_load(encoded)
    assert check_config == result
    tmp = config.with_name('opencode.jsonc.tmp-free-fallback')
    try:
        tmp.write_text(encoded, encoding='utf-8')
        tmp.replace(config)
        plugin_file.parent.mkdir(parents=True, exist_ok=True)
        if not plugin_file.exists():
            plugin_file.write_text(json.dumps(PLUGIN_CONFIG, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except Exception:
        shutil.copy2(backup, config)
        tmp.unlink(missing_ok=True)
        raise
    return (f'Configuración aplicada. Copia original: {backup}. '
            f'Plugin: {PLUGIN}. No se ha instalado aún; OpenCode lo cargará al reiniciar.')


def main():
    parser = argparse.ArgumentParser(description='Configura respaldo gratuito solo para /gratis-auto en OpenCode v2')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2], help='Raíz Room Builder')
    parser.add_argument('--apply', action='store_true', help='Aplicar cambios (por defecto simulación)')
    args = parser.parse_args()
    try:
        print(run(args.root.resolve(), args.apply))
        return 0
    except (OSError, ValueError) as e:
        print('NO SE HA APLICADO: ' + str(e), file=sys.stderr)
        return 2

if __name__ == '__main__':
    raise SystemExit(main())
