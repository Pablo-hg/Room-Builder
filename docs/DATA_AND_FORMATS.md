# Datos, unidades, guardado e interoperabilidad

**Estado:** principios CONFIRMADOS; contrato multiproyecto con prototipo puro en R4, no persistido ni declarado estable.

## Fuente espacial única
- Convención: sistema XYZ del mundo; X y Z corresponden al plano del suelo, Y a la altura. Las vistas **solo proyectan** la misma escena; no modifican coordenadas del mobiliario.
- Dimensiones de habitaciones/muebles/aberturas en **metros** como números finitos y positivos; UI española (coma decimal cuando proceda), guardado independiente de locale. Redondeo visual ≠ precisión interna.
- Coordenadas y ángulos deben documentarse por contrato; actualmente la rotación del mueble se expresa en radianes. No mezclar grados de UI con radianes sin conversión explícita.
- Restricciones: anchura/profundidad/altura y huecos admitidos deben ser configurables y comprobados. El límite actual de 3 m mínimos de anchura/profundidad no es suficiente para futuros cuartos pequeños; cambiarlo requerirá geometría y tests.
- Puertas y ventanas hacen referencia a pared y posición; las aberturas no son objetos flotantes.

## Persistencia realmente implementada (26/10/2026)
`src/domain/designV1.ts` declara `PersistedDesign` versiones 1, 2, 3 y 4 (reexportado desde `src/domain/types.ts`) con room, furniture, structurePacks opcionales, gridSnap, gridVisibility, hiddenElementIds, lockedElementIds, elementFolders y elementFolderAssignments. La versión 4 conserva el orden visual personalizado de los elementos de escena. La versión 3 añade la carpeta padre para carpetas anidadas; los diseños v1 y v2 mantienen sus carpetas en el nivel principal. La versión 2 añade nombres opcionales a puertas y ventanas; se usa cuando existen nombres personalizados en estas aperturas y se siguen admitiendo diseños v1 con sus nombres predeterminados. `lockedElementIds` y las carpetas (`elementFolders` + `elementFolderAssignments`) son opcionales y compatibles con diseños guardados anteriores: conservan los candados y la organización de la lista de elementos. `src/state/useRoomStore.ts` compone las acciones de diseños, que persisten hasta cinco diseños mediante `src/persistence/localDesignRepository.ts`; la cámara es temporal. Existe exportación GLB de escena. **No existe importación/exportación JSON editable pública ni modelo real multihabitación.**

## Organización del lector v1 tras R3.3

El contrato y la serialización canónica están en `domain/designV1.ts`; la normalización de habitación, packs y preferencias está en `domain/normalizeDesignV1.ts`. Se conservan versión, claves, defaults y aceptación anteriores. La comprobación de cabecera usada para listar diseños es parcial; la carga aplica después la normalización, validación geométrica y colocación. No constituye una validación estricta para importaciones públicas. Desde R3.4, las migraciones puras están en `persistence/designMigrations.ts` y el acceso a `localStorage` en `persistence/localDesignRepository.ts`. R3.5 conserva el orden de carga en `state/actions/designActions.ts`, dentro del store compuesto.

Las pruebas incluyen diseños completos, antiguos con opcionales ausentes, malformados y el fixture `valid-boundary.json`, con habitación de 10 m, pack e ID compuesto antiguo. El rechazo previo de superficies con rotación cero o negativa se mantiene y documenta como incidencia, sin cambiar el contrato durante la extracción.

## Almacenamiento y migraciones tras R3.4

Se mantienen `room-builder:v0.1:designs` para la lista actual y `room-builder:v0.1:design` para el diseño legacy. La lista actual tiene prioridad; un error al leerla no activa una recuperación silenciosa desde legacy. El lector mantiene el límite de las primeras cinco entradas y las acciones conservan el límite de creación/guardado.

Si no existe la lista actual y la cabecera legacy es válida, se crea una entrada con ID/fecha nuevos y el nombre anterior, se escribe la lista y se conserva la clave original. Releer usa la lista creada y mantiene ese ID. Las migraciones de decoración mural se aplican al cargar en memoria; no reescriben por sí solas el diseño guardado. Los errores de lectura, parseo o escritura llegan a las acciones, que mantienen los avisos anteriores y actualizan la lista en memoria solo después de una escritura satisfactoria.

El contrato v1 y sus límites de validación se conservan. Ver [informe de R3.4/R3.5](progress/R3_PROGRESS.md#r3-4-5) para pruebas de migración, errores de almacenamiento y conservación de cinco diseños.

## Contrato candidato Project/Room/Layout (R4)

R4 añade un contrato tipado y pruebas puras, sin usarlo todavía en la aplicación:

- `src/domain/projectV2.ts`: tipos y validación de `ProjectV2`, `FloorV2`, `RoomV2`, `WallV2`, `OpeningV2`, `LayoutV2` y preferencias.
- `src/persistence/projectMigration.ts`: prototipo de migración v1–v4 y round-trip de prueba a v1.
- `src/domain/projectVariants.ts`: aislamiento Original/Alternativa y revisión estructural.
- `src/domain/productCapabilities.ts`: capacidades separadas para modalidad completa y Mini.
- Informe: [progress/R4_PROGRESS.md](progress/R4_PROGRESS.md).

El esquema sigue **PROPUESTO** (RB-013). No se escribe en `localStorage`, no se modifica `PersistedDesign` v1–v4 y no se declara estable para importación pública. Los packs constructivos actuales se conservan como legado explícito (`legacyStructurePacks`) para no perder datos; su conversión a paredes canónicas queda pendiente. Las variantes comparten IDs de mueble lógico para conservar selección, candados, carpetas y orden.

## Formato futuro propuesto
Separa **proyecto** (una vivienda), **planta**, **habitaciones**, **paredes/aberturas estructurales**, **definiciones de objetos** e **instancias**, y **variantes de distribución**. Ejemplo conceptual, alineado con el prototipo R4 pero NO esquema público estable:

- Project: schemaVersion, id, name, units, structureRevision, floors[], rooms[], walls[], openings[], furnitureDefinitions[], layouts[], activeLayoutId, preferences, legacyStructurePacks?, metadata.
- Floor: id, name, elevation, roomIds[].
- Room: id, name, floorId, boundary (centro, anchura y profundidad), height y colores.
- Wall: id, extremos, altura, grosor, color y una o dos habitaciones adyacentes; aberturas con wallId.
- Opening: id, wallId, tipo, forma, offset, medidas, alféizar y color.
- Layout: id, nombre, tipo original/alternativa, `structureRevision`, mobiliario propio y variante base opcional.
- CameraState/UI selection: temporal; no parte de la distribución salvo función de vistas guardadas aprobada.

**Regla confirmada:** una medianera es una única entidad `Wall` con dos `roomIds`; la abertura existe en ambas habitaciones sin duplicar paredes con huecos independientes (RB-027, decisión del 03/11/2026). Falta por definir, para la fase multihabitación, el mapa de conexiones (qué lado local de cada habitación corresponde a la medianera y en qué eje). R4 valida la unicidad y coherencia solo en pruebas de contrato.

La puerta pasa de `door` al ID determinista de su habitación; la migración traduce también sus referencias en visibilidad, candados, asignaciones a carpetas y orden de escena. La proyección al formato anterior restaura esas referencias a `door`. Las ventanas y los muebles conservan sus IDs.

El contrato actual solo representa habitaciones rectangulares. Las formas no rectangulares y paredes interiores de RB-025 requieren un rediseño posterior; no están representadas ni validadas por este prototipo.

## Comparación de distribuciones
Mantener espacio/estructura común para las variantes de mobiliario cuando se comparan «Original» y «Alternativa A». Si el usuario modifica puertas o forma de estancia, informar que afecta al proyecto espacial o crear una nueva versión estructural con acción explícita. Evitar que cambiar de alternativa mueva la puerta sin aviso. El prototipo R4 modela esta separación con `structureRevision` y una confirmación explícita, sin UI.

## Exportación y seguridad
- **JSON editable (PROPUESTO para MVP):** versión de esquema, validación estricta y tamaño máximo razonable; importación con previsualización y confirmación. Nunca ejecutar contenido importado, ni confiar en rutas o scripts externos.
- **GLB (EXISTE):** exportación visual interoperable, no sustituto del editable. La geometría exportada no garantiza reconversión a un proyecto de Room Builder.
- **localStorage (EXISTE):** útil para inicio; evitar perder datos por cambios de versión. Posibilidad futura de IndexedDB si escala; NO requerida ahora.
- Migración: conservar lectura de diseños v1; fixture antiguo en pruebas; backups antes de migraciones destructivas; errores informativos. No falsear la carga de datos inválidos.
- No servicios externos, analítica invasiva ni subida de planos reales en el MVP. El registro local de interacciones de desarrollo debe permanecer limitado a desarrollo, no almacenar información personal innecesaria y no enviarse a terceros.

## Estado de formato
El contrato R4 está probado como prototipo puro, pero JSON editable y multihabitación siguen siendo objetivos de diseño. No declarar estable el esquema ni exponerlo como formato público hasta validar migración, importación y UI.
