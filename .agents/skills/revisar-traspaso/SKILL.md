---
name: revisar-traspaso
description: Recuperar el contexto de OpenCode con mínimo consumo. Permite revisión completa si se solicita expresamente.
---

# Traspaso OpenCode → Codex

## Modo predeterminado: LIGERO

Objetivo: recuperar contexto con el menor consumo posible.

1. Lee `.ai/TASK_HANDOFF.md`.
2. Consulta solo las reglas relevantes de `AGENTS.md`.
3. Comprueba `git status --short`, `git diff --stat` y los commits relevantes.
4. Identifica qué hizo OpenCode, qué está terminado y qué falta.
5. Usa el SHA base del traspaso, si existe, para detectar cambios ya confirmados.
6. No inspecciones archivos completos ni documentación extensa salvo necesidad.
7. NO ejecutes tests, builds, E2E ni comparaciones visuales.
8. NO modifiques código.
9. Si la tarea ya estaba completada, termina inmediatamente.
10. Responde brevemente: contexto recuperado, estado, posibles riesgos y siguiente paso.

No repitas verificaciones documentadas. No inventes resultados nuevos.

## Modo COMPLETO

Activar únicamente si el usuario añade "completa" o "verifica y corrige".

1. Recupera el contexto siguiendo el modo ligero.
2. Revisa únicamente los cambios atribuibles a OpenCode.
3. Ejecuta tests focalizados según el riesgo y las evidencias disponibles.
4. Ejecuta suites completas o comparaciones visuales solo cuando estén justificadas.
5. Corrige errores reales y verifica las correcciones.
6. Evita rehacer tareas completadas o corregir detalles ajenos al objetivo.
7. Resume brevemente las comprobaciones y correcciones.

## Restricciones generales

- Conserva los cambios locales.
- No hagas commits, merges, push ni publicaciones sin autorización.
- No inicies la siguiente fase del proyecto automáticamente.
- Si falta contexto esencial, explica exactamente qué información falta.
