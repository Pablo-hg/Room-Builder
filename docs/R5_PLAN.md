# R5 — Funcionalidad y diseño · plan y ejecución incremental

> **Estado vigente (04/11/2026, `main` tras PR #22):** R0–R5 integradas en el repositorio. R5.4 se aplazó a v0.2 y el editor local **todavía no está certificado como MVP completo**: según el informe de R5 hubo 213 pruebas unitarias y build correctos, pero no una nueva ejecución única de toda la suite E2E después de los últimos ajustes. La comparación A/B fue retirada de la interfaz MVP (RB-040); la compatibilidad de datos históricos se conserva. La planificación operativa es [MVP_SCOPE](MVP_SCOPE.md) + [LOCAL_MVP_BACKLOG](LOCAL_MVP_BACKLOG.md) y las issues [#23–#33](https://github.com/Pablo-hg/Room-Builder/issues/23). Este aviso prevalece sobre fotografías históricas del documento.


> **Actualización 04/11/2026:** El propietario retiró las variantes del MVP. El código local elimina su interfaz y conserva la distribución activa al leer v5. Las referencias anteriores a variantes se conservan como histórico; la verificación actual consta en el informe de progreso.

> **Decisiones posteriores:** el propietario pidió editar también las dimensiones de las ventanas: ancho/alto para rectangulares y diámetro para circulares, con hueco y restricciones de pared coherentes. Validó R5.2 manualmente y confirmó importar IDs duplicados como una copia con ID nuevo (RB-042).

**Estado:** R5.1 completada históricamente en `518a990`; las variantes se retiraron después del MVP. R5.2 fue validada manualmente por el propietario. R5.3 está implementada y en verificación; R5.4 está aplazada. D7 establece que los IDs duplicados se importan como copia; el reemplazo sigue pendiente.
**Rama de trabajo:** `refractor/r5-funcionalidad-diseño`.
**Base verificada:** `main` con R0–R4 integradas (PR #19 y #20) y el commit documental `ee455b3`; `npm test` en **189/189**, sin fallos.
**Alcance de este documento:** plan y decisiones históricas, matizadas por las decisiones posteriores de retirar variantes y precisar R5.2 y D7. La ejecución y sus pruebas se documentan en [R5_PROGRESS.md](progress/R5_PROGRESS.md). El plan no convierte decisiones pendientes en aprobadas.

## 1. Principio rector

R5 cierra el refactor con la funcionalidad que falta para validar una habitación, **sin abrir v0.2 ni construir casas**. El orden acordado el 03/11/2026 es:

1. **R5.1** — Comparar Original/Alternativa A en una sola habitación.
2. **R5.2** — Redimensionado del mobiliario compatible.
3. **R5.3** — JSON editable, seguro y versionado.
4. **R5.4** — Simplificación de experiencia, **solo** con decisiones aprobadas y sin adelantar E2/E4 de v0.2.

Cada subfase se implementa en un lote revisable, con sus pruebas y sin mezclar refactors internos con funciones nuevas. No se cierra ninguna decisión marcada PENDIENTE por comodidad.

### Cadencia de verificación actualizada por el propietario

El propietario corrigió expresamente la indicación anterior: las ejecuciones de tests, E2E y build se realizan **al terminar cada fase completa** (R5.2, R5.3…), sin repetir toda la batería por cada lote interno ni aplazarla hasta R5 completo. Los casos y fixtures se preparan con la implementación; entre lotes se revisan código y diff y se registra la validación pendiente. Las pruebas anteriores no se atribuyen a código nuevo. Las decisiones de producto pendientes siguen requiriendo respuesta antes de implementar lo que dependa de ellas. R5.2 queda autorizada para continuar desde su matriz de capacidades y decisiones abiertas; R5.3 no empieza antes de cerrar R5.2.

## 2. Punto de partida real antes de R5 (histórico verificado en el repositorio)

- La persistencia sigue siendo `PersistedDesign` **v1–v4** (`src/domain/designV1.ts`), con `room`, `furniture`, `structurePacks`, preferencias, carpetas y orden. No hay variantes persistidas ni UI de comparación.
- `src/domain/projectV2.ts`, `src/domain/projectVariants.ts`, `src/persistence/projectMigration.ts` y `src/domain/productCapabilities.ts` existen como **contrato puro** de R4: no los usa la aplicación, no escriben en `localStorage` y no se declaran estables (RB-013).
- El store compuesto (`src/state/useRoomStore.ts` y `src/state/actions/`) guarda un único `furniture` y un único historial de hasta 50 pasos (`src/state/actions/historyActions.ts`). La cámara y la selección son temporales y no se persisten.
- El mobiliario ya tiene `width`, `depth` y `height` en el modelo, pero **no** existe acción, control ni gesto de redimensionado (`FurnitureInspector` solo muestra las medidas). El catálogo define capacidades de traslación, giro y cambio de pared (`src/domain/objectCatalog.ts`).
- No existe importación/exportación JSON editable. La exportación GLB sí existe y es independiente.
- Los cinco diseños de `localStorage` se guardan con las claves `room-builder:v0.1:designs` y `room-builder:v0.1:design`; el límite sigue en cinco.

## 3. Relación con R4: qué se reutiliza y qué no

R5.1 **no sustituye** el contrato `ProjectV2` por el formato guardado. Sería un cambio de arquitectura completo (paredes, plantas, repositorio nuevo) que no hace falta para comparar dos distribuciones de una habitación. En su lugar:

- La estructura (habitación, puerta, ventanas y packs) sigue siendo **común al diseño**; solo el mobiliario es por variante. Esa es exactamente la separación de `LayoutV2`.
- Los nombres y la semántica de variante (`original` / `alternative`, IDs de mueble compartidos, muebles nuevos con ID único) se toman de R4, no se reinventan.
- `migrateDesignToProject` se ampliará para aceptar también el formato v5 y comprobar que la variante activa se proyecta igual que hoy. Así los dos modelos no divergen.
- `structureRevision` y la UI de obsolescencia **no** se persisten en R5.1: con estructura compartida en una sola habitación no puede haber variantes desincronizadas. El mecanismo de R4 queda para multihabitación (RB-015/RB-027).

Si el propietario prefiere adoptar `ProjectV2` como formato real ya en R5.1, es una decisión distinta y debe aprobarse antes de empezar; este plan no la da por hecha.

## 4. R5.1 — Comparación Original/Alternativa A (P0)

### 4.1 Objetivo verificable

Una persona puede duplicar la distribución actual como «Alternativa A», recolocar solo el mobiliario de una de las dos, alternar entre ambas, deshacer/rehacer, guardar y recargar sin perder ninguna de las dos ni mover la estructura.

### 4.2 Contrato de datos aprobado: `PersistedDesign` v5

Se amplía el formato actual, no se reemplaza. Versión nueva **5**; v1–v4 se siguen leyendo igual.

```ts
export interface PersistedLayout {
  id: string
  name: string
  kind: 'original' | 'alternative'
  furniture: FurnitureItem[]
}

export interface PersistedDesignV5 {
  version: 5
  room: RoomConfig
  structurePacks?: StructurePack[]
  furniture: FurnitureItem[]          // variante activa (espejo controlado)
  layouts: PersistedLayout[]          // incluye Original y la activa
  activeLayoutId: string
  gridSnap: boolean
  gridVisibility?: Record<GridSurface, boolean>
  hiddenElementIds?: string[]
  lockedElementIds?: string[]
  elementFolders?: ElementFolder[]
  elementFolderAssignments?: Record<string, string>
  sceneElementOrder?: string[]
}
```

`PersistedDesign` queda como unión de v1–v4 (sin cambios) y v5; `PersistedDesignV5` documenta solo los campos nuevos.

**Invariantes:**

1. Existe exactamente una variante `original`; la UI de R5.1 admite como máximo una `alternative` (el dominio de R4 sigue admitiendo más para el futuro).
2. `activeLayoutId` existe en `layouts` y sus `id` no se repiten.
3. `furniture` de nivel superior **es** el mobiliario de la variante activa. `syncActiveLayout` centraliza su captura para serialización y transiciones de variante; la edición del store usa el mobiliario activo. Las pruebas comprueban que el dato persistido no diverge.
4. Las preferencias (cuadrícula, visibilidad, candados, carpetas, orden) son **del diseño**, no de la variante. Pueden referenciar IDs ausentes en la variante activa; la UI ya debe ignorar referencias desconocidas y no borrarlas al cambiar.
5. La estructura (`room`, `structurePacks`) es común. Puerta, ventanas, medidas y colores afectan a las dos variantes por construcción.

**Validación del espejo:** la lectura de v5 debe detectar si `furniture` no coincide con `layouts[activeLayoutId].furniture` y rechazarlo con error explícito, sin sobrescribir ninguna copia (D1 confirmada). Las pruebas deben cubrir ambas variantes de discrepancia.

**Compatibilidad:**

- Al cargar v1–v4 se genera `layouts: [{ id: 'original', name: 'Original', kind: 'original', furniture }]` y `activeLayoutId: 'original'`, sin reescribir el guardado hasta que el usuario guarde.
- Guardar escribe siempre v5. Las claves de `localStorage`, el límite de cinco diseños y la recuperación legacy no cambian.
- `persistedDesignSignature` incluye `layouts` y `activeLayoutId`, para que el indicador de cambios pendientes detecte cambios de variante.

### 4.3 Estado, historial y selección

- El estado añade `layouts` y `activeLayoutId`; `furniture` se conserva como la variante activa para no reescribir escena, selectores e inspectores.
- **Cambiar de variante es un paso de historial** (recomendación): el snapshot ya incluye las dos variantes y la activa, así que deshacer devuelve también a la variante anterior. Evita que un undo edite una variante que el usuario no está viendo.
- **Selección:** al cambiar, se conservan los IDs seleccionados que existan en la variante destino (los muebles copiados comparten ID, RB-023) y se descartan los que no; si no queda ninguno, se limpia también el ancla. No se persiste.
- **Portapapeles:** se conserva en memoria; pegar sigue generando un ID nuevo dentro de la variante activa.
- **Cámara y vista:** no cambian al alternar y no se persisten.

### 4.4 Interfaz propuesta

- Selector segmentado `Original | Alternativa A` junto al nombre del diseño (cabecera) o sobre la lista de elementos, con etiqueta accesible y estado `aria-pressed`.
- Acciones: «Duplicar como alternativa» (deshabilitada si ya existe una), «Renombrar variante» y «Eliminar alternativa» con confirmación. Original no se puede eliminar.
- Aviso textual permanente y discreto: «La habitación y las aperturas son comunes a las dos variantes». Sin diálogo bloqueante en cada cambio estructural (recomendación; ver decisiones abiertas).
- Comparación = alternar. La vista lado a lado y el diff de muebles quedan **fuera** de R5.1.
- La sección de diseños guardados indica cuántas variantes tiene cada diseño, sin cambiar el límite de cinco.

### 4.5 Archivos previstos

- `src/domain/designV1.ts`: tipos v5, `persistedDesign`, firma y comprobación de cabecera.
- `src/domain/designLayouts.ts` (**nuevo**): helpers puros `ensureOriginalLayout`, `duplicateLayout`, `switchLayout`, `removeLayout`, `syncActiveLayout`, `validateLayouts`, con clones inmutables.
- `src/domain/normalizeDesignV1.ts`: normalización de variantes al cargar.
- `src/persistence/designMigrations.ts`: v1–v4 → v5 en lectura, sin reescritura automática.
- `src/persistence/projectMigration.ts`: aceptar v5 y proyectar la variante activa (prueba de convergencia con R4).
- `src/state/types.ts`, `src/state/defaults.ts`, `src/state/actions/designActions.ts`, `src/state/actions/historyActions.ts` y los selectores necesarios.
- `src/components/editor/VariantSwitcher.tsx` (**nuevo**), `EditorHeader.tsx`, `ObjectsPanel.tsx` y `SavedDesignsMenu.tsx`.
- Pruebas: `designLayouts.test.ts`, ampliación de `designMigrations.test.ts`, `useRoomStore.test.ts`, `projectMigration.test.ts` y E2E `layout-variants.spec.ts`.

### 4.6 Aceptación de R5.1

1. Cargar fixtures v1, v2, v3 y v4 produce una única variante Original idéntica; guardar genera v5 y recargar conserva muebles, preferencias, carpetas y orden.
2. Duplicar crea Alternativa A con los mismos IDs lógicos y objetos independientes; editar una no cambia la otra (prueba pura y de store).
3. Alternar muestra el mobiliario correcto, filtra la selección y no mueve ni la estructura ni la cámara.
4. Guardar y recargar conserva las dos variantes y la activa.
5. Deshacer/rehacer cubre ediciones y cambios de variante, con el límite de 50 pasos.
6. Eliminar la alternativa pide confirmación; Original permanece y la variante activa vuelve a Original.
7. El indicador de cambios pendientes reacciona a cambios de cualquiera de las dos variantes.
8. Crear un diseño en blanco genera una Original vacía; duplicar un diseño copia sus variantes y su variante activa.
9. Pruebas unitarias, E2E, build y `git diff --check` en verde; sin cambios en claves de almacenamiento.

### 4.7 Lotes de implementación de R5.1

R5.1 se entrega como una secuencia de lotes pequeños, no como una edición monolítica. Cada lote debe pasar sus pruebas antes de empezar el siguiente; el orden puede ajustarse solo si se documenta una dependencia real.

1. **R5.1a — Caracterización y contrato v5:** añadir fixtures/casos de prueba del comportamiento actual; definir tipos, invariantes y validación de layouts; comprobar que `furniture` espejo y `activeLayoutId` son coherentes. No cambiar todavía la UI.
2. **R5.1b — Normalización y migración:** leer v1–v4 como Original, normalizar v5, validar entradas y probar firmas/determinismo; mantener las claves y no reescribir datos solo por leerlos.
3. **R5.1c — Operaciones puras de variantes:** duplicar, activar, renombrar y eliminar con clones inmutables; conservar IDs lógicos al duplicar y generar IDs únicos para muebles nuevos.
4. **R5.1d — Estado, historial y selección:** integrar operaciones al store; mantener `furniture` activo como superficie compatible; probar undo/redo, indicador de cambios, selección, ancla y portapapeles.
5. **R5.1e — Guardado y proyección R4:** guardar v5, recargar ambas variantes y proyectar la variante activa a `ProjectV2` para comprobar convergencia semántica. Resolver y probar explícitamente errores de almacenamiento.
6. **R5.1f — UI y E2E:** añadir selector y acciones aprobadas, mensajes/confirmaciones y resumen de variantes en diseños guardados; cubrir el flujo de uso y accesibilidad básica con pruebas de componente/E2E.

**Puerta entre lotes:** si una prueba revela una decisión no cubierta por D1–D8 (por ejemplo, qué hacer con un v5 cuyo espejo discrepa), actualizar primero el plan y el registro; no incorporar una recuperación silenciosa.

## 5. R5.2 — Redimensionado de mobiliario compatible (P0 posterior)

**Objetivo:** cambiar ancho, fondo y alto de los muebles que lo admitan, con límites claros, aviso rojo de atravesamientos y un solo paso de historial por gesto. Las aclaraciones vigentes D11–D13 de esta sección sustituyen las propuestas iniciales contradictorias.

- **Capacidades:** ampliar `ObjectCapabilities` con `resize` (dimensiones permitidas, mínimos, máximos y paso). No todos los muebles admiten todo: alfombras solo ancho/fondo; decoración mural ancho/alto; lámpara de techo con límites propios; aperturas no se redimensionan desde aquí (ya tienen su inspector).
- **Reglas puras:** nuevo módulo `src/domain/furnitureResize.ts` con validación de medidas y límites por capacidad. Rechazar entradas inválidas conservando el tamaño; permitir atravesamientos de mobiliario con aviso rojo. Mantener las restricciones constructivas murales.
- **Interfaz:** controles numéricos accesibles en metros o centímetros, precisión de centímetros enteros y movimiento incremental de 5 cm, con cuadrícula visible de 25 cm. Asas opcionales en isométrica/plano; los campos numéricos son obligatorios para accesibilidad.
- **Historial:** un gesto = un paso (R3.6), también al arrastrar asas.
- **Persistencia:** no hay cambio de formato; `width/depth/height` ya existen y los diseños antiguos se leen igual.
- **Límites propuestos iniciales** (a concretar por tipo en implementación): suelo 0,25–4 m en ancho/fondo y 0,2–2,4 m de alto; alfombras 0,5–6 m; decoración mural 0,2–3 m de ancho y 0,2–2,5 m de alto; lámpara de techo 0,1–1,5 m. Se validarán contra el catálogo y la altura de la habitación.
- **Aceptación:** medidas persistidas tras guardar/recargar, también con atravesamientos permitidos; undo/redo por gesto; borde rojo ante intersecciones; límites visibles y mensajes claros; E2E de inspector y de asa si existe.

### Lotes de implementación de R5.2

1. **R5.2a — Matriz de capacidades:** inventariar los tipos del catálogo y definir para cada uno qué ejes se pueden editar, límites, paso y comportamiento al alcanzar un límite. Los rangos numéricos de este plan son hipótesis, no valores aprobados.
2. **R5.2b — Reglas puras:** implementar cálculo/validación de dimensiones y pruebas de bordes, colisiones y compatibilidad con superficies/aperturas. Precisar si una entrada fuera de rango se rechaza o se limita automáticamente.
3. **R5.2c — Controles numéricos:** integrar edición accesible al inspector, unidades y mensajes; validar teclado, valor vacío, decimal y límites antes de persistir.
4. **R5.2d — Asas opcionales:** solo si los controles numéricos están estables; reutilizar las reglas puras, admitir ratón/táctil y agrupar el gesto en una transacción de historial.
5. **R5.2e — Regresión y cierre:** probar catálogo representativo, guardado/recarga, undo/redo, colisiones y vistas que renderizan dimensiones.

**Decisiones previas:** declarar el punto de anclaje del redimensionado (centro o borde), el redondeo, el tratamiento de dimensiones inválidas y qué objetos conservan proporción. No elegirlos de forma implícita al implementar el inspector.

**Respuestas anticipadas del propietario (sin iniciar R5.2):** mantener el centro del objeto y rechazar cambios fuera de límites o con solapes, conservando el tamaño anterior y explicando el motivo. Redondeo, límites concretos y proporciones siguen pendientes. El propietario indicó expresamente terminar R5.1 primero y no continuar aún con R5.2.

### Aclaraciones vigentes D11–D13 y punto de parada (03/11/2026)

- **D11 CONFIRMADO:** precisión de dimensiones y posiciones editables de **1 cm (0,01 m)**, sin fracciones de centímetro. Son válidos 13 cm / 0,13 m, 24 cm de posición y 1,17 m; no 15,5 cm ni 1,154 m. Movimiento incremental de **5 cm** y cuadrícula visible de **25 cm**. El paso de movimiento se prepara relativo al origen introducido: 24 → 29 cm. Conservar datos antiguos al cargar. El propietario delegó rangos amplios para representar objetos reales.
- **D12 CONFIRMADO:** «las dimensiones parten del centro de la base del objeto», origen local (0,0,0). Mantener X/Z y base Y en muebles libres; crecer desde esa base. Los objetos fijados conservan su superficie; una lámpara fijada al techo mantiene el extremo superior. Sustituye conservar el centro geométrico XYZ.
- **D13 CONFIRMADO:** permitir cualquier atravesamiento al redimensionar mobiliario, incluido otro mueble, con borde rojo. Sustituye el rechazo previo de solapes en esta operación. Las entradas inválidas o fuera del rango se rechazan y conservan el tamaño anterior. Se mantienen las restricciones constructivas de aberturas y decoración mural; no se cambia implícitamente la política de movimiento.
- **Preparación parcial, sin verificar:** capacidades, helpers numéricos, control reutilizable todavía sin usar en los inspectores, reglas puras y acciones conectadas al store. Matriz provisional en código: 0,01–10 m en los ejes editables, alfombras sin editar grosor, decoración mural ancho/alto, diámetros vinculados y TV con ejes independientes. Estos detalles por tipo son criterios preparados bajo la delegación de rangos; no equivalen a aprobación expresa de toda la matriz.
- **Parada expresa:** el propietario pidió documentar y parar. No continuar implementación ni ejecutar el cierre de R5.2 hasta una nueva petición. El inventario, incompatibilidades y siguiente paso están en el informe único. Tests/E2E/build de R5.2 pendientes; los resultados de R5.1 son históricos.

### R5.2a — propuesta inicial e historial (superados donde contradigan las aclaraciones anteriores)

**Respuesta posterior del propietario:** la unidad mínima de tamaño y posición nueva/editada es **5 cm**. Son válidos 1,15 m / 115 cm; no lo son 1,17 m ni 1,154 m. La propuesta anterior de precisión manual de 1 mm queda descartada. Se conserva la lectura de diseños antiguos sin reescribir sus posiciones. El propietario delegó ajustar los rangos para representar medidas reales aproximadas; se priorizarán rangos amplios y valores múltiplos de 5 cm, sin forzar la proporción de pantalla de TV a medidas incompatibles con ese paso. Las formas circulares mantienen un diámetro común.

El propietario eligió conservar el centro XYZ de muebles libres y permitir cambios con borde rojo por atravesamiento. Se han consultado dos precisiones antes de implementar las reglas afectadas: prioridad entre centro exacto y posición de 5 cm cuando cambiar altura produce 2,5 cm de desplazamiento; y si los avisos permiten también solapes entre muebles o solo con estructura. No se resuelven implícitamente.

El propietario autorizó posteriormente continuar con R5.2. Esta matriz concreta el catálogo actual; todavía no modifica capacidades ni comportamiento. Los límites se aplicarán al editar medidas, sin normalizar tamaños guardados por el mero hecho de cargar. La estructura y el mobiliario conservan sus contratos actuales.

Todas las medidas se expresan en metros. Se propone paso de **0,05 m** en controles incrementales y entrada manual de hasta **3 decimales**, con coma o punto, sin redondeo silencioso. Una entrada no finita, vacía, con más precisión de la admitida, fuera de rango o con solapes se rechaza y conserva el tamaño anterior. Solo se validan contra el rango los ejes que se modifican; los valores antiguos de ejes no editados no se corrigen.

El párrafo anterior y la tabla siguiente se conservan como propuesta inicial; su precisión y sus bloqueos se revisan conforme a la respuesta posterior descrita arriba. No representan reglas ya entregadas.

| Tipos actuales | Ancho | Fondo | Alto | Relación propuesta |
| --- | --- | --- | --- | --- |
| Sillón, sofá, silla, silla de escritorio; mesa, escritorio, mesita de noche, mesa de centro; cama doble/individual; aparador, estantería, armario y mueble de TV | 0,25–4 | 0,25–4 | 0,20–2,40 | Ejes independientes |
| Lámpara de pie | 0,10–1,50 | 0,10–1,50 | 0,25–2,40 | Ancho = fondo; altura independiente |
| Lámpara de mesa y lámpara de techo | 0,10–1,50 | 0,10–1,50 | 0,10–1,50 | Ancho = fondo; altura independiente |
| Papelera y jarrón | 0,10–1,50 | 0,10–1,50 | 0,10–1,50 | Ancho = fondo; altura independiente |
| Planta | 0,10–2 | 0,10–2 | 0,20–2,40 | Ancho = fondo; altura independiente |
| Televisor | 0,50–4 | 0,10–1 | 0,30–2,40 | Conservar proporción ancho/alto de la instancia; fondo independiente |
| Alfombra rectangular | 0,50–6 | 0,50–6 | Sin edición | Ancho y fondo independientes; conservar grosor |
| Alfombra circular | 0,50–6 | 0,50–6 | Sin edición | Un diámetro común a ancho/fondo; conservar grosor |
| Cuadros pequeño/mediano/grande, espejo rectangular, estantería de pared y aplique de pared (`room.windows`) | 0,20–3 | No editable | 0,20–2,50 | Ancho/alto independientes; estructura compartida |
| Espejo circular (`room.windows`) | 0,20–2,50 | No editable | 0,20–2,50 | Un diámetro común a ancho/alto; estructura compartida |
| Puerta y ventanas rectangular/circular | Sin cambios | Sin cambios | Sin cambios | Fuera del redimensionado de mobiliario de R5.2 |

Los tipos de cuadros heredados que queden en `furniture` por no poder migrarse a una pared no se convierten ni se recolocan implícitamente. La edición mural se ofrece a los elementos ya asociados a una pared en `room.windows`.

**D11 — límites, precisión y proporciones (PROPUESTO):** aprobar o corregir esta matriz. Las medidas actuales de todas las definiciones están dentro de sus rangos; no se propone reescribir valores guardados al cargar.

**D12 — centro y anclaje vertical (PROPUESTO):** concretar la respuesta «mantener el centro» como centro en planta X/Z para muebles y centro en el plano de pared para decoración mural. Al cambiar altura, los muebles libres mantienen su base Y; las alfombras nuevas siguen en el suelo y las lámparas de techo nuevas mantienen el extremo superior en el techo. Así no se desprenden de su superficie al redimensionar. La alternativa para muebles libres es conservar también el centro Y, desplazando su base al cambiar altura. Los objetos antiguos siguen libres según D9/D10.

**D13 — relación con paredes y geometría existente (PROPUESTO):** la aplicación permite actualmente mover mobiliario fuera de la habitación o atravesar superficies con aviso. Para redimensionar se propone exigir un resultado dentro de la habitación y sin intersecciones estructurales imposibles, incluso si la posición actual ya presenta un aviso. Esto no cambia las acciones de movimiento. La alternativa es mantener también en redimensionado esos avisos y rechazar solo solapes volumétricos entre muebles y límites del tipo. No se elige una política implícita al implementar.

**Hallazgos técnicos para la implementación posterior:** los modelos 3D contienen detalles con tamaños fijos (asientos, patas, radios de lámparas). Cambiar solo las cotas del modelo de datos no garantiza una escala visual coherente; habrá que adaptar el render manteniendo la apariencia predeterminada. `normalizeDesignLayouts` ya conserva medidas v5; la lectura antigua conserva su recorrido histórico. La decoración mural pertenece a `room.windows` y es común a variantes; necesita sus controles de tamaño en el inspector mural, sin convertirla en mobiliario por variante. Los inspectores de aperturas actuales muestran sus medidas, pero no ofrecen edición general de ancho/alto; su existencia no significa que ese redimensionado esté entregado.

La primera entrega funcional de R5.2 usará controles numéricos accesibles. Las asas de R5.2d siguen siendo opcionales y no se incorporan por conveniencia antes de tener las reglas y controles completos. Tests/E2E/build se ejecutarán al cerrar R5.2, según la cadencia corregida.

## 6. R5.3 — JSON editable, seguro y versionado (P0 posterior)

> **Avance 04/11/2026:** el propietario confirmó la validación manual de R5.2. R5.3 implementa JSON de una distribución, ID nuevo para duplicados, vista previa y límite de 2 MiB. La mención histórica a exportar variantes y convertir v1–v4 a v5 no describe el flujo actual: se conserva el formato de almacenamiento existente y se advierte al importar variantes v5. El estado de las verificaciones figura en el informe de progreso.

**Objetivo:** exportar e importar un diseño completo con validación estricta, previsualización y sin pérdida de datos.

- **Archivo propuesto:**
  ```json
  {
    "format": "room-builder-design",
    "schemaVersion": 5,
    "exportedAt": "2026-11-03T00:00:00.000Z",
    "design": { "id": "…", "name": "…", "savedAt": "…", "data": { "version": 5 } }
  }
  ```
- **Exportación:** descarga el diseño activo (con sus variantes). Nombre de archivo legible y fecha; no incluye cámara, selección ni portapapeles.
- **Importación:** lectura de texto con límite de tamaño (propuesto: 2 MB), `JSON.parse` protegido, validación pura de cabecera, versión, habitación, mobiliario y variantes con lista de errores entendibles. Los v1–v4 se migran en memoria y se guardan como v5 tras confirmar.
- **Previsualización:** nombre, medidas de la habitación, número de muebles y variantes, versión detectada y aviso de que sustituirá/complementará la biblioteca. No se escribe nada hasta la confirmación.
- **Límite de cinco:** si la biblioteca está llena, se bloquea con mensaje claro; la opción de reemplazar un diseño existente queda **PENDIENTE** de decisión (no se implementa por defecto).
- **Seguridad:** nada de `eval`, HTML ni scripts; el contenido se muestra como texto; se rechazan estructuras no finitas, IDs duplicados y referencias inválidas; errores sin volcar el archivo entero.
- **Aceptación:** ida y vuelta exacta (firma estable), rechazo de JSON malformado, versión desconocida, tamaños fuera de límite y datos geométricos inválidos; fixtures v1–v5; prueba de que un archivo importado no ejecuta nada; E2E de exportar, borrar almacenamiento de prueba e importar.

### Lotes de implementación de R5.3

1. **R5.3a — Contrato de archivo:** fijar envelope, versiones admitidas, tamaño máximo y la política para IDs de diseño duplicados antes de implementar el diálogo.
2. **R5.3b — Validación pura:** parsear y validar envelope, versión, migración y contenido con errores por campo; no modificar store ni biblioteca durante esta etapa.
3. **R5.3c — Exportación:** descargar el diseño activo con todas sus variantes y probar nombre de archivo, UTF-8 y round-trip de fixtures.
4. **R5.3d — Previsualización/importación:** mostrar resumen, detectar conflictos y pedir confirmación; escribir en la biblioteca solo después de confirmación, respetando límite y errores de persistencia.
5. **R5.3e — Seguridad y aceptación:** probar JSON malformado, versión desconocida, tamaño, IDs/referencias inválidas, no ejecución de contenido, diseño duplicado, biblioteca llena y flujo E2E.

La importación no debe sobrescribir un diseño existente de forma implícita. D7 establece que un ID ya presente recibe un ID local nuevo; la opción de reemplazar un diseño continúa pendiente.

## 7. R5.4 — Simplificación de experiencia (PENDIENTE)

No se ejecuta dentro de R5 sin decisión expresa. Depende de la auditoría UX (E2) y del sistema visual (E3) de v0.2; adelantarla ahora mezclaría refactor con rediseño y rompería el principio de cambios mínimos. R5 puede cerrarse con R5.4 **explícitamente aplazada**, documentando la decisión.

## 8. Fuera de alcance de R5

- Formas de habitación de 1–6 lados y paredes interiores (RB-025).
- Multihabitación, plantas, escaleras, casas conectadas (RB-015/RB-027).
- Comparación lado a lado o diff visual de variantes.
- Importación pública sin validación, cuentas, nube, backend, Workshop o generación por texto.
- Cambios de estética, paleta o disposición general del editor.
- Convertir los packs constructivos en paredes canónicas.
- Adoptar `ProjectV2` como formato persistido (decisión aparte, no implícita).

## 9. Decisiones abiertas que requieren aprobación antes de codificar

| # | Decisión propuesta | Estado | Impacto |
| --- | --- | --- | --- |
| D1 | Guardar variantes en `PersistedDesign` v5 con `layouts` + `furniture` espejo de la activa; rechazar discrepancias | CONFIRMADO | Formato persistido y recuperación de datos inconsistentes |
| D2 | Cambiar de variante cuenta como paso de historial | CONFIRMADO | Undo/redo |
| D3 | Selección filtrada por IDs existentes al alternar; preferencias compartidas | CONFIRMADO | UI y carpetas |
| D4 | Estructura compartida sin diálogo bloqueante; solo aviso visible en R5.1 | CONFIRMADO | UX y seguridad |
| D5 | Máximo una Alternativa A en la UI de R5.1 (dominio preparado para más) | CONFIRMADO | Alcance |
| D6 | Eliminar alternativa exige confirmación y limpia referencias huérfanas | CONFIRMADO | Datos |
| D7 | Exportar/importar un diseño por archivo; biblioteca llena bloquea la importación; ID duplicado crea copia | CONFIRMADO | Reemplazo pendiente |
| D8 | R5.4 se aplaza a v0.2 salvo orden expresa | CONFIRMADO | Cierre de R5 |
| D9 | Anclaje por tipo para objetos nuevos: alfombras al suelo, lámparas de techo al techo; conservar comportamiento y posiciones de los antiguos | CONFIRMADO; implementado y verificado | Sin restricciones nuevas para lámparas de pie/mesa; ventanas y estantes murales siguen perteneciendo a paredes |
| D10 | Marca opcional `attachmentPolicy: 'by-type'` por mueble nuevo en v5; ausencia conserva comportamiento antiguo | CONFIRMADO; implementado y verificado | Permite mezclar antiguos y nuevos y recordar la distinción tras guardar/recargar. Ver RB-036 |

**Confirmación posterior del propietario:** D1–D8 se aprobaron con precisiones; posteriormente se retiraron las variantes del MVP. D1 rechaza discrepancias al leer v5. D7 crea una copia con ID nuevo para duplicados; reemplazar diseños requiere decisión aparte. Las aclaraciones vigentes de R5.2 figuran en RB-037–RB-039.

**Aclaración posterior de D9:** la fijación depende del tipo. El propietario confirmó expresamente alfombras al suelo y lámparas de techo al techo, y eligió conservar los objetos antiguos y aplicar anclaje solo a nuevos.

**D10 aprobada expresamente e implementada:** se añade `attachmentPolicy?: 'by-type'` a `FurnitureItem`. Los objetos nuevos creados desde el catálogo llevan esa marca; los datos sin marca mantienen su libertad anterior, sin modificar su altura al cargar. La marca se conserva al duplicar una variante y al guardar/recargar; un objeto nuevo pegado del portapapeles aplica la política de su tipo. Las ventanas y la decoración mural continúan bajo el contrato de pared existente. Ejemplo: un `rug` antiguo sin marca y `y: 1` permanece así; un `rug` nuevo con la marca nace en `y: 0` y no admite edición vertical. La versión sigue en 5 y no cambian las claves. `ProjectV2` continúa como candidato y conserva esta información en las pruebas de convergencia.

## 10. Criterios de salida de R5

- R5.1, R5.2 y R5.3 completadas con criterios de aceptación verificados; R5.4 ejecutada o aplazada por decisión registrada.
- Cada lote queda revisado y documentado; las ejecuciones de tests/E2E/build se concentran en el cierre de cada fase completa (R5.2, R5.3…), según la corrección expresa del propietario. Decisiones aplazadas y pruebas pendientes quedan registradas en [progress/R5_PROGRESS.md](progress/R5_PROGRESS.md).
- Fixtures v1–v5 y round-trip estables; claves y límite de diseños intactos.
- `npm test`, `npm run test:e2e` y `npm run build` en verde, o bloqueos explicados con evidencia.
- Convergencia comprobada entre v5 y el contrato R4 (`ProjectV2`) para la variante activa.
- Documentación actualizada: este plan, [DATA_AND_FORMATS](DATA_AND_FORMATS.md), [REFACTOR_PLAN](REFACTOR_PLAN.md), README e informe único [progress/R5_PROGRESS.md](progress/R5_PROGRESS.md).
- Sin decisiones PENDIENTES cerradas por conveniencia y sin cambios visuales no aprobados.

## 11. Siguiente paso

1. Revisar los resultados actuales de compatibilidad, pruebas y build en el informe único.
2. Completar las verificaciones pendientes de R5.2 y R5.3 y resolver los fallos encontrados.
3. R5.4 permanece aplazada. Reemplazar un diseño importado requiere una decisión aparte.

La planificación de fases posteriores no autoriza iniciarlas sin respetar estas condiciones.
