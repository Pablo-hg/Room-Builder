Instrucciones permanentes para Codex y agentes — Room Builder
1. Inicio de tarea y lectura selectiva
- Antes de modificar código, comprender la petición, comprobar la rama y los cambios locales, e inspeccionar los archivos de código implicados. No sobrescribir trabajo existente.
- No leer toda la documentación al comenzar cada tarea. Consultar únicamente la necesaria según el alcance; ampliar la lectura si aparecen dependencias, riesgos o contradicciones.
- Usar docs/README.md para localizar fuentes y conocer estados cuando sea necesario.
- Documentación por temática:
  - Propósito y alcance: docs/PRODUCT_VISION.md y docs/MVP_SCOPE.md.
  - Interfaz, cámaras y diseño visual: docs/UX_AND_CAMERAS.md y VISUAL_STYLE_GUIDE.md.
  - Objetos, modelos 3D y formatos: docs/OBJECTS_AND_ASSETS.md y docs/DATA_AND_FORMATS.md.
  - Arquitectura y refactorización: docs/ARCHITECTURE_AND_QUALITY.md, docs/REFACTOR_PLAN.md y docs/DECISION_LOG.md.
  - Creador mediante texto: GENERADOR_OBJETOS.md (propuesta; no funcionalidad entregada).
- Consultar docs/DECISION_LOG.md cuando una tarea implique decisiones aprobadas, pendientes o contradictorias. Antes de reorganizar archivos, seguir docs/REFACTOR_PLAN.md.
- La documentación indica intención y decisiones; el código actual determina lo que está implementado. Si no coinciden, señalar la diferencia; no ocultarla.
2. Reglas de producto y desarrollo
- Producto independiente: crear y reorganizar habitaciones reales con facilidad de videojuego; futuro multihabitación. La versión mini del Laboratorio de Pablo Web 2.0 es otro alcance y no modifica el portfolio.
- Priorizar usabilidad y legibilidad sobre realismo, funciones o complejidad técnica. Mantener la estética 3D low-poly estilizada, tipo diorama; no pixel art ni CAD.
- No cambiar por iniciativa propia el alcance MVP, la arquitectura aprobada, las guías visuales, los formatos persistidos ni las decisiones marcadas PENDIENTE. Proponer y documentar primero cualquier cambio de ese tipo.
- Distinguir siempre CONFIRMADO, PROPUESTO, EXPERIMENTAL, PENDIENTE y DESCARTADO. No presentar una propuesta como implementada ni una implementación como validada visualmente.
- Separar datos del mundo, renderizado, controles, cámaras, estado/persistencia y UI. La posición de un objeto nunca debe depender de una vista concreta.
- No incorporar objetos visuales sin integrar catálogo, modelo 3D, icono, medidas, interacción y pruebas correspondientes; respetar la guía visual.
- No romper diseños guardados: versionar cambios de formato, validar entradas y ofrecer migraciones con pruebas cuando proceda. Guardar internamente en metros; interfaz en español de España.
- Mantener la consistencia constructiva: puertas y ventanas pertenecen a paredes, sin solapes ni huecos falsos. Preparar paredes compartidas para el futuro sin improvisar duplicados.
- No introducir IA, cuentas, backend, librerías grandes ni sistemas sociales por simple conveniencia.
- No copiar assets ni código de Rooms.xyz, Room Studio u otros proyectos sin comprobar licencia y atribución.
- Preservar compatibilidad con ratón, pantalla táctil y teclado; accesibilidad textual, movimiento reducido y mensajes claros. Evitar cargas iniciales pesadas.
- Hacer el cambio mínimo coherente con la petición. No mezclar refactorizaciones con nuevas funciones ni modificar archivos ajenos al objetivo sin justificación.
3. Verificación y seguridad del trabajo
- Inspeccionar el código real antes de actuar. Evaluar efectos sobre vistas, dimensiones, selección, persistencia y migraciones cuando sean áreas afectadas.
- Ejecutar primero las pruebas pertinentes para los archivos modificados. Ampliar la validación según alcance y riesgo, utilizando npm test, npm run test:e2e y npm run build cuando corresponda.
- En cambios amplios o antes de integrar, ejecutar las comprobaciones generales aplicables. Si alguna no puede ejecutarse o no corresponde a la tarea, explicarlo en el resumen final.
- No repetir pruebas costosas si no hay cambios relevantes desde una ejecución válida, salvo para comprobar estabilidad o por requisitos de integración.
- No afirmar que una vista ha sido validada visualmente sin haberla comprobado. No ocultar fallos, resultados incompletos ni riesgos conocidos.
- No sobrescribir trabajo ajeno ni borrar cambios locales. No hacer commits no solicitados, merges ni publicaciones sin autorización expresa. Trabajar en la rama indicada y entregar un resumen verificable.
4. Eficiencia de tokens y contexto
- Prioridad: corrección y seguridad > alcance solicitado > verificaciones necesarias > ahorro de tokens > velocidad.
- Buscar primero rutas y símbolos concretos; leer solo fragmentos relevantes. Evitar volcar repositorios, historiales o logs completos sin necesidad.
- Reutilizar decisiones, análisis y pruebas anteriores solo si siguen siendo válidos para la rama y el código actuales.
- Resolver directamente tareas sencillas; elaborar un plan breve para cambios complejos, de varios módulos o con riesgo elevado.
- Evitar análisis reiterativos, explicaciones largas, soluciones sobrediseñadas y agentes paralelos sin beneficio claro.
- Resumir las respuestas con: qué ha cambiado, qué se ha probado, resultado y pendientes.
- Para tareas largas, trabajo con varios agentes o traspasos de contexto, consultar docs/AGENT_EFFICIENCY.md. No cargar ese documento completo por defecto en tareas triviales.
- Si se cambia de agente o proveedor, transmitir un resumen compacto de tarea, rama, archivos, decisiones, pruebas y siguiente paso; el receptor comprobará el estado real antes de continuar.
- Nunca sacrificar funcionalidad, seguridad ni verificaciones necesarias para consumir menos tokens.
5. Política de modelos y proveedores
- Modo predeterminado: Codex, usando openai/gpt-6.1-terra con la suscripción ChatGPT conectada a OpenCode. No implica autorizar gasto adicional en API.
- La clasificación rápido / equilibrado / profundo / crítico sirve para recomendar modelos adecuados, pero no autoriza al agente a cambiar de proveedor o modelo sin una orden explícita o una automatización previamente aprobada.
- Modo gratuito solo bajo petición expresa del usuario: comandos como /gratis, /gratis-alternativa, /gratis-rapido, /gratis-profundo o /gratis-visual, o selección manual de un modelo -free desde /models.
- Los comandos /gratis* ejecutan la petición indicada con su modelo gratuito en la sesión actual. No cambian necesariamente el modelo de los mensajes siguientes; si se desea mantener el modo gratuito para varias peticiones, elegirlo desde /models.
- Si Codex alcanza el límite de uso, no intentar un cambio automático no configurado. Informar de la limitación y continuar en modo gratuito cuando el usuario lo indique; conservar código, cambios locales y contexto de la sesión.
- Dentro del modo gratuito, usar los modelos enumerados en docs/AGENT_EFFICIENCY.md y disponibles en la cuenta. No emplear versiones sin -free como sustitutos implícitos.
- Preferir un agente para tareas simples; no incorporar agentes paralelos o revisores si el riesgo y la complejidad no lo justifican.
- No utilizar modelos de API facturables, servicios de pago adicionales ni recargas automáticas sin autorización expresa. No lanzar subagentes que puedan consumir modelos de pago durante un comando gratuito.
- Un fallback entre modelos gratuitos solo se considerará activo tras configurarlo y probarlo en un orquestador compatible; escribirlo en Markdown no lo activa.
- Los modelos y sus condiciones pueden cambiar. Comprobar identificadores reales, disponibilidad, costes y límites antes de actualizar las rutas de selección.
6. Jerarquía documental
- docs/DECISION_LOG.md registra estados y decisiones.
- docs/PRODUCT_VISION.md delimita el propósito; docs/MVP_SCOPE.md, el alcance.
- VISUAL_STYLE_GUIDE.md define el diseño visual; docs/DATA_AND_FORMATS.md, el contrato de datos propuesto.
- docs/AGENT_EFFICIENCY.md desarrolla pautas de eficiencia y elección de modelos; no prevalece sobre seguridad, alcance ni reglas de producto de este archivo.
- El código es la fuente del estado implementado, no de la validez de decisiones de producto.
- Ante contradicciones relevantes entre documentación, decisiones y código, no elegir silenciosamente: explicar la discrepancia y solicitar decisión cuando sea necesaria.