# Experiencia de uso, interacción y cámaras

**Estado:** CONFIRMADO en filosofía y vistas esenciales; los detalles específicos de control son PROPUESTOS y deben validarse con usuarios.

## Interfaz: Rooms antes que CAD
- Al abrir: **Crear habitación**, **Abrir proyecto**, y más adelante **Mi casa**. No abrumar con propiedades avanzadas.
- Lienzo amplio como protagonista; controles visibles de modo y acciones contextuales; catálogo organizado con iconos coherentes.
- Seleccionar un mueble muestra inspector mínimo (posición, tamaño, giro, color, duplicar y eliminar), con medidas más detalladas en controles desplegables.
- El usuario puede jugar libremente sin introducir medidas, pero puede activar precisión y escribir cifras.
- Confirmaciones solo para acciones destructivas; mostrar cambios pendientes y ofrecer deshacer.
- Diseñar estados vacíos y errores útiles: «Selecciona un objeto», «No cabe en ese hueco», «Ajusta la medida», no mensajes técnicos.
- Mantener accesos por ratón, táctil y teclado. Botones con etiquetas, foco visible, contraste, objetivos táctiles cómodos y preferencia de reducir movimiento. El móvil conserva el flujo fundamental; adaptar paneles.

## Plano (top)
Cámara cenital ortográfica. Muestra huella, puertas, ventanas y distancias orientativas; facilitar colocación precisa y ver una habitación completa. No ocultar datos ni cambiar orientación global de muebles.

## Isométrica / diorama
Principal vista creativa. Girar habitación 90° con botones; también puede existir giro suave con ratón/indicador. Se ocultan las **dos paredes más cercanas a la cámara** para mostrar el interior, mientras las dos del fondo quedan. En los cuatro cuadrantes cambian las parejas; la regla debe ser consistente al girar continuamente, sin paredes apareciendo de forma arbitraria en diagonales. Separar lógica de visibilidad de paredes de lógica de objeto y de exportación.

## Interior / POV desde puerta
Cámara ligada a posición y dirección de puerta, con paredes/resto de aberturas visibles. Mirada horizontal izquierda/derecha; sin caminar libremente en el MVP. Debe servir para comprobar perspectiva y obstrucciones. No es una sustitución de una medición real ni una simulación lumínica física.

## Vistas extra existentes
El código actual incluye **Frontal** y **Libre**. Mantenerlas funcionales durante el refactor; mostrarlas como avanzadas o secundarias en el diseño renovado. No eliminarlas sin una decisión explícita y pruebas de no regresión.

## Edición
- Colocar desde catálogo: vista previa de posición, confirmación comprensible, objeto seleccionado.
- Arrastrar mueve en coordenadas del mundo; rotar conserva el pivote y huella coherentes; inspector acepta medidas editables.
- Ajuste opcional a cuadrícula, sin exigir cuadrícula siempre. Las medidas deben ser visualmente manejables.
- Colisiones: no permitir intersecciones volumétricas incompatibles; considerar excepciones intencionales como alfombras en suelo, objetos sobre superficies y apliques de pared.
- Puertas y ventanas pertenecen a una pared y tienen sus propias cotas de alto/umbral/ancho; no se añaden como muebles libres.
- Borrar, duplicar y cambios estructurales deben poder deshacerse, salvo límites documentados.

## Comparación A/B
«Original» es una variante normal protegida de ediciones involuntarias cuando se compara; duplicar crea «Propuesta A». Comparten la configuración base cuando solo se reorganizan muebles. Cambiar paredes/puertas implica distinguir edición del espacio de edición de una variante, sin mutaciones ocultas. Mostrar claramente cuál está activa y si hay cambios no guardados.

## Principio de sencillez
Un control solo debe aparecer si aporta valor inmediato en el contexto de la tarea. La accesibilidad y la corrección del modelo tienen prioridad sobre animaciones espectaculares.
