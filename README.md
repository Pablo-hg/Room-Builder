# Room Builder v0.1

> **Documentación de producto:** antes de ampliar o reorganizar el editor, consultar [docs/README.md](docs/README.md), [AGENTS.md](AGENTS.md) y [VISUAL_STYLE_GUIDE.md](VISUAL_STYLE_GUIDE.md). La visión es un constructor de habitaciones amigable tipo diorama, útil para recrear espacios reales y comparar distribuciones. La construcción multihabitación es evolución posterior. La documentación distingue decisiones acordadas de propuestas aún no implementadas.


Prototipo web para construir una habitación rectangular, configurar sus aperturas y probar distribuciones sencillas de mobiliario en tres vistas coherentes.

## Requisitos

- Node.js 18.18 o superior.
- npm 9 o superior.

## Instalación y ejecución

```bash
npm install
npm run dev
```

Vite mostrará la URL local, normalmente `http://localhost:5173`.

Para generar la versión de producción:

```bash
npm run build
npm run preview
```

## Controles

- **Paredes A–D:** la interfaz identifica las paredes en sentido horario como A, B, C y D. Cada pared visible muestra una placa 3D sobre su borde superior.
- **Perspectiva:** vista isométrica. Mantén pulsado el indicador inferior y arrástralo horizontalmente para orbitar de forma continua alrededor del centro de la habitación. También puedes arrastrar con el botón central sobre la escena, incluso encima de un objeto, para orbitar y deseleccionarlo sin moverlo; el botón principal sigue reservado para mover muebles o girar desde zonas vacías. Los botones laterales conservan giros exactos de 90°. En cada diagonal se ocultan las dos paredes próximas a la cámara.
- **Libre:** cámara orbital en perspectiva alrededor del centro de la habitación. Arrastra con el botón central del ratón sobre la escena o usa el control inferior para orbitar horizontal y verticalmente; las flechas del teclado también orientan el control. La rueda cambia el zoom. La brújula muestra los ejes XYZ según la orientación actual y permite alinear la cámara con cada eje. No es una cámara en primera persona: no se desplaza por el espacio. Los elementos se siguen mostrando u ocultando y editando desde los paneles laterales.
- **Zoom:** coloca el cursor sobre la escena y usa la rueda: hacia arriba para acercar y hacia abajo para alejar. El nivel se limita entre 25 % y 300 % y se muestra junto a los controles de cámara.
- **Frontal:** cámara exterior lejana orientada hacia una pared y centrada de frente a 1,35 m. El selector funciona como un gizmo 3D: pulsa una cara del cubo para verla de frente, el cono verde para ir a Plano, los conos X/Z para sus vistas frontales o cualquiera de los cuatro conos violetas diagonales —orientados hacia el vértice opuesto— para saltar a una vista isométrica. El cubo transparente colorea las caras visibles. Las transiciones recorren un arco suave y la barra permite situar la cámara entre 1,35 y 10 m de altura. Los muebles seleccionados se pueden arrastrar lateralmente y en vertical desde la escena; sus flechas permiten moverlos sobre el eje lateral y en altura.

  En el indicador de la escena se muestran las paredes frontal, izquierda y derecha para la orientación seleccionada.
- **Planta:** cámara ortográfica cenital con el mismo sistema de coordenadas.
- **Interior:** cámara situada en la puerta a 1,65 m de altura. Las flechas permiten mirar hasta 55° a cada lado; no hay movimiento libre.
- **Objetos:** pulsa un elemento del catálogo para añadirlo. Incluye mesa de centro, escritorio, silla de escritorio, mueble de TV, televisor, alfombras rectangulares y circulares, planta, jarrón, lámpara de mesa, lámpara de techo y apliques de pared, además de espejos rectangulares o circulares montados en pared. Las alfombras se mueven por el suelo y no se pueden elevar; ventanas, espejos, estanterías, cuadros y apliques se colocan sobre una pared. La lámpara de techo permanece junto al techo de la habitación.
- **Construcción:** en la categoría «Construcción» añade «Nuevo piso vacío», un pack apilado con suelo y cuatro paredes, más un techo inicialmente oculto, o añade un suelo o una pared independiente. Selecciona el pack para moverlo en conjunto; elige cada superficie en la escena o en la lista para cambiar su tamaño, color, visibilidad y posición. Las paredes también se pueden girar; los suelos no tienen giro.
- **Colores:** cambia el color de todas las paredes desde «Color de las paredes» en la configuración de la habitación. Selecciona cualquier mueble, apertura o elemento mural para cambiar su color base; los detalles multicolor del objeto se ajustan automáticamente a tonos de ese color.
- **Movimiento y giro:** los muebles se arrastran por el suelo y, una vez seleccionados, también se pueden mover verticalmente con la flecha Y o el control «Posición Y» del inspector; pueden apilarse siempre que sus volúmenes no se solapen. Las alfombras solo se desplazan por el suelo y no admiten movimiento vertical. Los elementos de pared se mueven horizontal y verticalmente con sus ejes, se pueden cambiar de pared desde el inspector y girar con el aro en pasos de 15° (mantén `Shift` para giro libre). Usa `R` para girar 90° y `Supr`/`Retroceso` para eliminar.
- **Atajos:** la guía del inspector muestra las combinaciones y se puede minimizar. `Ctrl`/`⌘` + `Z` deshace y `Ctrl`/`⌘` + `Shift` + `Z` o `Ctrl`/`⌘` + `Y` rehace. Con un elemento seleccionado, `Ctrl`/`⌘` + `C` copia y `Ctrl`/`⌘` + `V` pega una copia; `Ctrl`/`⌘` + `D` duplica directamente. Los atajos de edición no se activan al escribir en campos de formulario.
- **Cuadrícula:** el suelo y cada pared visible tienen un control independiente para mostrar cuadrados de 25 cm; cada uno se divide en cuatro secciones lógicas de 12,5 × 12,5 cm. Los muebles se ajustan a la subcuadrícula y ventanas y elementos de pared encajan sus bordes en las líneas visibles de 25 cm.
- **Elementos:** el panel de escena lista puerta, ventanas, cuadros, estanterías de pared y muebles; desmarca su check para ocultarlos sin eliminarlos.
- **Guardado:** guarda hasta cinco diseños en `localStorage`; pulsa un diseño para abrirlo, «Guardar cambios» actualiza ese diseño y el indicador avisa si hay cambios pendientes. Desde el selector puedes crear un lienzo en blanco, duplicar el diseño actual o cambiarle el nombre; el icono de eliminar libera espacio. Los botones «Deshacer» y «Rehacer» permiten recorrer hasta 50 cambios del diseño. La vista y la orientación de cámara no se persisten.
- **Exportar:** descarga la habitación y sus elementos como un modelo 3D `.glb`, nombrado con el nombre del diseño actual y la fecha.

Todas las medidas de la interfaz están expresadas en **metros**. La habitación admite entre 3 y 10 m de anchura y profundidad, y entre 2,5 y 10 m de altura. Las aperturas se validan para mantener un margen al borde y evitar solapes.

## Pruebas

```bash
npm test
npm run test:e2e
```

La caracterización visual del catálogo se reproduce con `R2_CAPTURE_DIR=/tmp/room-builder-catalog npx playwright test --config=playwright.catalog.config.ts`; genera una captura por tipo en isométrica, planta y frontal. Los cuadros se cargan como elementos murales.

Las pruebas unitarias verifican las cuatro parejas de paredes ocultas, la geometría alrededor de puertas/ventanas, la validación de aperturas y los límites de los objetos. Las pruebas de Playwright recorren las cuatro orientaciones e interacciones principales. La primera ejecución de Playwright puede requerir instalar Chromium con `npx playwright install chromium`.

## Registro de diagnóstico

Al ejecutar el proyecto con `npm run dev`, el servidor guarda silenciosamente las acciones relevantes en `logs/interactions.log`. No añade controles ni indicadores a la interfaz y no requiere abrir la consola del navegador.

Cada línea contiene fecha, sesión y una descripción legible. Los cambios continuos —movimiento, giro, zoom o ajustes mediante una barra— se agrupan y solo escriben su último valor cuando comienza otra interacción o transcurren 1,2 segundos sin cambios. También se distinguen los clics que alcanzan muebles, aperturas, suelo o paredes de aquellos que el motor 3D considera perdidos.

Este registro es de diagnóstico y no es la fuente del historial de «Deshacer» ni del almacenamiento de diseños; ambas funciones gestionan el estado y `localStorage` por separado.

## Arquitectura

- **Guía visual obligatoria:** consulta [VISUAL_STYLE_GUIDE.md](./VISUAL_STYLE_GUIDE.md) antes de crear o modificar objetos, iconos o elementos visuales.
- **Propuesta para crear muebles desde texto:** consulta [GENERADOR_OBJETOS.md](./GENERADOR_OBJETOS.md) para el diseño por etapas y el prompt de implementación; todavía no describe una función implementada.
- `src/components/iconCatalog.tsx`: registro SVG tipado y compartido por el catálogo y el inspector.
- `src/domain/objectCatalog.ts`: catálogo local tipado con las propiedades base y capacidades de transformación de cada objeto.
- `src/domain`: tipos, constantes y geometría pura.
- `src/state`: estado de diseño, estado temporal de cámara y persistencia.
- `src/components/RoomScene.tsx`: composición de escena y reexportación compatible de las brújulas.
- `src/scene`: cámara, visibilidad, shell, aperturas, superficies, modelos, selección y gizmos de mobiliario, brújulas, órbita y adaptador GLB extraídos en R2.1–R2.9.
- `src/App.tsx`: composición del editor, coordinación de la escena y exportación.
- `src/components/editor`: cabecera y diseños guardados, paneles, controles, inspectores por selección y atajos del editor.

Las posiciones de muebles y aperturas pertenecen siempre al mundo. Cambiar de cámara solo modifica la proyección y visibilidad de paredes; no transforma los datos del diseño. La vista libre mantiene su orientación orbital como estado temporal de cámara, no como parte del diseño guardado.

## Limitaciones actuales

- Las colisiones se calculan con huellas rectangulares; no representan con precisión las formas circulares o irregulares.
- Los muebles, la puerta, las ventanas y los elementos murales tienen dimensiones predefinidas y no se pueden redimensionar desde el editor.
- Los diseños se guardan localmente en el navegador, hasta cinco por navegador. No hay importación ni exportación del proyecto editable en JSON; la descarga GLB sirve para exportar el modelo 3D.
- La vista Interior permite mirar desde la puerta, pero no caminar por la habitación.
- No hay selección múltiple ni herramientas de medición o alineación entre objetos.

## Posibles mejoras

- Importar y exportar proyectos en JSON para hacer copias de seguridad y continuar editándolos en otro navegador o equipo.
- Añadir guías de alineación y distancias para colocar los elementos con más precisión.
- Permitir redimensionar muebles y aperturas, con validación para que sigan cabiendo en la habitación.
- Incorporar selección múltiple y movimiento conjunto de elementos.
- Añadir navegación a pie por la habitación.
