# Auditoría de arquitectura y preparación del refactor — R0

**Fecha:** 26/10/2026  
**Rama de trabajo:** `refactor/room-builder-r0`  
**Base auditada:** `main` y `origin/main` en `80ae30c`  
**Estado:** diagnóstico **CONFIRMADO** por lectura del código y ejecución local; estructura y tareas de refactor **PROPUESTAS**.  
**Alcance:** documentación y preparación. En R0 no se ha refactorizado código, añadido funcionalidad, modificado la interfaz ni alterado formatos persistidos.

## 1. Resumen ejecutivo

Room Builder tiene una base funcional reconocible y una primera separación útil entre `domain`, estado, interfaz y escena. La geometría de habitación, aperturas, cámaras y colisiones cuenta con pruebas unitarias, el catálogo está centralizado y la cámara no forma parte del diseño persistido.

La separación, sin embargo, se interrumpe en tres archivos que concentran casi todo el comportamiento:

| Archivo | Líneas | Tamaño aproximado | Responsabilidades mezcladas |
| --- | ---: | ---: | --- |
| `src/components/RoomScene.tsx` | 3.139 | 141 KB | cámaras, transiciones, habitación, huecos, cuadrículas, modelos, selección, arrastre, gizmos, iluminación, brújulas y GLB |
| `src/App.tsx` | 1.532 | 74 KB | shell, paneles, inspector, catálogo, guardado, atajos, controles de cámara, órbita y coordinación de exportación |
| `src/state/useRoomStore.ts` | 1.520 | 62 KB | estado de mundo y cámara, acciones, validación, historial, portapapeles, migraciones, persistencia, metadatos y logging |

El riesgo principal no es solo el tamaño, sino que varias reglas tienen más de un dueño. La escena recibe datos por propiedades y a la vez accede directamente a Zustand; la visibilidad de paredes y la órbita se calculan en más de una capa; la normalización de datos vive junto a las acciones del store; y `RoomConfig`, `structurePacks` y los elementos murales representan conceptos estructurales parcialmente solapados.

Antes de mover archivos conviene fijar contratos de caracterización. La línea base no está completamente verde: el build termina, una prueba unitaria falla por una diferencia de serialización de `structurePacks`, y Playwright no puede arrancar porque falta su Chromium. Esta situación debe tratarse como estado previo, no como regresión del refactor.

## 2. Fuentes y límites respetados

Se han revisado `AGENTS.md`, el índice documental, visión de producto, alcance MVP, UX y cámaras, guía visual, objetos y assets, datos y formatos, arquitectura y calidad, plan de refactor, registro de decisiones, README técnico y código real.

La auditoría mantiene estas restricciones:

- **CONFIRMADO:** producto independiente, una habitación primero, coordenadas mundiales X/Z en suelo e Y en altura, metros internos, estética 3D low-poly tipo diorama y cinco vistas existentes que no deben perderse durante el refactor.
- **PROPUESTO:** organización objetivo, secuencia de extracciones y futuro contrato `Project/Room/Layout`.
- **PENDIENTE:** forma definitiva del esquema multihabitación, variantes A/B, paredes compartidas, paleta exacta y decisión sobre cómo encajan los packs constructivos actuales.
- La propuesta prepara puntos de extensión para multihabitación, pero no la implementa ni declara estable un esquema nuevo.

## 3. Estado de Git y reproducibilidad

- El checkout inicial estaba limpio en `main`.
- Se actualizó la referencia remota y se comprobó `main...origin/main`: `0 0` commits de diferencia.
- Ambos apuntaban a `80ae30c` (`docs: establish Room Builder product, visual, UX and architecture guidelines`).
- La rama local `refactor/room-builder-r0` se creó desde ese commit.
- No se ha modificado `main` ni `dev`, no se ha hecho merge, commit ni publicación.

## 4. Mapa de la arquitectura actual

### 4.1 Dependencias principales

```text
main.tsx
  -> App.tsx
       -> domain/{types,constants,geometry,objectCatalog}
       -> state/useRoomStore
       -> components/{RoomScene,iconCatalog,InteractionLogger}

RoomScene.tsx
  -> React Three Fiber / Three.js / GLTFExporter
  -> domain/{types,constants,geometry,objectCatalog}
  -> state/useRoomStore
  -> debug/interactionLog

useRoomStore.ts
  -> domain/{types,constants,geometry,objectCatalog}
  -> debug/interactionLog
  -> localStorage

iconCatalog.tsx -> domain/objectCatalog
InteractionLogger.tsx -> state/useRoomStore + debug/interactionLog
vite.config.ts -> endpoint local de logging + escritura en logs/interactions.log
```

La dirección deseable `UI/scene -> aplicación/estado -> dominio` existe parcialmente. Se rompe porque `RoomScene` depende directamente del store y del logger, y porque `App` importa componentes de brújula desde el archivo monolítico de escena.

### 4.2 Stack y dependencias

El stack coincide con la documentación: React 19, TypeScript 5.9, Vite 6, Three.js 0.180, React Three Fiber 9, Zustand 5, Node Test mediante `tsx` y Playwright 1.55. No se ha detectado necesidad de cambiar motor ni añadir librerías para ejecutar el refactor.

Las dependencias de ejecución son reducidas: React, React DOM, Three.js, React Three Fiber y Zustand. El peso del bundle procede principalmente de la aplicación 3D empaquetada en un único chunk, no de una proliferación de librerías.

### 4.3 Dominio y geometría

`src/domain` ya contiene piezas aprovechables:

- `types.ts`: tipos de vista, paredes, habitación, mobiliario, packs, superficies y `PersistedDesign` v1.
- `constants.ts`: límites, colores y habitación inicial.
- `objectCatalog.ts`: definiciones de muebles y aperturas, dimensiones, colores y capacidades.
- `geometry.ts`: validación de aperturas, segmentos de pared, orientación de cámaras, ajuste a cuadrícula, colisiones y límites de mobiliario.

Fortalezas confirmadas:

- La posición de los muebles es mundial y no depende de una cámara.
- La rotación se expresa en radianes y la UI realiza conversiones explícitas.
- Las colisiones usan cajas orientadas en X/Z y comprueban solape vertical.
- La lógica de aperturas y varias reglas de cámara son funciones puras probadas.
- Catálogo e iconos tienen una relación centralizada y comprobada.

Brechas:

- `geometry.ts` mezcla geometría espacial, reglas de colocación y matemáticas de cámara. Son dominios relacionados, pero cambian por motivos distintos.
- Parte de la geometría de pared solo existe dentro de `RoomScene.tsx`: polígonos rotados, clipping, intervalos visibles, transformaciones de superficie y planos de arrastre.
- Las transformaciones pared ↔ mundo se repiten entre `wallPlacement`, aberturas, planta, superficies constructivas y controles frontales.
- Los valores de cámara y sensibilidad aparecen repartidos entre `App`, `RoomScene` y el store.

## 5. Revisión de los archivos críticos

### 5.1 `src/App.tsx`

El archivo contiene cinco componentes grandes (`SelectionInspector`, `SettingsPanel`, `ObjectsPanel`, `ViewControls` y `App`) además de controles reutilizables.

Responsabilidades actuales:

- composición general y responsive;
- cabecera, cambio de vista, undo/redo, estado de guardado y exportación;
- selector, creación, duplicado, renombrado y borrado de diseños;
- inspector de packs, superficies, muebles, puertas y elementos murales;
- ajustes de habitación y colores;
- catálogo y árbol de elementos/visibilidad;
- controles de cámaras y gestos de órbita;
- atajos globales de edición;
- temporizadores de avisos y coordinación de exportación GLB.

Riesgos confirmados:

1. `App` se suscribe al store completo con `useRoomStore()` en la línea 1018. Cualquier cambio, incluidos arrastres y cámara, vuelve a renderizar el shell principal.
2. Los subcomponentes realizan decenas de suscripciones individuales y contienen búsquedas/derivaciones de selección que también aparecen en store y escena.
3. La órbita tiene dos rutas: botón central capturado por `App` y botón principal sobre superficies gestionado por `OrbitPointerController` en `RoomScene`. Ambas repiten sensibilidad y protocolo de inicio/fin.
4. El inspector conoce detalles de dominio, IDs compuestos, capacidades, límites geométricos y acciones concretas de Zustand. Extraer solo JSX sin definir un modelo de presentación conservaría el acoplamiento.
5. Guardado, ventanas emergentes, atajos, escena y exportación comparten el mismo ciclo de render y efectos.

Separación recomendada: extraer primero componentes sin cambiar DOM ni selectores observables; después encapsular derivaciones y hooks de interacción. No reestilizar durante esta fase.

### 5.2 `src/components/RoomScene.tsx`

Es el principal punto de riesgo del refactor. Incluye:

- cálculo y animación de cinco modos de cámara;
- reglas de paredes visibles;
- generación extruida de paredes y huecos;
- cuadrículas de suelo y paredes;
- aperturas y decoración mural;
- packs/superficies constructivas;
- 26 tipos de mueble modelados con primitivas JSX;
- selección, hit areas, arrastres, rotaciones y gizmos;
- iluminación, etiquetas y brújulas;
- clonación y exportación GLB.

Acoplamientos relevantes:

1. `SceneProps` transporta habitación, muebles, packs y cámara desde `App`, pero numerosos descendientes llaman también a `useRoomStore`. No existe un límite claro entre escena declarativa y comandos de edición.
2. `recordSceneInteraction` lee el store global fuera de React. Esto hace que componentes de render dependan de estado de aplicación aunque sus propiedades parezcan suficientes.
3. Las reglas de visibilidad de paredes se calculan tanto en `App.visibleWallsForView` como en `RoomWorld`.
4. `RoomScene` exporta `FreeCameraCompass3D` y `RoomCompass3D`, que son UI de navegación pero viven junto al render del mundo.
5. Los gizmos de superficie, abertura, mueble y vista frontal repiten gestión de planos, captura de puntero, estados hover/drag y agrupación de undo.
6. `FurnitureModel` es una cadena extensa de condiciones. Añadir o modificar un objeto obliga a editar catálogo, icono y este archivo, y dificulta pruebas aisladas de correspondencia 3D–icono.
7. La exportación GLB depende del árbol renderizado y de convenciones como `colorWrite`, sprites y visibilidad. Un cambio visual accidental puede cambiar el artefacto exportado.

La extracción segura debe conservar el mismo árbol observable y las mismas coordenadas antes de intentar reutilizar gizmos o redefinir modelos.

### 5.3 `src/state/useRoomStore.ts`

El store combina tres categorías de estado:

- **Diseño persistible:** `room`, `furniture`, `structurePacks`, cuadrícula y elementos ocultos.
- **Sesión temporal:** selección, vista, orientaciones, órbitas, zoom, pared frontal, altura de cámara, POV y avisos.
- **Gestión de documentos:** lista de diseños, diseño activo, cambios pendientes, historial, portapapeles y acceso a `localStorage`.

Además mantiene fuera del estado observable `undoHistory`, `redoHistory`, `copiedElement` y la transacción de movimiento agrupado. Esto funciona como cierre de la instancia singleton, pero complica reiniciar el store de forma determinista en pruebas.

Hallazgos:

1. La función privada `set` serializa con `JSON.stringify` el diseño completo antes y después de cada acción que podría cambiarlo. Es sencilla, pero su coste crece con el proyecto y su igualdad depende de representación y orden, no solo de significado.
2. Hay un fallo reproducible: un diseño nuevo contiene `structurePacks: []`, mientras `persistedDesign()` omite la propiedad si no hay packs. La igualdad los considera distintos y marca cambios sin guardar. Es el fallo de `useRoomStore.test.ts:74`.
3. El historial usa `PersistedDesign`, por lo que también deshace visibilidad y cuadrícula. No incluye selección ni cámara, coherente con la persistencia actual, pero este contrato no está aislado ni nombrado explícitamente.
4. Validación, normalización y migración viven dentro del store. Esto impide probar el codec sin crear/manipular el singleton de Zustand.
5. El store registra eventos de diagnóstico desde las mismas acciones de dominio. El logger es solo desarrollo, pero añade una dependencia transversal a casi todas las mutaciones.
6. La API pública reúne más de cincuenta comandos de cámara, estructura, aperturas, muebles, historial y guardado. Dividir en varios stores ahora podría crear fuentes de verdad duplicadas; conviene modularizar acciones conservando una única composición Zustand hasta medir una necesidad real.

## 6. Persistencia y compatibilidad

### 6.1 Formato implementado

`PersistedDesign` v1 contiene:

```text
version: 1
room: RoomConfig
furniture: FurnitureItem[]
structurePacks?: StructurePack[]
gridSnap: boolean
gridVisibility?: Record<GridSurface, boolean>
hiddenElementIds?: string[]
```

El contenedor privado `SavedDesign` añade `id`, `name`, `savedAt` y `data`. Se guardan hasta cinco entradas en `room-builder:v0.1:designs`; existe migración del antiguo `room-builder:v0.1:design`.

La cámara y selección no se persisten. Sí se persisten cuadrícula y visibilidad, que son preferencias de presentación incluidas hoy en el historial del diseño.

### 6.2 Riesgos confirmados

- `isPersistedDesign()` solo comprueba versión, que `room` sea objeto y que `furniture` sea array. No valida profundamente números finitos, límites, IDs, colores, tipos, duplicados, `windows` ni tamaños.
- La carga realiza normalización posterior dentro de un `try/catch`, por lo que ciertos datos inválidos terminan en un mensaje genérico en lugar de un error validado por campo.
- Al cargar, dimensiones de puertas, ventanas y muebles se sustituyen por valores actuales del catálogo; aperturas se ajustan a cuadrícula y muebles pueden recolocarse si colisionan. Esto protege el prototipo actual, pero puede transformar silenciosamente un diseño antiguo y será incompatible con el futuro redimensionado si no se convierte en migración explícita.
- La migración de cuadros/espejos desde muebles a `room.windows` es ad hoc y vive en el store.
- `hiddenElementIds` admite IDs obsoletos; no existe limpieza referencial completa.
- No hay límite de tamaño del documento, codec JSON editable, previsualización de importación ni fixture canónico v1 completo.
- La forma canónica no es estable para `structurePacks` vacío, como demuestra el fallo unitario.

### 6.3 Conflictos de modelo que deben resolverse antes de multihabitación

1. `RoomConfig` representa la habitación principal y sus aberturas reales.
2. `structurePacks` puede crear pisos, suelos y paredes visuales independientes, pero no posee aberturas ni una relación estructural con muebles/habitaciones.
3. `WindowConfig` almacena tanto ventanas reales como estanterías, cuadros, espejos y apliques. Por tanto, el nombre y el agregado mezclan huecos, decoración mural y objetos anclados.
4. Los cuadros siguen existiendo también como `FurnitureKind` por compatibilidad/migración.
5. Los cinco diseños guardados duplican habitación y mobiliario completos; no representan todavía estructura compartida y variantes A/B.

Un `StructurePack` no debe ascenderse por simple renombrado a vivienda, planta o habitación. La futura pared compartida necesita identidad única, adyacencias y aperturas propias, decisión marcada como **PROPUESTA/PENDIENTE** en la documentación.

## 7. Duplicaciones y responsabilidades mezcladas

| Área | Evidencia | Riesgo |
| --- | --- | --- |
| Visibilidad de paredes | `App.visibleWallsForView` y ramas de `RoomWorld` | UI y render pueden discrepar |
| Órbita | captura de botón central en `App` y `OrbitPointerController` en escena | constantes y estados de drag duplicados |
| Transformación pared/mundo | `wallPlacement`, aberturas, planta, superficies y gizmos frontales | signos/ejes incoherentes al añadir paredes compartidas |
| Nombres e IDs | `elementName`, búsquedas en inspector, escena e IDs compuestos | selección/visibilidad frágil al migrar tipos |
| Defaults visuales | catálogo, store y escena contienen colores/medidas auxiliares | cambios parciales y migraciones implícitas |
| Elementos murales | `FurnitureKind`, `WindowShape`, `WindowConfig` y migración | un mismo concepto puede seguir dos rutas |
| Gestos 3D | varios gizmos repiten pointer capture, planos y undo grouping | errores de cancelación y regresiones por vista |
| Persistencia | codec, repositorio, migración y Zustand en un archivo | difícil validar o migrar sin montar el store |

## 8. Cobertura y riesgos de calidad

### 8.1 Cobertura existente

- Geometría: parejas de paredes, orientación, huecos, límites, ajuste, rotación, colisiones y colocación libre.
- Catálogo de iconos: cobertura y lienzo SVG compartido.
- Store: undo/redo, diseños locales, cámaras, arrastre agrupado, copiar/pegar, migración de espejos y límites.
- E2E declarados: 19 flujos de vistas, responsive, atajos, elevación, objetos, visibilidad, color, orientación y órbita.

### 8.2 Carencias para un refactor seguro

- No hay pruebas unitarias de `CameraRig`, geometría de pared extruida, transformación pared/mundo, `FurnitureModel`, gizmos, cancelación de gestos o exportación GLB.
- No hay fixtures versionados que prueben la lectura íntegra de un diseño v1 válido, valores límite y documentos malformados.
- No se comprueba round-trip `decode -> normalize/migrate -> encode`.
- No hay prueba de forma canónica ni de cambios pendientes semánticos; el fallo actual es consecuencia directa.
- El singleton de store se reutiliza entre pruebas y sus cierres privados no tienen factory/reset explícito, con riesgo de dependencia de orden.
- No existe baseline visual versionada de las cinco vistas y cuatro diagonales. Playwright no pudo generarla en esta sesión.
- La configuración E2E reutiliza cualquier servidor existente en el puerto 4173, lo que puede ejecutar pruebas contra un proceso ajeno si el entorno no está controlado.

## 9. Rendimiento y carga

El build genera un único JavaScript de aproximadamente **1.314 KB** minificado (**362 KB gzip**) y Vite muestra el aviso de chunk superior a 500 KB.

No es una regresión ni requiere optimización inmediata en R0, pero confirma dos oportunidades posteriores:

- cargar de forma diferida exportación GLB y, si se valida, partes no iniciales del editor;
- evitar que `App` se renderice completo durante movimientos continuos y órbitas.

Antes de dividir chunks o memorizar componentes deben medirse carga e interacción; no se propone añadir dependencias.

## 10. Estructura de carpetas propuesta

Esta estructura es un destino orientativo por etapas, no una autorización para mover todo de una vez:

```text
src/
  app/
    App.tsx
    EditorShell.tsx
    shortcuts/useEditorShortcuts.ts

  domain/
    room/
      types.ts
      limits.ts
      openings.ts
      wallCoordinates.ts
    furniture/
      types.ts
      catalog.ts
      placement.ts
      collisions.ts
    structure/
      types.ts
      structurePackRules.ts
    camera/
      types.ts
      orientation.ts
    selection/
      elementId.ts

  persistence/
    schemas/v1.ts
    validateV1.ts
    normalizeV1.ts
    migrate.ts
    serialize.ts
    localDesignRepository.ts
    fixtures/

  state/
    roomStore.ts
    roomStore.types.ts
    createRoomStore.ts
    actions/
      roomActions.ts
      furnitureActions.ts
      openingActions.ts
      structureActions.ts
      cameraActions.ts
      historyActions.ts
      designActions.ts

  scene/
    RoomScene.tsx
    world/RoomWorld.tsx
    cameras/CameraRig.tsx
    room/{RoomShell,Wall,WallGrid,FloorGrid}.tsx
    openings/{Opening,PlanOpening,useOpeningInteraction}.tsx
    furniture/
      FurnitureObject.tsx
      models/
    structure/{StructureSurface,StructureGizmo}.tsx
    interaction/{AxisGizmo,RotationGizmo,pointerMath}.tsx
    navigation/{RoomCompass,FreeCameraCompass}.tsx
    export/{SceneExportController,exportGlb}.tsx
    lighting/StudioLight.tsx

  features/
    room-settings/
    catalog/
    inspector/
    scene-elements/
    saved-designs/
    view-controls/

  ui/
    controls/{ColorControl,DimensionControl,RotationControl,WallPicker}.tsx
    feedback/{Toast,EmptyScene}.tsx

  debug/
    interactionLog.ts
    InteractionLogger.tsx

tests/
  fixtures/persistence-v1/
  e2e/
```

Decisiones de esta propuesta:

- Mantener un único store compuesto inicialmente. Los módulos de acciones reducen tamaño sin crear varias fuentes de verdad.
- Separar `persistence` de Zustand para que leer, validar, migrar y escribir sean funciones/puertos probables de forma aislada.
- Mantener `scene` como consumidor del dominio y comandos explícitos. Elegir en cada extracción entre propiedades o contexto/store, pero no ambas rutas para el mismo dato.
- Centralizar transformaciones de pared en funciones puras reutilizadas por render, planta, aperturas y controles.
- Separar definiciones de catálogo de modelos 3D; un registro tipado puede enlazar cada `FurnitureKind` con su componente sin llevar React al dominio.
- Conservar el esquema v1 con su propio codec. El futuro esquema `Project/Room/Layout` debe añadirse como contrato nuevo con migración, no deformar silenciosamente `RoomConfig`.
- La carpeta `structure` actual no implica que `StructurePack` sea el futuro modelo de vivienda.

## 11. Plan de tareas pequeñas y dependencias

### Lote 0 — cerrar la caracterización

| ID | Tarea | Depende de | Riesgo | Pruebas/salida |
| --- | --- | --- | --- | --- |
| R0.1 | Proveer Chromium compatible y ejecutar los 19 E2E | entorno | confundir bloqueo de infraestructura con regresión | `npm run test:e2e` ejecutado realmente |
| R0.2 | Capturar las cinco vistas y cuatro diagonales con un diseño fijo | R0.1 | snapshots frágiles por GPU/fuentes | capturas baseline y datos del fixture, sin aserciones visuales rígidas al principio |
| R0.3 | Añadir fixture completo de persistencia v1 y casos inválidos | ninguno | codificar como válido un comportamiento accidental | tests de lectura, rechazo y compatibilidad |
| R0.4 | Caracterizar la forma canónica y el fallo `structurePacks: []` | R0.3 | arreglar y mover a la vez | test específico; corrección en commit separado antes de extracciones |
| R0.5 | Crear factory/reset de store para tests manteniendo la instancia de producción | R0.3 | cambiar cierres de historial | tests aislados y repetibles en distinto orden |

### Lote 1 — extraer UI de `App` sin cambiar DOM

| ID | Tarea | Depende de | Riesgo | Pruebas/salida |
| --- | --- | --- | --- | --- |
| R1.1 | Extraer controles atómicos existentes | R0 | cambios de etiquetas/ARIA | build + E2E de inspector |
| R1.2 | Extraer `SettingsPanel` | R1.1 | perder selectores o estados colapsados | dimensiones, colores y teclado |
| R1.3 | Extraer `ObjectsPanel` y árbol de escena | R1.1 | selección/visibilidad divergente | catálogo, aperturas, ocultación y selección |
| R1.4 | Extraer `SelectionInspector` por tipo seleccionado | R1.1 | duplicar derivación de selección | muebles, aberturas, packs y superficies |
| R1.5 | Extraer cabecera y `SavedDesignsMenu` | R0.4 | cambios pendientes/5 diseños | persistencia, renombrado, borrar, duplicar |
| R1.6 | Extraer `ViewControls` y hook de atajos | R1.2–R1.5 | eventos globales y foco | cinco vistas, atajos y formularios |

### Lote 2 — extraer escena conservando coordenadas y render

| ID | Tarea | Depende de | Riesgo | Pruebas/salida |
| --- | --- | --- | --- | --- |
| R2.1 | Centralizar orientación/visibilidad de paredes como función pura | R0.2 | invertir paredes cercanas | unitarias de cuatro diagonales + E2E |
| R2.2 | Extraer `CameraRig` y su matemática | R2.1 | saltos, zoom o movimiento reducido | cinco vistas, cuatro orientaciones, reduced motion |
| R2.3 | Extraer shell, paredes, huecos y cuadrículas | R2.1 | huecos falsos/z-fighting | áreas de pared, aperturas y capturas baseline |
| R2.4 | Extraer elementos murales e interacción de aperturas | R2.3 | mezclar hueco y decoración | mover, girar, cambiar pared, límites |
| R2.5 | Extraer superficies constructivas y gizmo | R2.3 | packs no alineados con habitación | selección, mover, redimensionar, undo |
| R2.6 | Extraer modelos de mobiliario a registro tipado | R2.3 | silueta/color/icono incoherente | catálogo completo en 3 vistas + icon tests |
| R2.7 | Extraer gizmos/gestos comunes por pasos | R2.4–R2.6 | cancelación de puntero o doble historial | drag start/end/cancel, ratón/táctil |
| R2.8 | Extraer brújulas e integración de órbita | R2.2, R2.7 | conflicto botón principal/central | recorridos actuales de órbita |
| R2.9 | Aislar exportación GLB detrás de una función/adaptador | R2.3–R2.6 | exportar helpers o elementos ocultos | smoke test de GLB y nombre de archivo |

### Lote 3 — ordenar estado, reglas y persistencia

| ID | Tarea | Depende de | Riesgo | Pruebas/salida |
| --- | --- | --- | --- | --- |
| R3.1 | Extraer IDs, nombres y derivación de selección | R1, R2 | romper referencias persistidas | tests de todos los tipos y IDs antiguos |
| R3.2 | Extraer reglas puras de habitación/muebles/aperturas | R2 | cambiar orden de clamp/colisión | caracterización y unitarias actuales |
| R3.3 | Separar schema, validación y normalización v1 | R0.3, R3.2 | rechazar datos válidos antiguos | fixtures válidos/malformados/límite |
| R3.4 | Extraer migraciones explícitas y repositorio local | R3.3 | pérdida de los cinco diseños | migración de clave legacy y wall pictures |
| R3.5 | Modularizar acciones manteniendo un store compuesto | R1, R3.2–R3.4 | orden de undo, closures y logging | suite de store + E2E completo |
| R3.6 | Definir transacciones de historial para gestos | R3.5, R2.7 | múltiples pasos por arrastre | undo/redo por gesto y cancelación |
| R3.7 | Reducir suscripción global de `App` con selectores medidos | R1.6, R3.5 | estados obsoletos por selector | perfiles de render + E2E |

### Lote 4 — preparar el contrato futuro, sin entregar multihabitación

| ID | Tarea | Depende de | Riesgo | Pruebas/salida |
| --- | --- | --- | --- | --- |
| R4.1 | Escribir propuesta/ADR de `Project`, `Floor`, `Room`, `Wall`, `Opening`, `Layout` | R3 | cerrar decisiones PENDIENTES por accidente | revisión documental antes de código |
| R4.2 | Prototipar en tests la migración v1 → candidato v2 | aprobación de R4.1 | pérdida o duplicación de paredes | fixtures y round-trip sin UI |
| R4.3 | Modelar estructura compartida y variante de mobiliario | aprobación de R4.1 | mutaciones cruzadas entre A/B | Original/Alternativa aisladas en tests |
| R4.4 | Validar dos habitaciones y una pared compartida solo como prueba de contrato | R4.2–R4.3 | convertir prototipo en función entregada | test de identidad/adyacencia; sin controles públicos |

R5 queda fuera de esta auditoría: redimensionado general, JSON público editable, comparación A/B visible y cualquier función multihabitación.

## 12. Orden de integración recomendado

1. Conseguir baseline verde o registrar excepciones aceptadas.
2. Hacer PRs pequeños: UI, cámara, habitación, aperturas, mobiliario, persistencia y estado por separado.
3. Evitar renombrar rutas y reescribir lógica en el mismo commit.
4. Mantener compatibilidad v1 y probar datos antiguos en cada lote que toque estado.
5. Comparar las cinco vistas después de cada extracción de escena.
6. Diseñar el contrato multihabitación solo después de aislar la persistencia actual.

## 13. Resultados de comprobaciones

### `npm test`

Primer intento dentro del sandbox: no ejecutó pruebas por `spawn EPERM`.  
Repetición con permisos adecuados: **41 de 42 tests pasan; 1 falla**.

Fallo confirmado:

```text
deshace cambios y administra hasta cinco diseños locales
src/state/useRoomStore.test.ts:74
Expected: hasUnsavedChanges === false
Actual:   true
```

Causa identificada por lectura: diferencia entre `structurePacks: []` y propiedad omitida al comparar JSON. No se ha corregido en R0.

### `npm run build`

Primer intento dentro del sandbox: bloqueado por `spawn EPERM` al iniciar esbuild.  
Repetición con permisos adecuados: **correcto**.

```text
59 módulos transformados
CSS: 29,95 KB (6,77 KB gzip)
JS: 1.314,09 KB (362,10 KB gzip)
```

Vite avisa de un chunk superior a 500 KB.

### `npm run test:e2e`

El servidor local arranca y Playwright descubre **19 tests**, pero ninguno llega a ejecutar el flujo porque falta:

```text
C:\Users\Pablo\AppData\Local\ms-playwright\chromium_headless_shell-1193\chrome-win\headless_shell.exe
```

Resultado: **bloqueo de infraestructura**, no validación funcional. Instalar Chromium (`npx playwright install chromium`) requiere descarga y queda pendiente; no se ha alterado el entorno en R0.

## 14. Criterio de salida de R0

R0 queda documentada con:

- inventario de archivos, dependencias y responsabilidades;
- contratos actuales de mundo, cámaras, estado y persistencia;
- brechas y conflictos previos identificados;
- estructura objetivo propuesta sin aprobar nuevos formatos;
- plan incremental ordenado por dependencias, riesgos y pruebas;
- resultados reproducibles de tests, build y limitación E2E.

Antes de iniciar R1 se recomienda decidir si el fallo unitario y la provisión de Chromium se resuelven como preparación técnica independiente. No se recomienda empezar movimientos masivos con una baseline roja o sin capturas de las vistas existentes.

## 15. Cierre de R0 — 27/10/2026

Este apartado actualiza el estado de la rama `fix/r0-baseline` en `0c3edb1` y conserva las observaciones históricas anteriores. Al iniciar el cierre, la rama estaba limpia y, tras actualizar la referencia remota, coincidía con `origin/fix/r0-baseline`. Los cambios de persistencia, fixtures, pruebas E2E y capturas ya estaban incorporados; no se han rehecho.

- **R0.1 — completado:** Chromium 1193 de Playwright está disponible y se han ejecutado los 19 recorridos E2E. En la primera ejecución pasaron 18: el primer caso no encontró el control de visibilidad del sillón. El caso aislado y una segunda ejecución completa pasaron; no se ha identificado la causa de esa incidencia intermitente.
- **R0.2 — completado:** se ha reproducido la captura con el fixture v1 y se han inspeccionado visualmente las cinco vistas y las cuatro diagonales. La antigua captura frontal mostraba una transición incompleta; se ha sustituido por la frontal reproducida, conservando las otras referencias. Son referencias visuales, no comparaciones automáticas de píxeles; pueden variar según el entorno gráfico.
- **R0.3 — completado:** se han verificado los fixtures completos, antiguos con opcionales ausentes y los casos inválidos de versión, habitación y mobiliario, además de la migración ya cubierta del espejo antiguo. No se ha modificado el formato v1.
- **R0.4 — completado:** la normalización previa de opcionales vacíos y ausentes supera las pruebas. Se ha comprobado el indicador de cambios al editar, guardar, deshacer y rehacer, también tras guardar la edición.
- **R0.5 — completado:** `createRoomStore` crea instancias con historial, portapapeles y cierres independientes; producción mantiene una única instancia. Cada prueba del store comienza con una instancia nueva y se ha comprobado el aislamiento entre dos instancias.

Resultados reales en Linux, Node 18 y Chromium de Playwright:

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 45 pruebas aprobadas, 0 fallos. El sandbox bloqueó inicialmente el socket de `tsx`; ejecución con permisos adecuados correcta. |
| `npm run test:e2e` | Segunda ejecución: 19 aprobadas. Primera ejecución: 18 aprobadas y un fallo intermitente descrito arriba; repetición aislada aprobada. |
| `npm run capture:r0-baseline` | 1 prueba aprobada; nueve capturas inspeccionadas. |
| `npm run build` | Correcto, 59 módulos; persiste el aviso de chunk superior a 500 kB. |
| `node --test scripts/model-routing/policy.test.mjs` | Correcto; prueba del clasificador aprobada. |

**Estado:** R0 completada y base preparada para comenzar R1, sin haber iniciado la reorganización. Pendientes de seguimiento: el fallo E2E intermitente sin causa determinada y el aviso de tamaño del bundle; ninguno se presenta como corregido. La validación visual se limita a las capturas revisadas, no certifica todos los entornos gráficos.

## 16. R1 — extracción de la interfaz

En `fix/r0-baseline`, manteniendo los cambios locales de R0, se ha reducido `App.tsx` a la composición del editor y coordinación de escena/exportación. `src/components/editor` contiene controles comunes, paneles de ajustes y objetos, inspector dividido por pack, superficie, mueble y apertura, cabecera y menú de diseños, controles de vista y hook de atajos. El DOM y las acciones existentes se han conservado; no se ha reorganizado `RoomScene` ni la lógica de producción del store como parte de R1.

Validación: `npm test` aprobó 45 pruebas; `npm run build` terminó correctamente con el aviso previo de chunk superior a 500 kB. Playwright aprobó los 19 recorridos existentes y, en una ejecución separada, dos recorridos nuevos sobre diseños guardados/foco y selección de pack/superficie. El primer intento del nuevo test de diseños usó un nombre accesible incompleto (el botón incluye «Actual»); corregido el localizador, pasó. `npm run capture:r0-baseline` generó nueve vistas y se compararon visualmente con R0: no se observaron cambios de composición. La frontal fue idéntica píxel a píxel; las otras referencias existentes tienen un píxel más de altura que las nuevas capturas en este entorno, por lo que no se afirma igualdad exacta. Se conservaron las referencias R0.

**Estado:** R1 implementada y validada para los recorridos indicados. R2 y fases posteriores permanecen pendientes; sigue pendiente de observación el fallo E2E intermitente registrado en R0.

## 17. R2 — primera entrega: R2.1–R2.3

**Alcance autorizado:** exclusivamente R2.1–R2.3, en `refactor/r2-escena`, creada desde `dev` en `926e58b`. El checkout inicial estaba limpio. R2.4–R2.9 quedan para otra entrega; no se ejecuta R3. Se conservan las observaciones históricas de esta auditoría.

### Baseline antes de extraer

- `npm test`: **45 pruebas aprobadas, 0 fallos**.
- `npm run build`: **correcto**, 73 módulos. Persiste el aviso de chunk superior a 500 kB.
- `npm run test:e2e`: **21 passed (1.6m)**. No se reprodujo el fallo intermitente registrado en R0.
- `npm run capture:r0-baseline`: **1 passed (21.1s)**. Nueve capturas inspeccionadas: cinco vistas y cuatro diagonales, con movimiento reducido. Las referencias versionadas se conservaron; las nuevas imágenes se archivaron localmente en `/tmp/room-r2/baseline` para comparar cada paso en el mismo entorno.

### R2.1 — completada

Se ha trasladado sin cambiar sus ramas la política de paredes ocultas, etiquetas y cuadrículas de `RoomWorld` a `src/scene/wallVisibility.ts`. Reutiliza las funciones existentes de `domain/geometry`; no cambia la política distinta de etiquetas y cuadrículas de POV y planta ni las reglas de exportación.

Verificación: `npm test`, **49 pruebas aprobadas, 0 fallos**; `npm run build`, **correcto**, 74 módulos; `npm run test:e2e`, **21 passed (1.7m)**; `npm run capture:r0-baseline`, **1 passed (23.3s)**. Las nueve imágenes se inspeccionaron y coinciden píxel a píxel con la baseline registrada antes de R2. Los cuatro tests nuevos caracterizan diagonales/libre, frontales, planta/POV y exportación. No hay cambios en contratos de `App`, store, datos persistidos ni DOM.

### R2.2 — completada

`CameraRig` reside ahora en `src/scene/CameraRig.tsx`, con sus efectos, cálculos y animación originales. La declaración de `SceneProps` se ha trasladado a `src/scene/types.ts` sin alterar campos ni tipos. Se verificó por comparación textual que `CameraRig`, la interfaz y el bloque de `Canvas` mantienen el contenido original salvo las declaraciones de export/import. Se conservan los valores por defecto, el remount perspectiva/ortográfica, las duraciones de 0,55/0,75 s y la suscripción a movimiento reducido.

Verificación: `npm test`, **49 pruebas aprobadas, 0 fallos**; `npm run build`, **correcto**, 75 módulos; `npm run test:e2e`, **21 passed (1.7m)**; `npm run capture:r0-baseline`, **1 passed (23.0s)**. Las nueve capturas fueron inspeccionadas y coinciden píxel a píxel con la baseline previa a R2. La captura usa movimiento reducido; los E2E existentes recorren las transiciones con la configuración normal. No se ha alterado la interfaz con `App` ni el store.

### R2.3 — completada

Se han trasladado `WallBody` y `wallPlacement` a `src/scene/Walls.tsx`, los polígonos/clipping/intervalos a `wallGeometry.ts` y las cuadrículas a `WallGrid.tsx` y `FloorGrid.tsx`. `RoomShell.tsx` contiene el suelo, plataforma, luz de estudio y etiquetas de pared; conserva el grupo raíz y la referencia usada por la exportación. `sceneInteraction.ts` comparte el logger original sin duplicar estado. `SoftWall` permanece como composición de cuerpo/cuadrícula y aperturas para no adelantar la interacción de R2.4 ni introducir dependencias circulares.

Se comprobó por lectura y comparación de las declaraciones que 37 funciones mantienen exactamente cuerpo y firma salvo `export`; `CameraRig` ya se comprobó en R2.2. `RoomWorld` compone los módulos conservando materiales, geometrías, orden de nodos Three, handlers y coordenadas. Las props externas y los campos del store no se han modificado. `RoomScene.tsx` pasa de 3139 a **2538 líneas**; todavía no es la composición final de toda R2.

Verificación: `npm test`, **54 pruebas aprobadas, 0 fallos**; `npm run build`, **correcto**, 81 módulos; `npm run test:e2e`, **21 passed (1.8m)**; `npm run capture:r0-baseline`, **1 passed (22.0s)**. Las nueve capturas se inspeccionaron y coinciden píxel a píxel con la baseline previa a R2. Las cinco pruebas nuevas comprueban área/centro de huecos girados, clipping en bordes, aproximación circular de 48 segmentos y cortes/fusión de intervalos de cuadrícula.

### Cierre de la primera entrega y pendientes

| Subtarea | Estado real |
| --- | --- |
| R2.1 | Completada: política de visibilidad extraída y caracterizada. |
| R2.2 | Completada: cámara y transiciones trasladadas literalmente. |
| R2.3 | Completada: shell, cuerpos de pared/huecos y cuadrículas extraídos. |
| R2.4 | PENDIENTE: decoración e interacción de aperturas. |
| R2.5 | PENDIENTE: superficies constructivas y gizmos. |
| R2.6 | PENDIENTE: modelos de mobiliario y registro tipado. |
| R2.7 | PENDIENTE: selección y gestos comunes. |
| R2.8 | PENDIENTE: brújulas e integración de órbita. |
| R2.9 | PENDIENTE: adaptador GLB y su smoke test. |

Los resultados de R2.3 sirven también como comprobaciones de cierre: después solo se actualizaron documentos y se normalizaron líneas vacías al final de archivos, sin cambios de comportamiento que requieran repetir las pruebas. La baseline y cada subtarea pasaron la suite E2E completa sin reproducir el fallo intermitente de R0. Se conservan las referencias visuales versionadas; las capturas de esta sesión quedan en `/tmp/room-r2/{baseline,r21,r22,r23}`. La comparación visual cubre este fixture y Chromium, no todos los entornos gráficos. Persiste el aviso previo de tamaño del bundle. No se ha iniciado R2.4 ni R3, ni se ha hecho merge o publicación.

## 18. R2 — segunda entrega: R2.4–R2.6

Se continúa en `refactor/r2-escena` desde el código de `7314a14` y los cambios documentales posteriores. Antes de la extracción se conservó la baseline de R2.3, todavía válida porque el código no había cambiado. Además se generaron e inspeccionaron 78 capturas de los 26 elementos del catálogo en isométrica, planta y frontal; los tres cuadros se representan como elementos murales, conforme al comportamiento actual.

### R2.4 — completada

`Openings.tsx` contiene la interacción, gizmos, decoración y representación en planta de las aperturas. `SoftWall` pasa a `Walls.tsx` y `colorTone.ts` comparte la función cromática original. Ocho funciones mantienen exactamente sus cuerpos y firmas salvo `export`; no se ha alterado el contrato externo ni el store.

Verificación: `npm test`, **54 pruebas aprobadas**; `npm run build`, **correcto**, 83 módulos; `npm run test:e2e -- tests/opening-extraction.spec.ts`, **2 passed (19.4s)**; `npm run capture:r0-baseline`, **1 passed (26.0s)**. Las nueve capturas fueron inspeccionadas y coinciden píxel a píxel con la baseline previa a R2. Se cubren cambio de pared, giro y límites desde el inspector, deshacer y arrastre horizontal mediante el gizmo en escena.

Durante la caracterización, el primer intento de arrastre no movió la ventana: la prueba había pulsado el eje vertical. Se reprodujo en una copia temporal anterior a R2.4 y se verificó que el eje horizontal sí desplaza la ventana; la prueba se corrigió para pulsar el eje correspondiente. Tampoco se alteró la deselección existente tras deshacer/rehacer, que los primeros borradores de las pruebas no contemplaban.

### R2.5 — completada

`StructureSurface.tsx` y `StructureSurfaceGizmo.tsx` contienen la superficie, su posición y el gizmo existente. Las tres funciones trasladadas conservan literalmente cuerpo y firma salvo `export`; la fuente de verdad sigue siendo el store y no se han modificado las props externas. La selección, posición, redimensionado y agrupación de movimiento mantienen el comportamiento anterior.

Verificación: `npm test`, **54 pruebas aprobadas**; `npm run build`, **correcto**, 85 módulos; `npm run test:e2e -- tests/structure-extraction.spec.ts`, **2 passed (16.6s)**; el caso existente de selección de pack también pasó; `npm run capture:r0-baseline`, **1 passed (21.8s)**. Las nueve capturas se inspeccionaron y coinciden píxel a píxel con la baseline. Los recorridos cubren seleccionar, mover/redimensionar desde el inspector, deshacer/rehacer y arrastrar el gizmo en planta con deshacer de un gesto. El arrastre se comprobó también en una copia de la versión anterior.
