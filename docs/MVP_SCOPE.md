# MVP — alcance y validación

**Estado:** PROPUESTO como criterio de planificación; confirmado que primero se diseña **una habitación** y después se amplía a una casa.

## MVP de habitación (primer producto útil)
El usuario debe poder **recrear su dormitorio, diseñar al menos una distribución alternativa y comparar ambas** sin aprender modelado 3D. No equivale a una demo técnica con cámaras.

### Imprescindible para dar por válido el MVP
1. Iniciar habitación vacía rectangular con medidas comprensibles y editables (ancho, fondo, alto) y unidades explícitas.
2. Colocar y ajustar posición/dimensiones de puerta y ventanas; huecos geométricos coherentes, sin solapes.
3. Catálogo reducido **pero suficiente** para un dormitorio/salón básico: cama, escritorio/mesa, silla, armario/almacenaje, sofá o sillón, lámpara y decoración básica. Modelos coherentes con guía visual.
4. Modificar ancho, fondo y altura de muebles compatibles; seleccionar, arrastrar, girar, eliminar, duplicar, cambiar color y deshacer/rehacer. Ajuste a cuadrícula opcional.
5. Evitar que objetos queden fuera o se solapen de forma imposible; comunicar claramente las restricciones y distinguir objetos superpuestos de decoración/apilables.
6. Alternar Plano, Isométrica giratoria e Interior/POV desde la puerta sin mover los objetos del mundo.
7. Mantener ocultas las dos paredes próximas en isométrica; recuperación de paredes en POV. Se permiten giros de 90° y control suave si no dificulta el uso.
8. Guardar la **distribución original** y al menos una variante A/B, alternar y distinguir cambios; conservar la geometría base cuando se comparan solo muebles.
9. Persistir localmente, importar/exportar el **proyecto editable JSON** con versión/validaciones; la exportación GLB es adicional.
10. Interfaz legible y accesible en escritorio y móvil razonable, con controles alternativos a gestos; onboarding breve y opcional; sin regresiones importantes.

### No imprescindible para este MVP
- Habitación conectada, casa, paredes diagonales, forma en L, múltiples plantas.
- Caminar libremente, personas, puntuaciones, mascotas, físicas avanzadas.
- Creación por IA, subida automática de fotos/planos, cuenta, nube, colaboración y comunidad.
- Catálogo enorme, marcas o modelos comerciales exactos; hiperrealismo.
- Generación de código/modelos arbitrarios por lenguaje natural.

### Siguiente hito después del MVP de habitación
**Validación multihabitación (PROPUESTO):** 2 habitaciones rectangulares contiguas, pared compartida real, puerta de conexión y plano general. Dejar preparados identificadores/contratos desde antes; no entregar esta función como obligatoria en el MVP de habitación.

### Mini del portfolio
**FUTURO / PENDIENTE DE DECIDIR:** solo una estancia y capacidades de edición sencillas, sin convertir el diseño del visitante en el HUB auténtico.

## Flujos de aceptación (propuesta)
- A: Crear habitación con medidas conocidas, situar puerta/ventana, guardar y recargar: no se pierden datos.
- B: Añadir cama y escritorio, ajustar dimensiones, arrastrar/rotar sin colisiones imposibles.
- C: Duplicar «Original» → «Propuesta A», recolocar mobiliario y alternar sin alterar paredes ni muebles del original.
- D: Pasar por las tres cámaras y las cuatro diagonales; el mismo objeto conserva posición/rotación.
- E: Exportar editable JSON, borrar almacenamiento local de prueba, importar y recuperar la escena, nombres y variantes.
- F: Realizar el flujo sin consola, con mensajes entendibles y sin bloquear la edición con un tutorial.

## Regla de prioridades
P0 = funcionamiento de creación y redistribución; P1 = calidad de la experiencia visual e interacción; P2 = mejoras creativas. Un nuevo objeto o una vista avanzada no desplaza un error P0.

## Situación actual (revisión 26/10/2026, commit 88bd565)
Hay cinco vistas implementadas, catálogo, movimientos, construcciones simples, cinco diseños en localStorage y exportación GLB; **no** se ha validado aquí en navegador la calidad de todos los recorridos. Faltan como mínimo el redimensionado general de muebles, comparación de variantes con estructura común y JSON editable. El «pack» de cuatro paredes no constituye aún una vivienda multihabitación.
