# F2 — Informe de progreso

## F2 · 01/03 — Guías inteligentes y magnetismo (#37, RB-045)

Rama: `feature/f2-01-guias-magnetismo`. Estado: **implementado, con E2E y validado visualmente por el propietario (15/11/2026); pendiente de PR a `main` y CI**.

### Decisiones del propietario (15/11/2026)

1. **Imán de paredes → unificado (1-A).** El contacto con la pared que ya existía (`softWallSnap`) obedece al interruptor de magnetismo y a Alt. Antes estaba siempre activo.
2. **Preferencias fuera del diseño (2-A).** Magnetismo y guías se guardan en `localStorage` (`room-builder:v0.2:editor-preferences`). No hay cambio de formato, versión ni migración, y no entran en el historial ni en el JSON/GLB.
3. **«Ajuste a 5 cm» configurable (3-B).** Reutiliza el campo ya persistido `gridSnap` (sin cambio de formato). Desactivado, los arrastres avanzan de 1 en 1 cm.

### Qué hace

- **Guías** (líneas y cotas) mientras se arrastra: bordes con bordes, centros con centros, centrado respecto al punto medio de una pared ortogonal cercana (≤ 1,5 m), huecos iguales entre dos vecinos y cotas en cm a los vecinos más próximos.
- **Magnetismo**: atrae a esas referencias dentro de 6 cm (en metros del mundo). Se calcula siempre desde la posición pedida por el puntero, nunca desde el resultado anterior: no hay saltos al salir de la tolerancia, al pulsar/soltar Alt ni al soltar el gesto.
- **Alt** suspende el magnetismo (incluido el imán de paredes) mientras está pulsada. Se lee con un listener de ventana (`src/state/dragModifiers.ts`).
- **Independencia**: ajuste a 5 cm, magnetismo y guías son tres interruptores separados (panel de cuadrículas) con indicador visible en la cabecera de la escena y texto `aria-live` para las guías activas.
- **Alcance de vista**: Plano, Isométrica y Libre. En Frontal y POV no hay guías ni imán de alineación.
- **Solapes permitidos (RB-041)**: no se añade ninguna restricción; las guías solo atraen.
- **Multiselección**: el arrastre del cuerpo del grupo usa la caja envolvente como referencia. El arrastre por flechas del grupo solo cambia al paso configurable (sin guías).

### Archivos

- Dominio puro: `src/domain/dragGuides.ts`.
- Estado: `src/state/actions/guideActions.ts`, `src/state/dragModifiers.ts`, `src/state/editorPreferences.ts`; cambios en `useRoomStore.ts`, `types.ts`, `furnitureActions.ts`, `historyActions.ts`, `furnitureWalls.ts`, `measurements.ts`.
- Escena/UI: `src/scene/DragGuidesOverlay.tsx`, `MultiFurnitureGizmo.tsx`, `FurnitureGizmos.tsx`, `src/components/editor/MovementStatus.tsx`, `GridVisibilitySection.tsx`, `App.tsx`, `RoomScene.tsx`.

### Límites conocidos

- Muebles girados: las guías usan la caja alineada con los ejes que envuelve al mueble (exacta a 0° y 90°; aproximada a otros ángulos). Paredes oblicuas no ofrecen guías.
- Las posiciones se guardan en cm enteros: dos bordes cuya diferencia no sea múltiplo de 1 cm quedan alineados con ≤ 5 mm de error.
- Solo cuentan muebles visibles que comparten altura con el objeto movido.
- La tolerancia es fija en metros (6 cm), no depende del zoom (coherencia entre vistas por diseño).
- Los arrastres por flecha aplican el imán solo en su eje libre.

### Pruebas

- Unitarias nuevas: `src/domain/dragGuides.test.ts` (tolerancia, ejes, giro, pared, huecos iguales, objetos ignorados, texto) y `src/state/dragGuides.test.ts` (puntero vs. teclado, Alt, interruptores, vista frontal, bloqueo, gesto único en el historial, imán de paredes, `gridSnap`, preferencias).
- Ejecutadas en local solo estas y las suites de `furnitureWalls`, `useRoomStore`, `multiSelection` y `measurements`: **68 correctas, 0 fallos**; `tsc -b` sin errores. La suite completa, el build y los E2E quedan para la CI de la PR hacia `main`.

### Pendiente

- E2E de Isométrica y de gestos táctiles (hoy cubiertos solo por pruebas unitarias).
- Actualizar `docs/DECISION_LOG.md` (RB-045) cuando el propietario valide la función.

### Correcciones tras la primera revisión visual (15/11/2026)

- **Mueble fijado a pared:** las guías se calculaban en la posición pedida por el puntero y no en la que el mueble ocupa tras el límite de la pared (cotas dibujadas lejos del objeto). Ahora los ejes bloqueados o impedidos por la pared conservan su coordenada actual; en paredes oblicuas no hay guías. Test añadido.
- **Interruptores:** etiqueta y descripción en dos líneas, interruptor de tamaño fijo, textos más cortos; el estado lo transmite el propio interruptor (`aria-checked`).
- **Cabecera de escena:** la medida de la habitación pasa a la lista de insignias, como 5.º elemento, con el formato `5.5 x 4.5 = 24.75 m²`.

### E2E (15/11/2026)

- Nuevo `tests/movement-guides.spec.ts` (6 pruebas, 1 `@smoke`): alinear dos muebles en Plano (borde atraído, guía visible y retirada al soltar), Alt sin salto, guías sin magnetismo, un gesto = un paso de historial, «Ajuste a 5 cm» independiente y sin «Cambios sin guardar», y formato de la medida de la habitación. La escala del arrastre se calibra en el propio navegador.
- `tests/checkpoint-v02.spec.ts` actualizado al nuevo texto de la medida (`4.2 x 3.6 = 15.12 m²`).
- Local (Windows): ambos specs pasan (7/7). En una tanda con `furniture-gestures` hubo 2 tiempos agotados de las pruebas nuevas y 1 de una prueba táctil ya existente; todas pasaron al repetirlas aisladas (carga de la máquina). Se subió el tiempo máximo del spec nuevo a 60 s.

### Nota de producto (sin implementar)

El propietario indica que «Mostrar detalles» (Plano detallado, #26) debería parecerse a un plano arquitectónico con cadenas de cotas exteriores e interiores (grosores de pared, huecos de puertas y ventanas, particiones). No forma parte de #37; encaja con #38 y requiere decisión antes de implementarse.
