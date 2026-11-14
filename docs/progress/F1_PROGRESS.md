# F1 — Editor base · informe de progreso

Informe único de la fase F1 (hito «F1 — Editor base»). Cada issue añade su sección; no se borran entradas anteriores.

## #26 · [F1 · 02/09] Validar medidas, redimensionado, aberturas y colisiones

**Rama:** `feature/F1-02-validad-cosas` (creada desde `origin/dev` en 23e160b, que incluye el merge #70). **Estado:** en curso, sin commit ni integración.

### Ampliación: cotas del perímetro en Plano · IMPLEMENTADO, sin validación visual

- **Dominio** — [`src/domain/planDimensions.ts`](../../src/domain/planDimensions.ts): calcula las cotas a partir de los segmentos de `physicalWalls` (no de valores fijos ni de medidas en pantalla). Funciona con segmentos arbitrarios para preparar #35. Longitud redondeada a 0,01 m y formato `es-ES` («4,37 m»). Incluye un resumen textual para lectores de pantalla y la regla de simplificación de etiquetas (completa → sin unidad → oculta) cuando falta espacio.
- **Escena** — [`src/scene/PlanDimensions.tsx`](../../src/scene/PlanDimensions.tsx):
  - Dibuja la línea de cota exterior, los testigos y las marcas oblicuas de los extremos, con una etiqueta de fondo claro.
  - Las posiciones se expresan en metros del mundo, así que cada cota sigue en su pared al girar el Plano. Grosores, separación y tamaño del texto se recalculan en píxeles cada fotograma, por lo que se mantienen legibles con cualquier zoom o tamaño de pantalla.
  - Orden desde la pared hacia fuera, con «Mostrar detalles»: trazo de pared → cota (a 8 px del trazo) → letra «PARED A–D» (8 px por detrás de la cota). En ese modo la letra la dibuja la capa de cotas y se oculta la etiqueta normal para no duplicarla. La letra mantiene su tamaño en metros. Al desmarcar, la letra vuelve a su posición habitual. _(Ajuste pedido por el propietario el 10/11/2026.)_
  - Las cotas no interceptan el puntero (`raycast` nulo), así que no bloquean puertas, ventanas ni manipuladores.
  - No se dibujan en exportación, fuera de Plano ni cuando la base no está visible (foco en otra planta).
- **UI/estado:** checkbox «Mostrar detalles» dentro de los controles de Plano ([`ViewControls.tsx`](../../src/components/editor/ViewControls.tsx)). Usa el estado de sesión `planDetailsVisible`:
  - no se persiste, no entra en el historial y no cambia cámara, zoom, encuadre ni selección;
  - por defecto está desmarcado, que equivale a «Plano normal»;
  - incluye un resumen `aria-live` con las cotas, para accesibilidad textual.
- **Todas las habitaciones** _(ajuste pedido por el propietario el 10/11/2026)_:
  - `planRoomDimensions` acota cada pared visible en el Plano de la habitación raíz y de cada habitación adicional (`floor-pack-*`).
  - Para cada habitación, el exterior se calcula respecto al centro de su suelo.
  - Las paredes independientes y las ocultas no se acotan.
  - El resumen accesible agrupa las cotas por nombre de habitación.
  - Las letras «PARED X» de la habitación enfocada también pasan detrás de su cota.
- **Límites F1:** en habitaciones contiguas, cada lado de la pared compartida tiene su propia cota, dibujada hacia la habitación vecina (las paredes compartidas únicas llegan con #51/#52). No se acotan huecos ni muebles, que corresponden a #38, #35 y #52.

### Arrastre libre en Plano en cualquier habitación · CORREGIDO

- **Antes:** arrastrar para desplazar el Plano solo funcionaba sobre el suelo de la habitación raíz. En las habitaciones adicionales, el clic en el suelo solo las seleccionaba.
- **Ahora:** la lógica está en un único hook, [`usePlanPan`](../../src/scene/usePlanPan.ts). Lo usan el suelo raíz ([`RoomShell.tsx`](../../src/scene/RoomShell.tsx)) y los suelos `floor-pack-*` ([`StructureSurface.tsx`](../../src/scene/StructureSurface.tsx)).
- Solo mueve la cámara de sesión: no entra en el historial y funciona también con el suelo bloqueado. Los suelos y paredes independientes siguen arrastrándose como objetos.

### Desplazar el Plano desde fuera de las habitaciones · IMPLEMENTADO

- [`PlanPanSurface`](../../src/scene/PlanPanSurface.tsx) es un fondo invisible, solo en Plano y por debajo de todas las plantas. Desde él se puede arrastrar en cualquier zona vacía y, como antes, deselecciona al pulsar en vacío. Solo actúa cuando es lo primero bajo el puntero, así que muebles, paredes, puertas y suelos conservan sus eventos. No se exporta.
- La plataforma de la habitación raíz también permite desplazar el plano.
- El cursor lo decide un único sitio: el fondo mira si lo primero bajo el puntero lleva `userData.planPannable` (fondo, plataforma o suelo de habitación).

### Selector «Cámara enfocada en…» por plantas · IMPLEMENTADO

- **Antes:** en Plano, el selector era una lista plana con la altura junto a cada habitación, a diferencia del resto de vistas.
- **Ahora:** todas las vistas agrupan por plantas numeradas como en un edificio. La planta de la habitación raíz es la 0, las superiores son 1, 2… y las inferiores −1, −2… La altura queda como `title` del grupo.
- El cálculo está en [`floorLevels.ts`](../../src/domain/floorLevels.ts), con test. Se ha actualizado el E2E `room-views.spec.ts`, que fijaba la lista sin grupos en Plano.

### Cursor de arrastre en Plano · IMPLEMENTADO

- Funciona igual que la órbita isométrica: al pasar por encima de un suelo desplazable aparece la mano abierta (`grab`), y mientras se arrastra, la mano cerrada (`grabbing`).
- Lo gestionan las clases `plan-pan-ready` y `plan-panning` del `body`, en `usePlanPan`. Se limpian al soltar, al cancelar, al salir de Plano y al desmontar.

### Hoja de plantas en Plano · IMPLEMENTADO, sin validación visual

- **Historial:** primero las plantas inferiores desaparecían al enfocar una superior. Después se probó a superponerlas en trazo discontinuo (`PlanLowerLevels`). El propietario pidió después el formato habitual en arquitectura, con cada planta dibujada por separado y una al lado de otra, así que esa superposición se ha retirado (11/11/2026).
- **Ahora:** [`PlanFloorSheet`](../../src/scene/PlanFloorSheet.tsx), con su cálculo en [`planSheet.ts`](../../src/scene/planSheet.ts), dibuja todas las plantas de izquierda a derecha, de la más baja a la más alta (−1, 0, 1, 2…) y con 4 m de separación.
  - La disposición sigue la derecha de la pantalla aunque se gire el Plano.
  - Las plantas quedan alineadas en la dirección vertical de la pantalla, como en una lámina.
- **Planta enfocada** (la del selector «Cámara enfocada en…»): es la única editable y se dibuja en su posición real.
- **Resto de plantas:** son copias de solo lectura con suelos, trazo de paredes, puertas y ventanas, muebles y, con «Mostrar detalles», cotas.
  - Se desplazan solo al dibujar y se elevan a la altura de la planta enfocada. Las coordenadas del mundo y la edición no cambian, así que se respeta la regla de que la posición no dependa de la vista.
  - No reciben el puntero (`NonInteractive`): se puede arrastrar el plano sobre ellas. No se exportan.
- **Títulos:** cada planta lleva su título debajo, «Planta N»; la enfocada aparece resaltada como «Planta N · editando».
- **Límites:** las copias no muestran las letras «PARED X» ni los avisos de colisión. Para editar otra planta hay que elegirla en el selector.

### Límites de tamaño y salas grandes cortadas · CORREGIDO (RB-053)

- **Límites:** `ROOM_LIMITS` pasa a 50 m de ancho y fondo y 15 m de alto. Antes eran 100 m en las tres medidas. La importación conserva el límite de 100 m para no romper diseños antiguos.
- **Corte visual:** el plano lejano fijo de 80 m recortaba las salas grandes en Isométrica, Frontal y Libre. Ahora [`cameraFarPlane`](../../src/scene/cameraClipping.ts) lo calcula a partir de la esquina más lejana de todas las habitaciones, tanto desde la posición de origen como desde la de destino de la cámara.
- **Luz:** la luz principal se eleva por encima de las paredes en salas altas. Antes estaba fija a 14 m.

### Validación de medidas · mejora aplicada

- Si en un campo de medida se escribe un texto no numérico, ahora aparece un mensaje específico (`MEASUREMENT_INVALID_NOTICE`). Antes se mostraba el aviso de «centímetros enteros», que no corresponde a ese error.

### Discrepancias detectadas · PENDIENTE de decisión del propietario

1. **Solapes entre aperturas.** La issue pide no aplicar a los huecos estructurales la regla permisiva de los muebles, y RB-026 (CONFIRMADO) prohíbe que dos aperturas se pisen. Sin embargo, el código actual los permite y lo fija un test:
   - `validateOpenings` lo indica en un comentario: «Solapamientos: aviso en la escena, no error de validación».
   - `openingOverlapPolicy.test.ts` comprueba que «solapamientos entre puerta y ventana se permiten».

   `COLLISION_SYSTEM_PROPOSAL.md` describe esto como propuesta pendiente. No se ha cambiado nada.

2. **Ventanas giradas.** `resizedWallObject` sigue rechazando que una ventana girada redimensionada se acerque a otra apertura a menos de `openingGap`, mientras que las aperturas sin girar pueden solaparse. La regla es incoherente según el giro y depende de la decisión anterior.
3. **Rama base.** `AGENTS.md` indica partir de `main`, pero el remoto no tiene `main`: su rama por defecto es `feat/room-builder-v0.1`.

### Pruebas

- **Ejecutado localmente:** `tsc -b --noEmit` sin errores. Además, solo los dos archivos nuevos: `planDimensions.test.ts` (5/5) y `planDetails.test.ts` (4/4, incluidas habitaciones adicionales y paredes ocultas o independientes), `planSheet.test.ts` (3/3), `floorLevels.test.ts` (2/2) y `cameraClipping.test.ts` (3/3). Además, los tests ajustados al nuevo máximo: `roomDimensionRange.test.ts`, `editingRules.test.ts` y `useRoomStore.test.ts`.
- **Añadido sin ejecutar** (política de 07/11/2026: se ejecuta al integrar): `tests/plan-dimensions.spec.ts`. Cubre el conmutador, el resumen de cotas, la comparación del canvas con y sin cotas, la actualización centimétrica, el cambio de vista y la pantalla estrecha.
- **Pendiente:** suite completa, build y E2E. Tampoco hay validación visual humana de legibilidad con zoom y rotación, ni de solapes de etiquetas en habitaciones muy pequeñas.

### Pendiente dentro de #26

- Resolver las discrepancias 1 y 2 y aplicar la regla elegida en validadores, tests y documentación.
- Revisar con la aplicación en marcha:
  - redimensionado de muebles por gestos;
  - snap y cancelación de gestos;
  - undo/redo por transacción;
  - recarga y cambio de cámara.

  Ya existen tests de estas áreas (`furniture-gestures`, `history-transactions`, `room-editing`), pero no se han ejecutado en esta rama.

## 11/11/2026 — Contacto y fijación de mobiliario a paredes

**Estado: implementación local; revisión estática realizada; validación funcional, visual y automática pendiente.** Petición directa del propietario, sin issue asignada en esta conversación.

- Trasladado por petición expresa del propietario a `feature/F1-02-validad-cosas`, conservando los cambios locales anteriores y el historial de este informe. La implementación se preparó inicialmente desde `main` local `9a9b691` en `.worktrees/catalogo-pared`; ahora está aplicada en la carpeta principal de la rama actual. Respaldo previo al traslado en `.cache/catalogo-traslado/`. No se ha actualizado el remoto.
- Decisión confirmada: detener al contacto y fijar mediante check, con deslizamiento por la pared y bloqueo opcional de movimiento lateral/altura.
- Dominio: barrido continuo de cajas orientadas contra paredes físicas, teniendo en cuenta giro, altura, grosor y recortes reales. Un salto grande del puntero no atraviesa una pared. En traslaciones de mobiliario se aplica una fracción común al grupo; una proyección incompatible de una selección mixta se rechaza para no alterar sus separaciones.
- Inspector y flechas respetan los movimientos disponibles. Al fijar se conserva la orientación del mueble; para girarlo hay que despegarlo. Redimensionar un objeto fijado reajusta el contacto cuando los bloqueos y el soporte lo permiten. Las intersecciones antiguas se pueden separar; no se corrigen silenciosamente al cargar.
- Soporte: los objetos fijados siguen una pared que se mueve/gira cuando no hay restricciones incompatibles. Si el soporte se elimina, se despegan sin saltar de posición. La operación se rechaza si un bloqueo o una colisión impide conservar el vínculo.
- Persistencia opcional v11, con lectura de v1–v10; validación de campo, versión, referencia y contacto. JSON/ProjectV2 y undo/redo conservan la relación. Al pegar una copia se retira su fijación previa.
- No se bloquean solapes entre muebles. No se modifican paredes compartidas, formatos canónicos de vivienda ni controles de puertas/ventanas/decoración mural.

### Evidencia y comprobaciones pendientes

- `tsc --noEmit -p tsconfig.app.json`: correcto también tras el traslado a la rama actual (comprobación estática, no build).
- `git diff --check`: correcto tras el traslado.
- Preparadas `src/domain/furnitureWalls.test.ts` y `src/state/furnitureWalls.test.ts`: barrido rápido, volumen girado/altura, puertas, paredes independientes giradas, deslizamiento/bloqueos, grupos, solapes permitidos, datos antiguos, borrado/movimiento del soporte, undo/redo, pegado y round-trip v11.
- **No se han ejecutado unitarias, E2E, build ni CI**, por política del propietario. Certificación tras integrar en `main`, con autorización específica para integrar. Las expectativas históricas que permitían atravesar paredes pueden necesitar actualización; no se afirma que la suite completa pase.
- **No se ha abierto el navegador ni validado la presentación o el uso táctil.** La colisión usa cajas orientadas, no la malla detallada. Los giros y redimensionados libres comprueban el volumen final; el barrido continuo se aplica a las traslaciones. El seguimiento de una pared durante su giro necesita validación específica.
- Sin commits, push, PR, integración ni publicación.

### Comprobación manual propuesta

1. Desde la carpeta principal de esta rama, iniciar `npm run dev`; añadir una silla/armario y arrastrarlo rápidamente contra una pared en Plano e Isométrica: debe detenerse al contacto.
2. Marcar «Fijar a esta pared»; mover lateralmente y después hacia fuera: debe deslizarse por ella y mantener el contacto. Repetir con una pared independiente girada.
3. Activar «Bloquear movimiento lateral» y «Mantener altura»; comprobar cada restricción y sus flechas. Desmarcar fijación y separarlo; el bloqueo manual de altura se conserva hasta desactivarlo.
4. Mover/borrar la pared y deshacer/rehacer; comprobar posición, fijación y selección. Duplicar: la copia se pega libre.
5. Guardar/recargar y exportar/importar JSON: deben conservar fijación y bloqueos; abrir un diseño antiguo debe conservar su disposición original.
6. Verificar pasos por puertas con un objeto que cabe y otro que no, varias plantas/alturas, esquinas, límites del soporte, ratón, teclado y pantalla táctil. Superponer muebles debe seguir permitido.

### Corrección posterior del propietario: imán suave y esquina A–D

**La primera implementación de tope rígido descrita arriba queda sustituida.** Se trabaja directamente en `feature/F1-02-validad-cosas`, sin crear otra rama.

- Los muebles vuelven a atravesar paredes. Al aproximarse a 6 cm de una cara se ajustan al contacto; continuar con intención normal o repetir el paso de posición libera el imán. Mientras atraviesan esa pared no se recapturan continuamente; se rearma después de alejarse 12 cm de la zona de contacto. El movimiento tangencial mantiene la alineación. Los saltos de posición que pasan de largo no se convierten en barreras.
- El ajuste de esquina resuelve dos caras independientes a la vez. Se aplica en coordenadas mundiales; no se desplaza un mueble solo para una cámara. La captura usa una caja orientada conservadora, no la silueta detallada de cada malla.
- La fijación explícita conserva deslizamiento y bloqueos laterales/altura, pero se despega si se empuja normalmente. El eje normal vuelve a estar disponible en las flechas y controles; los bloqueos manuales de ejes siguen respetándose.
- Se retira el rechazo de penetraciones de muebles libres al girar o redimensionar. Se conservan las advertencias espaciales existentes y las reglas constructivas de puertas/ventanas.
- El trazo de Plano antes era `max(0.22, profundidad * 1.7)`, mayor que la pared física y capaz de tapar un mueble en contacto. Ahora usa la profundidad física, de modo que el límite visible coincide con el usado por el imán en A y D. Cotas y etiquetas derivan de esa misma función.
- El estado temporal del imán es por instancia del editor y no se guarda ni cambia versiones. Cargar/deshacer/rehacer lo limpia. Las fijaciones explícitas continúan usando v11.
- Actualizadas las pruebas pendientes: movimiento libre a través de paredes, liberación con pasos de 1 cm, arrastre tangencial, empuje para atravesar, pared girada, esquina A–D y coincidencia de caras del trazo de Plano, grupos y fijación explícita vencible.
- **Comprobación estática:** TypeScript correcto. No se ejecutan unitarias, E2E, build ni CI en esta rama. **Comparación visual con la imagen y validación de ratón/táctil pendientes**; no se afirma que se hayan comprobado en navegador.

Para revisar manualmente: acercar un mueble a la esquina A–D en Plano hasta que se alineen ambos bordes; después seguir arrastrando hacia fuera y repetir usando los botones de 1 cm del panel. Debe salir del contacto y atravesar, sin quedarse atrapado. Probar también el check, el deslizamiento y los bloqueos elegidos, y comprobar la misma posición en Isométrica.

### Ajuste visual posterior: paredes más finas en Plano

Por petición del propietario, el trazo de Plano pasa al **50 % del grosor físico**, manteniendo su centro. Una pared de 12 cm se dibuja con un trazo equivalente a 6 cm en esta vista. Sustituye la coincidencia de grosor visual/físico descrita en la entrada anterior; no cambia geometría 3D, posiciones, magnetismo ni guardado. Cotas y etiquetas siguen tomando el borde del trazo visual desde la función compartida. Actualizada la expectativa de la prueba de esquina para distinguir la cara física y el trazo fino. Sin ejecutar pruebas, build ni CI; validación visual pendiente.

### Corrección de etiquetas, transición a Plano y contacto exacto con pared (11/11/2026)

Petición del propietario a partir de las capturas de una planta inferior. Se continúa en `feature/F1-02-validad-cosas`, conservando los cambios locales anteriores.

- **Título de planta:** se retira «· editando»; se conserva el nombre y el color que distingue la planta enfocada.
- **Cámara:** la transición espacial hacia/desde Plano usa los centros mundiales de la habitación anterior y la enfocada, con altura de planta y paneo. Antes calculaba la órbita alrededor de `(0, altura/2, 0)` y sustituía el azimut de destino incluso fuera del polo, por lo que al terminar copiaba una posición distinta. La nueva interpolación llega al destino real sin esa corrección final visible; contempla también interrupciones de la transición. La cámara cenital no necesita el desplazamiento artificial de 1 mm en Z.
- **Ratón e imán:** los arrastres del mueble, las flechas de eje, el arrastre frontal y con Shift se identifican como entrada de puntero. Repetir el mismo objetivo cuantizado de 5 cm mantiene el contacto exacto; el imán cede cuando el objetivo sale de la banda de 6 cm. Los botones de 1 cm siguen permitiendo atravesar al continuar. El contacto derivado no se redondea al paso de movimiento.
- **Grosor:** se mantienen los grosores físicos existentes, incluidos 0,13 m (13 cm). Su cara a 6,5 cm del centro no necesita coincidir con la cuadrícula de 5 cm. No se cambian medidas ni posiciones de diseños guardados.
- **Plano:** la versión anterior afinaba el trazo manteniéndolo centrado y dejaba una separación visual equivalente a un cuarto del grosor físico. Se conserva el trazo al 50 %, desplazándolo hacia el interior de cada habitación para que su borde interior coincida con la cara física usada por el imán. Las cotas se ajustan al borde exterior de ese trazo. Las paredes independientes sin suelo conservan el trazo centrado, al no tener una cara interior de habitación definida.
- **Comprobación estática:** `tsc --noEmit -p tsconfig.app.json` correcto. Pruebas preparadas para los extremos y continuidad de cámara en habitación desplazada/planta inferior, paneo e interrupción, y contacto en dos ejes con paredes de 13 cm, objetivos de ratón repetidos a 5 cm, liberación posterior y coincidencia del trazo interior.
- **Pendiente:** ejecución de unitarias/E2E/build/CI únicamente tras integración autorizada en `main`; no se ha abierto el navegador ni certificado visualmente el resultado de las capturas. Sin commits, PR ni publicación.

Comprobación manual: enfocar una habitación de la planta inferior y alternar Isométrica → Plano → Isométrica, también después de panear. El título debe contener solo el nombre y la transición no debe corregir su posición al final. Arrastrar la cama a las dos paredes de la esquina, mantener el ratón en el mismo paso y comprobar el borde de contacto en Plano/Frontal/Isométrica. Continuar más allá de la banda debe permitir atravesar, sin modificar los bloqueos elegidos por el usuario.

### CI en PR hacia main y push a main — política actualizada (11/11/2026)

Por instrucción expresa del propietario, `.github/workflows/ci.yml` conserva `push.branches: [main]` y añade `pull_request.branches: [main]`, sin filtrar la rama de origen. Valida PR abiertas, reabiertas y nuevos commits contra `main`, además de cada push a `main`. Se conservan los jobs existentes: instalación limpia, unitarias, build y E2E Chromium completo repartido en cuatro fragmentos. Los push a `dev` y las PR cuyo destino sea `dev` no activan esta CI.

`AGENTS.md` se actualiza para sustituir la regla anterior que posponía las pruebas hasta después de integrar. Las menciones anteriores de este informe se conservan como historial de lo ejecutado o pendiente en cada momento. El cambio se prepara para actualizar `dev`, origen de la PR #72, por autorización expresa para configurar GitHub; no autoriza fusionar ni publicar la aplicación. Los resultados reales se consultan en Actions: configurar el disparador no demuestra que las pruebas pasen ni activa por sí solo protecciones de rama.

### PR #72 — Corrección de fallos de CI, ejecución 43091278513

**Rama de trabajo: `dev`, por instrucción expresa del propietario.** Base `d0ac845`. Los tres cambios locales de configuración ya publicados se conservaron en un stash identificado como `ci-main-policy-already-published-d0ac845` antes de crear la rama local de seguimiento. No se modifica `main` ni se fusiona la PR. Esta petición autoriza ejecutar las pruebas afectadas localmente.

#### Causas comprobadas y correcciones

1. **Tres unitarias de `planWallLines.test.ts`: expectativas antiguas.** Se confirmó el contrato aprobado `planWallTraceThickness(depth) = depth * 0.5`. Las pruebas aún exigían más de 12/13 cm o al menos 22 cm. Se sustituyen por comprobaciones exactas del contrato del 50 %, conservando color, cantidad de trazos, aberturas, ocultación e identificadores. Reproducción local inicial: 4 correctas y 3 fallidas; después, 7/7 correctas.
2. **Cuatro timeouts táctiles: presupuesto agotado, sin aserciones funcionales fallidas en las trazas.** Se descargó y extrajo el artefacto del fragmento 1/4 (51.862.265 bytes). En los cuatro casos aparecen los diez comandos táctiles (inicio, ocho movimientos y fin/cancelación), las cinco aserciones finales completadas y cero aserciones fallidas; las interacciones de selección/undo/redo cuestan aproximadamente 1,3–2,5 s por clic en CI y consumen el límite global de 30 s. Se conservan los gestos reales, la edición posterior desde teclado, undo, redo y la comprobación final del inspector. Los estados intermedios se comprueban directamente en el store por ID, incluyendo posición, selección vacía y número de entradas de historial, evitando dos reselecciones costosas y sin ampliar timeouts.
3. **Plano: igualdad binaria frágil y un defecto real de interacción.** Las capturas dejan de actuar como sustituto de cámara/estado: se comprueban cámara real de R3F, zoom, desplazamiento, selección, historial y longitudes de cotas realmente montadas en la escena. Se conservan las capturas de diagnóstico normal/detallado. El helper de pruebas resuelve el módulo Vite que utiliza la aplicación; no añade un acceso de pruebas al producto.
   - La prueba de habitación adicional siguió fallando con esas comprobaciones: el desplazamiento de cámara permanecía en cero mientras el pack se movía a X=6,2/Z=3,1 y aparecía una entrada de historial nueva. El raycast mostró la caja invisible de la selección de carpeta delante del suelo. La cámara seguía el pack, ocultando el movimiento en la captura.
   - `MultiFurnitureGizmo` deja pasar al suelo los arrastres del cuerpo cuando la selección incluye el suelo de una habitación en Plano; las flechas de eje permanecen disponibles. Las selecciones de muebles y el resto de vistas conservan su arrastre. El E2E verifica que recibe el suelo, se mueve la cámara y no cambian la geometría ni el historial.
4. **`Mostrar Ventana 1`: confirmación de descarte pendiente, sin pérdida de persistencia.** Se descargó también el artefacto 3/4: su snapshot termina en el diálogo «¿Descartar los cambios sin guardar?». El test muestra una ventana después de guardar y luego intenta recuperar el diseño, lo que requiere aceptar ese diálogo desde F1-01. Se conserva el selector original y se confirma explícitamente el descarte. Se añaden comprobaciones de visibilidad en memoria, diseño guardado y `localStorage`, antes y después de recuperar, además de conservar la aserción del botón.

#### Resultados locales reales

- `node --import tsx --test src/scene/planWallLines.test.ts src/scene/cameraTransitions.test.ts src/scene/planSheet.test.ts src/state/planDetails.test.ts src/state/historyTransactions.test.ts src/persistence/localDesignRepository.test.ts src/state/useRoomStore.test.ts`: **49/49 correctas**.
- `node --import tsx --test src/state/multiSelection.test.ts src/scene/interactionPriority.test.ts`: **13/13 correctas**.
- Primera ejecución dirigida de los diez E2E afectados: **9 correctos y 1 fallo real de paneo**, investigado y corregido como se explica arriba.
- `playwright test tests/plan-dimensions.spec.ts --workers=1`: **5/5 correctos**, 30,9 s tras corregir la caja invisible. Incluye los tres fallos originales y los dos controles adicionales de estado/vista y pantalla estrecha.
- Los seis escenarios de historial de `furniture-gestures.spec.ts` (cuerpo/eje, ratón/táctil/cancelación) y el de recuperación de `room-builder.spec.ts`: **correctos** en la ejecución dirigida. Repetición específica de los cuatro táctiles: **4/4 correctos**, 42,7 s en total; aunque el comando permite dos workers, Playwright ejecuta este archivo secuencialmente con un worker.
- En conjunto se comprobaron **12 escenarios E2E distintos relacionados**. No se ejecutó toda la suite E2E local, no se añadieron `skip`, no se ampliaron timeouts y no se retiró cobertura funcional.
- `tsc --noEmit -p tsconfig.app.json` y `git diff --check`: correctos. Las trazas y logs descargados se mantienen en `.cache/ci72/`, fuera del control de versiones.
- Pendiente: resultado de la nueva CI completa que se disparará al subir este cambio a `dev`, origen de la PR hacia `main`. La validación dirigida no se presenta como certificación de toda la suite ni como validación visual humana.

## #28 · [F1 · 04/09] Mejorar multiselección, jerarquía, carpetas y operaciones

**Rama:** `feature/F1-04-mejoras-varias` (parte de `origin/dev` tras el merge de #73). **Estado:** IMPLEMENTADO, **sin validación visual humana** y sin CI (no hay PR hacia `main`). Sin integrar en `dev` ni en `main`.

### Cambios (por commit)

- `be342a9` · Eliminar respeta el bloqueo: los elementos bloqueados no se borran.
- `3d9889e` · Al ocultar, la selección se mantiene coherente (no queda seleccionado lo oculto).
- `458a6f4` · Al pegar un elemento suelto se conserva su carpeta.
- `3e4dd4c` · Corrección de un bloque `@media` sin cerrar en `styles.css`.
- `7929b23` · Selección por área (Mayús + arrastrar sobre el fondo y herramienta «Selección por área», con ratón y táctil) y foco de objetos superpuestos (Alt+clic). Nuevos `marqueeSelection`, `overlapFocus`, `MarqueeSelection.tsx`, `OverlapFocus.tsx`.
- `5ec9927` · Atajos de selección (Ctrl+A, Escape) y acciones de eliminar desactivadas cuando no son válidas, con mensaje.
- `419e579` · Auditoría de bloqueo, ocultación, pegado y jerarquía (`src/state/selectionAudit.test.ts`).
- `430f618` · Pruebas de exportación/importación de carpetas anidadas y de selección de muebles superpuestos.

### Contra los criterios de aceptación

| Criterio                                                           | Cobertura                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Caso guiado 8–12 objetos y 2 carpetas                              | E2E `selection.spec.ts` («caso guiado con 10 objetos y dos carpetas»)                             |
| Ocultar/bloquear respetados por escena, lista e inspector          | `selectionAudit.test.ts` + E2E de selección por área y Suprimir                                   |
| Undo/redo, guardado/carga y JSON con jerarquías y selección válida | `selectionAudit.test.ts` + `persistence-integrity.spec.ts`                                        |
| E2E ratón y táctil, teclado y unitarias                            | `area-selection.spec.ts`, `selection.spec.ts`, `marqueeSelection.test.ts`, `overlapFocus.test.ts` |

### Pruebas ejecutadas (14/11/2026, local)

- `npm test`: **504/504 correctas**.
- `tsc --noEmit -p tsconfig.app.json`: correcto.
- E2E de `selection`, `area-selection` y `persistence-integrity` con workers paralelos: **17 correctas y 13 con timeout de 30 s**. Dos de los fallos se repitieron aislados: `selection.spec.ts:5` pasó y `area-selection.spec.ts:16` pasó con un worker (14,4 s). Interpretación provisional: carga del equipo con workers paralelos, **no demostrado** para los 13. La repetición completa con un worker se canceló a petición del propietario y **queda pendiente**.
- No se ha ejecutado `npm run build` ni la suite E2E completa.

### Pendiente

- Validación visual y manual del propietario (selección por área, Alt+clic, bloqueo/ocultación en carpetas, copiar/pegar, undo/redo, JSON).
- Repetir las tres suites E2E con `--workers=1` o dejar que las ejecute la CI al abrir la PR hacia `main`.

## #29 · [F1 · 05/09] Unificar cámaras y controles de orientación

**Estado:** EN CURSO, sin commit ni integración. Validación visual en la web realizada por el propietario (14/11/2026, comunicada por chat): leyenda y botón de POV, pie de página, aviso de cambios sin guardar, panel de incidencias y flechas del objeto hundido. Rama: `feature/f1-05-unificar-camara-controles`.

### Auditoría

Las cinco vistas comparten una única `CameraRig`; `hiddenWallsForView` es la política de ocultación para render y colocación de aperturas. No se ha creado una cámara 3D duplicada. El POV con WASD (#36) queda fuera: el controlador existente no se duplica.

### Cambios

- **Leyenda de POV:** «Desde la puerta · mirando al frente / N° a la izquierda|derecha (límite)». Antes solo ponía «Cámara interior».
- **Pie de página eliminado** (estado de guardado y «Cuadrado visible: 25 cm»). El aviso «Cambios sin guardar» pasa a la leyenda superior y solo aparece cuando hay cambios; ya no se muestra «Diseño guardado» ni «Diseño sin guardar». Actualizados los E2E `first-use-ux.spec.ts` (sin ejecutar).
- **Panel «Incidencias en la escena»:** pasa de posición fija a ir dentro de la columna de la leyenda, debajo de la última etiqueta, para no taparla.
- **Órbita isométrica/libre:** `OrbitPointerController` aplica `prioritizeTransformControls`, de modo que las flechas y el anillo de un objeto hundido bajo el suelo reciben el clic en vez de orbitar la cámara. Seleccionar el objeto hundido pulsando sobre él (no desde la lista) sigue sin cubrirse: pendiente de decisión.
- **POV:** acción de sesión `centerPov` y botón «Mirar al frente» cuando el giro no es 0. No toca diseño, historial ni zoom.

### Pruebas

- Nuevo `src/state/cameraInvariants.test.ts` (16 tests): la cámara no cambia diseño, historial ni selección; cuatro diagonales, Frontal, POV, zoom independiente, exportación con las cuatro paredes y centrado de POV. `npm test`: **523/523 correctas**; `tsc` correcto.
- Nuevo `tests/camera-views.spec.ts` (10 tests, ratón y táctil, centrado de POV, capturas distintas por vista). **Escrito, listado con `--list` y NO ejecutado.**

### Pendiente

- Ejecutar el E2E nuevo (con un worker) y corregirlo si hace falta.
- Capturas de la misma escena en cada vista, escritorio y táctil.
- `glb-export.spec.ts`: añadido un E2E que exporta desde las cuatro diagonales y exige el mismo número de mallas, nodos y materiales. **Escrito y listado, no ejecutado.**
- Selección con objetos encima en cada diagonal: sin cubrir; requiere validación manual o un E2E con proyección de cámara.
- Validación visual humana.
