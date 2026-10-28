# Documentación del producto Room Builder — índice

**Estado:** base documental de trabajo · 26/10/2026. Revisión conceptual; no certifica que las funciones estén implementadas ni probadas.

Room Builder es una aplicación web independiente, de aspecto de juego, para recrear una habitación real y probar otras distribuciones. A largo plazo podrá unir habitaciones hasta formar viviendas. La integración en el Laboratorio de Pablo Web 2.0 sería una modalidad reducida de una habitación, no la aplicación entera.

## Leer por orden
| Documento | Propósito |
| --- | --- |
| [PRODUCT_VISION.md](PRODUCT_VISION.md) | Identidad, usuarios, visión, referencias y límites |
| [MVP_SCOPE.md](MVP_SCOPE.md) | Qué significa MVP, prioridades, casos de aceptación |
| [../VISUAL_STYLE_GUIDE.md](../VISUAL_STYLE_GUIDE.md) | Regla visual canónica, siluetas, paleta y coherencia 3D/iconos |
| [UX_AND_CAMERAS.md](UX_AND_CAMERAS.md) | Interfaz, edición, tres vistas esenciales y accesibilidad |
| [OBJECTS_AND_ASSETS.md](OBJECTS_AND_ASSETS.md) | Taxonomía, capacidades, tamaño, representación y assets |
| [DATA_AND_FORMATS.md](DATA_AND_FORMATS.md) | Unidades, persistencia, exportación y futuro multihabitación |
| [ARCHITECTURE_AND_QUALITY.md](ARCHITECTURE_AND_QUALITY.md) | Tecnologías presentes, principios y calidad |
| [REFACTOR_PLAN.md](REFACTOR_PLAN.md) | Reorganización del código en una fase posterior |
| [DECISION_LOG.md](DECISION_LOG.md) | Confirmado frente a propuesta o pendiente |
| [../GENERADOR_OBJETOS.md](../GENERADOR_OBJETOS.md) | Experimento separado: objetos parametrizados por texto |
| [../AGENTS.md](../AGENTS.md) | Instrucciones que Codex debe revisar en cada tarea |
| [AGENT_EFFICIENCY.md](AGENT_EFFICIENCY.md) | Uso mínimo de tokens, modelos gratuitos y continuidad de tareas |
| [MODEL_ROUTING.md](MODEL_ROUTING.md) | Selección de Luna/Terra/Sol, aviso y automatización según cliente |

## Significado de los estados
- **CONFIRMADO:** preferencia o regla expresamente acordada para Room Builder.
- **PROPUESTO:** solución recomendada, aún revisable y no autorizada para implementación automática.
- **EXPERIMENTAL:** línea de investigación o prototipo sin compromiso de entrega.
- **PENDIENTE:** falta una decisión concreta o una validación.
- **DESCARTADO:** no se desarrollará salvo decisión posterior expresa.

Las guías no suponen aprobación de la V1 pública de Pablo Web 2.0. El proyecto independiente y el portfolio tienen decisiones y calendarios distintos.

## Informes de progreso

Se conserva un único informe Markdown por fase R en `docs/progress/`: [informe de R3](progress/R3_PROGRESS.md). Sus subpartes y continuaciones amplían ese mismo archivo, manteniendo contexto, resultados y límites históricos. No se borra al cerrar la fase. Las mediciones JSON se conservan como evidencias enlazadas desde el informe.

## Mantenimiento documental
- Cambiar una decisión implica actualizar DECISION_LOG y los documentos afectados en la misma propuesta.
- Si una regla visual cambia, modificar VISUAL_STYLE_GUIDE y comprobar modelos e iconos existentes.
- Si cambia el contrato persistido, actualizar DATA_AND_FORMATS, migración, fixtures/pruebas y README.
- Documentar versión, alcance y estado real en PRs; no convertir una idea futura en requisito MVP.
- Mantener la documentación en español de España y enlaces relativos válidos.
