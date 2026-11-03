# R4 — Preparar evolución del producto

**Estado:** R4.1–R4.4 COMPLETADAS como contrato y pruebas puras.
**Rama:** `refactor/r4-preparar-evolucion`, desde `origin/main` (`9472bd5`).
**Alcance:** sin UI multihabitación, sin repositorio nuevo, sin escritura en `localStorage` y sin cambios en `PersistedDesign` v1–v4.

## Qué significa «contrato» en esta fase

El contrato es el esquema tipado y el conjunto de invariantes que definen qué es un proyecto válido: qué entidades existen, cómo se referencian y qué combinaciones deben rechazarse. No es una función visible ni un formato guardado; es la base que permite probar variantes, paredes compartidas y una futura vivienda antes de tocar la interfaz o la persistencia actual.

## Decisiones tomadas

1. **Alcance:** contrato y pruebas puras. No se integra en el repositorio local ni en la UI.
2. **Packs constructivos:** se conservan como legado explícito en `legacyStructurePacks`; no se convierten en paredes canónicas ni se mezclan con `WallV2`.
3. **IDs de mobiliario:** los muebles copiados entre variantes comparten ID como «mismo mueble lógico», para conservar selección, candados, carpetas y orden. Los muebles nuevos reciben un ID único en el proyecto.
4. **Mini:** una habitación, sin variantes, sin JSON editable, sin GLB, catálogo reducido y navegación contextual.
5. **Esquema final:** sigue PROPUESTO (RB-013). Este prototipo no lo declara estable.

## Entregables

### Contrato — `src/domain/projectV2.ts`

Define:

- `ProjectV2`: esquema 2 candidato, unidades, revisión estructural, plantas, habitaciones, paredes, aberturas, definiciones y variantes.
- `FloorV2`: elevación y habitaciones de la planta.
- `RoomV2`: rectángulo con centro, anchura, profundidad, altura y colores.
- `WallV2`: extremos, grosor, altura y una o dos habitaciones.
- `OpeningV2`: puerta/ventana ligada a `wallId`, con posición, medidas y alféizar.
- `FurnitureInstanceV2`: mueble ligado a habitación y, opcionalmente, a definición.
- `LayoutV2`: Original/Alternativa, mobiliario propio y `structureRevision`.
- `EditorPreferencesV2`: cuadrícula, visibilidad, candados, carpetas y orden.
- `legacyStructurePacks`: transición explícita para los packs v1.

Invariantes comprobadas por `validateProject`:

- identificadores únicos y referencias existentes;
- plantas que contienen sus habitaciones y habitaciones en su planta;
- paredes con longitud, grosor y altura válidos;
- una o dos habitaciones por pared, con extremos en el borde, sin repetir la misma habitación y con ambas habitaciones en la misma planta;
- una sola medianera por pareja de habitaciones;
- aberturas dentro de la longitud y altura de su pared, y sin solaparse entre sí en la misma pared (RB-026: solape medido en tramo × altura);
- definiciones y muebles con medidas finitas y positivas;
- una sola variante Original y una variante activa existente;
- paredes que discurren enteras por un único lado de cada una de sus habitaciones (un tramo alineado con el lado es válido aunque no lo cubra entero; quedan rechazadas las paredes diagonales o que atraviesen la habitación).

`projectStructureFingerprint` produce una huella estable de la estructura; no cambia al mover mobiliario y sí al cambiar habitaciones, paredes, aberturas o packs.

### Migración — `src/persistence/projectMigration.ts`

`migrateDesignToProject(saved, options)`:

- rechaza cabeceras, habitaciones, aberturas, mobiliario y packs no migrables;
- crea una planta, una habitación y cuatro paredes canónicas;
- convierte puerta y ventanas en `OpeningV2` conservando nombres, colores y medidas; las ventanas conservan su ID y la puerta recibe un ID determinista por habitación, con traducción de sus referencias de editor;
- conserva muebles, preferencias, carpetas, candados y orden;
- copia los packs constructivos a `legacyStructurePacks`;
- genera IDs deterministas a partir del ID del diseño;
- no muta la entrada.

`projectToPersistedDesignV1(project, layoutId)` reconstruye una variante para probar el round-trip. No es una importación/exportación pública y solo admite proyectos de una habitación.

### Variantes — `src/domain/projectVariants.ts`

- `duplicateLayoutAsAlternative`: crea Alternativa A sin mutar Original; copia muebles, conserva IDs lógicos y la revisión de origen, también cuando está obsoleta.
- `replaceLayoutFurniture`: sustituye solo el mobiliario de la variante indicada y rechaza IDs duplicados dentro de ella.
- `addFurnitureToLayout`: exige un ID único en todo el proyecto.
- `removeFurnitureFromLayout`: elimina solo de la variante indicada.
- `nextFurnitureId`: genera un ID libre para un mueble nuevo.
- `reviseStructure`: incrementa `structureRevision` y deja las variantes obsoletas.
- `rebaseLayoutsOnStructure`: confirma explícitamente la nueva estructura para todas las variantes.
- `switchActiveLayout` / `currentLayout`: cambian y consultan la variante activa.

### Capacidades — `src/domain/productCapabilities.ts`

`full` y `mini` se definen como capacidades separadas e inmutables. Mini queda limitada a una habitación, sin variantes, JSON editable ni GLB, con catálogo reducido y navegación contextual.

### Pruebas

- `src/domain/projectV2.test.ts`: contrato de dos habitaciones, medianera única, identidad/adyacencia, errores de referencias y aberturas, huella estructural y obsolescencia.
- `src/domain/projectV2.test.ts` (endurecimiento del contrato): la prueba `detecta paredes compartidas duplicadas y paredes fuera del borde` añade aserciones de rechazo para paredes fuera del perímetro, diagonales, la misma habitación repetida y medianeras entre plantas distintas, y de aceptación para tramos alineados con un lado; la prueba `detecta referencias, duplicados y aberturas...` añade el rechazo de aberturas solapadas en la misma pared y la aceptación de aberturas a distinto tramo o altura; la prueba `exige exactamente una distribución Original` rechaza proyectos sin Original.
- `src/persistence/projectMigration.test.ts`: fixtures v1 válidos, antiguos y de límite; versión 4 con nombres, candados, carpetas y orden; determinismo; rechazo de datos inválidos; packs como legado; round-trip.
- `src/domain/projectVariants.test.ts`: aislamiento Original/Alternativa, IDs compartidos, alta/baja de mobiliario, revisión estructural y proyección de cada variante a v1.
- `src/domain/productCapabilities.test.ts`: diferencias full/mini, copias inmutables y límites de habitaciones.

## Resultados

- `npm test`: **187/187 pruebas aprobadas**, 0 fallos (186 previas + 1 prueba nueva de contrato; los casos de paredes alineadas van como aserciones dentro de la prueba existente de paredes).
- `npm run build`: **aprobado** (aviso previo de chunk principal superior a 500 kB).
- Correcciones de contrato en esta continuación: exige exactamente una variante Original (`missing-original-layout`), paredes solo a lo largo de un único lado de sus habitaciones (`wall-not-along-room-side`), sin habitación repetida ni medianeras entre plantas (`invalid-wall`) y aberturas sin solape 2D en la misma pared (`opening-overlap`, RB-026). Las aserciones nuevas fallaban antes de las correcciones y pasan después; `npm run build` reejeculado y aprobado.
- No se ejecutaron E2E ni capturas: no hay cambios de UI, escena o comportamiento visible.
- `git diff --check`: sin errores.

## Límites y pendientes

- El contrato es un prototipo; no se ha aprobado como esquema final ni se ha integrado en el repositorio.
- Solo representa habitaciones rectangulares y paredes en su perímetro. Las formas no rectangulares y paredes interiores de RB-025 requieren rediseñar el contrato después de la comparación Original/Alternativa A.
- Queda abierto si el esquema final exigirá que las paredes cubran el lado completo de la habitación o si admitirá tramos parciales alineados (de momento se admiten; es una decisión de producto para el esquema definitivo, no bloquea el prototipo).
- El validador no comprueba que las habitaciones no se solapen entre sí; solo se comprueba la coherencia de paredes y medianeras. Extender esa regla geométrica excede el alcance R4 actual.
- Los packs constructivos no se normalizan a paredes canónicas; siguen siendo legado de transición.
- La validación cubre el contrato, pero no sustituye una futura validación estricta de importación pública.
- La prueba de dos habitaciones es solo de contrato; no hay creación de viviendas, controles públicos ni paredes compartidas en la escena real.
- Los IDs compartidos entre variantes están probados en el dominio, pero no se ha definido todavía cómo los consume la UI de selección/carpetas.
- No se han hecho commits, merges, push ni publicación.

## Revisión posterior — 03/11/2026

Se conservan los resultados anteriores como histórico. Esta continuación corrige dos fallos detectados en revisión:

1. Duplicar una variante obsoleta ya no la marca como actualizada: conserva la revisión de origen hasta confirmar explícitamente la estructura con `rebaseLayoutsOnStructure`.
2. La migración traduce las referencias de la puerta (`door` → ID de proyecto) en visibilidad, candados, asignaciones a carpetas y orden de escena. La proyección al formato anterior realiza la traducción inversa. Las referencias del mobiliario se conservan.

Se añadieron dos pruebas de regresión en los archivos de variantes y migración. Antes de las correcciones fallaban ambas (11/13 aprobadas); comprueban además que las entradas no se mutan, la confirmación explícita de estructura y la conversión de ida y vuelta con un ID de proyecto personalizado.

La documentación distingue ahora la referencia local `origin/main` de los cambios de R4 aún sin commit, actualiza el recuento y explicita el límite rectangular. R5 conserva el orden acordado: comparación de una habitación antes de redimensionado, JSON editable y nuevas formas.

Validación final de esta continuación:

- Pruebas específicas: **13/13 aprobadas**.
- `npm test`: **189/189 aprobadas**, 0 fallos.
- `npm run build`: **aprobado**, con el aviso de tamaño del bundle ya registrado.
- `git diff --check`: sin errores.
- Sin E2E ni capturas: los módulos siguen siendo un prototipo puro sin integración en UI, escena o almacenamiento.

Siguiente paso propuesto: preparar el alcance verificable de R5.1 (Original/Alternativa A): selección y preferencias al cambiar de variante, historial, guardado compatible y confirmación de cambios estructurales. Este informe no aprueba un nuevo formato persistido ni inicia su implementación.
