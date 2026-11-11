# Referencias funcionales de Room Builder — MVP completo y mejoras futuras

**Actualización:** 04/11/2026 · Referencias públicas revisadas a nivel de descripción/producto; **no es una auditoría interactiva del código o UX de terceros**. Los precios, límites y funcionalidades publicitados pueden variar.

| Referencia | Qué aporta como inspiración | Cómo se traduce a Room Builder | Qué NO copiar |
| --- | --- | --- | --- |
| [Rooms.xyz](https://rooms.xyz) | Crear, decorar, personalizar y compartir habitaciones interactivas | Entrada divertida, catálogo identificable, creación accesible y estética no intimidante | Plataforma social/remix, mecánicas y assets ajenos en el MVP |
| [MakeRoom (Steam)](https://store.steampowered.com/app/2212670/MakeRoom/) | Dioramas agradables, muebles personalizables y progresión amable | Coherencia cartoon/cozy, edición visual sencilla, aprendizaje contextual | Modelo de videojuego completo, enormes catálogos o desbloqueables |
| [MyRoomPlanner](https://www.myroomplanner.io/) | Planta 2D con medidas, composición 3D, recorridos y plantillas | Flujo claro **medir → construir → amueblar → visualizar**, dimensiones comprensibles | Render fotorrealista/IA, precios, catálogo comercial ni dependencia en nube |
| [floorplan-3d](https://github.com/wy51ai/floorplan-3d) | Planta completa SVG 2D, paredes y medidas, habitaciones, sincronización Three.js 3D y recorrido WASD, según su README | Referencia técnica funcional para el objetivo vivienda multihabitación, selector futuro de planta y datos unificados; ver [HOUSE_VISION](HOUSE_VISION.md) | Copiar su aplicación monolítica en `index.html`, su UI o dar por verificado su funcionamiento solo por el README |
| [Figma](https://www.figma.com/) | Capas, selección, operaciones múltiples y organización | Inspector contextual, selección múltiple, carpetas, guías de alineación #37 | Interfaz CAD compleja |
| [Furnish Master](https://store.steampowered.com/app/2004080/Furnish_Master/) | Libertad de diseño, colores y acabados | Materiales #39 y UX de colocación | Copiar UI/arte/recursos |
| [Diorama](https://github.com/pwsh/diorama) | Casas con habitaciones, paredes, plantas, medición, objetos propios | Contrato casa #51–#53, trazado #45, mobiliario modular #47 | Su dependencia Home Assistant y funciones de sensores |
| [Tiny Glade](https://store.steampowered.com/app/2198150/Tiny_Glade/) | Construcción intuitiva y formas arquitectónicas | Contornos y vértices #35 con estilo propio | Copiar generación procedural completa |
| [Snugtail Rooms](https://reb00t.itch.io/rooms) | Selección en espacios densos y relaciones de objetos | Inspiración para mejoras posteriores | Añadir apilamiento avanzado sin pruebas |
| [RoomPlan Pro](https://new-old-games.itch.io/roomplan-pro) | Puntos de edición de planta y esquinas | Interacción del editor #35 | Suponer curvas y CAD avanzados en MVP |

## Principio de posicionamiento
**No hacer otro Room Planner técnico ni un juego social ahora:** un editor local con espíritu de juguete de construcción, atractivo para principiantes y lo suficientemente preciso para probar disposiciones reales.

## Pruebas de benchmark por fases de MVP
1. Desde habitación vacía, evaluar cuántas decisiones requiere colocar cama/escritorio y guardarlo; comparar legibilidad, no contar solo clics.
2. Comprobar que cambiar cámara no altera geometría y que las medidas son interpretables.
3. Asegurar que iconos/modelos y feedback visual pertenecen a la misma familia; sin realismo fotográfico, sin pixel art.
4. Tomar capturas de **nuestro propio editor** para antes/después; no usar imágenes comerciales ajenas como assets.
5. Auditar teclado, móvil y errores; la belleza visual no compensa pérdida de datos.

## Funcionalidades aprobadas frente a ideas futuras

**Aprobadas para el MVP completo:** plantillas #41, cotas #26/#38, guía magnética #37, materiales #39, fotos/cámaras #40, trazado #45, editor modular #47, casa/plantas #51–#53 y recorrido WASD #36. **No están implementadas por esta documentación**.

**Solo futuro:** rayos X/#42, apilamiento #43, presets de grupos #44, puerta animada #46, GLB externo #48, ambientes dinámicos #49, objetos interactivos #50, IA automática, Workshop y monetización. Ver [FUTURE_IMPROVEMENTS](FUTURE_IMPROVEMENTS.md). No convertir ventajas comerciales de otras webs en tareas sin aprobación.

## Aplicación de referencias en F1-03 — guía de primer uso

Sin replicar interfaces ajenas, el recorrido opcional de seis pasos toma el principio de **entrada sencilla y divertida** de Rooms.xyz/MakeRoom, la secuencia «medir → construir → amueblar → visualizar» documentada para MyRoomPlanner y el **inspector contextual** de Figma. No introduce cuentas, progresión de juego, plantillas externas ni automatización. Las pruebas visuales y con usuarios siguen pendientes en la rama.
