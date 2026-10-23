# Room Builder v0.1

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
- **Perspectiva:** vista isométrica. Mantén pulsado el indicador inferior y arrástralo horizontalmente para orbitar de forma continua alrededor del centro de la habitación. Los botones laterales conservan giros exactos de 90°. En cada diagonal se ocultan las dos paredes próximas a la cámara.
- **Zoom:** coloca el cursor sobre la escena y usa la rueda: hacia arriba para acercar y hacia abajo para alejar. El nivel se limita entre 55 % y 200 % y se muestra junto a los controles de cámara.
- **Frontal:** cámara exterior lejana orientada hacia una pared y centrada de frente a 1,35 m. El selector funciona como un gizmo 3D: pulsa una cara del cubo para verla de frente, el cono verde para ir a Plano, los conos X/Z para sus vistas frontales o cualquiera de los cuatro conos violetas diagonales —orientados hacia el vértice opuesto— para saltar a una vista isométrica. El cubo transparente colorea las caras visibles. Las transiciones recorren un arco suave y la barra permite situar la cámara entre 1,35 y 7,5 m de altura.
- **Planta:** cámara ortográfica cenital con el mismo sistema de coordenadas.
- **Interior:** cámara situada en la puerta a 1,65 m de altura. Las flechas permiten mirar hasta 55° a cada lado; no hay movimiento libre.
- **Objetos:** pulsa un elemento del catálogo para añadirlo. Haz clic o toca para seleccionarlo y arrástralo sobre el suelo en Perspectiva o Planta.
- **Giro y borrado:** arrastra el aro para girar en pasos de 15° y mantén `Shift` para hacerlo libremente. Usa el botón o la tecla `R` para girar 90°, y `Supr`/`Retroceso` para eliminar.
- **Cuadrícula:** el suelo y cada pared visible tienen un control independiente para mostrar cuadrados de 25 cm; cada uno se divide en cuatro secciones lógicas de 12,5 × 12,5 cm. Los muebles se ajustan a la subcuadrícula y las ventanas encajan sus cuatro bordes en las líneas visibles de 25 cm.
- **Elementos:** el panel de escena lista puerta, ventanas y muebles; desmarca su check para ocultarlos sin eliminarlos.
- **Guardado:** guarda y recupera el diseño en `localStorage`. La vista y la orientación de cámara no se persisten.

Todas las medidas de la interfaz están expresadas en **metros**. La habitación admite entre 3 y 10 m de anchura y profundidad. Las aperturas se validan para mantener un margen al borde y evitar solapes.

## Pruebas

```bash
npm test
npm run test:e2e
```

Las pruebas unitarias verifican las cuatro parejas de paredes ocultas, la geometría alrededor de puertas/ventanas, la validación de aperturas y los límites de los objetos. Las pruebas de Playwright recorren las cuatro orientaciones e interacciones principales. La primera ejecución de Playwright puede requerir instalar Chromium con `npx playwright install chromium`.

## Registro de diagnóstico

Al ejecutar el proyecto con `npm run dev`, el servidor guarda silenciosamente las acciones relevantes en `logs/interactions.log`. No añade controles ni indicadores a la interfaz y no requiere abrir la consola del navegador.

Cada línea contiene fecha, sesión y una descripción legible. Los cambios continuos —movimiento, giro, zoom o ajustes mediante una barra— se agrupan y solo escriben su último valor cuando comienza otra interacción o transcurren 1,2 segundos sin cambios. También se distinguen los clics que alcanzan muebles, aperturas, suelo o paredes de aquellos que el motor 3D considera perdidos.

## Arquitectura

- `src/domain`: tipos, constantes y geometría pura.
- `src/state`: estado de diseño, estado temporal de cámara y persistencia.
- `src/components/RoomScene.tsx`: cámaras, habitación, paredes y mobiliario React Three Fiber.
- `src/App.tsx`: controles, paneles y composición de la interfaz.

Las posiciones de muebles y aperturas pertenecen siempre al mundo. Cambiar de cámara solo modifica la proyección y visibilidad de paredes; no transforma los datos del diseño.

## Limitaciones de la v0.1

- El catálogo contiene ocho muebles geométricos, además de puerta y ventana.
- Las colisiones usan la huella rectangular de cada mueble; todavía no contemplan formas irregulares.
- Puerta y ventanas usan dimensiones predefinidas; en esta versión se editan su pared y posición.
- El guardado es local al navegador y ofrece una única ranura.
- El POV permite mirar, pero no caminar.

## Ideas para v0.2

- Colisiones suaves y alineación a paredes/otros objetos.
- Varias ranuras de proyecto, exportación e importación JSON.
- Catálogo ampliable con miniaturas y dimensiones editables.
- Indicadores visuales de puertas y ventanas en planta.
- Historial de deshacer/rehacer y selección múltiple.
