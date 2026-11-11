# F1 — Editor base · informe de progreso

Informe único de la fase F1 (hito «F1 — Editor base»). Cada issue añade su sección; no se borran entradas anteriores.

## #26 · [F1 · 02/09] Validar medidas, redimensionado, aberturas y colisiones

**Rama:** `feature/F1-02-validad-cosas` (creada desde `origin/dev` en 23e160b, que incluye el merge #70). **Estado:** en curso, sin commit ni integración.

### Ampliación: cotas del perímetro en Plano · IMPLEMENTADO, sin validación visual

- **Dominio** — [`src/domain/planDimensions.ts`](../../src/domain/planDimensions.ts): calcula las cotas a partir de los segmentos de `physicalWalls` (no de valores fijos ni de medidas en pantalla). Funciona con segmentos arbitrarios para preparar #35. Longitud redondeada a 0,01 m y formato `es-ES` («4,37 m»). Incluye un resumen textual para lectores de pantalla y la regla de simplificación de etiquetas (completa → sin unidad → oculta) cuando falta espacio.
- **Escena** — [`src/scene/PlanDimensions.tsx`](../../src/scene/PlanDimensions.tsx):
  - Dibuja la línea de cota exterior, los testigos y las marcas oblicuas de los extremos, con una etiqueta de fondo claro.
  - Las posiciones se expresan en metros del mundo, así que cada cota sigue en su pared al girar el Plano. Grosores, separación y tamaño del texto se recalculan en píxeles cada fotograma, por lo que se mantienen legibles con cualquier zoom o tamaño de pantalla.
  - Orden desde la pared hacia fuera, con «Mostrar detalles»: trazo de pared → cota (a 8 px del trazo) → letra «PARED A–D» (8 px por detrás de la cota). En ese modo la letra la dibuja la capa de cotas y se oculta la etiqueta normal para no duplicarla. La letra mantiene su tamaño en metros. Al desmarcar, la letra vuelve a su posición habitual. *(Ajuste pedido por el propietario el 10/11/2026.)*
  - Las cotas no interceptan el puntero (`raycast` nulo), así que no bloquean puertas, ventanas ni manipuladores.
  - No se dibujan en exportación, fuera de Plano ni cuando la base no está visible (foco en otra planta).
- **UI/estado:** checkbox «Mostrar detalles» dentro de los controles de Plano ([`ViewControls.tsx`](../../src/components/editor/ViewControls.tsx)). Usa el estado de sesión `planDetailsVisible`:
  - no se persiste, no entra en el historial y no cambia cámara, zoom, encuadre ni selección;
  - por defecto está desmarcado, que equivale a «Plano normal»;
  - incluye un resumen `aria-live` con las cotas, para accesibilidad textual.
- **Todas las habitaciones** *(ajuste pedido por el propietario el 10/11/2026)*:
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
