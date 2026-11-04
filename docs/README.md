# Room Builder — documentación canónica

**Actualización:** 04/11/2026 · **Base consultada:** `main` tras PR #22 (R5 integrada). **Estado del producto:** editor local funcional con trabajo pendiente; **NO** declarar v0.2 o MVP terminados.

Room Builder es una web independiente. Primero debe permitir diseñar y guardar una habitación útil; posteriormente se valora integrar una versión Mini en Pablo Web 2.0 y, más adelante, evolucionar a casas y Workshop.

## Leer para ejecutar trabajo
| Prioridad | Documento | Uso |
| --- | --- | --- |
| 1 | [MVP_SCOPE.md](MVP_SCOPE.md) | Contrato del MVP de una habitación, entregado vs pendiente y pruebas |
| 2 | [LOCAL_MVP_BACKLOG.md](LOCAL_MVP_BACKLOG.md) | Orden de issues #23–#33 y dependencias |
| 3 | [DECISION_LOG.md](DECISION_LOG.md) | Decisiones y precedencia; **RB-040 reemplaza A/B en el MVP** |
| 4 | [PRODUCT_VISION.md](PRODUCT_VISION.md) | Promesa y usuarios |
| 5 | [REFERENCE_BENCHMARK.md](REFERENCE_BENCHMARK.md) | Qué aprender de Rooms, MakeRoom, MyRoomPlanner y Figma |
| 6 | [../VISUAL_STYLE_GUIDE.md](../VISUAL_STYLE_GUIDE.md) | Identidad visual obligatoria |
| 7 | [UX_AND_CAMERAS.md](UX_AND_CAMERAS.md) | Interacción, controles y vistas |
| 8 | [OBJECTS_AND_ASSETS.md](OBJECTS_AND_ASSETS.md) | Catálogo, anclajes y consistencia |
| 9 | [DATA_AND_FORMATS.md](DATA_AND_FORMATS.md) | Contratos, v1–v5, JSON, migraciones |
| 10 | [ARCHITECTURE_AND_QUALITY.md](ARCHITECTURE_AND_QUALITY.md) | Arquitectura y calidad |
| 11 | [CONFIGURATION_AUDIT.md](CONFIGURATION_AUDIT.md) | Carpeta `.agents`, `.codex`, `.opencode`, `.github` y residuos |
| 12 | [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md) | Mini, casas, IA, Workshop, negocio: **futuro, no issues ahora** |

## Histórico, no instrucciones para ejecutar a ciegas
- [REFACTOR_PLAN.md](REFACTOR_PLAN.md), [R5_PLAN.md](R5_PLAN.md), [informe R5](progress/R5_PROGRESS.md), [informes R3/R4](progress/) y [auditoría original](REFACTOR_AUDIT.md): trazabilidad de R0–R5. Sus estados locales pueden ser anteriores al merge.
- [Plan v0.2 con prompts E0–E12](roadmaps/v0.2/ROADMAP_Y_PROMPTS_V0_2.md): fotografía del 03/11 con requisitos superados por R5 o **descartados** (A/B). Aplicar el backlog vigente y rehacer E0 antes de usar prompts históricos.
- [Propuestas de formatos ya integrados](archive/): documentos históricos de nombres, carpetas y orden de escena, movidos para reducir ruido.
- [Modelos](MODELS.md), [ruteo](MODEL_ROUTING.md), [eficiencia](AGENT_EFFICIENCY.md), [AGENTS.md](../AGENTS.md): configuración y orientación del agente, independientes de las decisiones del producto.
- [Informe original Workshop (22 decisiones)](../ROOM_BUILDER_WORKSHOP_INFORME_MAESTRO_2026-11-03.md) y [generador de objetos por texto](../GENERADOR_OBJETOS.md): conservar, **no desarrollar** para el MVP.

## Estados y reglas
- **CONFIRMADO** = decisión de producto; **IMPLEMENTADO** = presente en código; **VALIDADO** = existe prueba con resultado; **PENDIENTE** = falta desarrollo, prueba o decisión. Son conceptos distintos.
- La última decisión expresa prevalece sobre propuestas antiguas; documentar fecha y fuente. No ocultar fallos E2E con afirmaciones de «MVP listo».
- Al alterar un contrato: cambiar tests, fixtures, migraciones, documentación y guía de uso en el mismo PR.
- Consultar solo archivos pertinentes para evitar gasto innecesario de tokens. No borrar reportes históricos que expliquen migraciones o pruebas.
