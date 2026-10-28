# Room Builder — Monitor de cuota Codex y traspaso a OpenCode

**Estado: EXPERIMENTAL.** Preparación con *hooks* y controles simulados; pruebas locales aprobadas. No se ha probado con la cuenta/versión concreta del usuario ni con una cuota real cercana al límite. Guardar estos archivos en Git no confirma que la integración esté operativa.

El comando `/gratis-auto` de `opencode.jsonc` también es **EXPERIMENTAL**: su selector y delegación requieren validación en una instalación compatible de OpenCode. No se ha verificado aquí su ejecución real ni la disponibilidad de los modelos configurados. No usarlo como garantía de continuidad automática.

## Requisitos

- Ubuntu/Linux, Python 3 (sin paquetes adicionales), Git.
- CLI oficial Codex que responda a `codex app-server`. La extensión de VS Code por sí sola no garantiza que el ejecutable esté en el `PATH`.
- Sesión de Codex **iniciada con ChatGPT**. No configurar API facturable.
- Repositorio confiable para que Codex cargue los hooks de `.codex/hooks.json`.

## Instalar

1. Situarse en la **raíz** de Room Builder.
2. Copiar `.codex/hooks.json` y `scripts/ai/codex_quota_handoff.py` respetando las rutas de este paquete. **Si ya tienes hooks**, fusiona manualmente las entradas: no sobrescribas tu archivo.
3. Comprobar: `python3 --version`, `codex --version`, `codex app-server --help`. En `codex features list`, comprobar que `hooks` está activo (si no, `codex features enable hooks` o `[features] hooks = true` en la configuración compatible).
4. Si falta la CLI oficial Codex: `npm install -g @openai/codex`. Si solicita autenticación, usar «Sign in with ChatGPT».
5. Ejecutar `python3 -m unittest scripts/ai/test_codex_quota_handoff.py` para simular 90 % y 96 % de cuota usada.
6. Antes de confiar en el control del 5 %, ejecutar `python3 scripts/ai/codex_quota_handoff.py --check-quota` para verificar que el app-server devuelve porcentajes reales de tu cuenta. Si no puede leerlos, NO considerar operativo el bloqueo automático.
7. Ejecutar **una vez** `python3 scripts/ai/codex_quota_handoff.py --manual` para verificar que crea `.ai/CODEX_HANDOFF.md` (con contenido limitado cuando aún no hay hooks).
8. Reiniciar una sesión de Codex en VS Code desde el repositorio confiable. En la CLI interactiva `codex` usar `/hooks` para revisar y **confiar** en estos hooks si lo solicita; el archivo no se ejecuta sin esa confianza. Probar una petición pequeña y comprobar si se actualiza `.ai/CODEX_HANDOFF.md`. No necesitas esperar a agotar la cuota.
9. Si la extensión de VS Code no dispara los eventos esperados, la instalación no se puede considerar funcional para ese cliente. No des por activada la parada al 5 % hasta probarla con cuota real disponible.

El script añade `.ai/` a `.git/info/exclude` **solo en tu clon**, para que no se publique el resumen temporal. No modifies `.gitignore` salvo que quieras compartir esa decisión. El script resuelve `info/exclude` incluso si utilizas worktrees; comprueba igualmente `git status --short` antes de publicar.

## Qué hace

- `UserPromptSubmit`: recoge la última petición; consulta la cuota y **bloquea una petición nueva** si detecta un 95 % o más usado en la cuota Codex (primaria o secundaria).
- `PostToolUse`: crea/actualiza el traspaso a partir de Git y, si detecta cuota baja, **avisa** al agente para que finalice en un punto seguro. **No garantiza detener una operación larga instantáneamente**.
- `Stop`: guarda la última respuesta visible y crea un nuevo checkpoint, sin pedir un resumen adicional al modelo.
- Se consulta la cuota como máximo una vez cada 45 segundos por sesión, para reducir gastos de proceso; no se consumen tokens de generación al leer límites.
- Si no se puede consultar la cuota, guarda el traspaso pero **no bloquea Codex basándose en cifras inventadas**.

## Para continuar en OpenCode

En el proyecto y worktree correspondientes:

`/gratis-auto Lee .ai/CODEX_HANDOFF.md, contrástalo con Git y continúa la tarea pendiente. Usa solo modelos gratuitos.`

Si `/gratis-auto` no está configurado, selecciona un modelo gratuito en `/models` y envía: `Lee .ai/CODEX_HANDOFF.md, verifica Git y continúa lo pendiente.`

Al regresar a Codex: usa `/traspaso-codex` en OpenCode (que genera `.ai/TASK_HANDOFF.md`) y pide a Codex revisión del diff + traspaso, sin repetir el trabajo ya comprobado.

## Advertencias

- El 95 % utilizado corresponde al **5 % restante de cuota**, no al contexto de la sesión.
- Los dos porcentajes no se confunden: se examinan `primary.usedPercent` y `secondary.usedPercent` del bucket Codex si el servidor los proporciona.
- La lectura puede no estar disponible temporalmente o corresponder a una cuota distinta de la que usa la extensión. Revisa el porcentaje mostrado en la interfaz.
- El archivo contiene **extractos** de solicitudes y respuestas, además de Git. No es una exportación íntegra ni perfecta de la conversación. Pueden faltar decisiones que Codex nunca haya escrito.
- Contiene texto de la sesión: revisa datos sensibles antes de compartirlo. La ocultación de credenciales es parcial y no garantiza detectar todos los secretos.
- Un hook no puede garantizar detener inmediatamente un turno ya iniciado; el bloqueo firme se aplica al intentar **una nueva petición**.
- No cambia de modelo ni abre OpenCode por sí mismo. `/gratis-auto` sigue siendo una decisión tuya.
- Para desactivar el monitor, elimina o desactiva estas entradas de `.codex/hooks.json` (no borres los hooks de otros programas). Puedes borrar `.ai/CODEX_HANDOFF.md` y `.ai/.codex_handoff_state.json` cuando termines.
