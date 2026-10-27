Eficiencia de agentes y consumo de tokens — Room Builder
1. Objetivo y prioridad
Completar las tareas usando el menor contexto, número de llamadas y consumo razonable sin sacrificar calidad, seguridad ni pruebas.

Orden: corrección y seguridad > alcance solicitado > verificaciones necesarias > ahorro de tokens > velocidad.

Esta guía complementa AGENTS.md; no altera sus restricciones ni modifica por sí sola el modelo seleccionado en OpenCode.
2. Contexto mínimo necesario
- Consultar primero la petición, git status --short, git diff --stat y los archivos afectados.
- Localizar rutas y símbolos con rg --files y rg -n; leer fragmentos y ampliar solo cuando resulte necesario.
- Consultar documentos según la tarea, no toda la documentación al inicio:
  - Producto y alcance: docs/PRODUCT_VISION.md, docs/MVP_SCOPE.md.
  - Interfaz y cámaras: docs/UX_AND_CAMERAS.md, VISUAL_STYLE_GUIDE.md.
  - Objetos y formatos: docs/OBJECTS_AND_ASSETS.md, docs/DATA_AND_FORMATS.md.
  - Arquitectura/refactor: docs/ARCHITECTURE_AND_QUALITY.md, docs/REFACTOR_PLAN.md, docs/DECISION_LOG.md.
  - Generador por texto: GENERADOR_OBJETOS.md (propuesta, no entregado).
- Utilizar docs/README.md para encontrar fuentes cuando sea necesario.
- Evitar volcados de historiales, archivos completos, logs o pruebas repetidas que no aporten información nueva.
- Reutilizar hallazgos ya comprobados solo si siguen siendo válidos para la rama y el código actuales.
3. Modos de uso y selección de modelos
Modo predeterminado: Codex mediante la suscripción de ChatGPT conectada a OpenCode. El archivo opencode.jsonc establece openai/gpt-6.1-terra como modelo predeterminado para trabajo nuevo. Una selección manual de /models en la sesión puede prevalecer sobre ese valor.

Modo gratuito: exclusivamente cuando el usuario lo solicite, con /gratis* o selección manual en /models. Nunca sustituir de manera silenciosa un modelo de Codex por otro proveedor.
Nivel de tarea	Codex: modelo orientativo	En modo gratuito: modelo orientativo	Cuándo corresponde
Rápido	openai/gpt-6-luna (si se elige expresamente) o Terra actual	opencode/glm-5.3-flash-free	Erratas, documentación corta, cambios pequeños y aislados
Equilibrado	openai/gpt-6.1-terra (predeterminado)	opencode/deepseek-v4.1-flash-free; alternativa opencode/mimo-v2.6-flash-free	React/TypeScript, componentes, hooks, bugs habituales
Profundo	openai/gpt-6.1-sol si se selecciona expresamente; de lo contrario Terra	opencode/nemotron-3-ultra-free	Refactors extensos, arquitectura, 3D, cámaras, persistencia, migraciones
Visual	Terra o Sol, según lo seleccionado	opencode/nemotron-3.5-super-vl-free	Interpretar capturas, UI y escenas 3D
Crítico / revisión	Modelo elegido explícitamente por el usuario; no escalar de forma autónoma	Revisor gratuito independiente si su capacidad es suficiente	Riesgo alto de regresiones, pérdida de datos o decisiones relevantes


La tabla es orientativa, no un cambio automático de modelo ni una clasificación de calidad validada. La disponibilidad, fiabilidad y condiciones de gratuidad deben revisarse periódicamente.

No escalar por el mero número de archivos; primero dividir la tarea o mejorar el contexto. No insistir con un modelo ligero si sus errores se repiten.
3.1. Detección y cambio de modelo al iniciar tareas
- El usuario ha autorizado la **selección automática entre modelos OpenAI de su suscripción ChatGPT**, si el cliente proporciona un método real para cambiar de modelo en la misma sesión. No autoriza proveedores externos de pago, API facturable ni recargas.
- Aplicar la guía docs/MODEL_ROUTING.md. Codex nativo debe recomendar y avisar, pero **no afirmar un cambio que no puede realizar**; OpenCode v2 tiene un plugin de enrutamiento automático pendiente de validar localmente.
- Modelos iniciales: documentación simple → Luna / Low; implementación habitual → Terra / Medium; R2/R3/R4 o problemas 3D/persistencia → Sol / Medium; Astra nunca automático.
- Si no se dispone de un modelo recomendado, conservar el actual. No invocar subagentes para elegir modelo.
- No aplicar el enrutador a /gratis*, -free ni al traspaso a Codex.

4. Cuotas, proveedores y límites de gasto
- El uso habitual consume la cuota de Codex correspondiente a la cuenta ChatGPT conectada; no debe contratarse una API de OpenAI ni otro servicio para sustituirla.
- En modo gratuito, elegir solamente modelos verificados como gratuitos (identificador acabado en -free en nuestra selección), sin recarga automática ni API facturable.
- Si se agota la cuota de Codex, informar del problema; el usuario podrá activar /gratis o escoger un modelo gratuito en /models.
- Si falla un modelo gratuito, proponer o emplear otra alternativa gratuita cuando el usuario lo haya pedido y exista un fallback configurado. Evitar bucles y reintentos ilimitados.
- Varios modelos opencode/*-free pueden compartir una cuota o límite de proveedor. Cambiar de modelo no garantiza una nueva cuota independiente.
- No considerar el fallback automático activo hasta haber instalado, configurado y probado un orquestador compatible. No se habilita mediante estos Markdown ni por incluir comandos personalizados.
- No invocar subagentes de pago en tareas del modo gratuito. Si no queda una alternativa adecuada, detenerse y explicar qué falta.
5. Ejecución proporcional
1. Acotar: objetivo, rama, archivos, riesgos y criterios de aceptación.
2. Investigar: localizar símbolos, leer solo el contexto necesario y evitar duplicar búsquedas.
3. Planificar: ejecución directa para cambios sencillos; plan breve y verificable para cambios complejos.
4. Implementar: cambio mínimo coherente, sin refactors o dependencias ajenas a la petición.
5. Verificar: primero pruebas específicas; ampliar a npm test, npm run test:e2e y npm run build según alcance y riesgo. Registrar pruebas no ejecutadas y por qué.
6. Cerrar: cambios, archivos, pruebas, resultado y pendientes en un resumen breve y verificable.
Nunca afirmar que una implementación visual está validada sin una comprobación real.
6. Agentes adicionales y revisión
- Un solo agente para tareas sencillas. No imponer análisis, implementación y revisión independiente en cada ajuste menor.
- Usar revisión separada cuando el riesgo lo justifique; preferir pruebas automatizadas frente a revisiones redundantes.
- Paralelizar solo tareas independientes, en ramas o worktrees aislados y con beneficio claro.
- La revisión de otro agente no sustituye pruebas ni validación humana cuando sean necesarias.
7. Continuidad entre modelos y cuotas
Usar la misma sesión de OpenCode siempre que sea posible. Los comandos /gratis* aprovechan su contexto, aunque el agente nuevo debe inspeccionar el estado real del repositorio.

Si se necesita resumir una tarea larga o pasarla a otra sesión, conservar solo:
TAREA: objetivo y criterio de aceptación
RAMA/ESTADO: rama, base y cambios locales
HECHO: modificaciones y archivos relevantes
DECISIONES: restricciones acordadas
VERIFICADO: comandos y resultados de pruebas
PENDIENTE: próximo paso y riesgos
No asumir que otra extensión o un chat diferente recuperará automáticamente el historial de Codex.
8. Revisión posterior por Codex (tras usar modelos gratuitos)
Flujo previsto: Codex en su chat nativo → OpenCode con modelo gratuito → revisión selectiva en Codex al recuperar cuota.
- Los chats de Codex y OpenCode no comparten automáticamente el historial. Los cambios en disco sí son visibles para ambos si trabajan en la misma carpeta y rama. Nunca ejecutar ambos agentes editando esos archivos a la vez.
- Al iniciar una tarea importante, anotar el objetivo y los criterios de aceptación. Antes del cambio de agente, conservar un resumen breve del estado; si Codex se interrumpe sin aviso, el nuevo agente reconstruirá lo verificable mediante Git y pedirá únicamente el contexto faltante.
- Al terminar en OpenCode, ejecutar /traspaso-codex si la tarea tuvo cambios significativos. Este comando guarda .ai/TASK_HANDOFF.md con hechos, pruebas, pendientes y riesgos. Mantener el archivo como estado local y no incluir secretos.
- Cuando Codex recupere cuota, pedirle revisar, no rehacer: leer el traspaso, git status, git diff y archivos nuevos; comprobar requisitos, posibles regresiones, arquitectura, seguridad y pruebas relevantes. Corregir solo incidencias demostrables.
- Para cambios triviales bien probados puede bastar con la revisión de diff y resultados; reservar revisión en profundidad para refactors, cámaras 3D, persistencia, migraciones y otras zonas de riesgo.
- Ni el traspaso ni la revisión constituyen un fallback automático. Codex y OpenCode deben usar la misma rama o un traspaso explícito de commits para observar los mismos archivos.
9. Evaluación y límites
- No reducir verificaciones, seguridad, compatibilidad ni accesibilidad para ahorrar tokens.
- No borrar trabajo, hacer commits, merges ni publicar sin la autorización que exige AGENTS.md.
- No fijar límites de salida que puedan truncar una implementación o diagnóstico necesarios.
- Comparar tareas similares por calidad, regresiones, tokens, reintentos y coste total; no solo por tokens de la primera llamada.
- Reevaluar periódicamente modelos, acceso y límites gratuitos; una oferta Free puede cambiar.
Estado actual: Codex predeterminado y comandos gratuitos manuales. Fallback automático todavía no configurado ni validado.