# F0 — Auditoría y refactorización conservadora (#34)

**Estado:** cambios de código realizados y revisados **estáticamente**, pendientes de validación manual y de `CI` cuando se integren en `main`. Ningún test ni build se ha ejecutado en esta rama por la política vigente. No confundir lectura/inspección con certificación.

- **Referencia funcional de partida:** `dev` en `33ec839650e0f9ef3aa5982da74150146de7dbdc` (incorpora la issue #24; `main` permanecía en `938e5b18edee26c1252a26ca038db0fd26a3f356`).
- **Rama revisada:** `feature/34-auditar-refactorizar`, creada previamente desde ese `dev` (no desde `main`) para conservar #24.
- **Alcance:** mantener idénticos DOM, etiquetas/roles/IDs, gestos, formato local y representación. No Workshop, funcionalidades nuevas ni segunda fuente de estado.
- **Evidencia inicial:** inventario estático de `src/` y lectura de módulos; 61 archivos de pruebas `.test.ts`/`.spec.ts` contabilizados en árbol, no ejecutados. Los tamaños son indicadores de lectura, **no métricas de rendimiento**.

## Hallazgos y decisiones

| Módulo | Observación respaldada por lectura | Decisión | Riesgo |
| --- | --- | --- | --- |
| `components/editor/ObjectsPanel.tsx` (~41 KB, 601 líneas antes) | En un componente conviven alta de objetos/categorías, árbol recursivo con drag-and-drop/menús contextuales y switches de cuadrícula; cada área tiene estado/acciones y markup propio | **Extraer dos secciones autónomas:** catálogo y cuadrícula. Conservar el árbol dentro de `ObjectsPanel` para no alterar gestos, foco y orden | Bajo-medio: montaje de componentes y suscripciones deben comprobarse |
| `App.tsx` | `hasPlacedSceneContent` evaluaba dos veces la misma condición `structurePacks.length > 0` | Retirar únicamente el término booleano duplicado, sin cambiar el resultado | Bajo |
| `styles.css` (~55,5 KB) | Reglas globales interdependientes y media queries: moverlas sin controlar cascada puede cambiar la UI | **No dividir ahora.** Requiere mapa de especificidad, comparación visual y CI estable; no se ha demostrado beneficio actual | Medio-alto |
| `scene/Openings.tsx` (~31 KB) | Gestos con puntero, gizmos y renderizado de varias formas de apertura comparten eventos e historial | **No tocar.** Extraer por tamaño no justifica arriesgar colocación/historial | Alto |
| `scene/FurnitureGizmos.tsx` (~25 KB) | Arrastre 3D, rotación y controles de ejes recientemente cambiados en #24 | **No tocar.** Priorizar certificación de los nuevos bloqueos de ejes | Alto |
| `state/actions/constructionActions.ts` (~26 KB) | Lógica de acciones mutable compartida para construcción y habitaciones | **No trasladar a componentes**. Conservar escritura en `state/actions`; auditar funcionalmente en F1/F4 si aparecen problemas concretos | Alto |
| `domain/projectV2.ts`, migraciones y fixtures v1–v5 | Contratos de prototipo R4 y retrocompatibilidad usados como preparación para vivienda | **Conservar**; que no haya UI expuesta no implica código muerto | Alto si se elimina |

Se revisaron importaciones, límites entre dominio/escena/UI/estado y los tests relacionados. **No se identificó evidencia suficiente para borrar módulos históricos ni archivos de persistencia**. No se hicieron perfiles de memoria, benchmarks ni mediciones de re-renderizados, por lo que no se atribuye ninguna mejora de rendimiento cuantificada.

## Cambios aplicados

1. `src/components/editor/ObjectCatalogSection.tsx` (nuevo). Mantiene sin alterar el JSX de alta de habitaciones, superficies, puertas, ventanas, muebles y decoración. Las tres variables de expansión/elección de ubicación y las acciones del catálogo pasan a estar encapsuladas allí.
2. `src/components/editor/GridVisibilitySection.tsx` (nuevo). Mantiene el JSX de los switches con sus IDs, roles, etiquetas y cálculo de la habitación activa. Lee los mismos datos/acciones de `useRoomStore`; no crea otro store.
3. `src/components/editor/ObjectsPanel.tsx`. Pasa de **601 a 406 líneas** mediante extracción, conserva jerarquía, drag-and-drop, menú contextual, renombrado, selección y listeners de pulsación larga. Reutiliza ambas secciones en el mismo orden DOM.
4. `src/App.tsx`. Elimina una condición booleana idéntica repetida en `hasPlacedSceneContent`.

Los archivos `ObjectCatalogSection` y `GridVisibilitySection` **no introducen dependencias npm nuevas**, y conservan la consulta al store Zustand que ya existía. No se han cambiado JSON, migraciones, objetos de dominio, clases CSS, text labels, ni IDs.

## Contratos que no deben variar

- Catálogo: id `catalog-families`, familias, botones, etiquetas accesibles, expansión global/por familia y elección de ubicación para «Nueva habitación vacía».
- Escena: orden relativo del catálogo, `elements-section` y `grid-section`; carpetas anidadas, selección Ctrl/Mayús, menú contextual con pulsación larga, arrastre y renombrado.
- Cuadrículas: mismo cálculo de paredes visibles según vista, mismo pack/habitación activa y switches `role="switch"` con `aria-checked`. La ocultación de cuadrícula no debe esconder el objeto completo.
- Persistencia: ninguna clave de `localStorage`, formato JSON ni fixture histórica se modifica. No se interviene sobre la elevación, los locks de ejes o los modelos.

## Verificación existente y pendiente

**Inspección estática realizada:** componentes exportados y referenciados desde `ObjectsPanel`, secciones JSX trasladadas manteniendo el orden, 4 etiquetas `<section>` del catálogo y 1 de cuadrícula con cierres equivalentes, imports reagrupados y condición redundante de `App` eliminada. Esto **no confirma** compilación ni funcionamiento en navegador.

**Pruebas automatizadas que deben ejecutarse únicamente en `main` tras integrar F0:**
- `npm ci`, `npm test`, `npm run build` y `npm run test:e2e` global (CI definido en #24).
- E2E relevantes ya existentes: `tests/room-builder.spec.ts` (catálogo, acciones y carpetas), `tests/room-views.spec.ts` (cuadrícula/pack), `tests/independent-surfaces.spec.ts` (cuadrículas independientes), `tests/selection.spec.ts` (multiselección/teclado/táctil). No excluirlos ni reemplazarlos por tests dirigidos.
- Comparar total de casos, fallidos, omitidos, advertencias y pruebas nuevas contra el baseline de `docs/progress/F0_BASELINE.md`. Si falla, clasificar antes de arreglar o cerrar F0.

**Comprobación manual en web de la rama** (no sirve probar la versión de producción si aún apunta a `main`):
1. Abrir y plegar el catálogo completo y cada familia; añadir un objeto de iluminación, un mueble, una puerta y una ventana. Comprobar inspector y deshacer.
2. «Nueva habitación vacía»: seleccionar Encima y una pared lateral; cambiar entre habitaciones y vistas. Verificar el selector de ubicación y no perder la selección.
3. Crear Carpeta 1 y subcarpeta, mover dos elementos mediante menú/arrastre, cambiar nombre, bloquear y ocultar, deshacer, guardar y recargar.
4. En Plano/Isométrica/Frontal cambiar switches de suelo y paredes; activar cuadrícula de superficie independiente. Confirmar etiquetas y switches correctos al elegir otra habitación.
5. Repetir la expansión del catálogo, los switches y el menú contextual en móvil/tablet, con pulsación larga y teclado si se dispone.
6. Comprobar que la escena inicial sin objetos muestra las mismas indicaciones y que al añadir una habitación/objeto se actualizan correctamente.

## Riesgos, pendientes y reversión

- **Riesgo principal:** error de compilación por un import o JSX extraído, o cambio involuntario de estado de expansión/foco en React. Detectarlo con validación manual y luego CI en `main`; no declarar verde prematuramente.
- No se recomienda extraer `renderFolder`/gestos del árbol ni dividir CSS/Openings/FurnitureGizmos en esta issue sin tests previos por la política actual.
- Si la revisión manual muestra diferencias, revertir los commits de extracción de secciones; no cambiar contratos para acomodar las pruebas.
- Si todos los flujos manuales están bien, integrar en `dev` cuando lo decida el propietario. **#34 y #24 siguen pendientes de certificación automática final en `main`**.

**Criterio de cierre de la refactorización conservadora:** inventario documentado, alcance de extracciones justificado, revisión manual completada y pruebas definitivas de `main` verificadas. No dar por completada la certificación antes de eso.

## Seguimiento de la revisión manual (08/11/2026)

El propietario ha confirmado sin anomalías las comprobaciones anteriores **3, 5, 6, 7 y 8**, además de la creación de objetos de la comprobación 2 y el uso general de carpetas/cuadrículas en la 4. Se han identificado **tres ajustes complementarios**, expresamente solicitados tras la revisión. Son correcciones de UX/funcionalidad, no refactorizaciones en sentido estricto, y se mantienen en commits independientes para poder revertirlas sin afectar a la extracción:

1. **Paneles laterales:** transición de 240 ms sobre la rejilla de escritorio; sin animación entre layouts apilados por debajo de 1000 px y respetando la regla existente `prefers-reduced-motion`.
2. **Cambio de pared en puertas/ventanas:** el desplazamiento previo podía quedar fuera del nuevo muro o chocar con otra apertura aunque existiese un hueco. Se incorpora búsqueda determinista de centímetros próximos mediante `findAvailableOpeningOffset`, validando cada candidato con las reglas preexistentes. Se aplica a puerta principal, ventanas, puertas adicionales de la raíz y puertas de packs; **no** se relajan márgenes/solapes ni se saltan bloqueos. Los offsets que el usuario introduce expresamente siguen validándose sin recolocación automática. Se han añadido pruebas de regresión, **no ejecutadas**.
3. **Carpeta raíz:** se muestra el cubo de habitación en el árbol y un contorno verde 3D no interactivo alrededor de la habitación base al seleccionarla (sin controles de traslado). Requiere verificación visual en las distintas vistas.

Las dos capturas del usuario muestran un ejemplo en el que una pared aparentemente libre rechaza una apertura con el mensaje de quedar fuera de la pared `west`. El análisis de `roomForWindowUpdate` y `roomForDoorUpdate` confirma que antes se aplicaba la pared nueva conservando el `offset` anterior. **La hipótesis de causa está respaldada por código, pero el resultado del parche todavía no está probado en navegador.** En el caso de muros físicamente coincidentes, se conserva expresamente el rechazo hasta disponer de medianera única.

## Auditoría de logs de interacción — alcance añadido por el propietario

**Fase 1, inventario estático realizado el 08/11/2026.** No existen en el repositorio muestras de `logs/interactions.log` (están ignoradas por Git) y no se ha ejecutado una sesión instrumentada. No inventar tasas de eventos, CPU, memoria o latencias ni marcar los nuevos criterios de aceptación hasta recogerlas.

| Aspecto | Evidencia de código | Evaluación actual |
| --- | --- | --- |
| Origen y activación | `src/debug/interactionLog.ts`: `recordInteraction` sale inmediatamente salvo `import.meta.env.DEV === true`; `sceneInteraction.ts` añade vista/selección | **Sin telemetría desde el bundle estándar de producción**; no se ha auditado un despliegue externo |
| Coalescencia | `coalesceKey` reemplaza el evento pendiente, espera 1200 ms; cambiar de clave obliga a vaciarlo; el grupo de medidas suprime eventos con clave | Posible ráfaga si se intercalan acciones distintas; requiere medición de un arrastre y cambios de medida |
| Envío | `delivery = delivery.then(fetch(...keepalive: true))`; error de red capturado y descartado, sin reintento ni timeout explícito | Si una solicitud se bloquea puede retrasar todas las posteriores; se ignoran respuestas HTTP no-2xx. No se altera todavía sin reproducciones |
| Cierre | `beforeunload` hace `flush` y registra fin de sesión, pero los envíos están encadenados | El final de sesión puede no terminar de enviarse antes de salir; comprobar pérdidas reales en sesiones cortas |
| Receptor | `vite.config.ts` instala middleware también en el Vite preview local, acepta POST hasta ~64 k caracteres y serializa escrituras en `logs/interactions.log` | Revisar exposición local (red/LAN) y respuesta a peticiones grandes; la ruta no es un backend de Cloudflare |
| Almacenamiento | `mkdir` + `appendFile` a un único archivo local; `.gitignore` excluye `logs/*.log` | No existe limpieza/rotación: posible crecimiento indefinido. No modificar o truncar los logs del propietario sin autorización |
| Privacidad | `describeInteraction` puede interpolar nombres de muebles, IDs y detalles en texto humano | **Datos potencialmente sensibles en logs locales**; no subir logs ni compartirlos íntegros, evitar introducirlos en informes o issues |
| Coste de cálculo | Serializa JSON al enviar y da formato textual en el plugin | No hay profiling o medición real de CPU/memoria. No inferir impacto en FPS únicamente del código |

**Medición agregada local preparada:** `scripts/audit-interaction-log.mjs` analiza el archivo sin imprimir mensajes, nombres, identificadores ni contenido. Devuelve tamaño del archivo, número de eventos/sesiones, bytes medios y máximos por línea, pico de entradas por segundo, repeticiones consecutivas de descripciones y categorías aproximadas. La clasificación por idioma es orientativa, no sustituye la estructura original.

Para completar la auditoría sin ejecutar pruebas automatizadas en ramas de trabajo:
1. Arrancar la web **local de desarrollo** (`npm run dev`; no usar la web pública) y realizar unos minutos de arrastres, selección, cambios de cámara, medidas y guardado.
2. Desde la raíz del repositorio ejecutar `node scripts/audit-interaction-log.mjs`. Si no existe el archivo, comprobar que el servidor de desarrollo recibió eventos; no crear datos ficticios.
3. Conservar los logs originales solo localmente y **compartir únicamente el JSON agregado** que imprime el script.
4. Con esa evidencia decidir si conviene limitar cola de envíos, responder a HTTP fallidos, rotar el archivo o añadir niveles `error/warn/debug`, y comparar con otra muestra. Las medidas de FPS/CPU y seguridad de acceso remoto del receptor requieren comprobación aparte y no están automatizadas aquí.

**Pendiente para cerrar #34:** obtener muestra real y evaluarla, verificar el comportamiento de las tres correcciones en la web y certificar la suite global al integrar F0 en `main`.

## Revisión de aperturas, foco y habitaciones multinivel — 08/11/2026

> La colocación vertical de esta primera entrega queda sustituida por la corrección posterior del hueco visible y la reserva de espacio documentada al final. Se conserva el detalle anterior como historial, no como algoritmo vigente.

**Estado: implementaciones locales sin certificar**, exclusivamente en `feature/34-auditar-refactorizar`, que estaba limpia al comenzar. Sin ramas nuevas, commits, PR, merges, push ni publicaciones; sin cambios en la descripción de #34 ni configuraciones de agentes. No se ejecutaron suites unitarias, E2E, build ni CI. Se leyó la issue actual y se revisaron estáticamente los consumidores y el diff; `git diff --check` sin errores de whitespace. El adjunto disponible contiene la petición textual; las dos imágenes mencionadas no están disponibles en él, por lo que no se afirma haber reproducido su aspecto.

### Causas y cambios

| Incidencia | Causa comprobada en código | Resultado local |
| --- | --- | --- |
| Mensajes con puntos cardinales | `validateOpenings` interpolaba `wall`; `createStructureSurface` generaba nombres como `Pared NORTH` | Mensajes y nombres automáticos nuevos usan `WALL_LABELS`. Árbol, inspector, lista de superficies y `elementName` traducen también nombres históricos automáticos al mostrar, sin reescribir datos ni nombres personalizados |
| Solapes y panel | Restricciones repartidas entre `validateOpenings`, `structureDoorError`, migraciones/JSON y ProjectV2; avisos booleanos sin parejas ni cobertura homogénea de aperturas | **Pendiente de tarea funcional separada**, con propuesta técnica en [COLLISION_SYSTEM_PROPOSAL.md](../COLLISION_SYSTEM_PROPOSAL.md). No se relajan validadores ni se añade panel incompleto |
| Cámara tras borrar/deshacer | `activeRoomId` no pertenece al snapshot persistido ni se reparaba al desaparecer un pack; `isoCameraHeight` seguía apuntando al nivel retirado. Libre centra su cámara mediante un offset separado | Historial transitorio de foco por store, descarte de IDs inválidos y restauración del último foco válido o raíz. Se cubren eliminación directa, carpetas, undo/redo y carga. Cambio de foco recentra Plano/Libre y sincroniza altura isométrica; CameraRig contempla el origen local de habitaciones coherentes |
| Habitaciones inferiores/superiores | La colocación sumaba/restaba solo `template.height`. Las superficies están centradas: suelo/techo nuevo de 0,13 m invade 0,065 m a cada lado; el suelo raíz mide 0,08 m y la peana de 0,14 m centrada en −0,11 m llega a −0,18 m | `roomVerticalBounds` calcula extremos mundiales reales. Al crear arriba/abajo se alinean envolventes sin penetración; creación automática toma la cota sólida más alta. Se consideran altura personalizada, espesor editado y origen local. Se redondea hacia fuera al centímetro, dejando menos de 1 cm entre caras. No se desplazan packs existentes ni objetos |

**Ejemplo con altura inicial de 2,70 m:** crear sobre la raíz coloca el nuevo origen Y en 2,77 m (suelo inferior a 2,705 m); crear debajo lo coloca en −2,95 m (techo superior a −0,185 m, bajo la peana que termina en −0,18 m). Entre dos packs estándar la distancia entre sus orígenes es 2,83 m. Estas cifras se derivan de espesores y precisión; no son desplazamientos fijos añadidos al algoritmo. La raíz no renderiza un techo propio; su límite superior sólido es el de sus paredes. La ocultación de un techo no elimina su volumen constructivo para colocar una nueva habitación.

### Archivos y unidades de cambio revisables

No se han creado commits. Para una posterior división por incidencia:

1. **Letras:** `domain/geometry.ts`, `domain/structureRules.ts`, `domain/selection.ts`, `components/editor/{ObjectsPanel,PackInspector,SurfaceInspector}.tsx` y regresiones de mensajes en `domain/geometry.test.ts`. El test de nombres históricos está en `state/roomLevels.test.ts`.
2. **Foco:** `state/useRoomStore.ts`, `state/actions/cameraActions.ts`, `scene/CameraRig.tsx`, `state/cameraRoomContext.test.ts` y parte de `tests/room-level-regressions.spec.ts`.
3. **Colocación vertical:** `domain/constants.ts`, `domain/roomEditing.ts`, `scene/RoomShell.tsx`, `state/actions/constructionActions.ts`, `state/roomLevels.test.ts`, expectativas actualizadas de `tests/room-views.spec.ts` y parte de `tests/room-level-regressions.spec.ts`.
4. **Análisis de colisiones y entrega:** propuesta separada e informe F0 actual, sin implementación funcional de colisiones.

### Pruebas preparadas, no ejecutadas

- `geometry.test.ts`: 4 casos nuevos parametrizados para A–D, tanto límites como mensajes de solape, manteniendo IDs.
- `cameraRoomContext.test.ts`: 8 casos nuevos (5 vistas + foco manual/ID inválido + eliminación de carpeta/estado transitorio + carga con IDs reutilizados). Verifican que navegar no añade pasos de undo ni cambios persistidos; redo conserva un foco que sigue siendo válido en lugar de secuestrarlo al restaurar geometría.
- `roomLevels.test.ts`: 7 casos nuevos: creación arriba/abajo de raíz con objetos, undo/redo; referencias con altura/espesores/origen personalizados y round-trip JSON; creación automática sobre la cota real; nombres históricos; fixtures v1–v5 sin recolocación ni mutación de la fuente.
- `room-level-regressions.spec.ts`: 12 casos E2E nuevos: las cinco vistas a 375/1280 px con undo/redo/borrado por carpeta, y creación encima/debajo con altura de 4 m y captura frontal. Las capturas se generarán cuando se ejecuten; no constituyen todavía una comparación visual aprobada ni una aserción automática de ausencia de penetraciones.
- `room-views.spec.ts`: altura isométrica esperada actualizada de `2.7 m` a `2.8 m` (presentación a un decimal del nuevo origen 2,77 m).
- Ejecutar en `main` tras integración autorizada: `npm ci`, `npm test`, `npm run build`, `npm run test:e2e`. Revisar también las suites existentes de candados XYZ, gestos, selección, carpetas, aperturas, migraciones e importación/exportación. No se certifica su ausencia de regresiones en esta rama.

### Compatibilidad y riesgos pendientes

- El esquema no cambia: el checkout actual escribe hasta v8 y conserva lectores v1–v5. No hay migración de posiciones ni reparación automática de intersecciones en diseños guardados; esos solapes históricos permanecen al abrirlos. Los cambios nuevos usan las mismas coordenadas mundiales en metros.
- Las habitaciones creadas a partir de ahora tienen distinta separación vertical. Cambiar después la altura o mover manualmente superficies/packs sigue pudiendo introducir intersecciones; impedirlas/repararlas globalmente pertenece al contrato estructural de #51/#52 y no se improvisa aquí.
- Al cambiar de habitación se recentran Plano y Libre, descartando el desplazamiento manual relativo de esas cámaras; zoom y orientaciones se conservan. Undo/redo no guarda navegación. Restaurar un pack con redo no le da foco si el actual sigue siendo válido.
- `structureSurfaceName` cambia solo la presentación del patrón automático histórico exacto `Pared NORTH/EAST/SOUTH/WEST`. El valor persistido y el texto original disponible al renombrar se mantienen; los nombres personalizados distintos de ese patrón se muestran intactos.
- No se ha medido rendimiento ni validado navegador, dispositivos o exportación GLB. El cálculo añadido de envolvente se hace al crear, no por frame. El historial de foco es de sesión y acotado por las habitaciones válidas, no se exporta.
- La propuesta de colisiones requiere unión de polígonos en `WallBody`, detección geométrica común y cambios atómicos de validadores. `buildWallSegments` no es el cuerpo principal extruido de la pared; permitir solapes solo ahí no garantiza una pared válida.

### Comprobación manual solicitada al propietario

1. Abrir un diseño anterior sin sobrescribir el original. Revisar posiciones, nombres personalizados y selección de puertas/ventanas. Provocar un límite o un solape en cada pared: el aviso debe usar A, B, C o D. Los solapes de aperturas **siguen bloqueados**, pendientes de la tarea propuesta.
2. Desde raíz crear Habitación 2, después Habitación 3; deshacer su creación y comprobar que vuelve a Habitación 2. Rehacer, enfocar manualmente Habitación 3 y borrarla mediante carpeta y mediante inspector en recorridos separados. Si también se eliminó la habitación previa, comprobar retorno a raíz.
3. Repetir con Plano, Isométrica, Frontal, POV y Libre; incluir desplazamiento manual de Plano/Libre, cambio manual de habitación, movimiento reducido y carga de otro diseño. Confirmar que no quedan cámara/altura en un nivel eliminado.
4. Con muebles de suelo y lámpara de techo, crear debajo y encima de raíz, y de un pack de altura 4 m. Mostrar los techos desde el árbol y observar en Frontal/Libre que no atraviesan objetos de la habitación vecina. Repetir con grosor de suelo/techo modificado y varias plantas. Los objetos existentes deben mantener sus posiciones.
5. Mover/girar/redimensionar muebles y aperturas, comprobar candados X/Y/Z, carpetas, selección múltiple y undo/redo. Guardar una copia, recargar y exportar/reimportar JSON; revisar también GLB y navegación móvil/tablet/escritorio.

**F0/#34 continúa abierta y sin certificar.** El alcance de logs que ya figura en la issue permanece pendiente; esta revisión no lo sustituye ni declara completado el MVP multinivel.

## Continuación — hueco entre plantas y creación en espacio ocupado

**08/11/2026 · correcciones locales, sin suites/build/CI ni validación visual ejecutada.** El propietario aporta una captura frontal con aire entre la peana de la raíz y las paredes de la habitación inferior. Se mantienen la rama, los cambios previos y la política de no publicar.

### Causas y correcciones vigentes

1. **Hueco introducido por la primera corrección:** se alineaba la cara superior del techo centrado con la cara inferior del soporte. Como el techo estaba oculto, sus paredes acababan medio espesor por debajo, dejando aire visible. Los techos de habitaciones nuevas quedan ahora **dentro de la altura de las paredes**, con su cara superior en el mismo plano que sus bordes superiores. Crear debajo alinea ese plano con la cara inferior del soporte real de arriba (incluida la peana de raíz). No se añade un suplemento fijo ni se reserva aire para una superficie oculta. Se elimina además el redondeo exterior: la colocación automática conserva los valores derivados de los semiespesores, aunque no sean centímetros enteros; la edición manual mantiene su precisión existente.
2. **Destinos sin reserva:** `addStructurePack` construía siempre un pack sin comprobar otras habitaciones. `domain/roomCreation.ts:planRoomCreation` concentra el cálculo de referencia, candidato y ocupación para UI y store. Intersección positiva de los volúmenes rectangulares en X, Y y Z bloquea la creación, incluida la raíz, habitaciones ocultas, distintos tamaños y cruces parciales. Contacto de límites y habitaciones en otra planta no bloquean por mera proximidad. Se mantienen los modelos y restricciones estructurales existentes; no se implementa medianera única.
3. **UI:** cada dirección ocupada muestra `Ocupado`, queda deshabilitada y tiene explicación en `title`. Se recalcula al cambiar habitación, selección, dimensiones, posiciones, creación, borrado y undo/redo. No calcula ni se suscribe al mobiliario durante arrastres. La acción vuelve a comprobar el destino y devuelve un aviso si está ocupado, sin generar ID, carpeta, cambio de foco ni paso de undo. Una selección explícita de raíz se respeta aunque la cámara estuviera en otro pack.
4. **Compatibilidad de techo:** `packRoomBox` reconoce tanto el techo histórico centrado en la coronación como el nuevo cuya cara superior coincide con ella; no transforma los antiguos. Cambiar la altura de una habitación conserva su tipo de alineación. Cambiar el grosor de un techo nuevo mantiene su cara superior y rechaza la operación si desplazar su centro vulneraría Y bloqueada. Las posiciones de muebles y habitaciones existentes no se migran.

**Geometría actual de referencia con paredes de 2,70 m:** sobre raíz, origen de nuevo pack a 2,765 m (cara inferior del suelo a 2,70 m); debajo de raíz, origen a −2,88 m (paredes y cara superior del techo a −0,18 m, justo bajo la peana). Entre packs nuevos con suelo de 0,13 m, distancia entre orígenes 2,765 m. El techo de 0,13 m queda interior al límite alto, no lo prolonga. Son cotas derivadas de la geometría, no constantes del algoritmo.

### Archivos de esta continuación

- `src/domain/roomCreation.ts` (nuevo): cálculo puro común para previsión y acción.
- `src/domain/roomEditing.ts`: reconocimiento y redimensionado compatible de ambas alineaciones de techo.
- `src/state/actions/constructionActions.ts`: rechazo de ocupación y ajuste de grosor con respeto a Y bloqueada.
- `src/components/editor/ObjectCatalogSection.tsx`, `src/styles.css`: direcciones deshabilitadas y explicación visible.
- `src/state/roomCreation.test.ts` (nuevo): **11 casos unitarios** preparados. Seis direcciones, operación rechazada sin mutaciones, liberación con borrado/undo/redo, ocupación de raíz/ocultos, contacto, solapes parciales, alturas distintas, suelo fino, techo/redimensionado, Y bloqueada y techo histórico.
- `src/state/roomLevels.test.ts`: sus regresiones de separación exigen ahora contacto exacto de caras, no toleran una rendija inferior a un centímetro.
- `tests/room-level-regressions.spec.ts`: **6 E2E adicionales** preparados para botones ocupados y actualización mediante undo/redo, uno por dirección. Se mantienen las capturas frontal arriba/abajo y los casos de foco de la primera entrega.

**Verificación:** revisión estática del cálculo y consumidores; `git diff --check` sin errores de whitespace. Ninguno de estos casos se ha ejecutado. El total preparado por ambas entregas es 30 casos unitarios nuevos y 18 E2E nuevos; no equivale a resultados pasados. Unitarias, compilación/build, suites existentes y E2E siguen pendientes de integración autorizada en `main`.

### Comprobación manual y límites

1. Para comprobar el hueco, **borrar/recrear la habitación inferior de la prueba**: no se reparan automáticamente posiciones antiguas. En Frontal, sus paredes deben llegar a la peana superior; al mostrar el techo desde el árbol, su cara superior debe quedar en ese mismo plano. Revisar también altura de 4 m, creación sobre/bajo packs y suelo fino.
2. Desde raíz crear una habitación en cada dirección en pruebas separadas, volver a seleccionar raíz y abrir el selector: esa opción debe estar deshabilitada con `Ocupado`. Seleccionar la habitación nueva y comprobar que la dirección inversa que vuelve a raíz también está bloqueada.
3. Deshacer, rehacer, borrar y mover la habitación ocupante: verificar que las opciones se actualizan y que otras direcciones libres siguen funcionando. Incluir un cruce parcial, habitaciones de tamaños distintos y habitaciones ocultas.
4. Comprobar el grosor del techo nuevo, bloqueo Y, altura de habitación, selección, muebles, guardado/reapertura y JSON, en escritorio y móvil. El aviso de bloqueo del store no debe cambiar el diseño ni añadir undo.

El control se aplica a **crear habitaciones**, no a recolocar estructuras antiguas ni a impedir solapes introducidos después mediante movimiento o edición manual. Usa los volúmenes rectangulares del modelo existente; las habitaciones deformadas/incompletas conservan el fallback de `worldRoomBoxes`. Geometría de vivienda irregular y medianeras físicas únicas siguen en #51/#52. No se modifican formatos persistidos ni se afirma certificación visual o de migraciones.

## Sincronización autorizada con la rama remota — 08/11/2026

El propietario autorizó expresamente avanzar `feature/34-auditar-refactorizar` mediante fast-forward y reaplicar los cambios locales. La rama pasó de `6327402` a `361ab68`, incorporando 16 commits remotos, sin crear commits nuevos ni publicar. No había un merge abierto ni archivos sin fusionar: el bloqueo era la actualización con cambios locales pendientes.

Se respaldaron los 24 archivos locales en una copia temporal y se utilizó autostash para el avance rápido. La reaplicación terminó sin conflictos textuales. La comparación con la copia confirmó que los 23 archivos locales distintos de `src/styles.css` conservaron su contenido (normalizando únicamente finales de línea); `styles.css` conserva la regla local para direcciones ocupadas y añade los estilos remotos del panel. No quedan entradas sin fusionar ni marcadores de conflicto; `git diff --check` sin errores. No se ejecutaron suites, build ni CI.

**Cambio de estado respecto a la propuesta anterior:** los commits recibidos implementan detección de parejas mediante cajas, panel y contornos de objetos/aperturas. Véase [F0_COLLISION_PANEL.md](F0_COLLISION_PANEL.md). Esto sustituye las afirmaciones anteriores de ausencia de panel, pero no habilita solapes de aperturas ni resuelve la unión geométrica de huecos. La propuesta original se conserva con una nota de actualización. La certificación funcional/visual y las pruebas siguen pendientes; no se declara completa la funcionalidad solicitada de colisiones.

## Ajuste de altas por habitación enfocada (08/11/2026)

- `focusedCreationTarget` centraliza la habitación enfocada mediante `activeRoomId` y devuelve su centro en coordenadas globales, dimensiones y carpeta de escena. No se deduce la habitación a partir de la selección actual.
- Nuevos muebles/decoración se asignan automáticamente a la carpeta de la habitación enfocada (incluida Raíz); conservan su búsqueda de posición libre. El usuario puede moverlos a otra carpeta sin afectar a su geometría.
- Nuevos suelos y paredes independientes se crean en el centro de la habitación enfocada en X/Z y a media altura, adaptando ancho y alto/profundidad a su volumen; su fila visible se asigna a la misma carpeta. En plantas superiores se aplica el origen global del pack de habitación, sin cambiar los formatos existentes.
- Las puertas adicionales conservan su anclaje a la habitación enfocada y ahora obtienen su carpeta del mismo criterio compartido.
- **Límite heredado:** las ventanas/elementos de pared del catálogo siguen perteneciendo a `RoomConfig`, es decir, a las paredes de la habitación raíz. Se asignan a Raíz aunque la cámara esté en otra habitación, para evitar una carpeta engañosa. Permitir ventanas físicas en packs requiere evolución específica de geometría/estado, ajena a este ajuste seguro.
- Al borrar mediante el árbol una superficie independiente se elimina también su pack invisible si se queda vacío. El cambio no reubica diseños guardados ni modifica migraciones.
- Se añade `creationInFocusedRoom.test.ts` con raíz, plantas arriba/adyacentes, posición global, asignación, cambio de carpeta y limpieza. **Pruebas no ejecutadas** en rama conforme al acuerdo de CI exclusivo de `main`.

## Movimiento entre volúmenes de habitación (08/11/2026)

`spatialFolderPlacement.ts` calcula la habitación que contiene el **centro 3D** de un mueble o superficie independiente. Cuando un elemento ya existente entra en el volumen de una habitación distinta, se actualiza su `elementFolderAssignments` en el mismo cambio que la posición: el árbol sigue la escena, incluso entre plantas por el eje Y. En límites comunes, espacios vacíos o volúmenes ambiguamente superpuestos no se reasigna la carpeta. Si el usuario reordena manualmente sin desplazar el elemento a otra habitación, se conserva su elección. Deshacer/rehacer restaura posición y carpeta juntas.

Este comportamiento se aplica a muebles y superficies independientes; no mueve habitaciones estructurales ni puertas ancladas. Las ventanas siguen siendo exclusivamente de `RoomConfig` y necesitan un modelo de aperturas de packs con soporte completo en geometría, inspector, colisiones, persistencia y migración. No se simula que una ventana pertenece a otra habitación cambiando solo su carpeta. `spatialFolderPlacement.test.ts` contiene regresiones preparadas **sin ejecutar** (CI exclusivo de `main`).

## Vacío de vivienda y elementos murales libres — continuación del 08/11/2026

**Implementación local, sin commits ni publicación.** Base real: `feature/34-auditar-refactorizar`, limpia, hasta `8ba834a`, que ya incorporaba ventanas físicas de packs. Las afirmaciones anteriores sobre ventanas exclusivas de raíz son históricas. El propietario solicita libertad de movimiento mural y aclara que las puertas no deben moverse en Y: estas conservan su anclaje constructivo y bloqueo vertical; ventanas y decoración admiten XYZ mundial.

### Causas y cambios

- **Exterior:** los validadores exigían que el objeto cupiera completo en una sola habitación. `buildingVolume.ts` comprueba cobertura por la unión de cuerpos rectangulares de habitaciones con sus apoyos, restando sus huellas por franjas de altura. No usa una caja global que rellene patios o huecos. Cruce entre estancias cubierto por esa unión no genera exterior; una parte positiva en vacío sí. Texto nuevo: `está fuera de la vivienda, en el vacío`.
- **Despegar:** se añade `WindowConfig.freePosition?: { x, y, z, yaw }` (base mundial, metros/radianes). Ausencia conserva anclaje histórico. Inspector y arrastre XYZ despegan el elemento sin recolocarlo ni cambiar su modelo/orientación; la ventana deja de recortar su pared. El centro permite pasar realmente entre `room.windows` y `pack.windows`, con el mismo ID, posición, selección y carpeta en el mismo historial. En vacío o límites ambiguos se conserva su pertenencia anterior.
- **Escena:** `WorldWallObjects` dibuja cada ventana/decoración una sola vez en coordenadas mundiales, en Plano y 3D. Los controles permanecen montados al cambiar de habitación. Inspector/árbol muestran estado `Libre`; se conservan candados, tamaño, giro, color, nombres y duplicación. `Volver a colocar en la pared…` restaura el anclaje y corte solo si los límites, otras aperturas y candados lo permiten. No se abre un hueco automáticamente al aproximarse a una pared. Las puertas no adquieren Y libre.
- **Consistencia:** grupos, selección, parejas de colisión, aviso de vacío y transferencias comparten posición mundial. Deshacer/rehacer conserva hueco, propietario y carpeta; reanclar compara candados en coordenadas mundiales. Mover solo una carpeta o redimensionar sin trasladar no cambia la asignación manual. La eliminación del soporte original no borra un elemento ya transferido a otro propietario.

### Formato y archivos

Se escribe **v9 únicamente si existen posiciones murales libres**. Los lectores conservan v1–v8 y no convierten sus coordenadas. Normalización, JSON y ProjectV2 validan finitud y conservan el campo; se rechaza declarar una posición libre en un archivo v1–v8. La huella estructural incluye ventanas de packs. Aplicaciones antiguas que solo admitan v8 no abrirán los archivos v9. Contrato en [DATA_AND_FORMATS.md](../DATA_AND_FORMATS.md); diseño previo en [COLLISION_SYSTEM_PROPOSAL.md](../COLLISION_SYSTEM_PROPOSAL.md).

Archivos nuevos: `domain/{buildingVolume,freeWallPosition,wallObjectPlacement}.ts`, `state/actions/wallObjectActions.ts`, `scene/{WorldWallObjects,WallObjectGizmo}.tsx`. Se ajustan sus consumidores en dominio, store/acciones, escena e inspector/árbol/panel; el contrato y lectores en `types`, `designV1`, `normalizeDesignV1`, `designMigrations`, `designFile`, `projectMigration` y `projectV2`.

### Verificación

- **Ejecutado:** TypeScript estático (`tsc --noEmit --project tsconfig.app.json`) correcto; revisión de diff y `git diff --check`. No se han ejecutado unitarias, E2E, build ni CI. Durante el tipado se corrigieron dos defectos previos: margen inferido como literal `0.25` que rechazaba `0.12`, y un acceso de prueba a `elementFolderAssignments` opcional sin estrechar.
- **Preparados, sin ejecutar:** 5 casos en `buildingVolume.test.ts`, 14 en `wallObjectMovement.test.ts` (6 formas parametrizadas y 8 casos de traspaso, corte/reanclaje, bloqueos, grupo, duplicación, v9/ProjectV2 y legado v1–v8), y 5 E2E en `free-wall-objects.spec.ts` (vacío/undo y transferencia a raíz a 375/1280 px, más puerta con Y deshabilitada). No equivalen a validación funcional ni visual.

### Comprobación manual y límites

1. Cruzar un mueble o superficie independiente entre habitaciones/plantas contiguas: sin aviso de vacío. Separar las habitaciones o probar un patio de una casa en L: debe aparecer al ocupar ese vacío real.
2. Mover ventana, estante, cuadro, espejo y aplique por XYZ, también Y negativa/sobre techo. Revisar desaparición del hueco al despegar, estado `Libre`, aviso/borde y nombres. Pasar entre raíz/packs/plantas y comprobar posición, selección, carpeta, grupo, copia, borrado de soporte anterior y undo/redo.
3. Reanclar desde el inspector: hueco válido o rechazo claro, respetando candados XYZ. Puertas con Y deshabilitada. Revisar las cinco vistas, ratón/táctil/teclado y Shift para altura, especialmente arrastre entre niveles.
4. Guardar una copia v9, recargar, exportar/reimportar JSON y GLB. Abrir históricos sin sobrescribir los originales. Suites y build únicamente tras integración autorizada en `main`.

**Pendiente:** validación visual, suites y rendimiento. El cuerpo de vivienda usa los volúmenes rectangulares/fallback del modelo actual; una pared independiente no crea habitación. Vivienda irregular, medianeras únicas y cerramientos deformados completos siguen en #51/#52. El diagnóstico conserva cajas: para ventanas giradas en su plano usa una envolvente conservadora, no prueba detallada de malla, y puede necesitar ajuste en límites complejos. No se promete precisión CAD ni se declara completada #34.

## Creación visible y selección de ventanas de habitaciones secundarias — 08/11/2026

**Continuación local sobre los cambios anteriores, sin sobrescribirlos ni hacer commits.** El propietario aporta una captura con el contorno verde por debajo de una ventana secundaria. El indicador antiguo de `StructureSurface` se colocaba a `height/2` sin sumar `opening.bottom`, coherente con ese desfase. La representación mundial de ventanas introducida en esta rama ya evita la duplicación del modelo dentro de la pared; se refuerza ahora con `wallObjectSelectionFrame`, que comparte posición, centro y profundidad del contorno y los ejes. Incluye origen mundial del pack, origen local del suelo, antepecho y orientación de pared. El anclaje visual de los ejes se separa del origen numérico del objeto para que acercarlos al marco no introduzca un salto al empezar a mover. Se corrige también la fórmula antigua al incluir `opening.bottom`.

**Colocación:** `addWindow` recorría siempre A→B→C→D. Ahora `windowPlacementWalls` usa la misma política de ocultación que el render (`hiddenWallsForView`, compartida con `scene/wallVisibility`) y prueba primero paredes visibles de la habitación enfocada. En Frontal favorece la pared principal; Libre sigue el azimut; Plano considera las cuatro paredes representadas por su contorno. Paredes inexistentes, ocultadas manualmente o bloqueadas se excluyen, así como una habitación oculta/bloqueada. Las paredes ocultas solo por la cámara quedan como alternativa si las visibles no admiten la ventana; en ese caso se indica expresamente en el aviso. Se conservan búsqueda de hueco, tamaños, márgenes, colisiones constructivas, protección de medianeras y asignación al pack correcto.

**Archivos:** `domain/{geometry,windowPlacement,wallObjectPlacement}.ts`, `state/actions/constructionActions.ts`, `scene/{wallVisibility,WorldWallObjects,WallObjectGizmo,StructureSurface}` y regresiones en `state/windowPlacement.test.ts` y `tests/window-visible-placement.spec.ts`. No se cambian formatos persistidos ni posiciones existentes por esta continuación.

**Verificación:** TypeScript estático (`tsc --noEmit --project tsconfig.app.json`) correcto; revisión del diff. Se preparan **10 casos unitarios** (prioridad raíz/pack, Frontal/Libre, ocultación/candados/Plano, fallback y marcos de selección de cuatro paredes con suelo local/altura personalizada, más posición libre) y **4 E2E** a 375/1280 px en raíz/secundaria, creando ventana rectangular y circular y preparando capturas de la selección. No se ejecutan unitarias, E2E, build ni CI.

**Límite visual explícito:** se intentó acceder al editor abierto para revisión puntual con la habilidad `computer-use`. El acceso de navegador no estaba disponible y la aprobación para acceder a Chrome caducó; no se modificó la sesión del usuario ni se pudieron obtener capturas nuevas. La imagen aportada se ha inspeccionado, pero **no se afirma reproducción ni validación visual posterior al cambio**.

**Manual pendiente:** refrescar la web local de esta rama, enfocar una habitación secundaria (también con altura personalizada), girar la vista 180° y crear ventanas rectangular/circular. Deben aparecer primero en B/C visibles, con contorno y ejes centrados sobre la seleccionada y coordenada Y que incluya la planta y antepecho. Repetir en cuatro diagonales, Frontal, Libre y Plano; ocultar/bloquear una pared, llenar las visibles y comprobar fallback con aviso. Confirmar selección desde árbol/canvas, arrastre sin salto inicial, bloqueo XYZ, giro y undo/redo. Revisar las capturas E2E únicamente al ejecutar la suite en `main` tras integración autorizada.

## Ejes de elementos fijados a paredes — 08/11/2026

**Petición posterior del propietario:** ocultar/bloquear el movimiento según el plano de la pared. Sustituye el comportamiento anterior en el que cualquier edición XYZ despegaba automáticamente el elemento. Se conservan rama y cambios locales, sin commits ni publicación.

- A/C: X e Y disponibles, Z perpendicular deshabilitado. B/D: Z e Y disponibles, X deshabilitado. Se deriva del plano mundial real de la pared, incluyendo giros de superficies de packs, no solo de su etiqueta. En pared oblicua, X/Z aislados no permanecen en el plano: se ocultan ambos y se ofrece desplazamiento local por la pared, además de Y/arrastre proyectado.
- `wallObjectAvailableAxes` es compartido por inspector, flechas de escena, arrastre, multiselección y validación de la acción. El bloqueo geométrico no se escribe como un candado manual persistido. Cambiar de pared alterna automáticamente los ejes; los candados elegidos por el usuario se conservan.
- Deslizar un elemento fijado conserva su anclaje y hueco; límites, márgenes, colisiones de aperturas y valores finitos siguen vigentes. El eje perpendicular no puede moverse invocando la acción directamente ni mediante un grupo. Mover una habitación completa sigue trasladando sus superficies y elementos anclados juntos.
- Nuevo botón **Despegar de la pared**: conserva coordenadas y candados, retira el hueco y habilita XYZ libre. Los elementos v9 ya libres mantienen su libertad. **Volver a colocar en la pared…** restaura la restricción del soporte. Puertas siguen con Y bloqueada. No hay cambio de formato ni migración automática de posiciones en esta continuación.

**Verificación:** `tsc --noEmit --project tsconfig.app.json` correcto. Se preparan **13 casos unitarios** en `wallObjectAxes.test.ts` (cuatro paredes en raíz/pack, despegado/reanclaje, candados manuales, giros de pared y grupos) y **1 E2E adicional** de alternancia X/Z y despegado. Se adaptan los casos anteriores de movimiento libre para despegar explícitamente primero. Unitarias, E2E, build y CI **no ejecutados**; revisión visual pendiente.

**Manual:** seleccionar ventanas/decoración en A/C y B/D, comprobar input/checkbox perpendicular deshabilitado y flecha ausente, deslizar en el eje permitido y en Y sin perder el hueco. Cambiar de pared, despegar y reanclar; repetir con candados manuales, selección múltiple, habitación secundaria y una pared girada. Confirmar que undo/redo restaura anclaje y posiciones.

## Diagnósticos locales — implementación por etapas, 08/11/2026

**Alcance autorizado:** encargo adjunto del propietario y orden «empieza». Rama `feature/34-auditar-refactorizar`, base limpia `71e30c8`, coincidente con la referencia viva de GitHub al comenzar. Revisados los cambios posteriores a la auditoría (gestos, carpeta espacial, ventanas por habitación y objetos murales); se conservan. Sin nuevas dependencias, sin push, PR, integración ni cierre de issue.

1. Motor versionado: IDs de sesión/evento/operación, categorías/niveles/resultados; acciones observadas tras validación efectiva. Resumen de cambios mínimos, selección múltiple, grupos, cámara, construcción, archivos y errores. Gestos correlacionados con cancelación que conserva posiciones, como antes. No se interpretan frases iguales como eventos duplicados.
2. IndexedDB canónico, sin backend y válido en producción/offline con app cargada. Retención configurable por defecto 7 días/5 MiB de eventos, prioridades y colas acotadas; recuperación y avisos ante fallos. Undo/redo y datos de diseños permanecen separados.
3. Copia JSONL automática al ejecutar Vite dev, por fecha/sesión/categoría y segmentos de 1 MiB. Escritor recuperable, confirmación por IDs, timeout/reintentos, límites y retención propios. Histórico `logs/interactions.log` intacto.
4. Visor solo DEV, importador aislado de JSON portátil/JSONL/histórico, filtros por fecha UTC, nivel, categoría, sesión, objeto y operación. Paginación y detalles; sin importación de registros al diseño. Guard literal DEV y comprobación preparada para los artefactos del build.
5. Ayuda pública: exportar y compartir diagnóstico por iniciativa del usuario, selector nativo o descarga, con explicación del contenido. Sin telemetría ni envío automático. Los nombres e IDs originales no se exportan; la familia de navegador no incluye UA completa.
6. Compatibilidad, documentación y pruebas preparadas: contrato/privacidad/agrupación/memoria, store/cancelación, colas y recuperación, disco/histórico, parejas de aperturas y E2E con IndexedDB real, offline, importación/exportación, receptor y compartir. Script agregado adaptado a JSONL sin convertir estadísticas en producto.

**Verificación realizada:** inspección de diff y revisión estática con TypeScript `--noEmit` para app y herramientas Node, sin build. `git diff --check` sin errores de formato; Git avisa de normalización LF/CRLF. No se ejecutan unitarias, E2E, build, CI ni servidor de desarrollo; no hay validación visual ni mediciones de CPU/FPS. La inspección automática del bundle público queda preparada para el build de main, no se afirma que ya haya pasado.

**Límites y pendientes:** [DIAGNOSTICS.md](../DIAGNOSTICS.md). El cierre es de mejor esfuerzo; IndexedDB puede perderse por borrado del navegador. La deduplicación de copia es por proceso/ventana acotada y un reinicio puede repetir IDs; el lector los deduplica. El muestreo espacial a 150 ms puede omitir contactos fugaces, y las cajas no representan mallas exactas. Validadores sin detalle estructurado conservan motivos genéricos. Exportar/compartir nativo, móvil/teclado, accesibilidad y consumo requieren validación real. Mantener #34 abierta hasta ejecutar las suites y build en main tras autorización de integración.

**Consulta manual prevista:** `npm run dev` → registros JSONL en `logs/diagnostics/`; botón «Diagnósticos · desarrollo» → directo/filtros/importar; Ayuda → Exportar diagnóstico o Compartir diagnóstico. Cancelar compartir no descarga; si no hay soporte se solicita descarga. Cerrar/reabrir Ayuda refresca el archivo preparado para compartir. Estas instrucciones son un recorrido pendiente de comprobación, no evidencia de éxito visual.

## Consulta de diagnósticos en archivos internos — rectificación del propietario

**08/11/2026, continuación de #34.** Sustituye el visor web de la entrega anterior y retira Compartir diagnóstico. Se elimina el componente del visor y su CSS, incluida su carga en DEV; el logger sigue sin interfaz. Ayuda conserva exportar y el JSON descargado se indenta. No cambian motor, IndexedDB, historial, privacidad ni política de colisiones.

- `tools/diagnostics/readable.ts`: lectura en español con acción/resultado, hora de Madrid, valores efectivos antes/después, metros/porcentajes/grados, motivos y referencias. El escritor Vite genera `.lectura.log` junto a cada JSONL y puede reconstruirlo si falla la proyección. La limpieza contabiliza originales y copias por parejas; no toca el histórico.
- `tools/diagnostics/read.ts` y `npm run diagnostics`: consulta interna en terminal/archivos de VS Code, filtros, seguimiento, salida conjunta, regeneración de lecturas existentes y apertura de diagnósticos exportados/histórico. No se monta visor en la web ni se incorporan registros al diseño.
- Pruebas preparadas/adaptadas de formato humano, filtros, escritura legible y ausencia de controles de compartir/desarrollo. Las pruebas automáticas, build/CI y validación visual siguen pendientes según la política de main. No se alteran las evidencias históricas superiores.

Guía vigente y comandos: [DIAGNOSTICS.md](../DIAGNOSTICS.md).

**Comprobación de esta continuación:** TypeScript sin emisión para aplicación y herramientas Node correcto. Se ejecutó el lector interno sobre los JSONL reales del propietario con `--regenerar --salida logs/diagnostics/LECTURA.log`: se generaron las copias legibles por categoría y la lectura conjunta, comprobadas por lectura de sus archivos. Los JSONL fuente y el histórico no se modificaron. Esto verifica la conversión/consulta local, no la actualización en vivo de Vite, la interfaz en navegador ni las suites, que siguen pendientes.

## Exportación directa bajo los atajos — 08/11/2026

Nueva indicación del propietario: no exigir comandos para generar lecturas. Se mantiene la generación automática JSONL/lectura de Vite como recorrido habitual; el lector de terminal existente queda como utilidad opcional de mantenimiento. Se retira el selector Ayuda de la cabecera y se sustituye por el botón directo **Exportar diagnóstico**, debajo de la sección **Atajos de teclado** del panel de configuración, independiente de su plegado. Conserva aviso de privacidad, estado de preparación/descarga y errores de almacenamiento. Se elimina el CSS del desplegable y se adapta el E2E existente, sin ejecutar suites/build/CI. Validación visual pendiente.
