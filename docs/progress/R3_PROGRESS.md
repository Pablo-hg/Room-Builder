# R3 — Informe de progreso

**Estado final:** R3.1–R3.7 completadas como refactor en `refactor/r3-dominio-estado`, sobre la base actualizada `77a502e`. Suite previa a la corrección del foco: 41/41 E2E. Tras la corrección: regresión específica 1/1, 101/101 unitarias y build aprobado; la nueva suite completa no se terminó por petición del usuario. Sin commits nuevos ni publicación.

Este es el único informe Markdown de R3. Sus subpartes se documentan aquí. Los apartados históricos conservan el estado, las pruebas y los pendientes de cada entrega; algunos se resolvieron en entregas posteriores. Las nuevas continuaciones deben ampliar este informe conservando el historial.

## Contenido

- [R3.1: inicio sobre la base antigua y actualización posterior](#r3-1).
- [R3.2 y R3.3: reglas puras y formato v1](#r3-2-3).
- [R3.4 y R3.5: migraciones, repositorio y acciones](#r3-4-5).
- [R3.6 y R3.7: transacciones y medición de renders](#r3-6-7).
- [Corrección tras la revisión: foco del inspector](#r3-inspector-focus).

## Evidencias de medición

La carpeta `measurements/` contiene dos JSON con los conteos de invocaciones de componentes React antes y después de R3.7, usando el mismo fixture y diez actualizaciones por recorrido. Son evidencias de pruebas; no forman parte de la web ni de los diseños guardados. No miden FPS ni tiempos de ejecución.

- [Antes: R3_RENDER_BEFORE.json](measurements/R3_RENDER_BEFORE.json).
- [Después: R3_RENDER_AFTER.json](measurements/R3_RENDER_AFTER.json).

<a id="r3-1"></a>

## Inicio de R3 — dominio y estado

Fecha: 28/10/2026. Rama: `refactor/r3-dominio-estado`, creada desde la referencia local `origin/main` en `80ae30c`, con autorización expresa para iniciar el desarrollo.

### Base y alcance

La referencia local de `origin/dev` contiene R1/R2 y tiene 28 commits adicionales respecto a esta base. No se ha hecho merge. Esta entrega adelanta una extracción acotada de R3.1 sobre las funciones presentes en `main`; la integración con los módulos extraídos en R1/R2 sigue PENDIENTE. No significa que se hayan completado las dependencias del plan detallado de `origin/dev`.

**Corrección tras consultar GitHub (28/10/2026):** el plan del `main` remoto sí conserva R2.1–R2.9 completadas. La referencia local de `origin/main` usada para crear esta rama estaba desactualizada; las menciones anteriores a `main` describen exclusivamente la base `80ae30c`, no el estado actual de GitHub. Se ha restaurado ese detalle en [REFACTOR_PLAN.md](../REFACTOR_PLAN.md), junto con el desglose R3.1–R3.7. Sigue pendiente actualizar la base de código conservando los cambios de esta rama.

Los únicos archivos sin seguimiento al iniciar el desarrollo eran cachés de Python en `scripts/ai/__pycache__/`; se conservan. `docs/AGENT_EFFICIENCY.md` no existe en esta base.

### Implementado

- `src/domain/elementIds.ts`: generación de IDs y composición de IDs de superficies con el formato anterior. El store mantiene su export público de `structureSurfaceElementId` por compatibilidad.
- `src/domain/selection.ts`: búsquedas de muebles, elementos murales, packs y superficies, apertura seleccionada y nombres de elementos. Recibe datos de dominio sin depender de Zustand, React ni Three.js.
- El inspector usa la derivación común; la escena importa el compositor de IDs desde dominio; el store usa los nombres y generador extraídos.
- Se conserva la selección por igualdad de cadenas, sin interpretar ni normalizar IDs antiguos. También se mantiene la precedencia de nombres y las búsquedas independientes cuando coinciden IDs entre categorías.

R3.2–R3.7 siguen PENDIENTES. Los formatos persistidos y las acciones del store conservan su comportamiento.

### Verificación

- Antes del cambio: `npm test`, 41/42 pruebas aprobadas. Fallo en `useRoomStore.test.ts:74`: después de crear un diseño se espera `hasUnsavedChanges === false`, pero se obtiene `true`.
- Después del cambio: `npm test`, 45/46 aprobadas. Las cuatro pruebas nuevas de compatibilidad pasan; persiste el mismo fallo de guardado.
- `npm run build`: aprobado, con aviso de bundle superior a 500 kB.
- E2E iniciales de vistas/guardado, visibilidad y catálogo: 1/3 aprobados. Las otras dos pruebas buscan un botón «Recuperar» ausente y esperan 29 tarjetas de catálogo frente a las 36 actuales. Son discrepancias de la base que no se corrigen en esta extracción.
- Suite E2E existente completa, Chromium y un worker: 12/19 aprobados. Fallan recuperación/visibilidad, persistencia de colores, dos selectores ambiguos de «Mesa», texto de la pared frontal, reselección del sillón y recuento de catálogo.
- Las incidencias de colores, ambos selectores ambiguos de «Mesa» y texto frontal se reprodujeron sin la extracción en una copia temporal de `80ae30c` (`/tmp/room-r31-baseline-a6vfp2o8`, puerto 4174). Las dos incidencias de recuperación/catálogo ya estaban en la comprobación inicial: seis fallos previos confirmados en total.
- Reselección del sillón: falló en la suite completa de esta rama; en ejecuciones aisladas posteriores pasaron 3/3 repeticiones en esta rama y 3/3 en la copia original. Su estabilidad en la suite completa queda PENDIENTE; no se atribuye una causa raíz ni se declara corregida.
- Se descartó una comparación simultánea de reselección: la copia temporal compartía `node_modules` y la caché de Vite; la rama actual agotaba el tiempo esperando el catálogo inicial. Se interrumpió y se repitió de forma aislada, con el resultado anterior. No se considera evidencia sobre la selección.
- Nuevo E2E `tests/selection.spec.ts`: 1/1 aprobado. Selecciona mueble, puerta, ventana, pack, superficie y vuelve al pack a través de la UI.

Las pruebas de dominio cubren los tipos actuales de muebles y elementos murales, las seis superficies, puerta, selección vacía/desconocida, IDs antiguos y compuestos, referencias de objetos, ausencia de mutaciones y el export compatible del store. No se ha hecho comparación visual de capturas ni se considera validado el aspecto por estas pruebas.

La primera extracción está implementada; R3.1 no se declara cerrada respecto al plan de `origin/dev` hasta integrar sus dependencias y resolver los límites de validación. Sin commits, merges ni publicación.

### Continuación: base actualizada y conservación del informe

El usuario autorizó el 28/10/2026 incorporar `main` mediante avance rápido. La rama pasó a `77a502e`, con R1/R2, y R3.1 se adaptó al inspector y módulos de escena extraídos. Los resultados anteriores permanecen como historial de `80ae30c`; no son resultados de la nueva base. Este informe se trasladó íntegro a `docs/progress/`, actualizando sus enlaces y añadiendo esta nota. La continuación y sus pruebas se registran en [R3.2 y R3.3](#r3-2-3).

<a id="r3-2-3"></a>

## R3.2 y R3.3 — reglas puras y diseño persistido v1

Fecha: 28/10/2026. Rama: `refactor/r3-dominio-estado`. Base actual: `77a502e`, correspondiente al `main` incorporado mediante avance rápido autorizado expresamente por el usuario.

**Estado:** R3.2 y R3.3 IMPLEMENTADAS; 76/76 pruebas unitarias y build aprobados; 33/34 E2E, con el mismo fallo de reselección de la referencia previa. R3.4–R3.7 siguen PENDIENTES.

### Contexto y conservación del trabajo

La primera extracción de R3.1 se inició sobre `80ae30c`, una referencia local desactualizada de `origin/main`. Tras actualizar las referencias se comprobó que el `main` remoto era `77a502e` y ya contenía R1/R2. El usuario autorizó incorporar esa base, conservar y adaptar R3.1 y continuar R3.2/R3.3.

Los cambios locales se respaldaron en `/tmp/room-r33-local-e5t9yqqf` antes del avance rápido. La copia temporal es una precaución de la sesión; la explicación durable y verificable del trabajo está en este informe y en Git. Se reaplicaron el plan con su jerarquía de títulos, el índice y las extracciones de IDs, nombres y selección.

R3.1 ahora conecta con `components/editor/SelectionInspector.tsx`, `PackInspector.tsx`, `ObjectsPanel.tsx`, `scene/StructureSurface.tsx` y `StructureSurfaceGizmo.tsx`. El store mantiene su export público del ID compuesto. No se reintroduce el inspector antiguo en `App.tsx` ni código de escena previo a R2.

El informe inicial se conserva en [Inicio de R3.1](#r3-1). Sus resultados siguen describiendo `80ae30c`; no se borran ni se atribuyen a la base actual. Los informes futuros se guardarán en esta carpeta, conforme a la instrucción añadida a `AGENTS.md` y al [contenido del informe](#contenido).

### R3.2: reglas de edición y colocación

#### Límites de responsabilidad

`src/domain/editingRules.ts` recibe habitación, mobiliario y ajuste a cuadrícula; devuelve candidatos o cambios de datos. No importa React, Zustand, Three.js, el logger ni almacenamiento. El store sigue buscando los elementos sobre los que se ejecuta cada acción y aplica el resultado mediante su mecanismo existente de historial y detección de cambios.

- `safeRoomUpdate`: valida las aperturas de la habitación candidata; ajusta muebles a sus límites; adapta la elevación y el anclaje de lámparas; comprueba colisiones; devuelve los datos aceptados o el aviso anterior.
- `arrangeFurniture`: restablece las dimensiones del catálogo, normaliza la elevación, ajusta límites y busca una posición libre en el mismo orden de entrada. Devuelve `null` si un tipo no existe o no puede colocarse.
- `applyFurnitureRotation`: normaliza el ángulo, ajusta la huella a la habitación y comprueba colisiones. Conserva la diferencia entre el giro silencioso y la acción que muestra un aviso.
- `clampRoomDimension`: conserva límites mínimos y máximos por dimensión. El seguimiento de altura de la cámara frontal permanece en el store como comportamiento de sesión.
- `roomForDoorUpdate` y `roomForWindowUpdate`: conservan las cuadrículas distintas de puerta y ventana, así como el margen superior y el límite de altura mural.
- `movedFurniture` y `elevatedFurniture`: devuelven candidatos sin mutar los originales o `null` cuando la operación no es válida o no cambia la elevación.

`src/domain/structureRules.ts` construye suelo, techo y cuatro paredes con las mismas medidas, colores, nombres y orientación por defecto. Lo usan tanto las acciones de construcción como el normalizador de diseños antiguos.

#### Orden que se conserva

Validar aperturas antes de ajustar muebles evita devolver un error de colisión cuando el primer problema real es una puerta o ventana inválida. El ajuste de huella precede a la comprobación de colisiones; en la recolocación, la elevación precede a la búsqueda de espacio libre. El orden del array de muebles conserva qué objeto tiene prioridad en una recuperación.

Los avisos, las claves de logging y el número de pasos de historial siguen gestionados por las acciones originales. No se introduce otra fuente de estado ni se modularizan las acciones completas, trabajo previsto para R3.5.

### R3.3: contrato, comprobación y normalización v1

#### Contrato y forma canónica

`src/domain/designV1.ts` declara `PersistedDesign`, `SavedDesign`, la forma de datos persistibles del mundo y los defaults de cuadrícula. `domain/types.ts` reexporta `PersistedDesign` para que sigan funcionando los imports existentes.

El serializer conserva `version: 1`, nombres y orden de los campos, referencias de datos y los valores actuales. La firma canónica mantiene la equivalencia de `structurePacks` ausente y vacío, cuadrículas ausentes y predeterminadas, y lista de ocultos ausente y vacía. Esta equivalencia participa en undo/redo y en `hasUnsavedChanges`: no es solo formato de exportación.

#### Normalización separada del almacenamiento

`src/domain/normalizeDesignV1.ts` contiene:

- Normalización de habitación: colores por defecto, colores de paredes, dimensiones de catálogo de la puerta y elementos murales, cuadrícula visible, altura, giro y color. Las formas antiguas desconocidas mantienen la conversión anterior a ventana rectangular.
- Validación y normalización de packs: coordenadas finitas, tipos de superficie, correspondencia pared/ID, IDs de superficie repetidos, medidas y defaults antiguos.
- Preferencias: mantiene valores booleanos explícitos, completa defaults de cuadrículas y filtra únicamente entradas no textuales de los elementos ocultos. Los IDs antiguos se conservan como cadenas opacas.

La carga mantiene esta secuencia: comprobación de cabecera → normalización de habitación → normalización de packs → validación de aperturas → migración mural existente → recolocación de muebles → registro y aplicación del mundo/preferencias. Las migraciones de cuadros y espejos y la lectura/escritura de `localStorage` siguen en el store para R3.4.

#### Compatibilidad y límites previos

`isPersistedDesign` conserva la comprobación parcial de cabecera que permite listar diseños v1 aunque fallen después al cargar sus datos anidados. No se convierte silenciosamente en un validador estricto ni se presenta como una API segura de importación JSON pública. Los fixtures malformados caracterizan la diferencia entre aceptar una entrada en la lista y aceptar su carga.

La validación antigua de superficies exige que el giro sea positivo junto con las dimensiones. Por tanto rechaza giros cero o negativos, incluido el valor por defecto de superficies nuevas. La incidencia se reprodujo con una prueba sobre el store antes de extraerla y se conserva con pruebas directas después. Corregir ese comportamiento queda PENDIENTE para una tarea específica; esta entrega no declara que guardar y recuperar cualquier pack nuevo esté resuelto.

No se cambian versión, claves, límite de cinco diseños ni política de migración.

### Pruebas y evidencia

#### Referencia antes de R3.2/R3.3

- Tras el avance rápido y adaptación de R3.1: `npm test`, **62/62 aprobadas**.
- Cinco pruebas de caracterización nuevas sobre el store, ejecutadas antes de extraer: **5/5 aprobadas**. Cubren rechazo de reducción con colisión, cambio de altura, giro bloqueado/normalizado, movimiento, elevación, cuadrículas distintas y carga v1 con superficies antiguas.
- `npm run test:e2e -- --workers=1`: **33/34 aprobadas**. Falló la reselección del sillón desde el canvas, ya documentada como intermitente en R2. Ninguno de los seis fallos deterministas de `80ae30c` se reproduce en esta nueva referencia.

#### Resultado tras la extracción

- Pruebas específicas de reglas, v1 y caracterización: **14/14 aprobadas**.
- `npm test`: **76/76 aprobadas**, incluidas las pruebas existentes de geometría, selección, store, historial, migración de espejo y cinco diseños.
- `npm run build`: **aprobado**, con el aviso previo de chunk superior a 500 kB; bundle principal de aproximadamente 1,317 MB sin comprimir.
- `npm run test:e2e -- --workers=1`: **33/34 aprobadas** en Chromium. Falló únicamente `tests/room-builder.spec.ts:431`, reselección del sillón desde el canvas, con la misma aserción que falló antes de la extracción. No se repitió la suite completa: el comportamiento y las limitaciones quedan registrados.
- `git diff --check`: aprobado; enlaces locales de los documentos modificados e informes comprobados. Se conservan las nueve subpartes R2 y las siete R3 con su jerarquía de títulos.

Los casos nuevos comprueban ausencia de mutaciones, referencias de elementos no afectados, orden de validación, recolocación sin colisiones, elevación, dimensiones, seis superficies, IDs antiguos y compuestos, defaults y booleanos explícitos, formas antiguas, duplicados, medidas no válidas y giros previos rechazados.

El fixture `tests/fixtures/persistence-v1/valid-boundary.json` añade habitación de 10 m, pack mural e ID compuesto antiguo. Se comprueban también los fixtures completos, antiguos, de versión incompatible, habitación malformada y tipo de mueble desconocido.

No se ha hecho una comparación visual de capturas. Los recorridos E2E no certifican dispositivos táctiles físicos ni otros motores gráficos.

### Pendientes

- R3.4: repositorio local y migraciones explícitas, conservando los cinco diseños.
- R3.5–R3.7: acciones modulares, transacciones de historial y medición de suscripciones.
- Investigar por separado el rechazo previo de superficies con giro cero/negativo y la estabilidad de reselección.

Se ha realizado el avance rápido autorizado; no se han creado commits nuevos, hecho push ni publicado cambios.

<a id="r3-4-5"></a>

## R3.4 y R3.5 — migraciones, repositorio y acciones compuestas

Fecha: 28/10/2026. Rama: `refactor/r3-dominio-estado`. Base Git: `77a502e`, más los cambios locales de R3.1–R3.3 conservados de las entregas anteriores.

**Estado:** R3.4 y R3.5 IMPLEMENTADAS; 88/88 pruebas unitarias y build aprobados; 34/34 E2E existentes aprobados y 2/2 E2E nuevos de persistencia aprobados en la comprobación específica final. R3.6 y R3.7 siguen PENDIENTES.

### Alcance y referencia

El usuario solicitó continuar con R3.4/R3.5. La rama y los cambios locales coincidían con la entrega anterior; se reutilizó su referencia válida de 76/76 unitarias y 33/34 E2E, con la reselección intermitente del sillón como único fallo. No se ejecutó otra suite completa de referencia sin cambios que la justificaran.

Se conserva el trabajo previo y los informes [Inicio de R3.1](#r3-1) y [R3.2 y R3.3](#r3-2-3). La copia previa del store quedó en `/tmp/room-r345-before-xc1n2vcs`; se utilizó para contrastar la extracción. Esta ruta es temporal: el informe y los archivos de la rama son el registro durable.

No se cambia el formato v1, las claves de almacenamiento, el catálogo, la UI ni las reglas de cancelación de gestos. No se añaden dependencias, backend o cuentas.

### R3.4 — transformaciones y acceso a almacenamiento

#### Migraciones puras

`src/persistence/designMigrations.ts` contiene dos transformaciones:

- `migrateLegacyDesign`: crea la entrada de lista a partir de los datos legacy y del ID/fecha recibidos. Conserva el nombre anterior y la referencia de los datos; no accede a almacenamiento ni genera valores no deterministas.
- `migrateWallPictures`: traslada los cuadros y el espejo de mobiliario antiguo a elementos murales. Conserva IDs, colores, pared preferida por distancia, orden de paredes alternativas, candidatos de offset y validación de aperturas. Si un elemento no puede colocarse, permanece en mobiliario; no se pierde.

La migración mural sigue ejecutándose después de normalizar la habitación y los packs y validar las aperturas, y antes de recolocar los muebles. Se aplica en memoria al cargar; no escribe por sí sola en el almacenamiento. Ejecutarla de nuevo sobre el resultado no duplica la decoración ya migrada.

#### Repositorio local

`src/persistence/localDesignRepository.ts` encapsula lectura y escritura mediante `read()` y `write(designs)`. Resuelve `localStorage` al ejecutar una operación, no al importar el módulo o crear el store; las pruebas pueden proporcionar un almacenamiento aislado.

Se mantienen las claves `room-builder:v0.1:designs` y `room-builder:v0.1:design`. La lista actual tiene prioridad, incluso si está vacía. Si su JSON o metadatos no son válidos, se propaga el error; no se sustituye silenciosamente por legacy.

Si falta la lista actual, un diseño legacy con cabecera válida se transforma, recibe ID y fecha nuevos y se escribe como lista. La clave original permanece intacta. Una segunda lectura utiliza la lista nueva y conserva el mismo ID/fecha. Si la escritura falla, el error llega al llamador y el valor legacy se conserva.

El lector conserva las primeras cinco entradas, como antes. El límite de creación y guardado permanece en las acciones; `write` no introduce una política de truncado nueva. La validación compatible de cabecera/metadatos y los avisos existentes se mantienen.

#### Operaciones fallidas

Las acciones escriben primero en el repositorio y solo después actualizan la lista en el store y registran la operación, conservando el orden original. Se prueban fallos de lectura y escritura, almacenamiento bloqueado, datos corruptos, migración fallida y ausencia de sustitución de diseños existentes.

### R3.5 — un store con acciones por responsabilidad

#### Composición y contrato

`src/state/useRoomStore.ts` conserva la creación de Zustand, los datos iniciales y el único setter que compara las firmas persistibles, actualiza el estado de cambios pendientes y administra el historial. El archivo pasa de 1257 a 93 líneas; esta cifra describe la organización, no demuestra una mejora de rendimiento.

`src/state/types.ts` recoge el contrato común de datos y acciones. `state/defaults.ts` conserva los límites y defaults compartidos entre composición, cámaras e historial. Se mantienen `useRoomStore`, `createRoomStore()` y el export público `structureSurfaceElementId`. La factory admite opcionalmente un repositorio, para pruebas aisladas; el uso sin argumentos mantiene el repositorio local por defecto.

#### Módulos de acciones

| Módulo | Responsabilidad | Acciones |
| --- | --- | --- |
| `cameraActions.ts` | Vistas, orientación, órbita, zoom, altura frontal y POV | 13 |
| `constructionActions.ts` | Habitación, colores, packs, superficies, puertas y elementos murales | 20 |
| `furnitureActions.ts` | Alta, movimiento, elevación, color, giro y borrado de muebles | 9 |
| `selectionActions.ts` | Selección transversal, borrado, portapapeles, visibilidad y avisos | 7 |
| `historyActions.ts` | Undo/redo sobre el historial compartido | 2 |
| `designActions.ts` | Lectura de lista, selección, creación/copia, renombrado, borrado, guardado y carga | 7 |

Los seis módulos reciben solo el setter/getter, contexto o repositorio que necesitan. Ninguno crea otro store ni mantiene otra copia del mundo. `get()` se consulta al ejecutar las acciones, de modo que las referencias retenidas de métodos trabajan con el estado actual.

#### Contexto privado por instancia

Las variables de cierre anteriores —pilas de undo/redo, portapapeles, marca de undo y snapshot/estado de movimiento agrupado— se agrupan en un objeto privado creado por cada instancia. Los módulos reciben la misma referencia. No es un segundo estado del mundo ni se serializa en los diseños.

Se mantienen la agrupación y el límite de 50 pasos del historial, la coordinación entre gestos de muebles y construcción, y el portapapeles transversal entre diseños. R3.6 no se adelanta: no se redefine la cancelación ni se añade una API nueva de transacciones.

#### Conservación de comportamiento

Se contrastaron los 58 cuerpos de acciones antes y después de la extracción, normalizando únicamente espacios y el prefijo de acceso al contexto. No hay omisiones, duplicados ni cambios de cuerpo respecto a la etapa R3.4. Así se conservan también las llamadas y claves de logging, el orden de actualización y los mensajes.

La prueba de guardar/cargar entre módulos utiliza una habitación con defaults canónicos para comprobar la coordinación de acciones sin atribuir a esta tarea cambios en la normalización anterior.

### Pruebas y resultados

- R3.4 antes de modularizar: **22/22** pruebas de repositorio, migraciones y store aprobadas.
- Tras modularizar: **84/84** unitarias y build aprobados.
- Pruebas nuevas de coordinación: **4/4** aprobadas. Cubren acciones retenidas que leen el estado actual; historial compartido entre módulos; portapapeles y guardado/carga entre diseños; fallos de escritura sin confirmar cambios; y aislamiento entre instancias.
- Verificación unitaria final: **88/88 aprobadas**.
- Build final: **aprobado**, con aviso previo de chunk superior a 500 kB. Bundle principal: aproximadamente 1,318 MB sin comprimir.
- `npm run test:e2e -- --workers=1`: **35/36 aprobados** en la ejecución completa. Los **34 E2E existentes pasaron**, incluida la reselección, sin atribuirle una corrección de estabilidad. Uno de los dos E2E nuevos agotó el tiempo buscando «Guardar» exacto, cuando la UI muestra «Guardar cambios».
- Se corrigió únicamente el selector de ese test. `npm run test:e2e -- tests/persistence-repository.spec.ts --workers=1`: **2/2 aprobados**. No se repitió toda la suite: el código de producción no cambió desde la ejecución completa, y se verificaron de nuevo los dos recorridos afectados.
- `git diff --check`, enlaces locales de documentación e informes y jerarquía de las 16 subpartes R2/R3: aprobados.
- Comprobación de extracción: 58 acciones conservadas y ausencia de acceso directo a `localStorage` en código de producción de `src/state`.

Las pruebas de repositorio reutilizan el fixture completo v1 y comprueban cinco diseños con sus IDs/nombres/fechas, lista vacía con prioridad, entrada inválida fuera del límite, JSON corrupto, metadatos/versión inválidos, lectura bloqueada y errores de escritura. Las de migración comprueban los tres tamaños de cuadros, el espejo antiguo, conservación de muebles restantes y falta de pared válida.

`tests/persistence-repository.spec.ts` añade dos recorridos de navegador: migración legacy con espejo y relectura sin duplicados; y edición/guardado de uno de cinco diseños conservando los otros cuatro, con renombrado y borrado persistidos tras recargar. La suite general cubre además edición, selección, cinco vistas, gestos de ratón y eventos táctiles, undo/redo y exportación GLB.

No se ha hecho comparación visual de capturas ni pruebas en dispositivos táctiles físicos. No se declara corregida la reselección intermitente ni el rechazo previo de superficies con giro cero/negativo.

### Pendientes

- R3.6: explicitar transacciones de historial de gestos sin alterar su política por accidente.
- R3.7: medir suscripciones/renders antes de modificar selectores.
- Mantener separadas las correcciones de las incidencias previas de reselección y superficies.

Sin commits nuevos, merges, push ni publicación en esta entrega. Los cambios locales de las fases anteriores se conservan.

<a id="r3-6-7"></a>

## R3.6 y R3.7 — transacciones de gestos y suscripciones medidas

Fecha: 28/10/2026. Rama: `refactor/r3-dominio-estado`. Base Git: `77a502e`, con los cambios locales conservados de R3.1–R3.5.

**Estado:** R3.6 y R3.7 COMPLETADAS; 101/101 unitarias, 41/41 E2E y build aprobados; medición antes/después registrada. R4/R5 no se inician en esta entrega.

### Contexto y alcance

El usuario autorizó continuar con R3.6/R3.7. Se comprobaron rama, cambios locales, plan, contrato del store, gestos de escena/inspectores y suscripciones reales. Se conservan los informes anteriores en esta carpeta. La referencia previa válida era 88/88 unitarias, build aprobado y los 34 E2E existentes más dos nuevos de persistencia comprobados en la entrega anterior.

La inspección confirmó que cancelar conservaba la última posición aceptada. También mostró una brecha: la agrupación existía para arrastre de muebles y ejes de superficies, pero faltaba en aperturas y varios aros de giro. R3.6 completa el requisito de un undo por gesto para esas interacciones; conserva la política de cancelación y las reglas geométricas.

No se cambia el contrato v1, claves de almacenamiento, migraciones, catálogo ni representación de los objetos. No se introducen dependencias nuevas.

### R3.6 — transacciones explícitas

#### Estado y ciclo de vida

`state/historyTransactions.ts` sustituye el snapshot agrupado y su booleano sueltos por una transacción explícita con token, objetivo, snapshot anterior y marca de cambios. El contexto continúa siendo privado de cada store; el mundo y la selección mantienen una única fuente de verdad.

1. `beginHistoryGesture` crea el token y captura el diseño persistible anterior. Iniciar otro gesto cierra el anterior en su última posición.
2. El setter común valida si el diseño cambió mediante la firma existente. El primer cambio aceptado añade el snapshot previo a undo y limpia redo; los siguientes cambios del gesto se agrupan en ese paso.
3. `commitHistoryGesture` cierra el token sin modificar el mundo.
4. `cancelHistoryGesture` también cierra el token conservando la última posición aceptada. **No restaura el snapshot**: el usuario puede deshacer el gesto mediante undo, como antes.
5. Un gesto vacío o con operaciones geométricas rechazadas no añade pasos ni destruye redo. Se conserva el límite de 50 pasos.

`isHistoryGestureActive` permite al propietario dejar de aplicar movimientos cuando su gesto ya terminó. Los tokens son símbolos temporales y no se serializan. Los métodos anteriores `begin/endFurnitureMove` y `begin/endStructureMove` se conservan como adaptadores de compatibilidad; la UI actual usa tokens propios.

#### Cierre y propiedad

`state/useHistoryGesture.ts` guarda el token del componente. Un fin/cancelación tardío o la limpieza de un componente antiguo solo puede cerrar ese token, nunca uno posterior. Cambiar el objetivo o desmontar ejecuta la cancelación de su token.

El setter cierra la transacción vigente al cambiar selección o vista, antes de registrar una nueva edición persistible. Undo y redo cierran el gesto antes de operar sobre las pilas. Iniciar otro gesto sobre el mismo objeto también delimita una transacción nueva si falta el evento de fin anterior.

El puente `scene/usePointerCancellation.ts` atiende `pointercancel`, `lostpointercapture` y pérdida de foco de ventana. El fin normal libera la captura cuando existe. Al desmontar se retiran listeners y referencias; el hook propietario cierra la transacción.

#### Integración con las interacciones

- Cuerpo de mobiliario y ejes: conservan el comportamiento previo y pasan a tokens con propiedad. Los movimientos tardíos comprueban que el token siga vigente.
- Aros de giro de mobiliario, arrastre y giro de aperturas y superficies: inician y cierran una transacción. Se incorpora el puente de cancelación nativa donde faltaba.
- Inspectores: los rangos y el dial comparten `useInspectorGesture`. Pointer up confirma; cancelación, pérdida de captura o desmontaje cierran conservando el valor aceptado. La pérdida de foco fuera del inspector confirma. Cambiar entre controles del mismo inspector no deja que un blur anterior cierre el nuevo gesto.
- Los pasos de teclado fuera de una interacción de puntero mantienen su historial independiente. No se agrupa todo el tiempo que un control permanezca enfocado.

Los hooks de acciones de `StructureSurfaceObject` se ejecutan antes de su salida por superficie oculta, manteniendo un orden de hooks consistente al alternar visibilidad. No cambia su salida visual.

### R3.7 — medición antes de elegir el cambio

#### Método reproducible

Se añadió `playwright.profile.config.ts` y `scripts/playwright-profile/r3-render-profile.spec.ts`. El comando es:

```sh
npm run test:e2e -- --config=playwright.profile.config.ts
```

La prueba utiliza `valid-complete.json`, movimiento reducido, Chromium y Vite en desarrollo con React StrictMode. Carga el mismo diseño, selecciona `fixture-plant` y usa las acciones reales del store para dos recorridos de diez actualizaciones, separadas por dos frames:

- Diez variaciones pequeñas del ángulo isométrico, manteniendo el mismo cuadrante.
- Diez posiciones válidas y distintas del mueble, dentro de un gesto agrupado.

La cobertura precisa de CDP cuenta invocaciones de las funciones de componentes. No añade contadores ni instrumentación al código de producción. Se excluye la carga inicial. El comando escribe `/tmp/room-r3-render-profile.json`; se conservaron copias de los dos resultados en este informe:

- [Medición anterior](measurements/R3_RENDER_BEFORE.json).
- [Medición posterior](measurements/R3_RENDER_AFTER.json).

#### Resultados

| Componente | Cámara antes | Cámara después | Mueble antes | Mueble después |
| --- | ---: | ---: | ---: | ---: |
| `App` | 20 | 0 | 20 | 0 |
| `EditorScene` | No existía | 20 | No existía | 20 |
| `EditorHeader` | 20 | 0 | 20 | 2 |
| `SettingsPanel` | 20 | 0 | 20 | 0 |
| `ObjectsPanel` | 20 | 0 | 20 | 20 |

StrictMode explica las invocaciones dobles por actualización en esta prueba. La escena sigue renderizando los datos/cámaras necesarios: el trabajo no desaparece, queda limitado a esa rama. La cabecera se actualiza al primer cambio del gesto, cuando cambian undo y estado pendiente, y luego conserva su proyección.

El catálogo sigue suscrito al array de mobiliario y conserva sus 20 invocaciones durante el movimiento. No se presenta como optimizado en ese recorrido. Estos datos no miden duración de renders, FPS, GPU ni velocidad de producción, y no justifican porcentajes de aceleración.

#### Implementación elegida

`state/selectors.ts` define proyecciones de escena, cabecera y acciones de atajos. Los selectores de objetos se consumen con `useShallow`; el nombre del diseño activo se deriva como string. Se preservan referencias cuando los campos seleccionados no cambian, sin duplicar estado ni mantener un segundo mundo.

`App` se suscribe únicamente a acciones estables y mantiene el estado local de paneles/exportación. `EditorScene`, en el mismo archivo, escucha mundo/cámaras y conserva el JSX y los manejadores del lienzo. `EditorNotice` escucha avisos y su temporizador. `EditorHeader` se suscribe a sus datos y pasa un contrato reducido al menú de diseños. `useEditorShortcuts` escucha sus acciones, que consultan el estado actual al ejecutarse.

Se conserva el mismo DOM de producto, el orden de los paneles, las etiquetas y los controles; se cambian los límites de suscripción de React. La derivación de selección de R3.1 permanece compartida. No se afirma validación visual de capturas.

### Pruebas y resultados

- Pruebas unitarias específicas de transacciones/selectores: 12/12 tras corregir el caso de prueba que intentaba girar un suelo; el giro válido se prueba sobre una pared. Una prueba adicional cubre iniciar otro gesto sobre el mismo objeto sin fin anterior.
- `npm test` final: **101/101 aprobadas**. Incluye las 88 anteriores, 11 nuevas de transacciones y dos de selectores.
- Build final: **aprobado**, con el aviso previo de chunk superior a 500 kB. Bundle principal: aproximadamente 1,321 MB sin comprimir.
- Perfil antes/después: **1/1 aprobado en cada versión**, con los resultados anteriores.
- E2E específicos iniciales: 13/14 aprobados; el test nuevo del dial intentaba arrastrarlo fuera del área visible del panel. Se añadió `scrollIntoViewIfNeeded` al test. La comprobación posterior del giro y del borrado durante arrastre pasó **2/2**.
- `npm run test:e2e -- --workers=1` final: **41/41 aprobados** en Chromium, incluidos los cinco recorridos nuevos. La reselección del sillón pasó en esta ejecución; no se considera demostrada una corrección de su intermitencia.
- `git diff --check`, enlaces locales del plan/informes y conservación de las 16 subpartes R2/R3: aprobados.

Las pruebas de estado cubren movimiento/giro de muebles, puertas, ventanas y superficies; un solo paso por gesto, cancelación con posición conservada, gestos vacíos o rechazados, redo, selección/vista, tokens antiguos, instancias independientes y límite de 50 pasos. Los selectores se comprueban durante edición, cámara, selección, undo y cambios de nombre activo.

Los cinco E2E nuevos comprueban una ventana con ratón y cancelación táctil, pérdida de captura de superficie, giro continuo del inspector y borrado durante un arrastre. Los seis recorridos existentes de cuerpo/eje con ratón, táctil y cancelación también se mantienen. La pérdida de captura se prueba despachando el evento nativo al canvas; no equivale a probar todas las causas reales de pérdida de captura en todos los navegadores.

### Límites y pendientes

R3.1–R3.7 quedan completadas como reorganización en esta rama; la integración/publicación posterior requiere la autorización correspondiente y no se realiza aquí.

- No se certifican dispositivos táctiles físicos, interacción multitáctil simultánea ni otros motores gráficos.
- La reselección intermitente del sillón y el rechazo anterior de superficies guardadas con giro cero/negativo son incidencias separadas. Esta tarea no declara corregida ninguna de ellas.
- R4/R5 conservan sus estados y decisiones pendientes. No se entrega multihabitación ni otro formato persistido.

Sin commits nuevos, merges, push ni publicación. Los cambios e informes anteriores se conservan.

<a id="r3-inspector-focus"></a>

## Corrección tras la revisión: foco del inspector

La revisión encontró que perder el foco de la ventana durante un arrastre del inspector dejaba abierta su transacción. Una edición posterior con teclado se agrupaba con ese arrastre y Deshacer revertía ambos cambios a la vez.

`useInspectorGesture` escucha ahora `window.blur` y cierra el gesto mediante su cancelación, conservando la última posición aceptada. El listener usa la función estable de cancelación y se elimina al desmontar el inspector.

La regresión añadida a `tests/history-transactions.spec.ts` fallaba antes de la corrección y pasa después (**1/1**): arrastra el control, despacha el evento de pérdida de foco, comprueba que la posición se conserva, edita con teclado y verifica Deshacer/Rehacer independientes. El evento se despacha de forma sintética; no se presenta como una comprobación de Alt+Tab real del sistema operativo.

También finalizaron las unitarias (**101/101**) y el build (aprobado, con el aviso previo de tamaño del bundle). La suite completa se inició y se detuvo al solicitar el usuario verificar únicamente este fallo: una prueba terminó, otra quedó interrumpida y 40 no se ejecutaron. No se atribuye esa interrupción a un fallo del producto ni se declara validada la suite completa de 42 pruebas.

Sin commits ni publicación.
