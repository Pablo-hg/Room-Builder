# F2 — Informe de progreso

> Nota de integración: la rama de #37 (`feature/f2-01-guias-magnetismo`) también crea este archivo con su sección. Al fusionar ambas, conservar las dos secciones.

## F2 · 02/03 — Regla de medición completa y cotas guardables (#38, RB-046)

Rama: `feature/f2-02-regla-cotas`. Estado: **implementado (contornos rectangulares), con pruebas unitarias y E2E; revisado visualmente por captura del agente, sin validación humana; sin PR**.

### Decisiones del propietario (16/11/2026)

1. **Anclajes:** cotas absolutas **y** ancladas a muebles (esquinas, puntos medios, centro) y a esquinas de pared. Si el referente se mueve, la cota se recalcula sola.
2. **Referente borrado:** la cota se conserva **fija** en su última posición con una advertencia visible (`stale`) hasta que el usuario la acepte o edite. Nunca desaparece ni miente.
3. **Formato:** v13 solo cuando hay cotas (sin ellas sigue v12); ver [DATA_AND_FORMATS](../DATA_AND_FORMATS.md).

### Qué hace

- **Herramienta «Medir»** (botón en la barra del Plano, funciona con «Mostrar detalles» activado o no, sin cambiar de vista, cámara, selección ni historial): clic/toque en dos puntos o arrastrar. Muestra la distancia real y, si es oblicua, sus componentes (`5,00 m (4,00 m × 3,00 m)`).
- **Ayudas:** Libre / Horizontal / Vertical (los de la pantalla, aunque el Plano esté girado; Mayús fija horizontal) e **imán** opcional (14 px) a esquinas de pared y esquinas, puntos medios y centro de muebles. El imán de la regla es independiente del magnetismo de #37 (no comparten estado).
- **Medidas temporales:** se descartan con «Descartar» o Esc; Intro las guarda. Salir de Plano desactiva la herramienta.
- **Cotas guardadas** (parte del diseño, un paso de historial por alta/edición/ocultación/baja): lista «Cotas guardadas» en el panel izquierdo con ocultar, editar (nombre y coordenadas; editar un extremo lo deja fijo) y eliminar; alta por coordenadas como vía de teclado. Se dibujan en azul solo con «Mostrar detalles» y si no están ocultas; con advertencia roja si están obsoletas.
- **Persistencia:** se conservan al guardar, recargar y en el JSON; validación estricta al importar.
- **Accesibilidad:** botones y formularios operables con teclado y táctil (destinos de 44 px en móvil), lectura `aria-live` de la distancia, alertas para cotas obsoletas.

### Archivos

- Dominio puro: `src/domain/planMeasures.ts` (tipos, anclajes, recalculado, imán, proyección, validación, visibilidad).
- Estado: `src/state/actions/measureActions.ts`; cambios en `useRoomStore.ts` (recalculado en el mismo paso de historial), `types.ts`, `designActions.ts`, `historyActions.ts`.
- Formato: `designV1.ts`, `designMigrations.ts`, `designFile.ts`, `projectV2.ts` (solo tipo).
- Escena/UI: `src/scene/PlanMeasures.tsx`, `src/components/editor/MeasureControls.tsx`, `ViewControls.tsx`, `ObjectsPanel.tsx`, `App.tsx`, `RoomScene.tsx`, `styles.css`.

### Pruebas

- Unitarias nuevas: `src/domain/planMeasures.test.ts` (12) y `src/state/measures.test.ts` (12): diagonal 4×3 = 5 m, anclajes, recalculado, referente borrado, imán, proyección de ejes, contrato y rechazos, migración v12→v13, JSON, historial, sesión.
- E2E nuevos: `tests/plan-measures.spec.ts` (5, 2 `@smoke`): dos clics y distancia, Escape y salida de Plano, guardar dos cotas/editar/ocultar/eliminar/deshacer, recarga + JSON + validación, referente movido/borrado. El E2E detectó un fallo real del formulario (lectura de `currentTarget` diferida) ya corregido.
- Local: `tsc -b` limpio; unitarias de persistencia, diseño, store, historial y diagnóstico (110 correctas, 0 fallos) y los 5 E2E nuevos pasan. La suite completa, el build y el resto de E2E quedan para la CI.

### Alcance respecto a la «Ampliación 09/11» de #38 — PENDIENTE

Esta entrega cubre la regla, el formato y las cotas manuales guardables. **No** incluye aún: cotas automáticas de puertas y ventanas (anchos y distancias a extremos de pared), distancias de muebles bajo filtro, controles secundarios por categoría (paredes, huecos, muebles, anotaciones), simplificación de etiquetas con el zoom ni capturas comparativas Plano normal/detallado. Estas piezas amplían el sistema de cotas de #26 y necesitan su propia decisión de diseño. Contornos irregulares dependen de #35.

### Límites conocidos

- Mientras la herramienta está activa, arrastrar en el Plano mide (no desplaza); para desplazar, desactívala o usa las flechas del botón de restablecer.
- Las cotas viven en el plano X/Z: no distinguen plantas; se dibujan a la altura de la planta enfocada.
- No hay arrastre de extremos con el ratón para editar una cota guardada (se edita por coordenadas).
- Sin E2E táctil ni de teclado del trazado (el alta por coordenadas es la vía de teclado).

### Nota de producto (sin implementar)

El propietario indica que «Mostrar detalles» debería parecerse a un plano arquitectónico con cadenas de cotas exteriores e interiores (grosores de pared, huecos, particiones). Es el objetivo de la parte pendiente de arriba.
