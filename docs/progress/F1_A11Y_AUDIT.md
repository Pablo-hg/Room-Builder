# Auditoría de accesibilidad, responsive y táctil (F1 · #31)

Estado: **en curso**. Rama `feature/f1-07-completar-accesibilidad`. Auditoría automática local (Playwright, Chromium) del 15/11/2026; sin validación humana.

## 1. Método

- **Responsive:** 320 × 640, 375 × 667, 667 × 375 (horizontal), 768 × 1024, 1024 × 768 y 1440 × 900, con táctil emulado por debajo de 1024 px. Se mide desbordamiento horizontal, controles cortados, controles sin nombre accesible y tamaño de zona táctil (< 24 px, WCAG 2.5.8).
- **Teclado:** recorrido completo con Tab en escritorio (indicador de foco, foco en elementos invisibles, trampas) y flujo P0 solo con teclado: añadir objeto, medidas, selección desde la lista, menú contextual, inspector, guardar, exportar e importar JSON, cancelar diálogos.
- **Táctil:** un toque en familia, tarjeta del catálogo y Deshacer debe producir una sola acción.
- Revisión de código: diálogos, menús, `aria-live`, movimiento reducido y estados que dependan solo del color.

## 2. Lo que ya cumple

- Sin desbordamiento horizontal ni controles cortados en ninguna anchura; todos los controles tienen nombre accesible; sin errores de página.
- Orden de tabulación lógico (88 paradas en escritorio) y sin trampas de foco.
- Flujo P0 completo con teclado. Menú contextual de la lista con Menú/Mayús+F10, flechas y Escape; menú de diseños con flechas; exportar e importar con teclado.
- `DesignModal` y la guía: foco inicial dentro, Tab circular, Escape y devolución del foco.
- Avisos con `role="status"`/`aria-live` (guardado, notificaciones, zoom, cotas). Errores de medida con texto (`role="alert"`). Selección de la lista con `aria-pressed`; colisiones con texto en «Incidencias», no solo color.
- Movimiento reducido: CSS global y transiciones de cámara.
- Sustitutos del arrastre 3D: campos numéricos y deslizadores de posición, giro y medidas en el inspector; selección desde la lista.
- Táctil: un toque produce una sola acción.

## 3. Hallazgos y estado

| # | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| 1 | El Escape que cierra el menú contextual de la lista también deseleccionaba el objeto | Alta | **Corregido** (`SceneContextMenu`: no propaga Escape) |
| 2 | Al cerrar la guía o el aviso de primera vez, el foco caía en el documento | Alta | **Corregido** (`focusAfterGuide`: vuelve a «Ver guía de primer uso» o al primer control visible) |
| 3 | Anillo de foco global al 25 % de opacidad: contraste 1,48:1 (WCAG 1.4.11 pide 3:1) | Alta | **Corregido**: `--focus-ring: #425547` sólido de 2 px (7–8:1) en todos los estados de foco |
| 4 | Las 4–6 alternativas de teclado a la brújula 3D recibían el foco siendo invisibles (1 × 1 px) | Alta | **Corregido**: `visually-hidden-focusable`, visibles como etiqueta al enfocarlas |
| 5 | Tiradores de ancho de panel y elementos de menú contextual con indicador de foco casi invisible | Media | **Corregido** (borde interior con `--focus-ring`) |
| 5b | Lista de escena: el anillo de foco se dibujaba solo en el botón interior de la fila (icono y texto), no en su caja (observación del propietario) | Media | **Corregido**: con `:has()`, el anillo rodea la fila completa y la cabecera de carpeta; al hacer clic solo se ve el borde de selección |
| 6 | El menú de diseños guardados seguía abierto con el foco ya fuera (Tab) | Media | **Corregido** (se cierra al salir el foco, salvo hacia su menú contextual o diálogos) |
| 7 | El error de las medidas no estaba enlazado a su campo | Baja | **Corregido** (`aria-describedby`) |
| 8 | 44–46 controles de menos de 24 px: cabeceras del catálogo (16 px de alto), ocultar/bloquear de la lista (20 × 20), pasos de 1 cm (18 × 13), interruptores de cuadrícula (34 × 19) | Media | **Corregido** (decisión del propietario): mínimo 24 px siempre y 32 px con puntero grueso; iconos del mismo tamaño. Pasos de 1 cm en fila ▼ ▲ (orden visual = orden de tabulación). Quedan por debajo solo las alternativas de la brújula (visibles al enfocar) y los tiradores de panel (alternativa equivalente: «Minimizar panel») |
| 9 | Móvil: la cabecera ocupaba ~40 % de la altura en vertical (375 × 667) y tres filas en horizontal (667 × 375) | Media | **Corregido** (decisión del propietario): dos filas (logo · Diseños · deshacer · rehacer · Guardar / cinco vistas), ~100 px; por debajo de 380 px Guardar solo con icono (texto para lectores) y vistas sin icono; en móvil horizontal la cabecera no queda fija |

## 4. Checklist manual (navegador y táctil)

- [ ] Con solo teclado: crear objeto, cambiar medidas, seleccionar desde la lista, mover con el inspector, guardar, exportar e importar JSON y cancelar diálogos.
- [ ] El anillo de foco se ve en todos los controles, menús y tiradores de panel.
- [ ] Escape cierra menús y diálogos sin efectos secundarios y el foco vuelve a su origen.
- [ ] En móvil (vertical y horizontal) no hay paneles cortados ni controles inalcanzables.
- [ ] Un toque produce una sola acción; la pulsación larga abre el menú contextual de la lista.
- [ ] Con zoom del navegador al 200 % no aparece desplazamiento horizontal.
- [ ] Con «reducir movimiento» activo, la cámara cambia de vista sin animación.

## 5. Tests

`tests/a11y-keyboard.spec.ts` (8 tests, menos de 10 gestos cada uno; el flujo P0 con teclado lleva `@smoke`): flujo añadir → guardar → exportar JSON solo con teclado; foco al cerrar aviso y guía; Escape del menú contextual sin deseleccionar; anillo de foco sólido y en la caja completa de la fila; alternativas de la brújula visibles al enfocar; menú de diseños cerrado al salir con Tab; error de medida enlazado; móvil táctil con cabecera ≤ 130 px, sin desplazamiento horizontal y zonas táctiles ≥ 32 px. Resultado local: 8/8.

## 6. Pendiente

- Validación humana con la checklist y capturas.
