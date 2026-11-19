# F3 — progreso

## #39 Materiales — inicio (18/11/2026)

Rama `feature/f3-01-materiales`, base `2fc9f79`. Se ha añadido una base de dominio aislada: catálogo de seis familias, parámetros de acabado, validación, compatibilidad por superficie y copia de aspecto sin geometría. Se han escrito pruebas unitarias de estas reglas; no se han ejecutado, conforme a la política de no ejecutar suites locales en ramas de desarrollo sin autorización específica.

**Pendiente:** integrar y revisar las compatibilidades de cada familia con los modelos reales; texturas y miniaturas coherentes, controles accesibles, pintar y cuentagotas en escena, preview/cancelación y undo/redo. Integrar formato versionado posterior a v14, validación y migración de colores existentes, guardado local/JSON, prototipo de casa y GLB. Añadir pruebas de integración y gestos y verificar rendimiento y aspecto visual. La funcionalidad no está disponible aún en la interfaz y la issue sigue abierta.

### Seis pasos propuestos para continuar

Esta división reconstruye el trabajo a partir de la issue y del código disponible; no acredita los pasos del otro chat. La rama local y la remota apuntan a `2fc9f79`, sin commits específicos de #39.

1. **Revisar alcance y diseño existente:** issue, formato, catálogo y puntos de integración. Revisión inicial hecha; ampliar según las zonas afectadas.
2. **Dominio y compatibilidad:** catálogo, parámetros, validación y copia de acabados. Iniciado con funciones puras; falta comprobar compatibilidad real y resolver colores históricos.
3. **Persistencia e historial:** formato versionado, migración, estado, undo/redo, JSON y prototipo de casa. Pendiente.
4. **Acabados visibles y controles:** recursos estilizados, miniaturas, renderizado y ajustes accesibles. Pendiente.
5. **Pintar y cuentagotas:** interacción en superficies y muebles, vista previa, cancelación y mensajes. Pendiente.
6. **Exportación y validación:** GLB, pruebas de integración y gestos, accesibilidad, rendimiento y revisión visual humana. Pendiente.

### Continuación — colores anteriores

Se ha ampliado el conversor aislado para hexadecimales cortos (`#abc`) además de los de seis dígitos, con una prueba escrita. La importación histórica acepta cualquier cadena como color: los demás formatos devuelven `null` y deben conservarse, no sustituirse silenciosamente. El conversor todavía no se usa en persistencia; no constituye una migración completa. Pruebas no ejecutadas por la política de ramas de desarrollo.

Se ha preparado además una validación pura para un formato candidato v15: comprueba acabados de suelo, paredes, muebles y superficies adicionales, rechaza propiedades extra, versiones anteriores con materiales y combinaciones incompatibles. Incluye pruebas escritas. **Aún no está conectada al importador, al almacenamiento ni al editor**; el contrato final y el transporte por ProjectV2 siguen pendientes. Las propiedades candidatas son `floorMaterial`, `wallMaterials` y `material`, con ausencia equivalente al color existente. El prototipo ProjectV2 transforma explícitamente habitación y mobiliario, por lo que requiere cambios y pruebas de ida y vuelta para evitar perder estos datos.

### Continuación — persistencia y estado (18/11/2026)

- Se ha conectado el formato v15 a la selección de versión, lectura local y JSON, con validación en normalización; diseños sin acabados siguen usando v12–v14. Los colores originales no se transforman ni eliminan.
- El prototipo ProjectV2 transporta acabados de habitación, mobiliario y packs heredados en ambas direcciones. Los cuadros antiguos con material se conservan como muebles para no descartar su acabado durante la migración a aberturas.
- La acción interna `setMaterialFinish` aplica a suelo, pared, mueble o superficie compatible, comprueba bloqueos y utiliza el historial existente. Todavía no hay interfaz ni renderizado de materiales, así que no está disponible para uso final.
- Se han escrito pruebas de JSON, ida y vuelta del prototipo, versiones, compatibilidad y undo/redo. No ejecutadas por la política de ramas de desarrollo. Es necesaria una revisión de integración antes de considerar completo el paso 3.
- Comprobación de tipos `tsc --noEmit -p tsconfig.app.json`: sin errores. No equivale a ejecutar pruebas ni validar el aspecto visual.

### Continuación — acabados visibles y controles

- Se han añadido patrones procedurales locales para madera, baldosa, piedra, papel y tejido; pintura usa color liso. No se utilizan recursos externos. Los acabados se aplican a suelo, paredes, superficies añadidas y la pieza principal de los modelos de mobiliario. Las caras de paredes físicas reciben coordenadas de textura sin alterar su geometría.
- Los inspectores permiten elegir un acabado compatible, ajustar tono, escala y orientación, o volver al color anterior. Los cambios de color existentes actualizan también el color del acabado. Los rangos usan la transacción de historial del inspector.
- Pendiente: miniaturas fiables, revisión de la escala entre geometrías, validación visual y rendimiento, y pruebas de GLB con texturas y transformaciones. No se ha comprobado visualmente este avance. Pintar directamente y cuentagotas aún no están implementados.

### Muestrario importable y pruebas (18/11/2026)

- [Muestrario de acabados](../../tests/fixtures/materials/muestrario-acabados.json) con salón, estudio contiguo y siete muebles. Incluye los seis acabados, muestras con distintas escalas y giros, y una silla con su color original. Las cuadrículas empiezan ocultas para facilitar la revisión visual.
- Las tres pruebas de Chromium en `tests/materials.spec.ts` pasaron con el mismo JSON. Cubren importación por el selector de archivos, compatibilidad y edición del inspector con teclado, deshacer y rehacer, guardado, recarga, reexportación JSON y descarga GLB. La prueba de GLB compara las muestras por color, comprueba que las texturas se incrustan y verifica la escala y el giro del suelo leyendo las coordenadas del archivo.
- La primera comprobación del GLB detectó que se perdía el desplazamiento de la textura al girarla alrededor de su centro. La copia para exportar ahora aplica la transformación a las coordenadas de textura, incluida la rotación. El muestrario se vuelve a exportar con esa corrección y pasa la prueba del binario.
- Pasaron cinco archivos de pruebas dirigidas (dominio y estado de materiales, JSON, migración de ProjectV2 y exportador GLB), el tipado de la aplicación y `git diff --check`. Quedan la revisión visual del propietario, miniaturas, Pintar, cuentagotas y la validación de rendimiento.

### Ampliación del catálogo y del muestrario

- Se añadieron parqué en espiga, baldosa hidráulica, terrazo, estuco, papel botánico y pana. Son patrones locales de 128 × 128 que se pueden teñir, escalar y girar desde el inspector. Los diseños v15 existentes conservan sus identificadores.
- El mismo JSON de prueba reúne los doce acabados. El salón muestra la espiga en el suelo y la pana en el sillón. El estudio muestra la baldosa hidráulica, el estuco, el papel botánico y el jarrón de terrazo.
- Pasaron las tres pruebas de Chromium con el muestrario actualizado, las cinco unitarias de materiales y el tipado. El GLB contiene once texturas PNG distintas y pintura lisa. Se revisó una captura plana con los seis patrones repetidos y teñidos. Queda la revisión visual del propietario en la escena 3D.

### Catálogo por familia, acabado y patrón

- Por petición del propietario, cualquier patrón se puede aplicar a cualquier elemento editable. El inspector de cada elemento ofrece tres recomendaciones en **Familia**, seguidas del catálogo completo. La selección pasa por **Familia → Acabado → Patrón** y conserva el color elegido al cambiar de patrón. **Color original** retira el acabado.
- Los 17 acabados incluyen las nuevas vetas de pino y roble, gotelé, ladrillo y cerámica esmaltada con gris como tono de muestra. El muestrario actualizado incluye los 17 y mantiene los identificadores anteriores del formato v15. Puertas, ventanas, techos y objetos murales también admiten acabados. En objetos con cristal se trata el marco, y en muebles de varias piezas se trata la superficie principal.
- Se comprobó en una captura isométrica que la espiga, el papel y las baldosas aparecen al importar. Los materiales se vuelven a montar al añadir o retirar un mapa para actualizar la escena de inmediato. Las firmas de los modelos base, los iconos, las pruebas de dominio, estado, JSON y ProjectV2, y el tipado pasaron.
- Pasaron las tres pruebas de Chromium del muestrario. Se verificaron la navegación por los tres niveles, recomendaciones distintas para sofá y puerta, aplicar papel al sofá, conservar el color, historial, guardado y recarga, JSON y GLB con 16 texturas PNG distintas. La prueba de guardado y recarga pasó al repetirla aislada tras agotar el límite anterior de 30 segundos.

### Casa muestrario

- [Casa muestrario de materiales](../../tests/fixtures/materials/casa-muestrario-materiales.json) con seis estancias en una planta, 23 muebles, cinco pasos interiores y los 17 acabados. Incluye paletas y combinaciones distintas en salón, estudio, cocina y comedor, dormitorio, tocador y taller de muestras. El taller combina papel pintado con tapicería y gotelé con mobiliario. El muestrario pequeño sigue siendo la entrada de las pruebas de materiales.
- El importador v15 valida el archivo. Las comprobaciones de geometría verificaron que cada paso interior recorta las paredes de las dos estancias que conecta. Los detectores de escena no encontraron colisiones, objetos fuera de las estancias ni aberturas sin apoyo.
- En Chromium se importó el JSON desde **Mis diseños**, se enfocaron las seis estancias en **Plano** y se comprobó que seguían disponibles al recargar. También se revisó una captura general en Isométrica.

### Ajuste del selector y próxima ampliación

- Se retiraron las recomendaciones. **Familia** muestra las familias y **Color original**. Los patrones se eligen en su propio nivel. Los 17 acabados y sus identificadores se conservan.
- La siguiente tanda de acabados quedó anotada en [#75, ampliación del catálogo de objetos](https://github.com/Pablo-hg/Room-Builder/issues/75), para desarrollarla con la ampliación de mobiliario.

## Cambios ajenos a #39 en esta rama (pedidos por el propietario, 17–18/11/2026)

Hechos sobre la base de materiales de este informe. No forman parte de #39: irán en commits separados.

- **Arrastrar desde el catálogo** (ratón y lápiz; táctil sigue pulsando): crear y mover es un paso de deshacer; soltar fuera o Esc lo revierte sin rastro (`revertHistoryGesture`, `continueHistoryGesture`). Muebles y construcción, sobre el suelo de la habitación enfocada; puertas, de pared en pared (`src/domain/catalogDrag.ts`, `catalogDragSession.ts`, `CatalogDropController.tsx`).
- **Objetos de pared:** al arrastrarlos van por el plano de la pared visible más cercana; sobre la pared real se fijan; soltados fuera quedan libres. Uno libre se fija solo al acercarlo a una pared de su habitación (Alt lo evita). Casilla «Fijar a pared» en lugar de los botones Despegar / Volver a colocar; solo la casilla despega. El cuerpo de un objeto fijado se mueve libre en los dos ejes de su pared (`setWallObjectFreePosition`).
- **Gizmo de objetos de pared:** flechas resaltadas al pasar el ratón y tamaño constante en pantalla al hacer zoom. En todos los gizmos, una flecha ya no se ilumina si el cursor pasa por ella durante otro arrastre.
- **Etiqueta de habitación apilada:** si otra habitación está justo encima, el nombre se ancla en su propio suelo (`src/domain/roomLabelAnchor.ts`).
- **Guía de inicio, paso 4:** la tarjeta va a la izquierda del inspector.
- **Indicador de movimiento** dividido en dos cajitas (cuadrícula y paso / magnetismo y guías).
- **Recargar vuelve al último diseño abierto** (`src/state/lastOpenedDesign.ts`), no siempre al primero de la lista.
- Los E2E `free-wall-objects` y `movement-guides` se adaptaron a la nueva interfaz; no se han ejecutado.

### Ajustes visuales del propietario sobre los acabados (18/11/2026)

- **El patrón se mide en metros reales** también en suelos, techos y muebles (`src/scene/worldUv.ts`), como ya hacían las paredes. Antes usaban las UV por defecto de cada cara: el patrón se estiraba al redimensionar un mueble y medía distinto según el tamaño de la pieza. En muebles la medida incluye el redimensionado, así que al agrandarlos el patrón se repite en vez de estirarse. **Cambia la escala aparente de los patrones en suelos y muebles ya guardados** (la escala guardada ahora significa metros por repetición).
- **Tejido «Trama fina»:** líneas más tenues y a doble distancia; con 8 px (6 cm) se leía como cuadraditos.
- Pendiente: madera de un solo tono si no convence la actual; mantener el diseño por cara de pared (interior/exterior) para #51/#52, que esta base no tiene (un material por pared).

### Medición de rendimiento con la casa muestrario (18/11/2026)

Diseño `casa-muestrario-materiales.json` (23 muebles y 30 superficies con acabado, 6 habitaciones, 16 acabados) frente al **mismo diseño sin acabados**. Build de producción (`npm run build` + `vite preview`), Chromium automatizado a 1280 × 720, tres repeticiones por variante intercaladas. Script: `scripts/playwright-profile/materials-perf.spec.ts` con `playwright.perf.config.ts`; resultado en `test-results/materials-perf.json` (no versionado).

**Limitación principal:** el navegador usó **render por software** (ANGLE / SwiftShader), no una GPU. Las cifras absolutas (20–25 fps) no representan un equipo real; solo la comparación entre variantes es útil.

| Métrica (mediana) | Con acabados | Sin acabados |
| --- | --- | --- |
| Carga hasta editor usable | 1331 ms | 1050 ms |
| Heap JS tras cargar | 75 MB | 30,5 MB (rango 30,5–61,2) |
| Fotogramas en reposo | 20,7 fps | 24,5 fps |
| Órbita: fps / mediana por fotograma | 22,4 fps / 50 ms | 24,8 fps / 33,4 ms |
| Órbita: fotogramas > 50 ms | 45 | 27 |
| Llamadas de dibujo por render | 74,3 | 74,3 |
| Cambio de vista (mediana) | 606 ms | 520 ms |

- **Las llamadas de dibujo no aumentan** con los acabados (74,3 en ambos).
- Con software de render los acabados cuestan entre un 10 y un 30 % de fluidez; es coste de muestreo de texturas por CPU y no es extrapolable a una GPU.
- **Memoria:** el heap sube unos 45 MB. La base crea una textura por componente (cada mueble y superficie), sin compartir las de un mismo acabado. Candidato a optimizar con una caché por acabado; por confirmar con una medición de memoria más fina (el heap es sensible al recolector).
- En reposo la escena se renderiza a cada fotograma aunque no cambie nada (también sin acabados): comportamiento previo, fuera del alcance de #39.
- Pendiente: repetir en un equipo con GPU y con el navegador del propietario.

### Caché de texturas por acabado (18/11/2026)

`src/scene/materialTexture.ts`: todas las piezas con el mismo acabado, escala y giro comparten una textura (antes cada mueble y cada superficie creaba la suya). Caché de 64 entradas; liberar una textura aún en uso es seguro porque three.js la vuelve a subir. La exportación GLB ya clonaba las texturas, así que no se ve afectada. `materialTexture.test.ts` (4 pruebas); `tsc` y 13 pruebas unitarias de textura, UV, GLB y materiales pasan.

Misma medición de la casa muestrario (SwiftShader, 3 repeticiones): **heap con acabados 75 MB → 48 MB** (rango 47,9–48; sin acabados 30,6 MB). Los tiempos y fps no son comparables entre ejecuciones (la variante sin acabados también empeoró, de 24,5 a 21,2 fps: ruido del equipo con render por software); en la misma ejecución, con acabados queda un 17 % por debajo en reposo y un 11 % en órbita, como antes. La caché no cambia las llamadas de dibujo (74,3) ni el coste de muestreo; solo la memoria.

### Pintar, Cuentagotas y miniaturas (18/11/2026) — sin verificar con pruebas

- **Pintar** (`🖌 Pintar` en la cabecera de la escena): con la herramienta activa, pulsar o tocar un elemento lo pinta con el pincel (o copia su acabado, en modo Cuentagotas) en vez de seleccionarlo; el fondo sigue orbitando. Cada pincelada es un paso de historial (reutiliza `setMaterialFinish`: respeta bloqueos y validación). Resalta con una caja el elemento bajo el cursor y nombra su habitación. Esc o × terminan; Deshacer revierte pincelada a pincelada. Estado de sesión: no se guarda ni entra en el historial. Archivos: `src/domain/paintTool.ts`, `src/state/actions/paintActions.ts`, `src/scene/PaintTool.tsx`, `src/components/editor/PaintToolControls.tsx`, prueba `src/state/paintTool.test.ts` (11, no ejecutada).
- **Cuentagotas:** copia solo el acabado (id, color, escala, giro); nunca posición ni medidas. Avisa si el elemento no tiene un color legible. Tras copiar vuelve al pincel.
- **Un solo control de color por elemento:** con acabado se oculta «Color del objeto / pared / superficie» y manda «Color del acabado» (como ya hacían puertas y ventanas).
- **Constructor de material (revisión del propietario):** el panel de Pintar usa los mismos campos que el inspector (familia, acabado, patrón, color, escala, orientación; componente compartido `MaterialFields`) y muestra abajo una **muestra grande en vivo** (`MaterialPreview`, 2,5 m de ancho, mismo patrón que la escena). «Pintar la selección (N)» aplica el material a varios elementos en un solo paso de deshacer (`applyPaintToMany`). El selector de miniaturas se retiró; el inspector conserva una miniatura del acabado actual (`MaterialSwatch`).

**Revisión de accesibilidad (por lectura de código; no probada con personas ni con lector de pantalla):**

- Teclado: el botón Pintar tiene `aria-pressed`; los campos del pincel tienen nombres propios («Familia del pincel»…) para no confundirse con los del inspector; hay vía sin puntero (pintar la selección y copiar del seleccionado); Esc termina; el texto del elemento bajo el cursor está en una región `aria-live`; la muestra grande tiene descripción textual.
- Táctil: pulsar sobre el lienzo usa eventos de puntero (vale para el dedo). Sin comprobar: gestos de cámara con dos dedos mientras Pintar está activo.
- Pendiente: E2E `tests/paint-tool.spec.ts` (3 pruebas, **no ejecutadas**), contraste de los bordes de las miniaturas y prueba con lector de pantalla.

- **Etiquetas de habitación:** ya no tapan los indicadores de la escena ni los paneles flotantes (Medir, Pintar, selector de habitación): se desplazan en vertical y, si no hay hueco, se ocultan hasta que la cámara les deja sitio.

### Pruebas ejecutadas (19/11/2026)

- Unitarias completas (`npm test`, por el propietario): **698/698**.
- E2E tocados o nuevos: `paint-tool` (3), `plan-measures`, `plan-details-categories`, `movement-guides`, `checkpoint-v02`, `materials` (3), `free-wall-objects`: **todos pasan** tras dos correcciones de prueba:
  - `paint-tool` (táctil): el selector `.scene-panel canvas` cogía la muestra grande del panel de Pintar en vez de la vista 3D; ahora elige el lienzo mayor.
  - `materials` (GLB): reconstruía las UV del suelo con un `BoxGeometry` unitario; desde que los patrones se miden en metros (`applyWorldUv`) usa la caja con las medidas de la habitación y UV en metros.
- Humo (`npm run test:e2e:smoke`, 5 procesos): 25/32 a la primera; los 7 restantes **pasan al repetirlos uno a uno** (agotamiento de 30 s por saturación del equipo, no regresión): `area-selection`, `camera-views` (×2), `furniture-gestures`, `history-transactions`, `persistence-integrity`, `selection` (Alt+clic).
- Corrección visual: el panel de Pintar (y el de Medir) queda por encima de la brújula (`z-index` 7).
- No ejecutado: suite E2E completa (`npm run test:e2e`).
