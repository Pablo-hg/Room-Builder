# Room Builder — Respaldo cloud gratuito v2 (sin modelos locales)

Solo cuando Codex esté sin cuota y el usuario decida seguir con el respaldo.
No intercepta sesiones interactivas ni cambia automáticamente desde Codex.
El ejecutor de terminal usa `opencode run` con modelos de una lista cerrada.

## 1. Instalación o actualización

En la raíz de Room-Builder, haz una copia de seguridad de los archivos antiguos si los tienes:

```bash
mkdir -p /tmp/room-builder-free-chain-backup
cp -n scripts/ai/free_chain.py scripts/ai/free_chain.json /tmp/room-builder-free-chain-backup/ 2>/dev/null || true
```

Descomprime el ZIP en la raíz. Si usas `unzip -o`, reemplazarás **solo** los ficheros `scripts/ai/free_chain*`, sus tests y este documento. Verifica que no tengas cambios propios en esos archivos antes de sobrescribir.

## 2. Modelos permitidos en la v2

1. `opencode/deepseek-v4.1-flash-free` — OpenCode Free
2. `google/gemma-4-31b-it` — Google AI Studio Free
3. `groq/openai/gpt-oss-120b` — Groq (a confirmar en la cuenta)
4. `openrouter/openrouter/free` — OpenRouter router de modelos Free

Se habilita por defecto solo OpenCode Free. Los demás están en `enabled: false`.
**Groq**: confirmar el identificador real antes de habilitarlo; puede ser distinto del disponible en tu plan.

## 3. Comprobar sin gastar tokens

```bash
python3 -m unittest scripts.ai.test_free_chain
opencode auth list
opencode models google
opencode models groq
opencode models openrouter
python3 scripts/ai/free_chain.py --list
```

Revisa los IDs de los modelos y, sobre todo, en cada portal confirma **cuenta Free, facturación desactivada**, y que el modelo es gratis para esa cuenta. Un modelo visible en OpenCode no implica ser gratuito.

## 4. Activar las rutas

Edita `scripts/ai/free_chain.json` y cambia `enabled: false` a `true` **solo** en las rutas confirmadas. Las autorizadas por defecto son OpenCode, Google Gemma 4 31B, Groq GPT OSS 120B y OpenRouter Free Router. El script rechaza identificadores no permitidos.

```bash
python3 scripts/ai/free_chain.py --check-models
python3 scripts/ai/free_chain.py --dry-run
```

`--check-models` verifica la presencia de los IDs en el catálogo del CLI sin invocar modelos de IA ni consumir mensajes. No garantiza disponibilidad o gratuidad efectiva de la cuenta.

## 5. Primera prueba segura

```bash
python3 scripts/ai/free_chain.py 'Responde únicamente OK. No ejecutes comandos ni modifiques archivos.'
```

Si el proveedor anterior devuelve error de cuota reconocido, intenta el siguiente habilitado. Si ejecutas el comando cuando un proveedor tiene cuota, se detendrá en ese proveedor al completar la petición. Para probar un proveedor concreto sin gastar en otros, puedes seleccionar manualmente su ID mediante `opencode run --model modelo 'Responde OK'`.

## 6. Retomar el trabajo al acabarse Codex

```bash
python3 scripts/ai/free_chain.py 'Lee .ai/CODEX_HANDOFF.md y continúa solo la tarea pendiente. Conserva los cambios existentes.'
```

Si ya habías utilizado OpenCode y tienes el ID de la sesión, usa `--session ses_...`.

**Importante**: el fallback automático se aplica **solo a este ejecutor desde terminal**, y no a `/gratis-auto` en la TUI. Cuando una tarea falla parcialmente, el nuevo proveedor revisa estado Git antes de actuar; una ejecución no equivale a una transacción atómica. Los errores desconocidos detienen la cadena.

No usar proveedores con facturación habilitada ni incluir secretos en prompts, commits o archivos de configuración. La cuota Free no equivale a uso ilimitado y algunas cuentas gratuitas permiten emplear las interacciones para mejorar productos del proveedor.
