# Instrucciones permanentes para Codex y agentes — Room Builder

> **FUENTE ACTUAL 04/11/2026:** R5 integrada en `main`. El **MVP completo** aprobado es vivienda por plantas + las siete funciones confirmadas (#37, #38, #39, #40, #41, #45, #47) + #35/#36. **v0.2 es solo checkpoint** (#33). Antes de implementar, leer [docs/MVP_MASTER_PLAN.md](docs/MVP_MASTER_PLAN.md), [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md) y la issue asignada. Gate final **#54**: no publicar sin validación y autorización humana. **Organización:** 24 tareas bajo Milestones nativos F0–F6, orden dentro de cada hito visible en títulos `[F# · NN/TT]` y documentado en `docs/MVP_MASTER_PLAN.md`; **no elegir primero por P0/P1 si faltan sus dependencias** y **únicamente las etiquetas `prioridad:P0` y `prioridad:P1`**. Los contenedores #55–#61 están archivados. **No añadir etiquetas `mvp`, `tipo:*`, `orden:*`, `fase:*` o `hito:*` ni cabeceras con el hito en las descripciones**: el hito está en la columna derecha de GitHub. No crear contenedores nuevos. Fuera de MVP: [FUTURE_IMPROVEMENTS.md](docs/FUTURE_IMPROVEMENTS.md). No modificar configuraciones de agentes sin autorización; ver [CONFIGURATION_AUDIT.md](docs/CONFIGURATION_AUDIT.md).


## Selección de modelo y razonamiento

- Recomienda un modelo únicamente cuando el usuario solicite ayuda para elegirlo o compararlo.
- Cuando se solicite una recomendación, indica:
  - Modelo y versión exacta.
  - Razonamiento recomendado: Low, Medium, High o Extra High.
  - Motivo breve de la elección.
  - Si conviene mantener o cambiar el modelo actual.
- No es necesario verificar el razonamiento activo.
- No afirmes conocer la configuración si no puedes verificarla.
- Si el usuario ya ha seleccionado un modelo, considera la elección confirmada.
- No repitas recomendaciones al comenzar tareas, continuar fases o recuperar contexto.
- No interrumpas el desarrollo para evaluar modelos.
- Prioriza ejecutar la tarea y minimizar el consumo de cuota y contexto.

Formato de recomendación (solo cuando se solicite):

**Recomendación: [MODELO] · [RAZONAMIENTO]**

Motivo: [Explicación breve].
Acción: [Mantener / Cambiar].

## 1. Inicio de tarea y lectura selectiva

- Antes de modificar código, comprender la petición, comprobar la rama y los cambios locales, e inspeccionar los archivos de código implicados. No sobrescribir trabajo existente.
- No leer toda la documentación al comenzar cada tarea. Consultar únicamente la necesaria según el alcance; ampliar la lectura si aparecen dependencias, riesgos o contradicciones.
- Usar `docs/README.md` para localizar fuentes y conocer estados cuando sea necesario.
- Documentación por temática:
  - Propósito y alcance: `docs/PRODUCT_VISION.md` y `docs/MVP_SCOPE.md`.
  - Interfaz, cámaras y diseño visual: `docs/UX_AND_CAMERAS.md` y `VISUAL_STYLE_GUIDE.md`.
  - Objetos, modelos 3D y formatos: `docs/OBJECTS_AND_ASSETS.md` y `docs/DATA_AND_FORMATS.md`.
  - Arquitectura y refactorización: `docs/ARCHITECTURE_AND_QUALITY.md`, `docs/REFACTOR_PLAN.md` y `docs/DECISION_LOG.md`.
  - Creador mediante texto: `GENERADOR_OBJETOS.md` (propuesta; no funcionalidad entregada).
- Consultar `docs/DECISION_LOG.md` cuando una tarea implique decisiones aprobadas, pendientes o contradictorias. Antes de reorganizar archivos, seguir `docs/REFACTOR_PLAN.md`.
- La documentación indica intención y decisiones; el código actual determina lo que está implementado. Si no coinciden, señalar la diferencia; no ocultarla.

## 2. Reglas de producto y desarrollo

- Producto independiente: empezar creando una habitación, ampliar a **casa con varias plantas y estancias conectadas** como parte del MVP final. La versión Mini del Laboratorio de Pablo Web 2.0 es otro alcance posterior y no modifica el portfolio.
- Priorizar usabilidad y legibilidad sobre realismo, funciones o complejidad técnica. Mantener la estética 3D low-poly estilizada, tipo diorama; no pixel art ni CAD.
- No cambiar por iniciativa propia el alcance MVP, la arquitectura aprobada, las guías visuales, los formatos persistidos ni las decisiones marcadas PENDIENTE. Proponer y documentar primero cualquier cambio de ese tipo.
- Distinguir siempre CONFIRMADO, PROPUESTO, EXPERIMENTAL, PENDIENTE y DESCARTADO. No presentar una propuesta como implementada ni una implementación como validada visualmente.
- Separar datos del mundo, renderizado, controles, cámaras, estado/persistencia y UI. La posición de un objeto nunca debe depender de una vista concreta.
- No incorporar objetos visuales sin integrar catálogo, modelo 3D, icono, medidas, interacción y pruebas correspondientes; respetar la guía visual.
- No romper diseños guardados: versionar cambios de formato, validar entradas y ofrecer migraciones con pruebas cuando proceda. Guardar internamente en metros; interfaz en español de España.
- Mantener la consistencia constructiva: puertas y ventanas pertenecen a paredes, sin solapes ni huecos falsos. **Implementar en #51/#52 paredes compartidas físicas únicas**, con migraciones y tests; no improvisar duplicados.
- No introducir IA, cuentas, backend, librerías grandes ni sistemas sociales por simple conveniencia.
- No copiar assets ni código de Rooms.xyz, Room Studio u otros proyectos sin comprobar licencia y atribución.
- Preservar compatibilidad con ratón, pantalla táctil y teclado; accesibilidad textual, movimiento reducido y mensajes claros. Evitar cargas iniciales pesadas.
- Hacer el cambio mínimo coherente con la petición. No mezclar refactorizaciones con nuevas funciones ni modificar archivos ajenos al objetivo sin justificación.

## 3. Verificación y seguridad del trabajo

- Inspeccionar el código real antes de actuar. Evaluar efectos sobre vistas, dimensiones, selección, persistencia y migraciones cuando sean áreas afectadas.
- **Política vigente del propietario (11/11/2026):** las pruebas automáticas (unitarias, build y **E2E de humo** de CI) se ejecutan en cada **`push` a `main`** y en las **PR de cualquier rama cuyo destino sea `main`**. Esta regla sustituye la política de 07/11/2026. Los `push` a otras ramas y las PR hacia `dev` no disparan esta CI; no ejecutar suites locales en ramas de desarrollo por iniciativa propia salvo autorización específica.
- Antes de integrar, revisar los cambios y exigir que la CI de la PR hacia `main` termine correctamente: `npm ci`, `npm test`, `npm run build` y `npm run test:e2e:smoke` (solo los E2E etiquetados `@smoke`, los flujos críticos). Los nuevos commits de esa PR vuelven a validarse; después de integrar, el `push` a `main` repite la comprobación. Documentar resultados reales y comprobaciones pendientes sin presentar la CI como validación visual humana. La política de exigir resultados correctos no equivale por sí sola a configurar checks obligatorios en la protección de rama de GitHub.
- **Política E2E (14/11/2026, decisión del propietario):** la suite E2E **completa** (`npm run test:e2e`) deja de ejecutarse en cada PR: se lanza a mano o cada lunes con `.github/workflows/e2e-full.yml` y debe pasar antes de cada release (gate #54). Los tests críticos se etiquetan `{ tag: '@smoke' }` y son los que bloquean las PR. Al añadir E2E nuevos, etiquetar como humo solo los flujos esenciales y mantener cada test por debajo de ~10 gestos de interfaz reales; en Windows ejecutarlos desde un terminal con `C:\` en mayúscula.
- No repetir pruebas costosas si no hay cambios relevantes desde una ejecución válida, salvo para comprobar estabilidad o por requisitos de integración.
- No afirmar que una vista ha sido validada visualmente sin haberla comprobado. No ocultar fallos, resultados incompletos ni riesgos conocidos.
- **Política vigente del propietario (07/11/2026):** partir siempre de `main` para crear ramas nuevas de tarea. Subir commits únicamente a esas ramas; **no crear PR**, y **no subir cambios ni integrar automáticamente en `main` o `dev`**. La integración en `main` requiere acción o autorización específica del propietario.
- No sobrescribir trabajo ajeno ni borrar cambios locales. No hacer commits no solicitados, merges ni publicaciones sin autorización expresa. Trabajar en la rama indicada y entregar un resumen verificable.

## 4. Eficiencia de tokens y contexto

- Prioridad: corrección y seguridad > alcance solicitado > verificaciones necesarias > ahorro de tokens > velocidad.
- Buscar primero rutas y símbolos concretos; leer solo fragmentos relevantes. Evitar volcar repositorios, historiales o logs completos sin necesidad.
- Reutilizar decisiones, análisis y pruebas anteriores solo si siguen siendo válidos para la rama y el código actuales.
- Resolver directamente tareas sencillas; elaborar un plan breve para cambios complejos, de varios módulos o con riesgo elevado.
- Evitar análisis reiterativos, explicaciones largas, soluciones sobrediseñadas y agentes paralelos sin beneficio claro.
- Resumir las respuestas con: qué ha cambiado, qué se ha probado, resultado y pendientes.
- Mantener un único informe Markdown por fase R en `docs/progress/` (por ejemplo, `R3_PROGRESS.md`, `R4_PROGRESS.md`). Documentar todas sus subpartes y continuaciones dentro de ese archivo, conservando el historial, pruebas y límites; no crear informes separados por subparte. No borrar el informe al cerrar una fase ni al integrar ramas. Si se unifican informes existentes, conservar su contenido y actualizar los enlaces.
- Para tareas largas, trabajo con varios agentes o traspasos de contexto, consultar `docs/AGENT_EFFICIENCY.md`. No cargar ese documento completo por defecto en tareas triviales.
- Si se cambia de agente o proveedor, transmitir un resumen compacto de tarea, rama, archivos, decisiones, pruebas y siguiente paso; el receptor comprobará el estado real antes de continuar.
- Nunca sacrificar funcionalidad, seguridad ni verificaciones necesarias para consumir menos tokens.

## 5. Política de modelos y proveedores

- La selección del modelo corresponde al usuario. Recomendar Luna, Terra, Sol o Astra únicamente cuando solicite ayuda para elegir o comparar modelos.
- Si el usuario ya ha seleccionado un modelo, respetar su elección sin volver a evaluarla al comenzar o continuar una tarea.
- El cambio automático de modelo permanece inactivo hasta disponer de una integración compatible y verificada. No afirmar que un cambio automático se ha realizado.
- En el chat nativo de Codex VS Code, `AGENTS.md` no controla el selector. En OpenCode, el plugin de cambio automático también permanece inactivo hasta que se pruebe una API compatible. No mostrar avisos de modelo salvo cuando el usuario los solicite.
- Catálogo único de modelos, usos, identificadores y comandos: `docs/MODELS.md`. Reglas de enrutamiento y etiquetas `#modelo:`: `docs/MODEL_ROUTING.md`. No seleccionar Astra automáticamente.
- Modo predeterminado: Codex, usando `openai/gpt-6.1-terra` con la suscripción ChatGPT conectada a OpenCode. No implica autorizar gasto adicional en API.
- La clasificación rápido / equilibrado / profundo / crítico sirve para recomendar modelos adecuados cuando se solicite, pero no autoriza al agente a cambiar de proveedor o modelo sin una orden explícita o una automatización previamente aprobada e implementada.
- Modo gratuito solo bajo petición expresa del usuario: comandos como `/gratis`, `/gratis-auto`, `/gratis-alternativa`, `/gratis-rapido`, `/gratis-profundo` o `/gratis-visual`, o selección manual de un modelo `-free` desde `/models`.
- Los comandos `/gratis*` ejecutan la petición indicada con su modelo gratuito en la sesión actual. No cambian necesariamente el modelo de los mensajes siguientes; si se desea mantener el modo gratuito para varias peticiones, elegirlo desde `/models`.
- Si Codex alcanza el límite de uso, no intentar un cambio automático no configurado. Informar de la limitación y continuar en modo gratuito cuando el usuario lo indique; conservar código, cambios locales y contexto de la sesión.
- Dentro del modo gratuito, usar los modelos enumerados en `docs/MODELS.md` y disponibles en la cuenta. No emplear versiones sin `-free` como sustitutos implícitos.
- Preferir un agente para tareas simples; no incorporar agentes paralelos o revisores si el riesgo y la complejidad no lo justifican.
- No utilizar modelos de API facturables, servicios de pago adicionales ni recargas automáticas sin autorización expresa. No lanzar subagentes que puedan consumir modelos de pago durante un comando gratuito.
- Un fallback entre modelos gratuitos solo se considerará activo tras configurarlo y probarlo en un orquestador compatible; escribirlo en Markdown no lo activa.
- Los modelos y sus condiciones pueden cambiar. Comprobar identificadores reales, disponibilidad, costes y límites antes de actualizar las rutas de selección.

## 6. Jerarquía documental

- `docs/DECISION_LOG.md` registra estados y decisiones.
- `docs/PRODUCT_VISION.md` delimita el propósito; `docs/MVP_SCOPE.md`, el alcance; `docs/MVP_MASTER_PLAN.md`, las fases, prioridades, orden y dependencias.
- `VISUAL_STYLE_GUIDE.md` define el diseño visual; `docs/DATA_AND_FORMATS.md`, el contrato de datos propuesto.
- `docs/MODELS.md` es la referencia central de modelos y casos de uso; `docs/MODEL_ROUTING.md` establece la política de selección y `docs/AGENT_EFFICIENCY.md`, las pautas de eficiencia. Estos documentos no prevalecen sobre seguridad, alcance ni reglas de producto de este archivo.
- El código es la fuente del estado implementado, no de la validez de decisiones de producto.
- Ante contradicciones relevantes entre documentación, decisiones y código, no elegir silenciosamente: explicar la discrepancia y solicitar decisión cuando sea necesaria.
