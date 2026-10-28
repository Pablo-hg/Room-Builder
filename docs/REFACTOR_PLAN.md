# Plan de reorganización del código — fase siguiente

**Estado de referencia (documentación de `main` en GitHub, comprobada el 28/10/2026):** R0 completada, R1 implementada y R2.1–R2.9 completadas, con incidencia E2E previa documentada. Se conserva el detalle de R2 de esa versión.

**Estado de esta rama:** `refactor/r3-dominio-estado` parte del `main` actualizado (`77a502e`), con R1/R2. R3.1–R3.7 están completadas como refactor, con 101/101 unitarias, build aprobado y perfiles de render antes/después registrados. Los 41/41 E2E corresponden a la revisión previa; la corrección posterior del foco del inspector pasa su regresión específica (1/1), sin terminar la nueva suite completa por petición del usuario. Las incidencias previas y límites de validación se conservan en los informes. R4 y R5 siguen PENDIENTES. Los informes se conservan en [progress/](progress/R3_PROGRESS.md), incluido el [informe de R3.6/R3.7](progress/R3_PROGRESS.md#r3-6-7). Las decisiones de arquitectura futura no quedan aprobadas por esta actualización.

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

- Diseñar contrato Project/Room/Layout para una habitación y variantes A/B.
- Ejecutar migración explícita y tests antes de exponer interfaz multihabitación.
- Separar toggles/capacidades para modalidad completa versus Mini.

### R5 — Funcionalidad y diseño

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
