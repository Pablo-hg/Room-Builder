# Plan de reorganización del código — fase siguiente

**Estado:** R0 completada y R1 ejecutada en la rama de trabajo; R2.1–R2.4 ejecutadas en la rama de trabajo; R2.5–R2.9 y R3–R5 siguen pendientes. Las decisiones de arquitectura futura no quedan aprobadas por esta actualización.

## Antes de tocar código
1. Confirmar alcance de esta documentación y enumerar cambios actuales sin commit; evitar sobrescribir trabajo de Codex.
2. Crear rama técnica separada desde la rama estable elegida; no modificar la rama de documentación ni la predeterminada por sorpresa.
3. Registrar comportamiento base: capturas de las cinco vistas, 4 diagonales, edición y guardado. Guardar fixtures de diseños v1 y comandos que pasan/fallan.
4. Evaluar cada ruta de importación y acoplamiento. No renombrar y reescribir funciones en el mismo lote.

## Orden sugerido
**R0 — Inventario y contratos**
- Revisar dependencias entre App, RoomScene, useRoomStore y domain.
- Documentar API interna, coordenadas, datos persistidos, selección/cámaras y tests existentes.
- Identificar conflictos entre mobiliario, aperturas y packs constructivos.
- Preparar tests de caracterización sin cambiar comportamiento.

**R1 — Extraer UI (implementado; verificación registrada en la auditoría)**
- Sacar de App.tsx cabecera, selector de vistas, catálogo, inspector, paneles de construcción y diálogos a componentes/herramientas propios.
- Mantener el mismo DOM observable para pruebas cuando sea posible; evitar cambio visual grande.

**R2 — Extraer escena (R2.1–R2.4 implementadas; R2.5–R2.9 pendientes)**
- Separar CameraRig, habitación/paredes/aberturas, modelos de mobiliario, helpers de selección y exportador GLB de RoomScene.tsx.
- Mantener los mismos valores por defecto, comportamiento y cinco vistas.

Subpartes, en orden de dependencia. Cada una se cierra con sus pruebas y capturas y no se mezcla con la siguiente en un mismo commit; detalle y verificación en `docs/REFACTOR_AUDIT.md`.

- **R2.1 — Visibilidad de paredes** (COMPLETADA): política de paredes ocultas, etiquetas y cuadrículas como funciones puras en `src/scene/wallVisibility.ts`, con tests de diagonales, frontales, planta/POV y exportación.
- **R2.2 — Cámara** (COMPLETADA): `CameraRig` y `SceneProps` trasladados sin cambios a `src/scene/CameraRig.tsx` y `src/scene/types.ts`, conservando valores por defecto, remount perspectiva/ortográfica, duraciones y movimiento reducido.
- **R2.3 — Shell, paredes y cuadrículas** (COMPLETADA): `RoomShell`, `Walls`, `wallGeometry`, `WallGrid`, `FloorGrid` y `sceneInteraction` extraídos; `SoftWall` sigue componiendo cuerpo, cuadrícula y aperturas hasta R2.4. `RoomScene.tsx` pasa de 3139 a 2538 líneas.
- **R2.4 — Elementos murales e interacción de aperturas** (COMPLETADA; depende de R2.3): mover, girar, cambiar de pared y respetar límites sin mezclar hueco y decoración.
- **R2.5 — Superficies constructivas y gizmo** (PENDIENTE; depende de R2.3): selección, movimiento, redimensionado y undo alineados con la habitación.
- **R2.6 — Modelos de mobiliario a registro tipado** (PENDIENTE; depende de R2.3): silueta, color e icono coherentes en las cinco vistas.
- **R2.7 — Gizmos y gestos comunes** (PENDIENTE; depende de R2.4–R2.6): arrastre con inicio, fin y cancelación en ratón y táctil, con un solo paso de historial por gesto.
- **R2.8 — Brújulas e integración de órbita** (PENDIENTE; depende de R2.2 y R2.7): sin conflicto entre botón principal y central.
- **R2.9 — Exportación GLB** (PENDIENTE; depende de R2.3–R2.6): adaptador aislado, sin exportar helpers ni elementos ocultos, con smoke test y nombre de archivo.

**R3 — Ordenar dominio y estado**
- Dejar geometría/catálogos/reglas puras; mover serialización/migraciones fuera del store.
- Dividir por funciones solo si disminuye acoplamiento, sin varios estados fuente de la verdad.
- Añadir validaciones/fixtures para diseños v1 y transformaciones.

**R4 — Preparar evolución del producto (sin entregar casa)**
- Diseñar contrato Project/Room/Layout para una habitación y variantes A/B.
- Ejecutar migración explícita y tests antes de exponer interfaz multihabitación.
- Separar toggles/capacidades para modalidad completa versus Mini.

**R5 — Funcionalidad y diseño**
- Solo después, implementar redimensionado, comparación A/B, JSON editable y simplificación de UX. Las casas conectadas son posterior.

## Criterios de salida para cada lote
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
