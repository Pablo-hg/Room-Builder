# Guía de documentación de Room Builder

**Actualizado el 04/11/2026.** R5 está integrada en `main`, pero **ni el checkpoint v0.2 ni el MVP completo están certificados**. El objetivo actual de publicación incluye **casa con plantas + siete nuevas funcionalidades confirmadas**, no solo una habitación.

## Entrada obligatoria para ejecutar tareas
| Orden | Documento | Para qué sirve |
| --- | --- | --- |
| 1 | [MVP_MASTER_PLAN.md](MVP_MASTER_PLAN.md) | **Fuente única de orden, dependencias, fases/etiquetas y gate final** (24 tareas de ejecución + épica #23; contenedores #55–#61 archivados; siete hitos nativos F0–F6 creados y asignados) |
| 2 | [MVP_SCOPE.md](MVP_SCOPE.md) | Alcance y criterios de publicación del **MVP completo**, con v0.2 como checkpoint |
| 3 | [DECISION_LOG.md](DECISION_LOG.md) | Registro de decisiones y precedencias |
| 4 | [HOUSE_VISION.md](HOUSE_VISION.md) | Meta comprometida: vivienda conectada por plantas, plano global y POV |
| 5 | [LOCAL_MVP_BACKLOG.md](LOCAL_MVP_BACKLOG.md) | **Solo** checkpoint v0.2, issues #24–#34 |
| 6 | [PRODUCT_VISION.md](PRODUCT_VISION.md) | Producto, personalidad y usuarios |
| 7 | [UX_AND_CAMERAS.md](UX_AND_CAMERAS.md) | Interacciones, guías, plano, fotos y recorrido |
| 8 | [OBJECTS_AND_ASSETS.md](OBJECTS_AND_ASSETS.md) | Mobiliario, capacidades, materiales y modelado |
| 9 | [DATA_AND_FORMATS.md](DATA_AND_FORMATS.md) | Persistencia y migración v1–v5 / proyecto de vivienda |
| 10 | [ARCHITECTURE_AND_QUALITY.md](ARCHITECTURE_AND_QUALITY.md) | Arquitectura, pruebas, compatibilidad y calidad |
| 11 | [REFERENCE_BENCHMARK.md](REFERENCE_BENCHMARK.md) | Qué estudiar de MakeRoom, Rooms, MyRoomPlanner, floorplan-3d y otros |
| 12 | [../VISUAL_STYLE_GUIDE.md](../VISUAL_STYLE_GUIDE.md) | Estilo cartoon/cozy, no fotorealismo |
| 13 | [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md) | **Ideas NO elegidas**, para después de #54 |
| 14 | [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md) | Resumen de fases posteriores, incluidas Mini/Workshop/IA |
| 15 | [DOCS_AUDIT.md](DOCS_AUDIT.md) | Inventario y clasificación de los Markdown |
| 16 | [CONFIGURATION_AUDIT.md](CONFIGURATION_AUDIT.md) | Carpeta `.agents`, `.codex`, `.opencode`, `.github` y configuración |

## Evidencias históricas — conservar, pero no ejecutar como roadmap vigente
- [REFACTOR_PLAN.md](REFACTOR_PLAN.md), [REFACTOR_AUDIT.md](REFACTOR_AUDIT.md), [R5_PLAN.md](R5_PLAN.md), [progress/R5_PROGRESS.md](progress/R5_PROGRESS.md) y registros R3/R4: evidencias de fases y medidas, no plan para rehacer R5.
- [roadmaps/v0.2/ROADMAP_Y_PROMPTS_V0_2.md](roadmaps/v0.2/ROADMAP_Y_PROMPTS_V0_2.md): prompts y etapas antiguas E0–E12; varias ya cambiaron (retirada A/B, amplitud del MVP final).
- [archive/](archive/): propuestas antiguas de carpetas, nombres y orden de escena; preservadas.
- [MODELS.md](MODELS.md), [MODEL_ROUTING.md](MODEL_ROUTING.md), [AGENT_EFFICIENCY.md](AGENT_EFFICIENCY.md) y [../AGENTS.md](../AGENTS.md): uso de agentes/arquitectura, no funcionalidades activas.
- [../ROOM_BUILDER_WORKSHOP_INFORME_MAESTRO_2026-11-03.md](../ROOM_BUILDER_WORKSHOP_INFORME_MAESTRO_2026-11-03.md) y [../GENERADOR_OBJETOS.md](../GENERADOR_OBJETOS.md): proyectos futuros sin issues de ejecución abiertas.

## Reglas de lectura y actualización
- **Aprobado ≠ implementado ≠ validado.** Una issue abierta representa compromiso, no entrega.
- El código determina lo que está implementado; el log y decisiones más recientes prevalecen sobre planes anteriores; no declarar pruebas nuevas si no se ejecutaron.
- Cada PR modifica tests, migraciones y la documentación pertinente. No reescribir logs históricos ni borrar fixtures legacy.
- La **única gate de publicación final** es [#54](https://github.com/Pablo-hg/Room-Builder/issues/54), y necesita autorización humana posterior.
