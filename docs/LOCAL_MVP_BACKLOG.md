# Checkpoint v0.2 — backlog de una habitación (históricamente G0–G9)

**Vigente como subconjunto del MVP completo, no como plan global.** La fuente canónica de **todas** las tareas, prioridades, orden y dependencias es [MVP_MASTER_PLAN.md](MVP_MASTER_PLAN.md) y la épica [#23](https://github.com/Pablo-hg/Room-Builder/issues/23).

## Secuencia inicial del producto
| Orden global | Gate histórico | Issue | Resultado |
| ---: | --- | --- | --- |
| 01 | G0 | [#24](https://github.com/Pablo-hg/Room-Builder/issues/24) | Certificar baseline R5, CI y E2E |
| 02 | G0bis | [#34](https://github.com/Pablo-hg/Room-Builder/issues/34) | Auditar/refactorizar lo justificable con tests |
| 03 | G1 | [#25](https://github.com/Pablo-hg/Room-Builder/issues/25) | Persistencia local/JSON robustos |
| 04 | G2 | [#26](https://github.com/Pablo-hg/Room-Builder/issues/26) | Medidas, aperturas, solapes y cotas automáticas de pared |
| 05 | G3 | [#27](https://github.com/Pablo-hg/Room-Builder/issues/27) | Primer uso y jerarquía de controles |
| 06 | G4 | [#28](https://github.com/Pablo-hg/Room-Builder/issues/28) | Selección múltiple, carpetas y operaciones |
| 07 | G5 | [#29](https://github.com/Pablo-hg/Room-Builder/issues/29) | Cámaras existentes, incluido POV fijo |
| 08 | G6 | [#30](https://github.com/Pablo-hg/Room-Builder/issues/30) | Catálogo mínimo e identidad visual |
| 09 | G7 | [#31](https://github.com/Pablo-hg/Room-Builder/issues/31) | Accesibilidad, teclado, táctil |
| 10 | G8 | [#32](https://github.com/Pablo-hg/Room-Builder/issues/32) | Rendimiento, fiabilidad y despliegue estático |
| 11 | G9 | [#33](https://github.com/Pablo-hg/Room-Builder/issues/33) | **Checkpoint E2E v0.2**, no release global |

## Qué sigue después de este checkpoint
F2 (#37, #38, #41): precisión, guías y plantillas. F3 (#39, #40): materiales y fotos. F4 (#51, #35, #52, #53, #45, #36): casa por plantas, trazado y recorrido. F5 (#47): objetos modulares. F6 (#54): **auditoría final y autorización de publicar**.

El número de orden no prohíbe trabajos paralelos sin dependencias compartidas. No fusionar cambios de datos sin tests ni publicar una release definitiva únicamente porque termine #33.

## Convenciones heredadas
- Cada issue se desarrolla en una rama/PR; mantener contratos, pruebas, fixtures y migraciones en el mismo cambio.
- El resultado de E2E/CI debe ser reproducible, no deducido de un informe antiguo.
- No confundir el modelo `ProjectV2` de R4 con casas funcionales; las tareas #51–#53 son necesarias.
