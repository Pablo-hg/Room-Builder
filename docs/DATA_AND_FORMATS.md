# Datos, unidades, guardado e interoperabilidad

> **Ampliación local 08/11/2026, solicitada por el propietario:** ventanas/decoración mural admiten `WindowConfig.freePosition?: { x, y, z, yaw }`. Son coordenadas mundiales de la base en metros y orientación alrededor de Y en radianes. Ausencia conserva el anclaje histórico; presencia despega el elemento y excluye su hueco de la pared. Los diseños que usan este campo se escriben como **v9**; los lectores conservan v1–v8 y rechazan posiciones libres en versiones anteriores. JSON, normalización y el round-trip candidato ProjectV2 conservan y validan el campo. No se convierten posiciones históricas. Versiones anteriores de la aplicación que solo admiten hasta v8 no pueden abrir diseños v9. Implementación local con tipado verificado; migraciones/round-trips y E2E preparados pero sin ejecutar. Véase la continuación del informe [F0](progress/F0_REFACTOR_AUDIT.md).

> **VIGENCIA ACTUAL 04/11/2026:** el MVP comprometido incluye un contrato versionado de **casa con plantas y habitaciones** (#51–#53) y nuevos datos de cotas (#38), materiales (#39), cámaras (#40), plantillas (#41), importación de plano (#45) y objetos modulares (#47). **Todavía no están implementados**. R5.3 sí implementa JSON editable de una habitación (certificación #25). El selector A/B se retiró por RB-040; v5 se lee por compatibilidad. Plan canónico: [MVP_MASTER_PLAN.md](MVP_MASTER_PLAN.md). Los párrafos R3/R4/R5 inferiores son fotografías históricas.


> **Actualización 04/11/2026:** El propietario retiró las variantes del MVP el 04/11/2026. El código local ya no escribe v5: al leer v5 toma el mobiliario activo y guarda una sola distribución con el formato previo. La conversión y la conservación de medidas editadas están pendientes de pruebas de compatibilidad. El apartado v5 inferior se conserva como histórico.

**Estado actual:** geometría y formato v1–v5 existentes; R5.3 entrega importación/exportación **JSON editable de una habitación**, pendiente de tests completos (#25). La extensión de casa es un contrato **comprometido pero NO desarrollado** (#51–#53). Los datos A/B v5 son históricos por RB-040.

## Fuente espacial única
- Convención: sistema XYZ del mundo; X y Z corresponden al plano del suelo, Y a la altura. Las vistas **solo proyectan** la misma escena; no modifican coordenadas del mobiliario.
- Dimensiones de habitaciones/muebles/aberturas en **metros** como números finitos y positivos; UI española (coma decimal cuando proceda), guardado independiente de locale. Redondeo visual ≠ precisión interna.
- Coordenadas y ángulos deben documentarse por contrato; actualmente la rotación del mueble se expresa en radianes. No mezclar grados de UI con radianes sin conversión explícita.
- Restricciones: anchura/profundidad/altura y huecos admitidos deben ser configurables y comprobados. El límite actual de 3 m mínimos de anchura/profundidad no es suficiente para futuros cuartos pequeños; cambiarlo requerirá geometría y tests.
- Puertas y ventanas hacen referencia a pared y posición; las aberturas no son objetos flotantes.

## Fotografía histórica de persistencia (26/10/2026), anterior a R5.3
`src/domain/designV1.ts` declara `PersistedDesign` como unión de las versiones legacy 1–4 y la versión 5 de variantes (reexportado desde `src/domain/types.ts`) con room, furniture, structurePacks opcionales, gridSnap, gridVisibility, hiddenElementIds, lockedElementIds, elementFolders y elementFolderAssignments. La versión 4 conserva el orden visual personalizado de los elementos de escena. La versión 3 añade la carpeta padre para carpetas anidadas; los diseños v1 y v2 mantienen sus carpetas en el nivel principal. La versión 2 añade nombres opcionales a puertas y ventanas; se siguen admitiendo esos datos y diseños v1 con nombres predeterminados; la aplicación guarda ahora v5. `lockedElementIds` y las carpetas (`elementFolders` + `elementFolderAssignments`) son opcionales y compatibles con diseños guardados anteriores: conservan los candados y la organización de la lista de elementos. `src/state/useRoomStore.ts` compone las acciones de diseños, que persisten hasta cinco diseños mediante `src/persistence/localDesignRepository.ts`; la cámara es temporal. Existe exportación GLB de escena. **Corrección posterior (04/11): ya existe JSON editable de una habitación mediante R5.3; lo que NO existe es un formato y editor multihabitación de producción (#51).**

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

## Formato v5 para variantes (R5.1)

La comparación Original/Alternativa A persiste dos distribuciones con estructura común. La decisión D1 confirmada en [R5_PLAN.md](R5_PLAN.md) amplía el contrato actual:

- `version: 5`; `room`, `structurePacks` y preferencias siguen siendo del diseño.
- `layouts: PersistedLayout[]` con `id`, `name`, `kind: 'original' | 'alternative'` y `furniture` propio.
- `activeLayoutId` y `furniture` superior como espejo controlado de la variante activa. `syncActiveLayout` centraliza su captura al serializar y antes de cambiar de variante; el mobiliario activo es la superficie de edición del store.
- La validación v5 debe rechazar una discrepancia entre ese espejo y el mobiliario de la variante activa con un error explícito, sin sobrescribir ninguna copia (D1 confirmada).
- Al leer v1–v4 se genera una única variante Original, sin reescribir el guardado hasta que el usuario guarde.
- Al guardar se escribe v5. Las claves `room-builder:v0.1:designs` y `room-builder:v0.1:design`, el límite de cinco diseños y la recuperación legacy no cambian.
- Las preferencias (visibilidad, candados, carpetas y orden) son del diseño y pueden referenciar IDs ausentes en la variante activa; la UI debe ignorarlos sin borrarlos.
- La estructura (habitación, puerta, ventanas y packs) es común a las dos variantes; no se persiste `structureRevision` hasta la fase multihabitación.
- D9/D10 confirmadas: los muebles nuevos incluyen `attachmentPolicy: 'by-type'`. El catálogo determina su fijación: alfombras al suelo, lámparas de techo al techo, lámparas de pie/mesa libres. La ausencia de la marca conserva posiciones y movimiento antiguos; cargar un diseño v1–v5 no añade la marca ni corrige sus alturas. Un diseño puede mezclar ambas políticas y conservarlas al guardar/recargar. Duplicar una variante conserva los objetos; pegar crea un objeto nuevo con la política actual. La marca no cambia versión ni claves y no se añade al contrato mural de ventanas/estantes.

La convergencia con la semántica de `LayoutV2` de R4 está comprobada mediante pruebas puras de ambas variantes. No se declara estable ni se expone como JSON público hasta completar R5.3.

## Formato de proyecto completo — candidato R4, implementación comprometida #51
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
- **JSON editable de un diseño (EXISTE por R5.3):** formato `room-builder-design`, validación, límites y previsualización/confirmación. **JSON de vivienda completa (PENDIENTE #51):** definir nuevo formato/versionado para plantas, contornos y recursos sin destruir v1–v5. Nunca ejecutar contenido importado ni confiar en rutas o scripts externos.
- **GLB (EXISTE):** exportación visual interoperable, no sustituto del editable. La geometría exportada no garantiza reconversión a un proyecto de Room Builder.
- **localStorage (EXISTE):** útil para inicio; evitar perder datos por cambios de versión. Posibilidad futura de IndexedDB si escala; NO requerida ahora.
- Migración: conservar lectura de diseños v1; fixture antiguo en pruebas; backups antes de migraciones destructivas; errores informativos. No falsear la carga de datos inválidos.
- No servicios externos obligatorios ni analítica invasiva. **#45 importa planos reales solo localmente**, sin subirlos a servidor; cuidar su privacidad, límites y portabilidad. El registro local de interacciones de desarrollo debe permanecer limitado a desarrollo, no almacenar información personal innecesaria y no enviarse a terceros.

## Estado de formato

### Candados XYZ (petición del propietario, 07/11/2026)

**Última continuación del 07/11/2026:** `RoomConfig.extraDoors` permite puertas
adicionales en raíz sin reemplazar `room.door`. Sus entradas usan el mismo
contrato de puerta con ID estable. Estos diseños se guardan como v8; lectura
v1–v7 mantenida. Las puertas adicionales se conservan como aberturas en R4 y en
JSON, con selección, candados, historial y referencias. La puerta principal
mantiene su ID `door`. El catálogo usa la habitación enfocada en la cámara para
añadir, independiente de la selección de objetos.

**Continuación del 07/11/2026:** `data.version: 7` cuando un pack contiene
`doors?: (DoorConfig & { id: string })[]`. La pared se identifica por su lado
en el pack y conserva un hueco geométrico real; la puerta sigue sus movimientos.
Se validan IDs únicos, medidas, pared existente, límites y solapes. Se rechazan
puertas en paredes coincidentes hasta resolver medianeras únicas (#51/#52).
El borrado de pared/pack elimina sus puertas y referencias en el mismo historial.
Se sigue leyendo v1–v6; el contenedor JSON mantiene `schemaVersion: 5`.
Las dimensiones independientes de packs se expresan mediante las medidas y
desplazamientos de sus superficies existentes, sin añadir un segundo contrato
de vivienda. Cambiar la raíz compensa esos desplazamientos para conservar los
otros packs. Documentación de implementación local, pendiente de pruebas en main.

Extensión de un diseño individual: **data.version = 6** cuando muebles, puerta,
ventanas, packs o superficies tienen `axisLocks: { x: boolean, y: boolean,
z: boolean }`. Las tres claves son obligatorias cuando existe la propiedad.
Ausencia: comportamiento heredado. No cambia IDs, unidades ni claves locales;
se conserva lectura v1–v5, incluyendo aplanado de variantes v5.

Un candado explícito congela la coordenada y no implica fijación al suelo/techo.
La primera edición de candados de un mueble materializa su base visible como Y
absoluta. Volver a bloquear Y no recoloca el objeto. Los objetos antiguos
mantienen sus coordenadas al cargar; las alfombras apoyadas en losas corrigen
solo su desfase visual. El JSON de intercambio mantiene `schemaVersion: 5`,
con `design.data.version: 6`. El prototipo R4 conserva los candados en ida y
vuelta. Implementación local pendiente de ejecución de pruebas en main y de
validación visual; no representa el contrato de vivienda de #51.
El contrato R4 sigue siendo un prototipo puro; el **JSON editable de una habitación existe** con formato R5.3, pendiente de E2E final. El formato de **proyecto completo** aún no está implementado ni validado; no declararlo público/estable hasta #51–#54.


## Archivo JSON de intercambio R5.3 (implementación pendiente de verificación)

El archivo usa `format: "room-builder-design"`, `schemaVersion: 5`, `exportedAt` y un objeto `design` con `id`, `name`, `savedAt` y `data`. Esta versión corresponde al archivo de intercambio; `data` conserva el formato persistido de una distribución. Límite: 2 MiB; como protección ante geometrías extremas, cotas positivas de hasta 100 m y coordenadas/ángulos con valor absoluto de hasta 10 000. La lectura comprueba estructura, medidas, referencias y anclajes antes de mostrar vista previa; nunca escribe hasta confirmar. Un ID duplicado recibe uno nuevo. En archivos v5 antiguos se importa solo la variante activa y se avisa antes de confirmar. La biblioteca llena bloquea la importación. No se ha validado aún con tests ni E2E.
