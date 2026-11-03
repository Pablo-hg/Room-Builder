# R5 — Funcionalidad y diseño · plan y ejecución incremental

**Estado:** R5.1 completada y verificada · 03/11/2026. R5.2/R5.3 no iniciadas; R5.4 aplazada. D7 conserva pendiente la política de IDs duplicados. El propietario indicó no continuar aún con R5.2.
**Rama de trabajo:** `refractor/r5-funcionalidad-diseño`.
**Base verificada:** `main` con R0–R4 integradas (PR #19 y #20) y el commit documental `ee455b3`; `npm test` en **189/189**, sin fallos.
**Alcance de este documento:** plan redactado antes de implementar; la confirmación posterior de D1–D10 se registra en §9, con la política de IDs de D7 todavía pendiente. La ejecución y sus pruebas se documentan en [R5_PROGRESS.md](progress/R5_PROGRESS.md). R5.1a–f están completadas y verificadas; R5.2/R5.3 siguen pendientes. El plan no convierte decisiones pendientes en aprobadas.

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

**Objetivo:** cambiar ancho, fondo y alto de los muebles que lo admitan, con límites claros, sin solapes imposibles y con un solo paso de historial por gesto.

- **Capacidades:** ampliar `ObjectCapabilities` con `resize` (dimensiones permitidas, mínimos, máximos y paso). No todos los muebles admiten todo: alfombras solo ancho/fondo; decoración mural ancho/alto; lámpara de techo con límites propios; aperturas no se redimensionan desde aquí (ya tienen su inspector).
- **Reglas puras:** nuevo módulo `src/domain/furnitureResize.ts` con clamp de medidas, límites por tipo y comprobación de colisiones/estructura reutilizando `structureCollisions` y `editingRules`. Conservar la política actual de aviso/reversión; no introducir bloqueos nuevos sin decisión.
- **Interfaz:** controles numéricos accesibles en el inspector (metros, paso 0,05) y, opcionalmente, asas de redimensionado en isométrica/plano que apliquen las mismas reglas. Los campos numéricos son obligatorios para accesibilidad; las asas no sustituyen al teclado.
- **Historial:** un gesto = un paso (R3.6), también al arrastrar asas.
- **Persistencia:** no hay cambio de formato; `width/depth/height` ya existen y los diseños antiguos se leen igual.
- **Límites propuestos iniciales** (a concretar por tipo en implementación): suelo 0,25–4 m en ancho/fondo y 0,2–2,4 m de alto; alfombras 0,5–6 m; decoración mural 0,2–3 m de ancho y 0,2–2,5 m de alto; lámpara de techo 0,1–1,5 m. Se validarán contra el catálogo y la altura de la habitación.
- **Aceptación:** medidas persistidas tras guardar/recargar; undo/redo por gesto; sin atravesar paredes ni solaparse de forma imposible; límites visibles y mensajes claros; E2E de inspector y de asa si existe.

### Lotes de implementación de R5.2

1. **R5.2a — Matriz de capacidades:** inventariar los tipos del catálogo y definir para cada uno qué ejes se pueden editar, límites, paso y comportamiento al alcanzar un límite. Los rangos numéricos de este plan son hipótesis, no valores aprobados.
2. **R5.2b — Reglas puras:** implementar cálculo/validación de dimensiones y pruebas de bordes, colisiones y compatibilidad con superficies/aperturas. Precisar si una entrada fuera de rango se rechaza o se limita automáticamente.
3. **R5.2c — Controles numéricos:** integrar edición accesible al inspector, unidades y mensajes; validar teclado, valor vacío, decimal y límites antes de persistir.
4. **R5.2d — Asas opcionales:** solo si los controles numéricos están estables; reutilizar las reglas puras, admitir ratón/táctil y agrupar el gesto en una transacción de historial.
5. **R5.2e — Regresión y cierre:** probar catálogo representativo, guardado/recarga, undo/redo, colisiones y vistas que renderizan dimensiones.

**Decisiones previas:** declarar el punto de anclaje del redimensionado (centro o borde), el redondeo, el tratamiento de dimensiones inválidas y qué objetos conservan proporción. No elegirlos de forma implícita al implementar el inspector.

**Respuestas anticipadas del propietario (sin iniciar R5.2):** mantener el centro del objeto y rechazar cambios fuera de límites o con solapes, conservando el tamaño anterior y explicando el motivo. Redondeo, límites concretos y proporciones siguen pendientes. El propietario indicó expresamente terminar R5.1 primero y no continuar aún con R5.2.

## 6. R5.3 — JSON editable, seguro y versionado (P0 posterior)

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

La importación no debe sobrescribir un diseño existente de forma implícita. D7 incluye resolver si un ID ya presente se rechaza o recibe un ID local nuevo; la opción de reemplazar un diseño continúa pendiente.

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
| D7 | Exportar/importar un diseño por archivo; biblioteca llena bloquea la importación | CONFIRMADO parcialmente | Conflicto de IDs y reemplazo pendientes |
| D8 | R5.4 se aplaza a v0.2 salvo orden expresa | CONFIRMADO | Cierre de R5 |
| D9 | Anclaje por tipo para objetos nuevos: alfombras al suelo, lámparas de techo al techo; conservar comportamiento y posiciones de los antiguos | CONFIRMADO; implementado y verificado | Sin restricciones nuevas para lámparas de pie/mesa; ventanas y estantes murales siguen perteneciendo a paredes |
| D10 | Marca opcional `attachmentPolicy: 'by-type'` por mueble nuevo en v5; ausencia conserva comportamiento antiguo | CONFIRMADO; implementado y verificado | Permite mezclar antiguos y nuevos y recordar la distinción tras guardar/recargar. Ver RB-036 |

**Confirmación posterior del propietario:** D1–D8 aprobadas con las precisiones siguientes: D1 rechaza discrepancias con error explícito; D6 solo elimina referencias a elementos ausentes de todas las variantes y de la estructura. En D7 queda pendiente la política de ID de diseño duplicado antes de R5.3; reemplazar diseños requiere decisión aparte. R5.2 conserva pendientes las decisiones de anclaje, redondeo, límites y proporciones.

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

1. R5.1a–R5.1f cerradas, con D9/D10 y verificaciones finales en el informe único.
2. El propietario autorizó continuar con R5.2: preparar la matriz de capacidades y concretar límites, redondeo y proporciones antes de implementar los controles. Se conservan las respuestas anticipadas sobre centro y rechazo de cambios inválidos.
3. R5.3 sigue después de redimensionado, con conflicto de IDs de D7 pendiente. R5.4 permanece aplazada.

La planificación de fases posteriores no autoriza iniciarlas sin respetar estas condiciones.
