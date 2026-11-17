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
