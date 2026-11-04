# MVP — alcance y validación

> Actualización 04/11/2026: el propietario retiró las variantes del MVP. Los cambios locales que las eliminan y el redimensionado R5.2 están pendientes de validación.

**Estado:** PROPUESTO como criterio de planificación; confirmado que primero se diseña **una habitación** y después se amplía a una casa.

## MVP de habitación (primer producto útil)
El usuario debe poder **recrear y reorganizar su dormitorio** sin aprender modelado 3D. No equivale a una demo técnica con cámaras.

### Imprescindible para dar por válido el MVP
1. Iniciar habitación vacía rectangular con medidas comprensibles y editables (ancho, fondo, alto) y unidades explícitas.
2. Colocar y ajustar posición/dimensiones de puerta y ventanas; huecos geométricos coherentes, sin solapes.
3. Catálogo reducido **pero suficiente** para un dormitorio/salón básico: cama, escritorio/mesa, silla, armario/almacenaje, sofá o sillón, lámpara y decoración básica. Modelos coherentes con guía visual.
4. Modificar ancho, fondo y altura de muebles compatibles; seleccionar, arrastrar, girar, eliminar, duplicar, cambiar color y deshacer/rehacer. Ajuste a cuadrícula opcional.
5. Comunicar los atravesamientos con borde rojo; al redimensionar mobiliario se permiten, también entre muebles. Las aberturas mantienen sus restricciones constructivas.
6. Alternar Plano, Isométrica giratoria e Interior/POV desde la puerta sin mover los objetos del mundo.
7. Mantener ocultas las dos paredes próximas en isométrica; recuperación de paredes en POV. Se permiten giros de 90° y control suave si no dificulta el uso.
8. Guardar y recuperar la distribución editable. Las variantes A/B ya no son requisito del MVP.
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
- C: Guardar y recuperar una distribución con muebles y medidas editadas.
- D: Pasar por las tres cámaras y las cuatro diagonales; el mismo objeto conserva posición/rotación.
- E: Exportar editable JSON, borrar almacenamiento local de prueba, importar y recuperar la escena y sus nombres.
- F: Realizar el flujo sin consola, con mensajes entendibles y sin bloquear la edición con un tutorial.

## Regla de prioridades
P0 = funcionamiento de creación y redistribución; P1 = calidad de la experiencia visual e interacción; P2 = mejoras creativas. Un nuevo objeto o una vista avanzada no desplaza un error P0.

## Situación histórica (revisión 03/11/2026, tras R4)
Hay cinco vistas implementadas, catálogo, movimientos, construcciones simples, cinco diseños en localStorage, exportación GLB y comparación Original/Alternativa A con estructura común y guardado v5. La verificación de R5.1 se registra en [su informe](progress/R5_PROGRESS.md); no certifica todos los recorridos del producto. Faltan como mínimo el redimensionado general de muebles y JSON editable. R4 dejó el contrato multiproyecto como prototipo puro; R5 sigue en curso según [R5_PLAN.md](R5_PLAN.md). El «pack» de cuatro paredes no constituye aún una vivienda multihabitación.
