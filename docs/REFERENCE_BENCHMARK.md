# Referencias funcionales de Room Builder — investigación para v0.2

**Actualización:** 04/11/2026 · Referencias públicas revisadas a nivel de descripción/producto; **no es una auditoría interactiva del código o UX de terceros**. Los precios, límites y funcionalidades publicitados pueden variar.

| Referencia | Qué aporta como inspiración | Cómo se traduce a Room Builder | Qué NO copiar |
| --- | --- | --- | --- |
| [Rooms.xyz](https://rooms.xyz) | Crear, decorar, personalizar y compartir habitaciones interactivas | Entrada divertida, catálogo identificable, creación accesible y estética no intimidante | Plataforma social/remix, mecánicas y assets ajenos en el MVP |
| [MakeRoom (Steam)](https://store.steampowered.com/app/2212670/MakeRoom/) | Dioramas agradables, muebles personalizables y progresión amable | Coherencia cartoon/cozy, edición visual sencilla, aprendizaje contextual | Modelo de videojuego completo, enormes catálogos o desbloqueables |
| [MyRoomPlanner](https://www.myroomplanner.io/) | Planta 2D con medidas, composición 3D, recorridos y plantillas | Flujo claro **medir → construir → amueblar → visualizar**, dimensiones comprensibles | Render fotorrealista/IA, precios, catálogo comercial ni dependencia en nube |
| [floorplan-3d](https://github.com/wy51ai/floorplan-3d) | Planta completa SVG 2D, paredes y medidas, habitaciones, sincronización Three.js 3D y recorrido WASD, según su README | Referencia técnica funcional para el objetivo vivienda multihabitación, selector futuro de planta y datos unificados; ver [HOUSE_VISION](HOUSE_VISION.md) | Copiar su aplicación monolítica en `index.html`, su UI o dar por verificado su funcionamiento solo por el README |
| [Figma](https://www.figma.com/) | Capas, selección, operaciones múltiples y organización | Modelo mental de inspector contextual, selección múltiple, carpetas y atajos | Interfaz CAD/profesional compleja, menús densos sin jerarquía |

## Principio de posicionamiento
**No hacer otro Room Planner técnico ni un juego social ahora:** un editor local con espíritu de juguete de construcción, atractivo para principiantes y lo suficientemente preciso para probar disposiciones reales.

## Pruebas de benchmark que sí conviene hacer en G3/G6
1. Desde habitación vacía, evaluar cuántas decisiones requiere colocar cama/escritorio y guardarlo; comparar legibilidad, no contar solo clics.
2. Comprobar que cambiar cámara no altera geometría y que las medidas son interpretables.
3. Asegurar que iconos/modelos y feedback visual pertenecen a la misma familia; sin realismo fotográfico, sin pixel art.
4. Tomar capturas de **nuestro propio editor** para antes/después; no usar imágenes comerciales ajenas como assets.
5. Auditar teclado, móvil y errores; la belleza visual no compensa pérdida de datos.

## Ideas futuras no aprobadas
Plantillas de estancia, biblioteca ampliada, walk-through, objetos creados por IA, publicación y monetización. Mantenerlas en [FUTURE_ROADMAP](FUTURE_ROADMAP.md). No convertir ventajas de otras webs en requisitos P0.
