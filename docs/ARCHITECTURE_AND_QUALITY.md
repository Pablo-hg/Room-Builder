# Arquitectura y calidad técnica

> **Estado vigente (04/11/2026, `main` tras PR #22):** R0–R5 integradas en el repositorio. R5.4 se aplazó a v0.2 y el editor local **todavía no está certificado como MVP completo**: según el informe de R5 hubo 213 pruebas unitarias y build correctos, pero no una nueva ejecución única de toda la suite E2E después de los últimos ajustes. La comparación A/B fue retirada de la interfaz MVP (RB-040); la compatibilidad de datos históricos se conserva. La planificación operativa es [MVP_SCOPE](MVP_SCOPE.md) + [LOCAL_MVP_BACKLOG](LOCAL_MVP_BACKLOG.md) y las issues [#23–#33](https://github.com/Pablo-hg/Room-Builder/issues/23). Este aviso prevalece sobre fotografías históricas del documento.


**Estado:** diagnóstico del código actual CONFIRMADO por lectura; organización objetivo PROPUESTA.

## Stack actual (package.json, 26/10/2026)
React 19, TypeScript, Vite 6, Three.js, React Three Fiber, Zustand, pruebas de Node/tsx y Playwright. Mantener salvo necesidad real medida; no hay que introducir otro motor de juego.

## Problema técnico real
La auditoría original identificó concentración en `src/App.tsx`, `src/components/RoomScene.tsx` y `src/state/useRoomStore.ts`. R1 extrae la interfaz de `App.tsx` a `src/components/editor`; R2.1–R2.9 trasladan cámaras, paredes, aperturas, superficies, mobiliario, selección y gestos, brújulas, órbita y exportación a `src/scene`. `RoomScene.tsx` compone estos módulos y conserva los exports públicos de brújulas para `App`. R3.1–R3.3 extraen identificación/selección, reglas puras y contrato/normalización v1 a `src/domain`; R3.4 separa migraciones y almacenamiento en `src/persistence`; R3.5 compone las acciones desde `src/state/actions` mediante un único store e historial. El tamaño no demuestra errores por sí solo, pero dificulta comprensión, pruebas y cambios seguros.

## Extracción de escena implementada (R2.1–R2.9)

- `scene/CameraRig.tsx`: cálculos, animación y movimiento reducido originales; `scene/types.ts` conserva el contrato de props.
- `scene/wallVisibility.ts`: política de paredes ocultas, etiquetas y cuadrículas reutilizando las funciones existentes del dominio.
- `scene/RoomShell.tsx`: suelo, plataforma, iluminación y etiquetas; su grupo conserva la referencia usada para exportar y recibe el contenido de la escena por composición.
- `scene/Walls.tsx` y `scene/wallGeometry.ts`: colocación, cuerpo de pared y cálculo de huecos; `WallGrid.tsx` y `FloorGrid.tsx` conservan las cuadrículas.
- `scene/sceneInteraction.ts`: logger de escena compartido, sin estado duplicado. Zustand sigue siendo la única fuente de verdad.

- `scene/Openings.tsx`: representación e interacción de aperturas; `SoftWall` reside en `Walls.tsx`.
- `scene/StructureSurface.tsx` y `scene/StructureSurfaceGizmo.tsx`: superficies constructivas y su gizmo.
- `scene/FurnitureModels.tsx`: registro tipado que cubre todos los tipos de mobiliario; `colorTone.ts` conserva el cálculo cromático compartido.

- `scene/FurnitureObject.tsx` y `scene/FurnitureGizmos.tsx`: selección espacial, arrastre y cuatro gizmos originales; `scene/usePointerCancellation.ts` comparte el cierre de cancelación nativa entre cuerpo y gizmos, documentado como corrección separada.
- `scene/Compass.tsx` y `scene/OrbitPointerController.tsx`: brújulas y órbita nativa; el manejo del botón central de `App` conserva su integración.
- `scene/SceneExportController.tsx`: efecto de petición de exportación y validación de la referencia; `scene/exportGlb.ts`: copia/filtrado y descarga mediante el exportador de Three.js, con `binary` y `onlyVisible` originales.

La auditoría registra las verificaciones y limitaciones de cada subparte. El detalle de R3 se registra a continuación y en sus informes conservados.

## Dominio y formato v1 extraídos (R3.1–R3.3)

- `domain/elementIds.ts` y `domain/selection.ts`: IDs y derivación compartida por inspector, escena y store; se conserva el export público de IDs de superficies en el store.
- `domain/editingRules.ts`: reglas puras de dimensiones, actualización de habitación/aperturas, movimiento, elevación, giro y recolocación de muebles. `domain/structureRules.ts` construye las superficies por defecto.
- `domain/designV1.ts`: contrato v1, metadatos de diseños, defaults de cuadrícula, serialización canónica, firma de cambios y comprobación compatible de cabecera. `domain/types.ts` reexporta el tipo persistido para mantener los imports anteriores.
- `domain/normalizeDesignV1.ts`: normalización de habitación, superficies, cuadrículas y elementos ocultos. Se conserva el orden de la carga: cabecera, habitación, packs, validación de aperturas, migración mural, colocación de muebles y preferencias.

La comprobación de cabecera sigue siendo parcial: permite listar diseños que pueden fallar al cargar sus datos anidados. No equivale a un validador estricto para una futura importación JSON pública. La restricción previa que rechaza rotaciones cero/negativas de superficies se caracteriza y conserva en esta extracción; corregirla requiere una tarea específica. La continuación R3.4/R3.5 se detalla a continuación; las transacciones explícitas de R3.6 se detallan más abajo. Ver [informe de R3.2/R3.3](progress/R3_PROGRESS.md#r3-2-3).

## Repositorio y acciones compuestas (R3.4–R3.5)

- `persistence/designMigrations.ts`: transformaciones puras de diseño legacy y cuadros/espejo antiguos. Los IDs y fechas se reciben desde el llamador; la migración mural conserva el orden de búsqueda y los elementos no colocables.
- `persistence/localDesignRepository.ts`: acceso diferido a `localStorage`, lectura compatible y escritura con las mismas claves. La clave actual tiene prioridad, incluso si contiene una lista vacía. Los errores se propagan a las acciones para mantener sus avisos. La clave legacy se conserva tras migrar.
- `state/useRoomStore.ts`: compone datos iniciales y acciones, crea el contexto privado por instancia y mantiene el único setter que aplica firmas, cambios pendientes e historial.
- `state/actions/`: módulos de cámaras, construcción/aperturas, mobiliario, selección/portapapeles/visibilidad, historial y diseños. Todos reciben el mismo setter y getter según su necesidad; solo diseños recibe el repositorio.
- `state/types.ts` y `state/defaults.ts`: contrato común, contexto de historial/portapapeles y defaults actuales. El contexto privado sustituye las variables de cierre anteriores; no duplica el mundo persistido ni introduce otro store.

`useRoomStore`, `createRoomStore()` y el export de IDs mantienen su uso anterior. `createRoomStore` admite opcionalmente un repositorio para aislar pruebas. Las reglas vigentes en esa entrega se conservan en su informe; la continuación R3.6/R3.7 se detalla a continuación. Ver [informe de R3.4/R3.5](progress/R3_PROGRESS.md#r3-4-5).

## Transacciones y suscripciones medidas (R3.6–R3.7)

- `state/historyTransactions.ts`: inicio, cierre y registro de cambios de una transacción de historial. Cada gesto tiene un token propio y un snapshot; solo su primer cambio aceptado añade un paso de undo. Cancelar cierra conservando la última posición, sin rollback.
- `state/useHistoryGesture.ts`: propiedad del token por componente, cierre al desmontar y comprobación de vigencia antes de aplicar movimientos. Los tokens antiguos no cierran un gesto posterior. Cambiar selección/vista y ejecutar undo/redo cierra el gesto vigente.
- `scene/usePointerCancellation.ts`: puente nativo para cancelación, pérdida de captura y pérdida de foco. Se usa también en aperturas y superficies. Los inspectores agrupan rangos y dial mediante `useInspectorGesture`, conservando los pasos de teclado independientes.
- `state/selectors.ts`: proyecciones concretas de escena, cabecera y atajos, y nombre activo como valor primitivo. Los selectores que devuelven objetos se usan con `useShallow`, evitando identidades nuevas innecesarias.
- `App.tsx`: el shell escucha acciones estables; `EditorScene` escucha los datos/cámaras que renderiza; `EditorNotice` escucha los avisos. La cabecera se suscribe a su propio contrato; el menú recibe ese contrato reducido.

Con el mismo fixture y diez actualizaciones separadas, las invocaciones de `App` pasan de 20 a 0 en ambos recorridos; la cabecera pasa de 20 a 0 con cámara y a 2 con mobiliario. `EditorScene` sigue en 20 y el catálogo mantiene 20 al mover muebles. Son conteos de funciones en desarrollo con StrictMode, no medidas de FPS, duración ni velocidad de producción. Datos y reproducción en el [informe de R3.6/R3.7](progress/R3_PROGRESS.md#r3-6-7).

## Límites de responsabilidad objetivo
- **domain/**: modelos, objetos, restricciones y geometría puros, sin React o Three donde sea viable.
- **scene/**: renderizado 3D, cámaras, meshes, selección espacial y exportación.
- **features/**: creación de habitaciones, aberturas, catálogo, editor, variantes, guardado.
- **state/**: stores divididos por necesidad y persistencia, sin duplicar fuentes de verdad.
- **ui/**: controles, paneles y componentes comunes.
- **assets/**: iconos, modelos y recursos con origen trazable.
- **tests/**: unitarias de geometría/estado y Playwright de flujos.
No forzar exactamente estos directorios antes de una auditoría; la [reorganización](REFACTOR_PLAN.md) define los pasos.

## Principios
- Datos del diseño serializables y ajenos a cámaras/render; geometría común para plano/isométrica/POV.
- Separar instancias de muebles de sus definiciones; controlar acoplamientos entre catálogo y render.
- Un único responsable de las acciones mutables, undo/redo y validación por dominio; no duplicar estados.
- Escena y paneles no deben depender de archivos gigantes.
- Evitar generar modelos 3D nuevos que requieran reescribir interfaces de persistencia; cambios compatibles.
- Carga diferida del editor en la futura modalidad Mini; no aumentar el peso inicial del HUB.
- Transiciones de cámara discretas si se solicita movimiento reducido; establecer degradación razonable si WebGL no está disponible.
- No optimizar a ciegas: medir antes; geometría sencilla, iluminación limitada, reutilización de materiales y recursos.

## Pruebas/gates
- Geometría de aberturas, colisiones, límites de tamaño, rotación, validaciones numéricas.
- Cuatro orientaciones isométricas y paredes ocultas; cambio de vistas conserva posiciones.
- Operaciones sobre elementos: añadir, seleccionar, mover, redimensionar, eliminar, ocultar, duplicar, copiar/pegar, undo/redo.
- Persistencia/migración y pérdida de estado entre variantes; importación malformada.
- E2E de flujo de usuario real, responsive y accesibilidad básica.
- Ejecutar npm test, npm run test:e2e y npm run build cuando correspondan. Si no pueden ejecutarse, reportar el bloqueo de forma explícita.
- En un refactor de estructura, no cambiar comportamientos ni el aspecto visual sin consentimiento y pruebas comparativas.

## Seguridad y privacidad
- Archivos JSON importados y cadenas de usuario son no fiables; validar tamaño, tipos y límites; no eval, ni código activo derivado de datos.
- Logs de interacción: en el proyecto actual son diagnósticos locales de desarrollo; documentar y evitar habilitarlos accidentalmente en producción.
- Las futuras fotos/planos importados requieren aclarar conservación y privacidad; no forman parte del MVP.

## Entregas
Para cada PR: qué cambió, qué no, pruebas ejecutadas, capturas si hay cambios visuales, compatibilidad de formatos, archivos afectos, riesgos y pendientes. No hacer merges automáticos.
