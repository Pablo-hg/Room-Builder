# F0 — Ventanas en la habitación enfocada (#34)

**Alcance:** corregir la creación heredada de ventanas y decoración mural en Raíz cuando hay una habitación adicional enfocada. Todas las modificaciones se empaquetan en un solo commit, sin pruebas ejecutadas en rama.

## Diseño adoptado

- `RoomConfig.windows` continúa representando las aperturas de Raíz en diseños v1–v8. No se migran ni cambian posiciones de ventanas antiguas.
- `StructurePack.windows?: WindowConfig[]` representa ventanas y decoración mural de habitaciones añadidas. Es opcional, así que las estructuras históricas sin ventanas siguen válidas.
- `addWindow()` utiliza `activeRoomId` (cámara, no el objeto seleccionado); busca una pared y un hueco libre **del pack enfocado**, conserva las reglas de separación y asigna el nuevo elemento a su carpeta.
- La escena construye los huecos a partir de aperturas de esa pared, renderiza ventanas/decoración y permite seleccionar, arrastrar y girar dentro del marco de coordenadas del pack.
- El inspector, las acciones de cambio de pared/offset/altura, redimensionado, renombrado, borrado, copiar/pegar, panel de colisiones, árbol, diseños guardados y deshacer/rehacer admiten las ventanas del pack.
- `structureWindowError` valida dimensiones, paredes, márgenes y separaciones respecto a otras ventanas y puertas de la misma habitación. No relaja la validación ni altera `validateOpenings` para Raíz.
- Las ventanas de pack elevan el formato de guardado al **v8**, que ya admite la infraestructura de habitaciones; no se crea una nueva versión de archivo ni se reescriben registros antiguos. `normalizeStructurePacks` verifica las nuevas ventanas sin modificar datos heredados.

## Riesgos y límites

- Las ventanas de paredes físicamente compartidas con otra habitación no deben abrir un hueco unilateral: la creación evita esas paredes mediante `hasCoincidentWall`. La gestión de medianeras únicas es una funcionalidad estructural posterior.
- El recorte de geometrías giradas conserva las aproximaciones ya existentes en las aperturas de Raíz. No es un motor de operaciones booleanas entre paredes.
- Las habitaciones tienen coordenadas locales y globales; el marco para el arrastre se calcula por pared y pack, incluidas las plantas superiores.
- No se ha medido rendimiento ni ejecutado tests, builds o E2E en la rama conforme a la política actual.

## Revisión manual

1. En Raíz, crear una ventana rectangular y confirmar que sigue en Raíz.
2. Crear una habitación **encima**, enfocarla y crear una ventana. Debe verse en su pared, a su altura real, y aparecer en la carpeta de esa habitación, no en Raíz.
3. Crear otra habitación **lateral**, enfocarla y crear una ventana circular. Revisar las vistas Isométrica, Plano y Frontal.
4. Seleccionar la ventana del pack desde escena y desde el árbol; cambiar pared, desplazamiento, antepecho, tamaño y color desde el inspector, y moverla con el ratón. Verificar que se abre su hueco y no se afecta la raíz.
5. Añadir varias ventanas hasta agotar una pared. Debe buscar otros huecos y mostrar aviso al quedarse sin espacio; no debe atravesar puertas ya existentes.
6. Copiar, pegar, renombrar, ocultar y borrar una ventana de pack; deshacer y rehacer. Borrar la habitación completa: sus ventanas deben desaparecer sin dejar entradas en carpetas.
7. Guardar, recargar y exportar/importar el diseño. Verificar que las ventanas del pack se conservan y que un proyecto histórico con ventanas únicamente en Raíz sigue igual.
8. Comprobar que el panel de colisiones conoce las ventanas de pack y que no confunde la misma posición X/Z de una habitación situada en otra planta.

**Pruebas preparadas, no ejecutadas:** `src/state/windowsInFocusedRooms.test.ts`. El CI y la suite global solo se ejecutarán después de integrar las tareas de F0 en `main`.
