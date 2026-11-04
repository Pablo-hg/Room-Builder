# Auditoría del inventario Markdown — 04/11/2026

**Objetivo:** eliminar contradicciones de alcance sin borrar documentación útil ni historiales. Esta auditoría es de **documentos y planificación**, no implica que se hayan ejecutado tests nuevos ni implementado las funciones aprobadas.

**Reorganización posterior del mismo día:** las issues #55–#61, creadas solo como contenedores, quedaron cerradas por redundantes; las 24 tareas reales siguen abiertas y ordenadas con **Milestones nativos F0–F6**. Las etiquetas redundantes `fase:*` y `hito:*` se eliminaron; no se ha añadido ninguna cabecera artificial a las tareas. **Los siete hitos están creados por el propietario y las 24 issues están asignadas y verificadas.** Ver el mapa real en [MVP_MASTER_PLAN.md](MVP_MASTER_PLAN.md). La auditoría es documental y no sustituye pruebas.

## Jerarquía de fuentes (si hay discrepancias)
1. Issue [épica #23](https://github.com/Pablo-hg/Room-Builder/issues/23) + [MVP_MASTER_PLAN](MVP_MASTER_PLAN.md): alcance comprometido, etiquetas y secuencia; [MVP_SCOPE](MVP_SCOPE.md) define criterios de aceptación.
2. [DECISION_LOG](DECISION_LOG.md): decisiones del propietario y alcance aprobado.
3. [HOUSE_VISION](HOUSE_VISION.md), [PRODUCT_VISION](PRODUCT_VISION.md), [UX_AND_CAMERAS](UX_AND_CAMERAS.md), [OBJECTS_AND_ASSETS](OBJECTS_AND_ASSETS.md), [DATA_AND_FORMATS](DATA_AND_FORMATS.md): contratos conceptuales y de producto.
4. [ARCHITECTURE_AND_QUALITY](ARCHITECTURE_AND_QUALITY.md) y [REFERENCE_BENCHMARK](REFERENCE_BENCHMARK.md): pautas técnicas y referencias, no tareas por sí solas.
5. Documentos de progreso, informes R0–R5 y roadmap de prompts v0.2: **históricos**, NO aplicarlos literalmente si contradicen decisiones posteriores.

## Inventario y tratamiento
| Documento(s) | Clasificación | Acción |
| --- | --- | --- |
| `README.md`, `AGENTS.md`, `docs/README.md` | Entrada operativa | Apuntar al nuevo MVP, gate #54 y docs vigentes |
| `docs/MVP_MASTER_PLAN.md` | **Canónico: ejecución** | Tabla única F0–F6 con etiquetas `orden` y dependencias |
| `docs/MVP_SCOPE.md` | **Canónico: producto** | Distinguir v0.2 checkpoint de MVP final de vivienda |
| `docs/LOCAL_MVP_BACKLOG.md` | Índice de checkpoint | Limitarlo a #24–#34, redirigir al plan maestro; no plan global duplicado |
| `docs/HOUSE_VISION.md` | Visión **incluida en MVP** | Reflejar habitaciones, plantas, cotas y POV comprometidos |
| `docs/PRODUCT_VISION.md`, `docs/FUTURE_ROADMAP.md` | Visión/futuro | No presentar casas o los siete módulos aprobados como ideas fuera del MVP |
| `docs/FUTURE_IMPROVEMENTS.md` | **Canónico: ideas post-release** | Propuestas no aprobadas y referencias, sin reabrir issues |
| `docs/DECISION_LOG.md` | Registro acumulativo | Añadir decisiones actuales, no borrar decisiones históricas superadas |
| `docs/UX_AND_CAMERAS.md`, `docs/OBJECTS_AND_ASSETS.md` | Guías de funcionalidad | Diferenciar lo que existe de lo que se implementará con #35–#47 |
| `docs/DATA_AND_FORMATS.md`, `docs/ARCHITECTURE_AND_QUALITY.md` | Contratos + antecedentes | Corregir cabecera de estado y advertir de fragmentos históricos |
| `docs/REFERENCE_BENCHMARK.md`, `VISUAL_STYLE_GUIDE.md` | Benchmark y estética | Referencias no sustituyen decisiones ni autorizan clonar |
| `docs/CONFIGURATION_AUDIT.md`, `docs/MODELS.md`, `docs/MODEL_ROUTING.md`, `docs/AGENT_EFFICIENCY.md` | Configuración/agentes | Mantener vigentes; no modificar modelos/ruteo sin instrucción expresa |
| `docs/REFACTOR_PLAN.md`, `docs/REFACTOR_AUDIT.md`, `docs/R5_PLAN.md` | Historial técnico | Conservar, marcar como anterior al nuevo plan; no ejecutar «R5 pendiente» |
| `docs/progress/R3_PROGRESS.md`, `R4_PROGRESS.md`, `R5_PROGRESS.md` | Historial verificable | **No reescribir resultados**, son evidencias a fecha |
| `docs/roadmaps/v0.2/ROADMAP_Y_PROMPTS_V0_2.md` | Plan histórico de prompts | Conservar con aviso: A/B retirado, casas incluidas ahora en MVP final |
| `docs/archive/*` | Archivo de propuestas | Conservar por trazabilidad; no cuentan como tareas |
| `ROOM_BUILDER_WORKSHOP_INFORME_MAESTRO_2026-11-03.md`, `GENERADOR_OBJETOS.md` | Futuro explícito | No reabrir #9–#18 ni activar IA por error |
| `INSTALACION.md` | Instalación | Vigente; comprobar comandos al preparar RC #54 |

## Decisiones de limpieza documental
- Mantener `LOCAL_MVP_BACKLOG` como índice corto del checkpoint, sin una segunda lista global divergente.
- No borrar informes R3/R4/R5 ni el antiguo roadmap E0–E12: contienen historia de migración y validación importante.
- No renombrar versiones ni afirmar que pruebas E2E o UI avanzadas se ejecutaron por el mero hecho de actualizar Markdown.
- No editar automáticamente configuraciones `.codex`, `.opencode`, `.agents` ni generar issues para funcionalidades futuras no aprobadas.

**Pendiente en ejecución real:** desarrollar y probar las issues del MVP; el estado de producto aún no es «publicable» solo por este cambio documental.
