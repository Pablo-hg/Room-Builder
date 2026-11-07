# Auditoría de carpetas ocultas y mantenimiento del repositorio

**Estado:** revisión conservadora de `main` a 04/11/2026; no presume que hooks o fallbacks se hayan ejecutado en una sesión real.

| Ruta | Hallazgo | Acción 04/11 |
| --- | --- | --- |
| `.agents/skills/revisar-traspaso/SKILL.md` | Skill de traspaso OpenCode→Codex. Referencia archivos locales `.ai/*HANDOFF.md` y no debe prometer que existan en remoto | **Mantener**; es flujo voluntario, no función del editor |
| `.codex/config.toml` | Configuración predeterminada de modelo/esfuerzo por repo; puede diferir de una sesión abierta | **Mantener**; no alterar preferencias de modelo sin petición |
| `.codex/hooks.json` | Marcado EXPERIMENTAL; invoca script de cuota. No consta verificación de compatibilidad con versión local de Codex | **Mantener pero no declarar operativo**. Validar triggers/sintaxis/Windows-Linux y fallos antes de automatizar |
| `.opencode/opencode-fallback.jsonc` | Política de reintentos y respaldo gratuito configurada; no acredita transición real de proveedores | **Mantener**, prueba de fallback real pendiente |
| `.opencode/plugins/model-routing/index.ts` | Stub deliberadamente inactivo; no hace enrutamiento de modelo | **Mantener**, no venderlo como función disponible |
| `opencode.jsonc` | Configuración activa de comandos/modelos OpenCode | **Mantener**; separar de backups históricos |
| `opencode.jsonc.backup*` | Dos copias antiguas duplicadas y potencialmente obsoletas, con reglas experimentales | **Eliminar del control de versiones** y añadir patrón a `.gitignore` |
| `.gitignore` | Faltaban temporales de traspaso local, entornos `.env`, backups de OpenCode y nuevas capturas generadas | **Actualizar** sin borrar pruebas históricas versionadas |
| `.github/` | No había plantilla para issues/PR de MVP local | **Añadir plantillas**; workflow CI está planificado en #24 y no se presume verificado |
| `logs/.gitkeep` | Mantiene carpeta de diagnóstico local vacía. Logs reales se ignoran | **Mantener** |
| `output/playwright/r0-baseline/` | Evidencia histórica R0 versionada (incluidas capturas) | **Conservar**; impedir que nuevas capturas se añadan accidentalmente |
| `docs/*_PROPOSAL.md` | Tres propuestas anteriores ya materializadas (nombres, carpetas y orden) | **Mover a `docs/archive/`** sin perder su texto histórico |
| `INSTRUCCIONES.md` | Instrucciones de un ZIP de parche antiguo, no instalación general | **Eliminar**; usar README/INSTALACION y tests del script para el flujo actual |

## Reglas de seguridad
- No introducir tokens, API keys, logs personales ni archivos de handoff sensibles en el repositorio. Los handoffs locales quedan ignorados por defecto.
- El fallback de cuota, el ruteo automático y los hooks son **sistemas auxiliares de desarrollo**, no funcionalidades de Room Builder.
- No instalar dependencias nuevas o sustituir configuraciones de modelo sin validar las versiones locales.
- No borrar `src/domain/projectV2.ts`, migraciones, fixtures v1–v5, capturas R0 ni progresos R3–R5 solo porque parezcan históricos: son compatibilidad y evidencia.
- Esta auditoría es documental y de estructura; faltan ejecución local y smoke test de scripts/hook, que corresponden a una revisión independiente.
