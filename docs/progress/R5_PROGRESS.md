# R5 — Funcionalidad y diseño

**Estado:** R5.1 COMPLETADA Y VERIFICADA · 03/11/2026. R5.2/R5.3 no iniciadas; R5.4 aplazada. R5 completa sigue pendiente. Las entradas anteriores al inicio y cierre de R5.1 se conservan como histórico.
**Rama:** `refractor/r5-funcionalidad-diseño`.
**Base:** `main` con R0–R4 integradas (PR #19 y #20) y el commit documental `ee455b3`.
**Plan detallado:** [R5_PLAN.md](../R5_PLAN.md).

Este es el informe único de la fase R5. Todas sus subpartes y continuaciones se documentarán aquí, conservando el historial. No se crea un informe por subfase.

## Alcance de esta entrada

Solo documentación. Se desarrolla el plan de R5 antes de escribir código, tal como pidió el propietario:

- orden R5.1 → R5.2 → R5.3, con R5.4 aplazable;
- contrato propuesto `PersistedDesign` v5 para Original/Alternativa A;
- interfaz, estado, historial, selección, persistencia y pruebas previstas;
- decisiones abiertas D1–D8 que requieren aprobación;
- límites y trabajo fuera de alcance.

## Punto de partida verificado

- R4 es **contrato puro**: `projectV2`, `projectVariants`, `productCapabilities` y `projectMigration` no se usan en la aplicación ni escriben en `localStorage`.
- La persistencia real sigue en `PersistedDesign` v1–v4, con un único `furniture` por diseño.
- No existe UI de variantes, ni redimensionado general de mobiliario, ni JSON editable.
- Baseline de pruebas al iniciar la documentación: **189/189 unitarias**, 0 fallos (`npm test`, 03/11/2026). El build de referencia de R4 estaba aprobado con el aviso de tamaño de bundle ya registrado.
- No se modificó código, dependencias, `package.json`, claves de almacenamiento ni formato persistido.

## Entregables documentales

- [R5_PLAN.md](../R5_PLAN.md): plan completo, contrato v5 propuesto, subfases, aceptación, archivos, riesgos y decisiones D1–D8.
- [REFACTOR_PLAN.md](../REFACTOR_PLAN.md): encabezado actualizado (R4 integrada; R5 planificada) y sección R5 reescrita con enlaces, sin borrar el histórico del estado anterior.
- [DECISION_LOG.md](../DECISION_LOG.md): propuestas RB-028–RB-034, marcadas **PROPUESTO**, y nota de que no autorizan implementación.
- [DATA_AND_FORMATS.md](../DATA_AND_FORMATS.md): sección del formato v5 como propuesta no implementada y relación con `LayoutV2`.
- [README.md](../README.md): índice y estado actualizados con el plan y el informe de R5.

## Resumen del plan

### R5.1 — Comparación Original/Alternativa A (P0)

- `PersistedDesign` v5 con `layouts`, `activeLayoutId` y `furniture` como espejo de la variante activa.
- Estructura y preferencias del diseño; solo el mobiliario es por variante.
- Alternar variante conserva la selección cuyos IDs existen en el destino y registra un paso de historial.
- Máximo una Alternativa A en la UI; eliminarla pide confirmación.
- Lectura de v1–v4 como Original; guardado siempre v5; claves y límite de cinco intactos.
- Archivos previstos: `designV1`, `designLayouts` (nuevo), normalización, migraciones, store, `VariantSwitcher` (nuevo), cabecera, panel de objetos y menú de diseños; pruebas unitarias y E2E.
- El plan se desglosa ahora en R5.1a–R5.1f: contrato, migración, operaciones puras, store/historial, guardado/proyección y UI/E2E.

### R5.2 — Redimensionado

- Capacidades `resize` por tipo, reglas puras, controles numéricos accesibles y asas opcionales.
- Un paso de historial por gesto; sin cambio de formato porque las medidas ya existen.
- Se desglosa en R5.2a–R5.2e: matriz de capacidades, reglas, controles, asas opcionales y regresión/cierre.

### R5.3 — JSON editable

- Exportación e importación de un diseño por archivo, validación estricta, previsualización, límite de tamaño y compatibilidad v1–v5.
- Biblioteca llena bloquea la importación; la opción de reemplazo queda PENDIENTE.
- Se desglosa en R5.3a–R5.3e: contrato de archivo, validación pura, exportación, previsualización/importación y seguridad/aceptación.

### R5.4 — Simplificación de experiencia

- Aplazada a E2/E4 de v0.2 salvo orden expresa; no se mezcla con el cierre funcional de R5.

## Decisiones pendientes de aprobación

D1 formato v5 · D2 cambio de variante en historial · D3 selección y preferencias compartidas · D4 estructura común sin diálogo bloqueante · D5 una sola alternativa · D6 eliminación con confirmación · D7 JSON de un diseño por archivo · D8 aplazar R5.4.

Ninguna está aprobada por este informe. El detalle y el impacto están en [R5_PLAN.md §9](../R5_PLAN.md#9-decisiones-abiertas-que-requieren-aprobación-antes-de-codificar).

## Verificación de esta entrada

- Cambios limitados a Markdown; no se tocó `src/`, `package.json` ni configuración.
- `npm test`: **189/189 aprobadas**, ejecutado para confirmar el baseline antes de documentar (no como validación de una función nueva).
- No se ejecutaron E2E ni build: no hay cambios de código, escena, UI o persistencia que los requieran.
- `git diff --check`: sin errores.
- Enlaces relativos de los documentos modificados: comprobados; los destinos existen.

## Límites

- El formato v5 es una propuesta; no está implementado, no se escribe en `localStorage` y no es un contrato público.
- `ProjectV2` sigue siendo el prototipo de R4; R5.1 no lo adopta como formato persistido sin una decisión distinta y expresa.
- No se han validado visualmente controles de variantes ni de redimensionado porque no existen todavía.
- No hay commit, merge, push ni publicación.

## Siguiente paso

**Recomendación inicial, sustituida por el desglose que sigue:** revisar D1–D8 e implementar R5.1 como un lote revisable empezando por el contrato puro.

## Continuación — desglose de ejecución (03/11/2026)

El plan detallado organiza ahora R5.1, R5.2 y R5.3 en lotes dependientes, cada uno con verificaciones antes de avanzar. R5.1 ya no se plantea como una entrega monolítica: R5.1a–R5.1f separan contrato, migraciones, operaciones puras, store/historial, persistencia y UI/E2E.

Se precisan dos puntos que deben resolverse antes de implementar las superficies afectadas:

- D1/RB-028 debe especificar qué ocurre si el `furniture` espejo de v5 no coincide con la variante activa; ninguna copia se sobrescribe silenciosamente.
- D7/RB-033 debe especificar cómo se trata la importación de un diseño cuyo ID ya existe en la biblioteca, además del caso de biblioteca llena.

Para R5.2, los rangos de dimensiones siguen siendo hipótesis; la matriz por tipo, el anclaje, el redondeo y la respuesta a valores fuera de límites se decidirán antes de construir controles o asas. Para R5.3, la importación no podrá sobrescribir diseños sin una regla aprobada.

No cambia el alcance ni el estado de la fase: R5 sigue **PLANIFICADA**, sin código. D1–D8 y RB-028–RB-034 siguen propuestas y requieren aprobación; este desglose no autoriza implementación.

## Verificación de la continuación documental

- Solo se actualizaron Markdown de planificación y seguimiento; no se modificaron código, dependencias ni formatos.
- No se ejecutaron pruebas ni build: no hay cambios ejecutables.
- `git diff --check` y la comprobación de whitespace de los dos documentos nuevos no detectaron errores.
- Los destinos de los enlaces Markdown relativos de `R5_PLAN.md` y este informe existen.

## R5.1a — contrato y validación pura (03/11/2026)

El propietario confirmó D1–D8, con rechazo explícito de discrepancias del espejo y limpieza de referencias solo cuando el elemento no exista en ninguna variante ni en la estructura. La política de IDs duplicados de D7 queda pendiente antes de R5.3; los detalles de redimensionado siguen pendientes antes de R5.2.

- Se definieron los tipos candidatos `PersistedLayout` y `PersistedDesignV5` y se añadió validación pura de variantes y espejo, sin integrarlos aún en lectura ni escritura. El formato real continúa en v1–v4.
- Se probaron los invariantes y discrepancias en ambas variantes, además de conservar las pruebas de caracterización existentes.
- `npm test`: 191/191 aprobadas. El primer intento limitado a los archivos pertinentes falló por `EPERM` del canal IPC de `tsx` en el sandbox; la suite completa pasó fuera del sandbox con el permiso disponible.
- `npm run build`: aprobado, con aviso de bundle superior a 500 kB. Sin cambios de UI; E2E no ejecutado en este lote.
- Siguiente: R5.1b, normalización y migración en memoria con pruebas de compatibilidad y sin reescritura por lectura.

## R5.1b — avance parcial: migración pura (03/11/2026)

- Añadida una conversión pura y determinista de v1–v4 a una Original v5, y clonación de v5 con rechazo de espejo discrepante. Las copias de mobiliario quedan aisladas y no se escribe almacenamiento desde esta función.
- `npm test`: 193/193 aprobadas. `npm run build`: aprobado, con aviso de bundle superior a 500 kB.
- **Pendiente para cerrar R5.1b:** integrar y verificar la normalización y lectura real de v5, validación de todas las variantes, firmas y fixtures completos. Todavía no se aceptan ni guardan v5 en la aplicación; no se ha ejecutado E2E.

## Continuación — R5.1b completada (03/11/2026)

- Normalización completa en memoria de v1–v5: v1–v4 conservan el recorrido histórico de habitación, decoración mural y colocación; v5 comprueba ambas variantes, IDs, valores finitos, dimensiones positivas, aperturas y colisiones de mobiliario. v5 conserva sus dimensiones y posiciones y rechaza el espejo discrepante antes de normalizar.
- Fixtures nuevos v2, v3, v4 y v5, junto con los fixtures v1 existentes, verifican determinismo, preferencias, carpetas, orden y ausencia de mutaciones. La firma incluye variantes y activa.
- `npm test`: 195/195 aprobadas antes de avanzar a R5.1c. La conexión del lector al store se realizó en R5.1d para no aceptar v5 mientras el store aún no podía conservar sus variantes.

## R5.1c — operaciones puras (03/11/2026)

- Creación de Original, duplicación, activación, renombrado, eliminación y snapshot de la activa con copias independientes. Duplicar conserva IDs lógicos; eliminar Original se rechaza.
- `npm test`: 197/197 aprobadas antes de integrar estado.
- Precisión técnica del plan: `syncActiveLayout` centraliza la captura tanto al serializar como antes de una transición de variante. El store mantiene `furniture` como superficie activa compatible; su copia en `layouts` se captura en esos puntos. Esto evita tener dos fuentes de edición concurrentes.

## R5.1d — estado, historial y selección (03/11/2026)

- Store con variantes y acciones; alternar registra historial, filtra selección y ancla, mantiene cámara y portapapeles y conserva el límite de 50 pasos.
- Los cambios de habitación se comprueban también contra las variantes inactivas con las mismas reglas existentes. Un conflicto en cualquiera rechaza la operación completa con un aviso que identifica la variante.
- Borrar un mueble en una variante conserva las preferencias de su copia en otra. Reordenar conserva referencias a mobiliario inactivo. Eliminar la alternativa limpia únicamente referencias huérfanas respecto de todas las variantes y de la estructura.
- Se actualizaron tres expectativas de versión en pruebas del store: el guardado ahora es v5. Los casos de lectura legacy permanecen.
- `npm test`: 203/203 aprobadas, incluidas las pruebas nuevas de estado, selección, portapapeles, historial, estructura común y errores de guardado.

## R5.1e — guardado y convergencia con R4 (03/11/2026)

- El guardado de la aplicación escribe v5. Leer v1–v4 crea Original en memoria sin reescritura; la recuperación de la clave legacy sigue siendo la excepción histórica que crea la biblioteca, sin borrar el original. Claves y límite de cinco intactos.
- Cargar v5 valida también el mobiliario inactivo antes de cambiar la escena; una discrepancia de espejo se comunica explícitamente y no modifica el almacenamiento. Crear en blanco genera Original vacía; copiar un diseño conserva todas sus variantes y la activa.
- `migrateDesignToProject` acepta v5 y conserva ambas variantes, la activa y sus definiciones. La proyección de prueba a un diseño legacy toma una sola variante y usa v4 para un origen v5. `ProjectV2` sigue sin persistirse.
- `npm test`: 204/204 aprobadas. La primera prueba de convergencia falló por fecha de fixture vacía; se corrigió el fixture de prueba y el tipo de retorno de la proyección legacy. TypeScript aprobado después de las correcciones.

## R5.1f — UI y verificación en curso (03/11/2026)

- Selector accesible sobre el catálogo, aviso de estructura común, duplicación limitada a una alternativa, renombrado y eliminación con confirmación nativa y recuperación de foco en Original. El menú de diseños muestra el número de variantes.
- Cuatro E2E nuevos cubren comparación, historial, recarga, renombrado con teclado, confirmación/cancelación, errores de espejo y tamaños 1440/390/320 px.
- Primera ejecución dirigida: 3/4 aprobadas; el flujo de guardado encontró un nombre accesible ambiguo por el icono del botón. Se añadió una etiqueta explícita y la segunda ejecución, junto con las dos pruebas de biblioteca, pasó 6/6.
- Inspección visual real de capturas de escritorio y móvil: selector y acciones legibles, sin desbordamiento horizontal. No equivale a una auditoría visual completa del producto.
- Revisión adicional: la firma ordena propiedades de objetos para que un espejo semánticamente igual con otro orden de claves no marque cambios al cargar; conserva el orden de los arrays.
- La primera regresión E2E general se interrumpió durante esa corrección: 18 aprobadas, 4 fallos, 2 interrumpidas y 94 sin ejecutar. Esa ejecución no valida el estado final y sus fallos deben contrastarse en la repetición con el código estable.

## Verificación final de R5.1 y decisión D9 pendiente (03/11/2026)

- Código de aplicación final: `npm test` **207/207 aprobadas**; `npm run build` aprobado, con aviso de bundle superior a 500 kB (aprox. 1,43 MB sin comprimir). `git diff --check` sin errores.
- E2E dirigidos de variantes y biblioteca: **6/6 aprobadas**. Sus seis casos también pasaron en la regresión general posterior con la firma final.
- Regresión general con código de aplicación estable: `npm run test:e2e -- --workers=2`, **105/118 aprobadas y 13 fallos**. No se presenta como suite en verde.
- Se corrigieron expectativas/localizadores obsoletos de las pruebas: guardado v5; carpeta concreta en presencia de Raíz; conservación de Raíz al borrar una carpeta; selección de rango según orden visible; valores realmente fuera del rango editable y múltiplos de la cuadrícula; alcance del botón Eliminar al inspector; segundo dragover tras desplazar el panel; un hermano real para probar reordenado con teclado.
- Dos coordenadas de gestos se corrigieron conservando la prueba real del arrastre: la superficie usa el tirador X existente; en frontal se pulsa sobre el cuerpo, evitando el eje Y que solo permite desplazamiento vertical. El test frontal reduce movimiento de cámara.
- Repetición dirigida de 12 casos: **10 aprobadas, 2 fallos** (frontal y lámpara de techo). Tras inspeccionar una captura frontal y corregir el punto del cuerpo: **1/1 aprobada**. Por tanto, 11 de los 13 fallos de la corrida general ya tienen una repetición válida aprobada; quedan los dos casos de anclaje.
- Comparación ejecutada sobre una copia de `ee455b3` en `/tmp/room-builder-r51-baseline`, con dependencias compartidas y servidor separado en el puerto 4187: se reprodujeron los fallos originales de captura de superficie, renombrado de carpeta, conservación de Raíz, gesto frontal y los dos casos de anclaje. No se modificó la rama ni se creó un commit para esta comparación.

### D9 — discrepancia previa de anclaje vertical (PENDIENTE)

`FurnitureInspector` permite editar Y para cualquier mueble (`canChangeElevation = true`) y las acciones permiten elevar alfombras y lámparas de techo. Dos E2E esperan ocultar Y y mantenerlos anclados. Ambos fallan también en la base `ee455b3`.

No se cambió la regla de la aplicación ni se eliminaron esas expectativas para hacer pasar la suite. El propietario debe decidir entre conservar la libertad vertical actual o fijar alfombras al suelo y lámparas al techo. La propuesta del agente es conservar la libertad actual durante R5.1; sigue sin aprobarse. La decisión se registra como RB-035 y D9.

R5.1 está implementada, pero **no se da por cerrado su criterio E2E**. No se ha iniciado R5.2 ni R5.3. R5.2 además conserva pendientes anclaje de redimensionado, redondeo, respuesta a medidas inválidas, proporciones y límites por tipo; D7 mantiene pendiente la política de IDs duplicados antes de R5.3.

## Continuación — D9 confirmada y compatibilidad de anclaje (03/11/2026)

- El propietario confirmó fijación por tipo: alfombras al suelo, lámparas de techo al techo y elementos murales a su pared. Las lámparas de pie/mesa no reciben ese anclaje.
- Para diseños antiguos eligió conservar posiciones y comportamiento y aplicar anclaje solo a objetos nuevos. Se descarta corregir alturas antiguas al cargar.
- Se preparó el soporte de capacidades de anclaje en catálogo, restricciones en reglas, inspector y gestos individuales/múltiples. Verificación intermedia: 210/210 unitarias y TypeScript aprobados. Esa ejecución precede a la integración de la distinción antiguos/nuevos y no certifica todavía la política completa.
- D10/RB-036 propone la marca opcional `attachmentPolicy: 'by-type'` para recordar esa distinción en un diseño mixto después de guardar/recargar. La ampliación está pendiente de aprobación; no se ha modificado aún el contrato persistido con esta marca.

### D10 aprobada — integración y compatibilidad

El propietario aprobó expresamente la marca opcional en v5. Se incorporó `attachmentPolicy?: 'by-type'` en muebles nuevos, sin cambiar versión ni claves. Los objetos antiguos no se marcan ni se recolocan al cargar, incluidos los de versiones v1–v4. Guardar un diseño mixto conserva esa distinción. Duplicar variantes mantiene sus objetos; el portapapeles crea objetos nuevos sujetos al tipo actual.

- Catálogo con fijación `free/floor/wall/ceiling` y consulta efectiva por instancia; reglas de edición, inspector, ejes de escena y selección múltiple usan la misma política.
- Altura canónica de objetos nuevos: alfombras en 0; lámparas de techo en altura de habitación menos altura del objeto. Las lámparas de pie/mesa admiten Y. Los objetos antiguos permanecen libres y conservan sus valores. Los cambios de altura de habitación actualizan las lámparas nuevas fijadas al techo.
- Validación v5 rechaza políticas desconocidas o alturas incoherentes en objetos marcados; no modifica ni rechaza una altura antigua solo por carecer de anclaje. La información se conserva en la proyección de prueba R4.
- `npm test`: **213/213 aprobadas**. Un caso geométrico se amplió para distinguir alfombra nueva marcada (fijada) de antigua sin marca (libre). `npm run build`: aprobado, con aviso de tamaño del bundle.
- Tres E2E nuevos cubren objetos nuevos por tipo, guardado mixto y recarga con objetos antiguos, y selección mixta. El primer intento no ejecutó casos por un paréntesis sobrante en el test nuevo; corregido antes de la ejecución dirigida.

- E2E dirigidos de anclajes y variantes: **7/7 aprobadas**. Captura de lámpara de techo inspeccionada: no muestra control Y y explica el anclaje; la escena muestra los ejes horizontales.
- La primera corrida general tras D10 se detuvo antes de modificar código por un caso adicional de compatibilidad: **34 aprobadas, 2 interrumpidas y 85 sin ejecutar**, sin fallos de aserción antes de la interrupción. Se comprobó que las alturas antiguas fuera de cuadrícula tampoco deben redondearse al editar la habitación; se amplió el fixture de pruebas a 0,73 m y 1,03 m y se protegió esa conservación para alfombras y lámparas antiguas.
- Tras esa corrección, `npm test`: **213/213 aprobadas** de nuevo. La regresión general se repite con el código estable; no se reutiliza la corrida interrumpida como verificación final.

### Límite de continuación indicado por el propietario

El propietario indicó terminar **solo R5.1** y no continuar con R5.2. No se ha iniciado su implementación. Las respuestas obtenidas para una futura R5.2 se conservan como decisiones anticipadas: mantener el centro del objeto al cambiar dimensiones y rechazar cambios inválidos o con solapes, conservando el tamaño anterior y explicando el motivo. No autorizan adelantar esa fase; sus límites por tipo, redondeo y proporciones siguen pendientes.

## Cierre de R5.1 (03/11/2026)

**R5.1a–R5.1f completadas y verificadas**, incluidas las decisiones posteriores D9/D10. El cierre corresponde a R5.1 y no a R5 completa ni al MVP completo.

### Resultado entregado

- Original/Alternativa A con mobiliario independiente y estructura/preferencias comunes; activación, duplicación, renombrado y eliminación con confirmación, historial y selección compatible.
- Guardado v5 de ambas variantes y su activa; lectura compatible v1–v4 sin reescritura por carga. Claves y límite de cinco diseños intactos. Validación de discrepancias de espejo y de mobiliario inactivo, con rechazo sin sobrescritura.
- `attachmentPolicy: 'by-type'` opcional aprobada para objetos nuevos: alfombras al suelo y lámparas de techo al techo. Antiguos sin marca conservan alturas y movilidad, incluso fuera de cuadrícula. Las lámparas de pie/mesa permanecen libres; ventanas y decoración mural siguen en sus paredes.
- La marca se conserva en variantes y al guardar/recargar diseños mixtos; pegar crea un objeto nuevo según el tipo. La convergencia de prueba con R4 conserva la marca. `ProjectV2` sigue siendo candidato y no se persiste.

### Verificaciones finales realmente ejecutadas

| Comprobación | Resultado final |
| --- | --- |
| `npm test` | **213/213 aprobadas**, 0 fallos |
| `npm run test:e2e -- --workers=2` | **121/121 aprobadas**, 0 fallos; Chromium, 8,7 minutos |
| `npm run build` | Aprobado; aviso de bundle superior a 500 kB, aprox. 1,43 MB sin comprimir |
| `git diff --check` | Sin errores |
| Inspección visual | Capturas de selector en escritorio/móvil y de lámpara fijada revisadas |

La corrida E2E final se ejecutó de principio a fin con el código de aplicación estable y sustituye las corridas fallidas o interrumpidas registradas arriba. No se ha ejecutado Firefox/Safari ni una auditoría visual o de rendimiento de todos los recorridos del producto.

### Pendientes y entrega

- No quedan bloqueos conocidos de aceptación de R5.1. D9/D10 están confirmadas e implementadas; los dos fallos de anclaje anteriores quedan resueltos.
- R5.2 no iniciada por indicación expresa del propietario. R5.3 y sus conflictos de IDs siguen pendientes; R5.4 continúa aplazada.
- Se conservan los cambios documentales locales previos y todo el historial de este informe. Sin commits, merges, push ni publicación.

## Cambio de cadencia de verificación tras R5.1 (03/11/2026)

El propietario indicó dejar las ejecuciones de tests para el final, cuando termine R5 completo. Para el trabajo restante se aplazan tests, E2E y build al cierre conjunto; no se repetirán por lote. Se prepararán los casos necesarios con el código y se revisarán los diffs, dejando las entregas intermedias como **implementadas, pendientes de validación**. Las verificaciones de R5.1 registradas arriba conservan su valor histórico y no se atribuirán a código posterior.

Esta indicación sustituye las puertas de ejecución de pruebas por lote del plan anterior, pero mantiene los criterios de aceptación finales y las consultas de decisiones de producto pendientes. R5.2 sigue sin iniciar; este cambio de flujo no autoriza comenzarla.

Solo se actualizaron el plan, la excepción de R5 en el plan de refactor y este informe. No se ejecutaron tests, E2E ni build para esta actualización documental.

## Corrección de cadencia y autorización de commit/continuación (03/11/2026)

El propietario corrigió expresamente la instrucción anterior: ejecutar tests, E2E y build al terminar **cada fase completa**, por ejemplo toda R5.2 y después toda R5.3. No repetir toda la batería por cada lote interno ni aplazarla hasta terminar R5 completo. Se conservan las entradas anteriores como histórico.

También solicitó un commit de los cambios acumulados y continuar con la siguiente fase, interpretada por contexto como R5.2. La autorización de continuación sustituye la pausa anterior de R5.2, pero no aprueba automáticamente sus rangos, redondeo ni proporciones pendientes. La autorización de commit corresponde al acumulado de R5.1 y su documentación; no autoriza merges ni push, ni commits adicionales por iniciativa del agente.

Se comprobó la rama `refractor/r5-funcionalidad-diseño`; HEAD estaba en `eea2d2c` (documentación de visión futura), posterior a la base histórica `ee455b3`. No había cambios staged. Se conservan ese historial y los cambios locales. Las verificaciones válidas de R5.1 siguen siendo las registradas en su cierre: 213 unitarias, 121 E2E y build aprobado; no se han repetido para esta corrección documental.
