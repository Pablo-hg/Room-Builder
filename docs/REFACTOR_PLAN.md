# Plan de reorganización del código — histórico R0–R5

> **Estado vigente (04/11/2026, `main` tras PR #22):** R0–R5 integradas en el repositorio. R5.4 se aplazó a v0.2 y el editor local **todavía no está certificado como MVP completo**: según el informe de R5 hubo 213 pruebas unitarias y build correctos, pero no una nueva ejecución única de toda la suite E2E después de los últimos ajustes. La comparación A/B fue retirada de la interfaz MVP (RB-040); la compatibilidad de datos históricos se conserva. La planificación operativa es [MVP_SCOPE](MVP_SCOPE.md) + [LOCAL_MVP_BACKLOG](LOCAL_MVP_BACKLOG.md) y las issues [#23–#33](https://github.com/Pablo-hg/Room-Builder/issues/23). Este aviso prevalece sobre fotografías históricas del documento.


> **Actualización 04/11/2026:** El propietario retiró las variantes del MVP. Los apartados anteriores sobre R5.1 describen el histórico; el estado de validación figura en el informe de progreso.

**Estado de referencia (03/11/2026):** R0, R1, R2.1–R2.9, R3.1–R3.7 y R4.1–R4.4 integradas en `main` mediante los PR #19 y #20, junto con las correcciones posteriores de superficies, vistas y navegación y el commit documental `ee455b3`. El estado anterior de este encabezado citaba `origin/main` en `9472bd5` y daba R4 por no integrada; se conserva aquí como histórico: esa referencia dejó de ser válida al fusionarse R4. R5 está en curso, con su plan detallado en [R5_PLAN.md](R5_PLAN.md).

**Estado de R4:** completada como **contrato y pruebas puras** y ya integrada. No hay UI multihabitación, ni migración ejecutada sobre datos reales, ni cambio del formato persistido v1–v4; `ProjectV2` sigue siendo un prototipo no estable (RB-013). El detalle está en [progress/R4_PROGRESS.md](progress/R4_PROGRESS.md); el histórico de R3 se conserva en [progress/R3_PROGRESS.md](progress/R3_PROGRESS.md).

**Estado de R5:** fusionada en `main` mediante PR #22; pendientes E2E globales y cierre de producto en [MVP_SCOPE.md](MVP_SCOPE.md). El histórico está en [R5_PLAN.md](R5_PLAN.md) y [progress/R5_PROGRESS.md](progress/R5_PROGRESS.md). Las variantes de R5.1 se retiraron del MVP; se conserva el anclaje por tipo de objetos nuevos y la compatibilidad de los antiguos. R5.2 fue validada manualmente por el propietario y R5.3 está implementada y en verificación. Los IDs duplicados se importan como copia; el reemplazo y R5.4 siguen aplazados. `ProjectV2` sigue siendo candidato.

## Antes de tocar código

1. Actualizar las referencias remotas y comprobar el commit real de partida antes de crear una rama; no confundir una referencia local antigua con el `main` actual de GitHub.
2. Confirmar alcance de esta documentación y enumerar cambios actuales sin commit; evitar sobrescribir trabajo de Codex.
3. Crear rama técnica separada desde la rama estable elegida; no modificar la rama de documentación ni la predeterminada por sorpresa.
4. Registrar comportamiento base: capturas de las cinco vistas, 4 diagonales, edición y guardado. Guardar fixtures de diseños v1 y comandos que pasan/fallan.
5. Evaluar cada ruta de importación y acoplamiento. No renombrar y reescribir funciones en el mismo lote.

## Orden sugerido

### R0 — Inventario y contratos

- Revisar dependencias entre App, RoomScene, useRoomStore y domain.
- Documentar API interna, coordenadas, datos persistidos, selección/cámaras y tests existentes.
- Identificar conflictos entre mobiliario, aperturas y packs constructivos.
- Preparar tests de caracterización sin cambiar comportamiento.

### R1 — Extraer UI (implementado; verificación registrada en la auditoría)

- Sacar de App.tsx cabecera, selector de vistas, catálogo, inspector, paneles de construcción y diálogos a componentes/herramientas propios.
- Mantener el mismo DOM observable para pruebas cuando sea posible; evitar cambio visual grande.

### R2 — Extraer escena (R2.1–R2.9 completadas; incidencia E2E previa documentada)

- Separar CameraRig, habitación/paredes/aberturas, modelos de mobiliario, helpers de selección y exportador GLB de RoomScene.tsx.
- Mantener los mismos valores por defecto, comportamiento y cinco vistas.

Subpartes, en orden de dependencia. Cada una se cierra con sus pruebas y capturas y no se mezcla con la siguiente en un mismo commit; detalle y verificación en `docs/REFACTOR_AUDIT.md`.

#### R2.1 — Visibilidad de paredes

(COMPLETADA): política de paredes ocultas, etiquetas y cuadrículas como funciones puras en `src/scene/wallVisibility.ts`, con tests de diagonales, frontales, planta/POV y exportación.

#### R2.2 — Cámara

(COMPLETADA): `CameraRig` y `SceneProps` trasladados sin cambios a `src/scene/CameraRig.tsx` y `src/scene/types.ts`, conservando valores por defecto, remount perspectiva/ortográfica, duraciones y movimiento reducido.

#### R2.3 — Shell, paredes y cuadrículas

(COMPLETADA): `RoomShell`, `Walls`, `wallGeometry`, `WallGrid`, `FloorGrid` y `sceneInteraction` extraídos; `SoftWall` sigue componiendo cuerpo, cuadrícula y aperturas hasta R2.4. `RoomScene.tsx` pasa de 3139 a 2538 líneas.

#### R2.4 — Elementos murales e interacción de aperturas

(COMPLETADA; depende de R2.3): mover, girar, cambiar de pared y respetar límites sin mezclar hueco y decoración.

#### R2.5 — Superficies constructivas y gizmo

(COMPLETADA; depende de R2.3): selección, movimiento, redimensionado y undo alineados con la habitación.

#### R2.6 — Modelos de mobiliario a registro tipado

(COMPLETADA; depende de R2.3): silueta, color e icono coherentes en las cinco vistas.

#### R2.7 — Gizmos y gestos comunes

(COMPLETADA; depende de R2.4–R2.6): arrastre con inicio, fin y cancelación en ratón y táctil, con un solo paso de historial por gesto.

#### R2.8 — Brújulas e integración de órbita

(COMPLETADA; depende de R2.2 y R2.7): sin conflicto entre botón principal y central.

#### R2.9 — Exportación GLB

(COMPLETADA; depende de R2.3–R2.6): adaptador aislado, sin exportar helpers ni elementos ocultos, con smoke test y nombre de archivo.

### R3 — Ordenar dominio y estado (R3.1–R3.7 completadas como refactor)

- Dejar geometría/catálogos/reglas puras; mover serialización/migraciones fuera del store.
- Dividir por funciones solo si disminuye acoplamiento, sin varios estados fuente de la verdad.
- Añadir validaciones/fixtures para diseños v1 y transformaciones.

Detalle de implementación, historial, pruebas y límites en el [informe único de R3](progress/R3_PROGRESS.md).

#### R3.1 — Identificadores, nombres y selección

(COMPLETADA; depende de R1 y R2): centraliza los IDs, los nombres y la selección de muebles, aperturas, packs y superficies entre interfaz, escena y store.

#### R3.2 — Reglas puras de habitación, muebles y aperturas

(COMPLETADA; depende de R2): extrae del store las reglas de dimensiones, colocación, colisiones, elevación y giro, conservando su comportamiento.

#### R3.3 — Contrato, validación y normalización de diseños v1

(COMPLETADA; depende de R0.3 y R3.2): separa el contrato, las comprobaciones compatibles y la normalización de diseños guardados sin cambiar el formato v1.

#### R3.4 — Migraciones y repositorio local

(COMPLETADA; depende de R3.3): aísla las migraciones y el acceso a `localStorage`, conservando las claves, los cinco diseños y la recuperación legacy.

#### R3.5 — Acciones modulares y un único store compuesto

(COMPLETADA; depende de R1 y R3.2–R3.4): organiza las acciones en seis módulos que comparten un único store, historial y portapapeles.

#### R3.6 — Transacciones de historial para gestos

(COMPLETADA; depende de R3.5 y R2.7): agrupa cada arrastre o giro en un paso de undo y cierra los gestos al finalizar, cancelar o desmontar, conservando la última posición aceptada.

#### R3.7 — Suscripciones y selectores medidos

(COMPLETADA; depende de R1.6 y R3.5): sustituye la suscripción global de `App` por selectores específicos y comprueba la reducción de renders con mediciones antes y después.

### R4 — Preparar evolución del producto (sin entregar casa)

**Estado: COMPLETADA como contrato y pruebas puras (R4.1–R4.4).** No entrega multihabitación, no añade controles públicos y no modifica `PersistedDesign` v1–v4 ni las claves de `localStorage`.

**Decisiones tomadas para el prototipo (03/11/2026):**

- **Alcance:** contrato y pruebas puras; sin UI de variantes ni lectura/escritura del proyecto nuevo en el repositorio.
- **Packs constructivos:** se conservan como legado explícito para no perder datos; no se convierten aún en paredes canónicas ni se mezclan con `Wall`.
- **IDs de mobiliario:** los muebles copiados entre variantes comparten ID como «mismo mueble lógico», para conservar selección, candados, carpetas y orden; los muebles nuevos reciben un ID único en el proyecto.
- **Modalidad Mini:** una habitación, sin variantes, sin JSON editable, sin GLB, catálogo reducido y navegación contextual.

Estas decisiones describen el prototipo R4. El esquema final sigue **PROPUESTO** (RB-013) y requiere validación antes de integrarse.

**Entregables:**

- `src/domain/projectV2.ts`: tipos `ProjectV2`, `FloorV2`, `RoomV2`, `WallV2`, `OpeningV2`, `LayoutV2`, preferencias, huella estructural y validación.
- `src/persistence/projectMigration.ts`: migración pura v1–v4 → candidato v2 y round-trip de prueba a v1.
- `src/domain/projectVariants.ts`: variantes Original/Alternativa, aislamiento de mobiliario y revisión estructural.
- `src/domain/productCapabilities.ts`: capacidades separadas para modalidad completa y Mini.
- Pruebas puras en `src/domain/projectV2.test.ts`, `src/domain/projectVariants.test.ts`, `src/domain/productCapabilities.test.ts` y `src/persistence/projectMigration.test.ts`.
- Informe único de fase en [progress/R4_PROGRESS.md](progress/R4_PROGRESS.md).

#### Decisiones e invariantes del contrato

1. **Coordenadas:** habitación como rectángulo con centro `x/z`, anchura, profundidad y altura en metros; paredes con extremos `start/end`; aberturas referenciadas por `wallId` y `offset` respecto al centro de la pared.
2. **Paredes compartidas:** una sola entidad `Wall` con dos `roomIds`. La validación rechaza más de una medianera para la misma pareja, extremos fuera del borde de sus habitaciones, paredes que no discurren enteras por un único lado de cada habitación (diagonales o segmentos que atraviesen la habitación), la repetición de la misma habitación en `roomIds` y habitaciones de plantas distintas en una misma pared. Los tramos alineados con un lado, aunque no lo cubran entero, se aceptan; esa decisión completa queda abierta para el esquema final.
3. **Aberturas:** deben pertenecer a una pared existente, caber en su longitud y no superar su altura. En la misma pared no pueden solaparse entre sí (RB-026): el solape se mide en tramos a lo largo de la pared y franja de altura.
4. **Variantes:** comparten la misma estructura; debe existir exactamente una variante Original y la variante activa debe existir. Cada `Layout` guarda su mobiliario y su `structureRevision`. Un cambio estructural incrementa la revisión y deja las variantes obsoletas hasta una confirmación explícita.
5. **Preferencias:** cuadrícula, visibilidad, candados, carpetas y orden se conservan en el proyecto migrado; no se mezclan con la geometría. Las referencias a `door` se traducen al ID de puerta del proyecto y se restauran al proyectar al formato anterior.
6. **Legado:** los packs constructivos viajan en `legacyStructurePacks`, separados de las paredes canónicas.

#### R4.1 — Propuesta/ADR del contrato `Project`/`Floor`/`Room`/`Wall`/`Opening`/`Layout`

(COMPLETADA; depende de R3): contrato tipado, invariantes y límites documentados en el código y en el informe de fase. No se declara estable el esquema ni se modifica el formato persistido.

Aceptación cumplida: revisión documental previa, sin cambios de UI ni de `localStorage`; las decisiones abiertas del esquema final quedan visibles.

#### R4.2 — Prototipo de migración v1–v4 → candidato v2

(COMPLETADA; depende de R4.1): `migrateDesignToProject` convierte un `SavedDesign` en un proyecto de una habitación conservando habitación, cuatro paredes canónicas, puerta, ventanas, mobiliario, nombres, colores, preferencias, carpetas, candados, orden de escena y packs constructivos. `projectToPersistedDesignV1` permite comprobar el round-trip sin exponer importación pública.

Aceptación cumplida: fixtures válidos, antiguos y de límite; migración determinista; round-trip semántico; rechazo de datos malformados; entrada sin mutaciones; los cinco diseños actuales siguen leyéndose con el repositorio existente.

#### R4.3 — Estructura compartida y variantes de mobiliario

(COMPLETADA; depende de R4.1): `duplicateLayoutAsAlternative`, `replaceLayoutFurniture`, `addFurnitureToLayout`, `removeFurnitureFromLayout`, `reviseStructure` y `rebaseLayoutsOnStructure` modelan Original/Alternativa A sin mutaciones cruzadas. Los muebles copiados conservan ID lógico; los nuevos usan un ID único.

Aceptación cumplida: aislamiento Original/Alternativa, identidad de estructura, revisión estructural, confirmación explícita y conservación de preferencias. Duplicar una variante obsoleta conserva su revisión y no confirma implícitamente la estructura nueva. Sin controles públicos de comparación A/B.

#### R4.4 — Prueba de contrato: dos habitaciones y una pared compartida

(COMPLETADA; depende de R4.2–R4.3): prueba pura con dos habitaciones rectangulares contiguas, una única medianera con dos `roomIds` y una apertura compartida. Comprueba identidad, adyacencia, lados de pared por habitación y ausencia de duplicados.

Aceptación cumplida: sin interfaz pública, sin creación de vivienda y sin declarar entregada la función multihabitación. La validación rechaza paredes fuera de borde, referencias inexistentes y más de una medianera para la misma pareja.

#### Criterios de salida de R4

- Contrato documentado y decisiones abiertas visibles; ninguna decisión PENDIENTE cerrada por conveniencia. **Cumplido en el prototipo.**
- Migración de prototipo probada con fixtures v1–v4 y round-trip semántico. **Cumplido.**
- Variantes aisladas y estructura compartida verificadas en pruebas puras. **Cumplido.**
- Prueba de dos habitaciones con pared compartida sin UI ni persistencia nueva. **Cumplido.**
- Sin regresiones en la lectura de los diseños actuales; `npm test` y build en verde. **189/189 unitarias y build aprobado.**
- Ningún cambio de claves, esquema persistido o comportamiento visible sin autorización expresa. **Cumplido.**

### R5 — Funcionalidad y diseño (integrada en main; certificación de MVP pendiente)

**Estado del código: INTEGRADO.** El plan histórico está en [R5_PLAN.md](R5_PLAN.md); el seguimiento, en [progress/R5_PROGRESS.md](progress/R5_PROGRESS.md).

- **Orden acordado (03/11/2026):** R5.1 comparación Original/Alternativa A en una sola habitación; R5.2 redimensionado del mobiliario compatible; R5.3 JSON editable seguro y versionado; R5.4 simplificación de experiencia solo con decisiones aprobadas y sin adelantar v0.2. Las formas no rectangulares y paredes interiores de RB-025 quedan después; las casas conectadas, más tarde.
- **R5.1:** persistir dos variantes de mobiliario con estructura común en `PersistedDesign` v5, alternar, conservar selección compatible, historial y guardado; máximo una Alternativa A en la UI. Contrato y decisiones en el plan; completada y verificada con D9/D10 aprobadas; no se inicia R5.2 por indicación del propietario.
- **R5.2:** capacidades de redimensionado por tipo, reglas puras, controles accesibles, un paso de historial por gesto y sin cambio de formato.
- **R5.3:** exportación/importación de un diseño con validación estricta, previsualización, límite de tamaño y compatibilidad v1–v5; GLB sigue siendo independiente.
- **R5.4:** aplazable a E2/E4 de v0.2; no se ejecuta dentro de R5 sin orden expresa.
- **No incluye:** multihabitación, formas RB-025, comparación lado a lado, backend, cuentas, Workshop ni adopción implícita de `ProjectV2` como formato persistido.
- **Decisiones:** D1–D8 y las aclaraciones posteriores figuran en el plan; las variantes se retiraron y un ID duplicado se importa como copia. El reemplazo de diseños sigue pendiente.

## Criterios de salida para cada lote

**Cadencia expresa para lo que queda de R5:** el propietario corrigió la indicación anterior: ejecutar tests, E2E y build al terminar **cada fase completa** (R5.2, R5.3…), sin repetir toda la batería por lote interno ni esperar al final de R5. Entre lotes se revisa código/diff y se registra la validación pendiente. R5.2 queda autorizada desde su matriz y decisiones pendientes. Ver [R5_PLAN.md](R5_PLAN.md).

- Sin regresiones en creación, vistas, aperturas, selección, edición y recuperación de diseños.
- Tests verdes o bloqueos explicados; build funcional.
- Diff limitado y fácilmente revisable; sin reestilizado inesperado.
- Compatibilidad de datos con fixtures anteriores.
- README y documentación técnica actualizados si cambia la estructura real.
- PR separado por fase; no mezclar R1+R2+R3 con funciones nuevas en un commit gigantesco.

## Riesgos

- Unir habitaciones requiere pared compartida real y nuevo modelo; no hacer parches ad hoc a StructurePack.
- El redimensionado cambia lógica de colisiones, límites, selección y geometría; añadir pruebas antes de incluirlo.
- El modelo de variantes comparte estructura pero aísla mobiliario; estudiar escenarios de edición de puertas y ventanas.
- Mantener cámaras Frontal y Libre existentes hasta decisión expresa.
