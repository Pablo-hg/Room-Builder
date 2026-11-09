# R5 — Funcionalidad y diseño

## Icono de giro táctil — 07/11/2026

Petición del propietario: sustituir el ratón del botón `camera-orbit-drag` en
formato móvil/tablet. `ViewControls.tsx` incorpora una mano táctil en SVG;
`styles.css` la muestra hasta 1200 px, con puntero táctil principal o cuando la
escena adopta el formato estrecho. Escritorio conserva el ratón. Se mantienen
las flechas, el nombre accesible y todos los eventos de giro. Revisión estática;
sin pruebas/build ni validación visual, que realizará el propietario.

## Contexto de cámara y controles móviles — 07/11/2026

Nueva petición: un único botón Puerta que añada en la habitación enfocada,
panel de habitación ligado a la cámara, barra de zoom y separación de controles
en móvil. Sustituye la elección por carpeta como fuente del contexto visible;
la comprobación de componentes completos/coherentes sigue protegiendo tamaños.

Plan previo: centralizar el contexto de habitación enfocada, conservar selección
de objetos independiente, reutilizar límites de zoom existentes para rueda y
barra, separar cabecera/escena/controles cuando la escena sea estrecha. Añadir
`RoomConfig.extraDoors?: (DoorConfig & { id: string })[]` para permitir añadir
en raíz manteniendo su puerta principal e IDs antiguos; guardar esos diseños
como v8 y mantener lectura v1–v7. Aberturas reales y validación de solapes y
paredes coincidentes; no simular pasos por medianeras duplicadas. JSON/R4 deben
conservar las puertas adicionales. Suites y build pendientes de main.

Implementado: una tarjeta «Puerta · Añadir», contexto `focusedRoom` común al
catálogo/panel/dimensiones, puertas adicionales en raíz con huecos en pared y
rodapié, barra de zoom sincronizada con rueda y valores de cada vista. En escenas
estrechas, cabecera/escena/controles ocupan filas independientes; la brújula
mantiene la proporción de escritorio y su tamaño grande sobre 1200 px.

Análisis estático TypeScript de src y E2E afectados correcto; diff correcto.
Preparadas regresiones `cameraRoomContext.test.ts` y
`camera-context-mobile.spec.ts`, sin ejecutarlas. La revisión visual mediante
computer-use se detuvo porque el acceso al navegador no pudo verificar la URL
actual de Chrome; no se considera validado el diseño móvil. El propietario
indica que hará la comprobación manual. Vite local de revisión en
`http://127.0.0.1:5179/`; sin tests, build, CI, push ni integración.

## Continuación solicitada — 07/11/2026

El propietario solicita recuperar la proporción original de brújula, quitar el
prefijo de habitación de las superficies, seleccionar superficies raíz, editar
dimensiones solo desde una carpeta completa y añadir puertas en otros packs.
Confirma dimensiones independientes por habitación.

Plan técnico previo: deducir la caja rectangular desde suelo y cuatro paredes
coherentes existentes; redimensionar conjuntamente sus superficies sin añadir
otro modelo de vivienda. Al redimensionar la raíz conservar las posiciones
mundiales de los packs mediante sus desplazamientos actuales. Añadir
`StructurePack.doors?: (DoorConfig & { id: string })[]`, ligadas a la superficie
de su pared, con hueco geométrico y validación de límites/solapes. Persistir como
v7 si hay puertas de pack, manteniendo lectura v1–v6. No crear paredes duplicadas
ni pasos falsos: rechazar puertas sobre una pared coincidente con otra pared
hasta disponer de medianeras únicas de #51/#52. Las puertas de packs se editan
en inspector y siguen a su pared; no reutilizar el arrastre global de la puerta
raíz porque sus coordenadas pertenecen a otro espacio.

Pruebas unitarias/E2E/build pendientes de main. Esta ampliación de packs
heredados no certifica la vivienda canónica ni las conexiones entre estancias.

Implementación local de la continuación:

- `Compass.tsx`: restaura zoom 45 a 168 px (proporción original de escritorio),
  manteniendo el escalado por tamaño real que evita el recorte bajo 1200 px.
- `ObjectsPanel.tsx`, `selection.ts`, `multiSelection.ts`: etiquetas locales
  «Suelo», «Techo», «Pared…»; nombres/IDs persistidos intactos.
- `RoomShell.tsx`, `Walls.tsx`: selección directa de suelo/paredes raíz,
  selección múltiple por modificadores y contorno visible fuera de exportación.
- `roomEditing.ts`, `Controls.tsx`, `SettingsPanel.tsx`, acciones constructivas:
  dimensiones disponibles solo desde una carpeta con exactamente una caja
  rectangular completa (suelo y cuatro paredes; techo opcional, coherente si
  existe). Una carpeta incompleta, una superficie, un mueble o una selección
  múltiple no habilitan el cambio de habitación. Colores vinculados a la
  habitación seleccionada. El cambio raíz conserva el mundo de los otros packs
  y conserva muebles identificables por posición dentro de ellos; no añade
  pertenencia canónica de mobiliario a habitaciones.
- `structureDoors.ts`, acciones, inspector y `StructureSurface.tsx`: varias
  puertas por pack con huecos extruidos de su pared, marco y marcadores en Plano.
  Editar posición/color/pared mediante inspector; borrado, renombrado, candados,
  selección/carpetas, referencias y undo/redo. Arrastre espacial de estas
  puertas pendiente: no se conecta al arrastre de coordenadas de la puerta raíz.
- `normalizeDesignV1.ts`, `designMigrations.ts`, `designFile.ts`, `designV1.ts`,
  `projectV2.ts`: persistencia v7 y validación. El prototipo R4 conserva las
  puertas en el legado y las incluye en la huella estructural; no son todavía
  aberturas de una vivienda canónica. La raíz mantiene su puerta principal.

Preparadas `src/state/roomEditing.test.ts` y `tests/room-editing.spec.ts`:
carpetas incompletas, tamaños independientes, conservación del mundo y muebles
de otras habitaciones, etiquetas, dos puertas en distintas paredes, JSON/R4,
borrado en cascada/undo y rechazo de paredes coincidentes o puertas fuera de
límites. Adaptados selectores de E2E a nombres locales, acotando por carpeta
cuando hay varias habitaciones. **No ejecutados**.

Repetir comprobaciones manuales: brújula a 1440/1200/1199/1024/640/430 px;
seleccionar suelo/pared raíz en 3D y lista; dimensiones deshabilitadas sin
carpeta completa; cambiar dimensiones de dos habitaciones por separado y de
raíz sin alterar las otras; añadir varias puertas a un pack desde el catálogo,
editar posición/pared, revisar huecos/Plano, borrar pared y deshacer,
guardar/recargar/exportar/importar. Las conexiones sobre paredes coincidentes
siguen bloqueadas por la dependencia de medianeras únicas. Pruebas, build,
capturas nuevas y aceptación visual pendientes de main/validación humana.

Verificación estática de esta continuación: TypeScript de `src` (incluidas las
pruebas preparadas) y de los seis E2E afectados correcto, sin emisión de archivos;
`git diff --check` correcto. Unitarias, E2E, build y CI **no ejecutados**.
Incluida también regresión de creación contigua a un pack redimensionado:
hereda sus medidas y usa su extensión real para colocar el pack nuevo.

**Estado:** R5.1 fue completada históricamente en `518a990`; el propietario retiró después las variantes del MVP. R5.2 validada manualmente por el propietario, con tests pendientes; R5.3 en implementación, sin tests, y R5.4 aplazada. Las entradas anteriores se conservan como histórico; la última entrada recoge el estado vigente.
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

## Commit de R5.1 y comienzo de R5.2a (03/11/2026)

- Commit solicitado creado: `518a990` — `feat(r5.1): comparar distribuciones y persistir variantes compatibles`. Incluye el acumulado de R5.1 y su documentación, con la cadencia corregida de pruebas por fase completa. El árbol quedó limpio inmediatamente después del commit. No se hizo merge ni push.
- Se inicia R5.2a con inventario del catálogo, revisión de modelos 3D, inspectores, reglas de edición y persistencia. La matriz concreta de ejes/rangos/proporciones está **PROPUESTA** en R5_PLAN, pendiente de D11.
- D12 precisa cómo interpretar el centro al cambiar altura sin romper anclajes. D13 resuelve la diferencia entre el movimiento actual con avisos y un posible rechazo estructural del redimensionado. Se consultan antes de implementar las superficies afectadas.
- Hallazgos: algunos detalles de modelos tienen tamaños fijos; la decoración mural está en `room.windows` y es compartida; los inspectores de aperturas muestran medidas pero no implementan edición general de ancho/alto. El guardado v5 ya conserva cotas, por lo que no se propone cambiar formato ni claves.
- En esta continuación solo se modifica planificación/seguimiento. No hay código de redimensionado implementado ni validación funcional nueva. No se ejecutan tests/E2E/build: corresponden al cierre de toda R5.2, no a R5.2a.

## Continuación de R5.2a — precisión de 5 cm y respuestas D11–D13 (03/11/2026)

- El propietario estableció unidad mínima de 5 cm para tamaños y posiciones y equivalencia visible entre metros y centímetros. Se descarta la precisión manual de 1 mm propuesta anteriormente. Los datos antiguos se mantienen al cargar, conforme a la política previa.
- Confirmó centro XYZ para muebles libres y atravesamientos con borde rojo. Se consultaron dos conflictos concretos: prioridad del centro frente al paso de posición (0,80 → 0,85 m de alto requiere mover la base 0,025 m), y alcance del aviso respecto de otros muebles frente al rechazo de solapes previamente aprobado.
- Base independiente preparada: `measurements.ts` centraliza el paso de 5 cm, lectura de coma/punto y unidades explícitas m/cm, conversión visible y avance desde un valor antiguo sin migrarlo. `MeasurementControl` permite entradas exactas válidas, conserva el valor ante entrada inválida y muestra su equivalencia en cm.
- Se prepararon pruebas de estas reglas numéricas. **No se han ejecutado**; la verificación corresponde al cierre de toda R5.2. Tampoco se ha ejecutado E2E ni build. Los nuevos helpers y el control todavía no están conectados al editor; no se presenta la precisión global como entregada.
- Las reglas dependientes de la prioridad del centro y del alcance de los solapes esperan respuesta. No se ha hecho ningún commit adicional al `518a990` solicitado anteriormente.

## Punto de parada solicitado — R5.2 parcial y aclaraciones definitivas (03/11/2026)

**Petición vigente:** «documenta lo que llevamos hecho y para». Se detiene el desarrollo tras actualizar este informe, el plan y el registro de decisiones. Esta entrada sustituye los estados anteriores contradictorios, sin borrar su historial. No continuar hasta nueva petición del propietario.

### Estado Git comprobado al parar

- Rama: `refractor/r5-funcionalidad-diseño`. HEAD: `518a990` — `feat(r5.1): comparar distribuciones y persistir variantes compatibles`.
- El commit anterior `eea2d2c` de visión futura se conserva. No se ha creado ningún commit adicional, merge ni push.
- Modificados sin commit: `docs/DECISION_LOG.md`, `docs/R5_PLAN.md`, este informe, `src/domain/objectCatalog.ts`, `src/state/types.ts` y `src/state/useRoomStore.ts`.
- Nuevos sin seguimiento: `src/components/editor/MeasurementControl.tsx`, `src/domain/measurements.ts`, `src/domain/measurements.test.ts`, `src/domain/resizeCapabilities.ts`, `src/domain/furnitureResize.ts` y `src/state/actions/resizeActions.ts`. Son parte del avance local y deben conservarse al retomar.

### Decisiones vigentes del propietario

1. **Precisión:** centímetros enteros para dimensiones y posiciones introducidas. Válidos: 0,13 m / 13 cm, 0,24 m / 24 cm y 1,17 m; inválidos: 15,5 cm y 1,154 m. Esto sustituye el paso mínimo absoluto de 5 cm, manteniendo metros internamente y equivalencia visible m/cm.
2. **Movimiento:** saltos de 5 cm para facilitar la interacción; cuadrícula visible de 25 cm. La base preparada calcula el salto relativo al origen exacto introducido: de 24 a 29 cm. Aún falta integrarlo en los gestos del editor.
3. **Origen y redimensionado:** las dimensiones parten del centro de la base local (0,0,0). Interpretación aplicada en la regla pura: conservar X/Z y base Y para muebles libres, creciendo desde la base. Sustituye conservar el centro geométrico XYZ. Alfombras nuevas siguen en el suelo y lámparas nuevas fijadas al techo conservan el apoyo superior; objetos antiguos sin marca conservan la política D9/D10.
4. **Atravesamientos:** permitir cualquier atravesamiento al redimensionar mobiliario, también con otro mueble, mostrando borde rojo. Sustituye rechazar los solapes de esta operación. Seguir rechazando entradas inválidas o fuera de límites. No autoriza cambiar implícitamente el movimiento ni las restricciones constructivas murales.
5. **Rangos:** se delegó elegir límites amplios para aproximar objetos reales. La preparación actual usa 0,01–10 m por eje editable. Los diámetros vinculados y la TV sin proporción fija son criterios provisionales del código; no se atribuye al propietario una aprobación expresa de cada detalle de la matriz.
6. **Verificación:** tests, E2E y build al completar cada fase entera, comenzando por R5.2. La petición de parar no cierra la fase ni elimina sus verificaciones pendientes.

### Código realmente preparado, no entrega completa

| Archivo o área | Estado comprobado |
| --- | --- |
| `measurements.ts` | Helpers de precisión 0,01 m, movimiento 0,05 m, lectura de coma/punto y m/cm, formateo y movimiento relativo al origen |
| `MeasurementControl.tsx` | Campo y rango reutilizables, equivalencia en cm, rechazo de entradas inválidas y pasos incrementales; todavía sin integración en los inspectores |
| `resizeCapabilities.ts` + `objectCatalog.ts` | Capacidad `resize` por tipo, límites provisionales, vínculos de diámetros; alfombras sin edición de grosor, decoración mural ancho/alto; puertas/ventanas y cuadros legacy en `furniture` excluidos |
| `furnitureResize.ts` | Cálculos puros con origen de base, anclajes, validación numérica y mural; no bloquea intersecciones del mobiliario |
| `resizeActions.ts`, `state/types.ts`, `useRoomStore.ts` | Acciones declaradas y compuestas en el store, comprobación de candado y avisos mediante `furnitureHasSpatialWarning`; no disponibles aún en la UI de tamaño |
| `measurements.test.ts` | Casos preparados, pero **desactualizados**: aún esperan la unidad mínima anterior de 5 cm y contradicen el helper de 1 cm; deben corregirse antes de ejecutar la suite |

No se cambiaron en esta preparación `PersistedDesign`, versión, claves de almacenamiento ni el papel candidato de `ProjectV2`. La parada documental no añade cambios de implementación. El código parcial no se considera compilado, probado ni validado visualmente.

### Pendientes y riesgos concretos para reanudar

- Corregir las expectativas numéricas antiguas y añadir pruebas pertinentes de redimensionado, candados, historial, variantes, anclajes y compatibilidad.
- Integrar los controles en inspectores de mobiliario y decoración mural y adaptar los modelos 3D: sus detalles fijos todavía no garantizan representar las nuevas cotas.
- Aplicar precisión de 1 cm y movimiento relativo de 5 cm a entradas, arrastres, ejes y selección múltiple. **El editor actual aún usa `placementStep: 0.125`; la cuadrícula permanece `gridSize: 0.25`.** La nueva política no está aplicada globalmente.
- Revisar compatibilidad de guardado: **`normalizeDesignLayouts` todavía rechaza muebles solapados en v5**, mientras la nueva acción de redimensionado permite esos solapes. Resolver y probar el guardado/recarga antes de ofrecer la función; revisar también `safeRoomUpdate` y variantes inactivas para no bloquear ediciones por solapes ya permitidos.
- Evitar que cambiar pasos globales altere normalización legacy, posiciones antiguas, grosores de estructura o las pruebas del contrato R4. No migrar datos antiguos por mera carga.
- La regla provisional rechaza redimensionar una lámpara fijada si el techo antiguo no está en centímetros enteros. Revisar este caso de compatibilidad y su mensaje antes del cierre, sin normalizar datos por iniciativa propia.
- Completar historial por gesto, accesibilidad, equivalencia m/cm y verificación de las vistas afectadas. Asas de R5.2d opcionales, todavía sin implementar.
- R5.3 no iniciada: resolver D7 sobre IDs duplicados antes de su importación. R5.4 sigue aplazada.

### Verificación y siguiente paso

- Las últimas pruebas válidas de **R5.1** son históricas: **213/213 unitarias**, **121/121 E2E Chromium**, build aprobado con aviso de bundle. No se han repetido ni validan los cambios locales de R5.2.
- **R5.2:** no se han ejecutado tests, E2E, comprobación TypeScript ni build; fase incompleta y detenida. En esta parada solo se comprueban estado/diff y documentación mediante `git diff --check`.
- Al recibir una nueva petición de continuación: volver a comprobar rama, estado y archivos nuevos; usar estas decisiones vigentes; completar la integración y compatibilidad anteriores; ejecutar y registrar las verificaciones reales al terminar toda R5.2. No iniciar R5.3 ni crear otro commit por iniciativa propia.


## R5.2 — implementación preparada para validación manual (04/11/2026)

El propietario indicó continuar R5.2, no ejecutar tests y avisar para validar en la web. Confirmó además que elimina las variantes del MVP. Se respetaron los cambios locales preexistentes que retiran la interfaz y aplanan v5 a su distribución activa; esa decisión sustituye el alcance anterior de R5.1. El código de R4 `ProjectV2` sigue siendo candidato.

- Controles de dimensiones para muebles y decoración mural compatibles, con centímetros enteros, entrada en m/cm, errores visibles y bloqueo de edición en objetos bloqueados. Alfombras mantienen grosor; formas circulares vinculan diámetro; las aberturas conservan restricciones constructivas.
- El modelo 3D de mobiliario se escala con las dimensiones; se adaptaron detalles de estantería y aplique mural. El origen de los muebles libres sigue en el centro de la base; alfombras y lámparas de techo conservan su anclaje según tipo.
- Movimiento en saltos de 5 cm respecto de la posición inicial en gestos de mobiliario, aberturas y superficies; entrada manual con precisión de 1 cm y cuadrícula visible de 25 cm. Las medidas antiguas no se redondean por cargar.
- Se permiten atravesamientos al redimensionar mobiliario con aviso y borde rojo, incluso entre muebles; se ajustó la lectura para conservar cotas y posiciones existentes y aceptar mobiliario solapado. Se mantienen claves de almacenamiento y formato de una distribución. La conversión local v5 a v4 elimina las variantes al guardar: solo se conserva el mobiliario activo.
- `npm run build`: **aprobado** (TypeScript y Vite, 141 módulos); aviso habitual por bundle superior a 500 kB, aproximadamente 1,43 MB sin comprimir. `git diff --check`: sin errores. Estas comprobaciones no validan funcionalidad, interfaz ni migraciones.
- **No se ejecutaron tests unitarios ni E2E**, por indicación expresa. Los resultados históricos de R5.1 no verifican el árbol actual. `src/domain/measurements.test.ts` sigue desactualizado respecto al cambio posterior de 1 cm y deberá actualizarse antes de ejecutar la batería. No se ha validado visualmente la interfaz.
- Pendiente: validación manual del propietario en la web y pruebas automatizadas de medidas, anclajes, historial, solapes, guardado/recarga y compatibilidad v1–v5 cuando se autoricen. R5.2 no se declara verificada ni cerrada. No se inició R5.3; D7 de IDs duplicados sigue pendiente. No se hicieron commits, merges ni push.

- En la comprobación final aparecieron además modificaciones locales en archivos de pruebas y un fixture que no figuraban en el estado inicial de esta continuación. Se han conservado; no se atribuyen a esta implementación ni se han ejecutado.


## R5.2 — teclado, historial y registro de medidas (04/11/2026)

El propietario pidió que las flechas de teclado funcionen como los botones, que deshacer/rehacer vuelva al estado anterior al ajuste completo y que el registro no guarde cada centímetro intermedio. También pidió no hacer pruebas.

- Los botones y las flechas comparten el mismo paso y la misma repetición acelerada, tanto en el campo como en el deslizador; los botones enfocados también responden a las flechas verticales.
- Cada edición de una medida agrupa sus cambios en una transacción desde el primer cambio hasta confirmar con Enter, salir del control, perder la ventana o cambiar de elemento. Así Ctrl+Z recupera el valor previo al ajuste, y rehacer recupera su resultado. Los atajos también se gestionan con el campo de medida enfocado.
- El registro de desarrollo agrupa los cambios intermedios y anota una sola entrada con medida, valor inicial y final al cerrar la edición. El gesto del inspector ya no inicia una transacción paralela para el deslizador de medidas.
- No se ejecutaron tests, E2E ni build para estos cambios, por petición expresa. Quedan pendientes la validación manual del propietario y las comprobaciones automatizadas de R5.2, incluido historial, teclado y registro. No se hicieron commits, merges ni push.


## Atajo de guardado e inspector plegable (04/11/2026)

- Ctrl/⌘+G ejecuta el mismo guardado que el botón de la cabecera, también con un campo editable enfocado; primero se pierde el foco para confirmar la edición en curso. Si no hay diseño activo se usa el comportamiento existente de guardado inicial.
- El atajo anterior de agrupación pasa a Ctrl/⌘+Alt+G para evitar el conflicto; se actualizaron la guía y el menú contextual. Ctrl/⌘+Mayús+G sigue desagrupando.
- El inspector puede minimizarse y volver a mostrarse mediante un botón con estado accesible; se mantiene la selección.
- No se ejecutaron pruebas ni build, conforme a la indicación vigente del propietario. La validación manual sigue pendiente.


## Continuación de R5.2 — precisión al duplicar y anclaje visual (04/11/2026)

- Al pegar mobiliario o elementos murales, la posición nueva se expresa en centímetros sin forzarla a la cuadrícula de movimiento de 5 cm; las alturas libres nuevas se ajustan a centímetros y los objetos fijados conservan su anclaje. No se modifican los objetos de origen ni las cotas antiguas por el mero hecho de cargarlos.
- Se eliminó el desplazamiento visual heredado de 2 cm para los objetos nuevos fijados al suelo o al techo, manteniéndolo para los antiguos sin marca. La geometría de aviso y los límites de selección usan el mismo desplazamiento; la alfombra circular fijada dispone de grosor visual hasta el suelo.
- Una lámpara nueva en una habitación de altura antigua inferior a su tamaño conserva su extremo superior fijado al techo. El render de tipos desconocidos evita usar propiedades heredadas como si fueran una definición del catálogo.
- Los gestos que no alcanzan el primer desplazamiento ya no redondean involuntariamente una posición antigua; un valor manual inválido no se utiliza como base del botón de incremento.
- No se ejecutaron tests, E2E ni build por la instrucción vigente. Estas correcciones y la integración de R5.2 siguen pendientes de validación manual y automatizada. No se inició R5.3 ni se hizo commit.

## Retirada del inspector plegable (04/11/2026)

El propietario pidió eliminar la opción de minimizar el inspector del elemento. Se retiraron el control y su estado; la entrada anterior se conserva como histórico. El atajo Ctrl/⌘+G para guardar sigue disponible. Sin tests ni build por la instrucción vigente.


## R5.2 — medidas de ventanas y decisión de IDs de R5.3 (04/11/2026)

- El propietario pidió editar dimensiones de ventanas y continuar después con R5.3. El catálogo habilita ancho y alto para ventanas rectangulares y un diámetro común para circulares. Los controles existentes aplican centímetros enteros, candados e historial; el hueco se reconstruye a partir de las medidas y la lectura conserva las cotas guardadas.
- El redimensionado conserva el centro horizontal y la altura de base y comprueba límites de pared y separación. Para ventanas giradas se comprueba además su caja envolvente frente a la pared y otras aperturas: es una validación conservadora que puede rechazar algunas posiciones que visualmente cabrían. El marco se adapta a ventanas pequeñas.
- El propietario confirmó para D7 que un diseño importado con ID ya existente se añadirá como copia con ID nuevo (RB-042). Reemplazar un diseño existente sigue pendiente; se mantiene el límite de biblioteca.
- No se ejecutaron tests, E2E ni build por la instrucción vigente; tampoco se ha realizado la validación visual. La funcionalidad de ventanas y el conjunto de R5.2 quedan pendientes de validación manual y pruebas, incluyendo geometría de huecos y compatibilidad de guardado. R5.3 no se inicia antes de cerrar y verificar R5.2 conforme a la condición expresamente indicada para las fases.


## R5.2 validada manualmente y avance R5.3 (04/11/2026)

El propietario confirmó que había validado R5.2 en la web, incluidas ventanas, guardar/recargar y deshacer, y pidió continuar. Esta confirmación es una validación manual comunicada por el propietario; no sustituye los tests automatizados pendientes.

- R5.3a–d: preparado archivo JSON `room-builder-design`, `schemaVersion: 5`, límite de 2 MiB y datos de un diseño con el formato de almacenamiento existente. Se exporta la escena actual, incluidos cambios sin guardar, con nombre y fecha. El archivo se valida antes de descargarlo.
- Importación con lectura limitada, análisis de JSON, comprobación de valores, IDs, referencias, geometría, anclajes y jerarquías; se rechazan propiedades peligrosas, contenidos excesivamente complejos y discrepancias de espejo en v5. Por seguridad, las cotas positivas importadas se limitan a 100 m y las coordenadas/ángulos a valores absolutos de 10 000; son límites del archivo, no nuevos controles del editor. No se escribe durante la lectura ni en la vista previa.
- La vista previa muestra nombre, habitación, cantidad de muebles y versión; advierte de variantes antiguas que se descartan y de IDs duplicados. La confirmación añade el diseño a la biblioteca; si el ID ya existe, se genera otro. Biblioteca llena y errores de almacenamiento se comunican sin sustitución de diseños. La escena activa no cambia al importar.
- Se mantiene `ProjectV2` como candidato y no cambian las claves ni el contrato de almacenamiento. La retirada de variantes del MVP se respeta; los archivos v5 importan la distribución activa con aviso. R5.3e y la validación de seguridad, compatibilidad, interfaz, exportación e importación siguen pendientes; no se declara la fase verificada.
- No se ejecutaron tests unitarios ni E2E, conforme a la instrucción vigente. Se ejecutó únicamente la comprobación de tipos TypeScript; el primer intento detectó dos errores de tipos que se corrigieron antes del segundo intento aprobado. Sin commit, merge ni push.

- La validación estricta rechaza referencias huérfanas. Al exportar se omiten únicamente referencias obsoletas o duplicadas de la copia del archivo, sin modificar el diseño abierto, y se avisa de cuántas se omitieron. Su compatibilidad y la importación siguen pendientes de verificación.


## R5.3 — menú de diseños y confirmaciones centrales (04/11/2026)

El propietario comunicó que al confirmar el borrado también se activaba la importación y solicitó un menú contextual y confirmaciones modales centrales.

- Las confirmaciones de borrar e importar se muestran en una capa modal centrada e independiente del desplegable. La capa bloquea los clics del fondo; Escape cancela y Tab mantiene el foco dentro del diálogo. El texto de la importación sigue avisando de variantes descartadas e IDs duplicados.
- El menú de opciones se abre con clic derecho sobre el selector o un diseño de la lista, y con el botón de más opciones. Contiene descargar 3D, exportar/importar JSON, copiar, crear en blanco, renombrar y borrar. Las acciones de una fila se refieren a ese diseño; descargar 3D requiere que sea el diseño abierto, porque utiliza la escena actual.
- No se ejecutaron tests ni E2E por indicación del propietario; la corrección del conflicto, el menú, el foco y los diálogos siguen pendientes de validación manual y automatizada. No se modificaron claves de almacenamiento ni se hicieron commits.


## Corrección de descarga repetida al borrar un diseño (04/11/2026)

El propietario indicó que, tras borrar un diseño, seguía abriéndose el diálogo para guardar una descarga. La revisión encontró una causa concreta distinta de la hipótesis anterior de clic a través del modal: después de una descarga GLB, `SceneExportController` volvía a procesar la misma solicitud al cambiar el nombre del diseño activo. Borrar el diseño activo puede cambiar ese nombre.

- El controlador procesa cada número de solicitud solo una vez y solo mientras la descarga está activa. El número procesado se conserva fuera del Canvas, que puede volver a montarse al cambiar de cámara. Así un cambio de nombre, una nueva renderización o un cambio de cámara no reutilizan una descarga anterior.
- Esta corrección no cambia el borrado ni la importación. No se ejecutaron tests ni E2E por la instrucción vigente; queda pendiente que el propietario compruebe la secuencia en la web.

## Ajuste del menú de diseños (04/11/2026)

El propietario pidió retirar «Crear diseño nuevo» del menú contextual. La opción de crear un diseño desde la lista de diseños guardados sigue disponible. Sin tests ni build por la instrucción vigente.

## Ubicación de la importación (04/11/2026)

El propietario pidió mover «Importar diseño» del menú contextual al selector de diseños, junto a «Crear diseño». Se conserva la vista previa con confirmación y el bloqueo cuando la biblioteca está llena. Sin tests ni build por la instrucción vigente.

Posteriormente pidió mostrar ambas opciones en la misma fila; el formulario de creación se abre debajo. Sin tests ni build.

## Verificación y cierre pendiente de R5 (04/11/2026)

El propietario autorizó completar los pendientes y las pruebas antes de subir los cambios. Se conservan las entradas anteriores como historial.

- La lectura de v5 comprueba que exista la distribución activa y que su mobiliario coincida semánticamente con el espejo superior; rechaza discrepancias sin reescribir el original. Se validan también las dimensiones positivas y finitas de la habitación. Se mantiene la conversión de la distribución activa y las claves existentes.
- Se corrigió la marca de cambios pendientes al crear un diseño: se respeta un `false` explícito. Se actualizaron dos textos del editor para indicar el desplazamiento de 5 cm.
- Se añadieron pruebas de importación/exportación JSON, fixtures v1–v5, validación de entradas, copia por ID duplicado, capacidad, errores de escritura, medidas, anclajes y ventanas. Se adaptaron pruebas antiguas a las decisiones actuales y se mantienen los hashes de modelos por defecto.
- `npm test`: **213 pruebas aprobadas**. La primera ejecución de diagnóstico tuvo fallos por expectativas anteriores y un error real de cambios pendientes, corregidos antes de la ejecución aprobada.
- `npm run build`: aprobado tras la última corrección, 143 módulos; Vite avisa de un paquete JavaScript mayor de 500 kB (1.447,19 kB antes de gzip).
- E2E dirigidos: medidas y guardado/recarga, JSON con importación como copia, descarga GLB y regresión de descarga repetida tras borrar y cambiar de cámara aprobados. Una primera ejecución no pudo conectar con el servidor y otra usó un nombre de cámara incorrecto en la prueba; ambas se repitieron con los resultados indicados.
- La primera pasada E2E completa terminó con **84 aprobados y 35 fallidos**. Se actualizaron casos históricos por selectores, precisión al centímetro, formato guardado y menú actuales; la repetición conjunta obtuvo **33 aprobados y 2 fallidos**, y esos dos pasaron en ejecuciones individuales después de ajustar sus pruebas. No se ha repetido la suite completa en una sola ejecución tras estos ajustes. La validación manual de R5.2 fue comunicada previamente por el propietario, no se atribuye a esta ejecución.
- La regresión detectó que la zona de arrastre de una selección múltiple quedaba por debajo del modelo visual. Se amplió ligeramente su volumen interactivo; las pruebas E2E de selección y arrastre con ratón y pantalla táctil pasaron después del cambio. `npm test` y `npm run build` se repitieron tras corregirlo.
- El reemplazo de un diseño importado sigue pendiente de decisión; la biblioteca llena bloquea la importación. R5.4 se mantiene aplazada y `ProjectV2` como contrato candidato. Sin commits, merges ni push durante esta continuación.


## Reconciliación de GitHub (04/11/2026)

La rama `main` integra R5 mediante el merge de PR #21 (a `dev`) y PR #22 (a `main`), commit `d5ff7841b9b20a97fcc0d337ceb7f4c687588799`. Las frases anteriores «sin commit/merge» son testimonios del momento de escritura y **no describen el estado remoto posterior**. Esta reconciliación no constituye una nueva ejecución de pruebas: se conserva el dato del informe (213 unitarias y build aprobados, E2E dirigidas aprobadas y suite completa todavía sin repetición única final). La verificación final queda en la [issue #24](https://github.com/Pablo-hg/Room-Builder/issues/24).
# Revisión de seis incidencias — 07/11/2026

## Solución técnica previa a implementación

Petición del propietario: alfombras, bloqueos XYZ, nombre Habitación, giro circular,
brújula adaptable y textos Subir/Bajar, en `feature/24-certificar-r5-e2e-ci`.

- Añadir `axisLocks?: { x: boolean; y: boolean; z: boolean }` a las entidades
  móviles existentes (muebles, packs, superficies y aberturas). Es una extensión
  opcional, sin cambiar IDs ni claves de almacenamiento. Revisión del contrato
  antes de implementarlo: guardar como **v6** cuando haya candados explícitos;
  mantener la lectura v1–v5 y las versiones anteriores para datos sin candados.
  Leer v1–v5 sin la propiedad conserva los valores por defecto actuales. Validar
  estrictamente la propiedad cuando exista; conservarla en JSON, historial y R4.
- El bloqueo congela una coordenada; no es un anclaje. En muebles, la primera
  edición de candados materializa la altura absoluta visible y sustituye la
  fijación automática por coordenadas explícitas. Bloquear Y posteriormente no
  recoloca el objeto. La marca histórica `attachmentPolicy` se conserva.
- Las alfombras heredadas mantienen sus coordenadas guardadas: corregir su base
  visible únicamente si coincide con una losa de suelo en su huella y nivel.
  Usar la misma base en render y límites; nunca elevar todo el catálogo ni elegir
  siempre la planta más alta. Los muebles con candados explícitos usan Y absoluta.
- Las aberturas mantienen los ejes permitidos por la pared; desbloquear no las
  libera de ella. Los packs se desplazan completos, conservando sus superficies.
  La multiselección solo se mueve por ejes permitidos en todos sus elementos;
  girar un grupo tampoco puede eludir candados de posición.
- La vivienda canónica con plantas y medianeras sigue pendiente de #51–#53.
  Esta corrección usa los packs independientes existentes, sin simular una casa
  canónica ni introducir relaciones persistidas de pertenencia a una habitación.
- La simetría horizontal se declara por modelo, sin borrar rotaciones guardadas.
  La brújula ajustará la cámara al tamaño real del canvas, manteniendo los
  breakpoints y distribución responsive recientes.

Validación: revisión estática y preparación de regresiones. Por política del
propietario no ejecutar unitarias, E2E, build ni CI en esta rama; ejecución
pendiente en `main`. Las capturas aportadas son evidencia del defecto previo,
no validación visual de la solución.

El contenedor JSON de intercambio sigue en `schemaVersion: 5`; la versión de
`design.data` pasa a 6. Son contratos distintos. Las aplicaciones anteriores
no entienden v6; debe usarse la versión actual del editor para abrir esos diseños.

## Resultado local de las seis incidencias

| Incidencia | Causa | Cambio y archivos principales |
| --- | --- | --- |
| Alfombras enterradas | La losa está centrada en su cota y su cara superior sobrepasa la alfombra; los muebles nuevos fijados no tenían desfase | `furniturePlacement.ts`, `objectCatalog.ts`, `FurnitureObject.tsx`, `multiSelection.ts`, `multiFurniture.ts`, `structureCollisions.ts`: apoyo en la cara superior del suelo de su nivel, base compartida por render/selección/avisos. Datos antiguos conservados; los nuevos guardan su base absoluta |
| Restricción vertical y ausencia de candados XYZ | El catálogo confundía fijación por tipo con capacidad de elevar; algunos caminos de movimiento trabajaban directamente con coordenadas | `axisLocks.ts`, `types.ts`, acciones de muebles/construcción/redimensionado/selección, inspectores, gizmos, `designV1.ts`, normalización y persistencia: candados individuales, historial, multiselección, validación y formato v6. Las aberturas siguen sujetas a su pared y la puerta al suelo |
| Nombre Piso | `addStructurePack` generaba literalmente `Piso N` y el inspector usaba «Eliminar piso completo» | `constructionActions.ts`, `PackInspector.tsx`: `Habitación N` y «Eliminar habitación completa». IDs y nombres guardados anteriores no se reescriben |
| Aro en objetos circulares | La escena añadía el aro a todo mueble; el inspector usaba una excepción aislada para la lámpara de techo | `objectCatalog.ts`, `FurnitureInspector.tsx`, `FurnitureObject.tsx`: capacidad por modelo, con excepción para elipses antiguas. Ocultar en lámparas de techo/pie/mesa, papelera y alfombra circular; conservar en jarrón por su adorno lateral, planta y alfombra rectangular. `FurnitureModels.tsx`: disco inferior de lámpara horizontal, imprescindible para la simetría. Ángulos guardados intactos |
| Brújula recortada | Se reducía el canvas conservando zoom ortográfico de píxeles; tamaño interior y contenedor tenían reglas independientes | `Compass.tsx`, `styles.css`: cámara proporcional al canvas real, margen para etiquetas y hover, canvas centrado proporcional; breakpoints recientes conservados |
| Textos de ordenación | Literales «Mover arriba/abajo» y «Subir/Bajar carpeta» | `SceneContextMenu.tsx`, `FolderInspector.tsx`: «Subir/Bajar», mismos handlers y atajos |

### Verificación realizada

- Revisión del código real, diff, coordenadas, anclajes, persistencia y rutas de
  movimiento; revisión de las cuatro capturas del defecto anterior.
- Análisis estático TypeScript sin emisión: `tsc --project tsconfig.app.json
  --noEmit --incremental false`, correcto. Incluye `src` y sus pruebas preparadas.
- Análisis de tipos sin emisión de los seis archivos E2E modificados, correcto.
- Unitarias, E2E, build y GitHub Actions **no ejecutados** en esta rama.
  No hay certificación funcional ni validación visual de la solución.

### Regresiones preparadas y pendientes de ejecutar en main

- `src/state/axisLocks.test.ts`: congelación XYZ, multiselección y giro,
  desbloquear/rebloquear/deshacer/rehacer, alfombras heredadas en otra altura,
  creación en habitación activa, packs/superficies/aberturas, recarga/JSON/R4,
  datos de candados inválidos y simetría frente a modelos asimétricos/elipses.
- `furnitureAttachmentCompatibility.test.ts`: apoyo corregido y semántica de Y
  congelada; conserva los casos antiguos. `designV1.test.ts` y fixture de versión
  desconocida ahora usan 999 porque 6 es una versión reconocida.
- `FurnitureModels.test.ts`: comprueba la orientación horizontal del disco y
  mantiene la firma histórica para el resto de primitivas, sin borrar la prueba.
- `tests/furniture-attachments.spec.ts`: controles Y visibles/bloqueados,
  desbloqueo, elección de altura y guardado; compatibilidad antigua y selección.
- `tests/compass-responsive.spec.ts`: 1200, 1199, 1024, 1000, 950, 850, 640 y
  430 px, límites de canvas, separación del zoom y capturas isométrica/Libre.
  Las capturas requieren revisión humana: los límites del canvas por sí solos
  no demuestran que sus etiquetas WebGL estén bien.
- Selectores actualizados en `room-views`, `history-transactions`,
  `structure-extraction` y `room-builder` para los textos nuevos.
- Tras integración autorizada: workflow de main (`npm ci`, `npm test`,
  `npm run build`, `npm run test:e2e`).

### Comprobaciones manuales del propietario

1. Añadir ambas alfombras en la habitación base y en un pack elevado; comprobar
   apoyo en Plano/Isométrica/Frontal y que diseños antiguos conservan posición.
2. Bloquear cada eje y probar inspector, arrastre directo, flechas del gizmo y
   teclado; desbloquear Y, elegir altura, bloquear otra vez sin salto.
3. Guardar/recargar/exportar/importar; deshacer/rehacer candados y movimientos.
   Probar una selección con elementos que tengan candados distintos y un pack
   con una superficie bloqueada. Verificar que puerta/ventanas siguen en pared.
4. Crear un pack vacío: nombre «Habitación N». Los nombres guardados anteriores
   se conservan; pueden renombrarse con F2.
5. Revisar ausencia de aro en los modelos circulares indicados y su presencia
   en jarrón/planta/alfombra rectangular; comprobar elipses antiguas y ángulos
   guardados, que no se borran.
6. Revisar las ocho anchuras indicadas, etiquetas normales y hover de la brújula,
   orientación por clic y separación de cámara/zoom; comprobar «Subir/Bajar».

### Límites y riesgos pendientes

La inferencia de apoyo antiguo solo corrige alfombras cercanas a una losa de su
nivel; no cambia alturas arbitrarias ni asigna una habitación canónica. Un
mueble con candados explícitos conserva Y absoluta aunque se mueva una losa o
cambie la altura de la habitación: para recolocarlo hay que desbloquear Y.
La vivienda por plantas y medianeras físicas únicas corresponde a #51–#53.
La versión v6 exige el editor actualizado. La certificación funcional, las
capturas nuevas y aceptación manual siguen pendientes. Sin PR, push, integración
ni publicación automática; solo commits locales en la rama autorizada.


### Continuación F0: ejecución 42537312577 (09/11/2026)

Base `a587762`, push a main: unitarias y build correctos; E2E fragmento 3/4 correcto y ocho fallos en 1/4, 2/4 y 4/4. Se descargaron los logs y los tres artefactos de fallo. La certificación F0 sigue pendiente.

- Selector de puerta: la prueba esperaba Posición lateral, que solo aparece con pared girada; se comprueba Posición X en la configuración inicial.
- Órbita libre: la prueba esperaba un evento de instrumentación retirado; ahora comprueba el cambio de orientación de la brújula. Pendiente verificar el control en CI.
- Gizmo X: la instrumentación anterior ya no emite el evento esperado. Sigue pendiente una comprobación que identifique el eje sin debilitar la aserción.
- Selección de carpeta: la captura sitúa Carpeta 1 después de los elementos de Raíz; el rango ahora termina en la carpeta y sigue exigiendo los cuatro elementos. Pendiente comprobar el orden y la selección real en CI.
- IndexedDB: la prueba agotó 30 s dentro de evaluate; falta localizar la transacción bloqueada o lenta. Su causa raíz y corrección siguen pendientes.
- Restablecer plano: la captura final no igualó exactamente la inicial; falta distinguir estado de cámara y sincronización/renderizado.
- Ventana frontal: no se seleccionó en la coordenada usada; falta determinar impacto real y corregir el punto o la interacción.
- Órbita sobre pared: se inició la órbita en el punto supuesto de pared; falta demostrar qué geometría alcanzó el rayo y corregir el caso sin perder prioridad de pared.

No se ejecutaron pruebas, build ni CI en esta rama. Tras completar las correcciones y la integración manual autorizada en main, ejecutar `npm ci`, unitarias, build y suite E2E completa en sus cuatro fragmentos; revisar artefactos y los comportamientos funcionales indicados. Ninguna modificación aquí acredita una pasada ni certifica F0.

### Continuación local de los ocho fallos (09/11/2026)

El propietario autorizó pruebas locales en ramas de trabajo; GitHub Actions sigue limitado a `push` a `main`. En IndexedDB se encolan juntas las consultas de claves de cada lote, sin cambiar la transacción, retención ni deduplicación: antes se esperaban en serie y el caso tardó 26,9 s localmente frente al límite de 30 s. No se observó un bloqueo de transacción; las pruebas posteriores deben confirmar el comportamiento bajo carga.

La prueba del gizmo arrastra en diagonal y exige movimiento en X sin cambios en Y ni Z. La de plano verifica el desplazamiento, cambio de zoom y restitución de los tres valores de cámara, sin exigir imágenes idénticas. En frontal se ocultaron las aperturas ligadas exclusivamente a paredes ocultas: la puerta de la pared opuesta interceptaba la ventana. La prueba de órbita identifica una pared seleccionable antes de arrastrarla y comprueba el ángulo continuo, evitando deducirlo del texto discreto de paredes visibles.

Las ocho regresiones originales pasaron juntas localmente (8/8, un trabajador); las unitarias pasaron 429/429 y el build pasó con aviso de bundle de 1.569 kB. La primera ejecución completa E2E con dos trabajadores se interrumpió tras un timeout en una prueba móvil; esa misma prueba pasó con un trabajador. La repetición completa local, sin filtros y con un trabajador, terminó con **176/176** en 24,9 minutos. `git diff --check` pasó. Quedan pendientes la integración manual y el CI completo de `main`; F0 no está certificada.
