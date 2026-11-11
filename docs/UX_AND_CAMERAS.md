# Experiencia de uso, interacción y cámaras

## F1-03: guía interactiva opcional de primer uso (11/11/2026)

**Implementación en rama `feature/F1-03-simplificar-uso-controles`, pendiente de pruebas manuales y certificación.**

- En la primera apertura sin diseños locales, aparece una **invitación que no bloquea el editor**. El usuario puede empezar el recorrido, pulsar «Ahora no» o seguir trabajando; interactuar fuera de la invitación la descarta.
- El recorrido visual resalta los controles reales del editor en **seis pasos**: medidas, puertas/ventanas, mobiliario, inspector de selección, vistas y guardado. No crea objetos ni modifica la geometría, ni exige seguir una secuencia obligatoria.
- «Siguiente», «Anterior», «Saltar guía» y «Finalizar» permiten salir en cualquier momento; Escape también cierra el recorrido. El diálogo gestiona el foco del teclado y se posiciona de forma adaptativa en escritorio y móvil.
- El usuario puede iniciar el recorrido de nuevo desde **Inspector y configuración detallada → ¿Necesitas ayuda? → Ver guía de primer uso**.
- La preferencia se guarda exclusivamente en `room-builder:first-use-guide:v1`. No altera `room-builder:v0.1:designs`, no requiere cuenta, red, herramientas de terceros ni cambios de formato. Los usuarios que ya tienen diseños locales no reciben una invitación inesperada.
- Si el navegador bloquea `localStorage`, la guía no interfiere con el editor; puede reabrirse manualmente. No se utilizan CDN, scripts externos ni telemetría.

**Criterio de calidad:** comprobar el recorrido mediante ratón, teclado (Tab, Mayús+Tab, Escape), vista de 390 px, paneles desplazables, recarga tras saltar y reapertura. No declarar aprobado sin dichas pruebas. No ocultar Frontal, Libre o funciones avanzadas ni sustituir los controles originales.


> **Vigente 04/11/2026:** la comparación A/B se retiró del MVP por RB-040. El contenido antiguo de comparación está reemplazado por nota de compatibilidad. Según RB-039 y RB-041, los muebles se pueden atravesar y se muestra advertencia roja; no bloquear esos movimientos por colisión.


**Estado:** base de vistas existentes CONFIRMADA; guías, anotaciones, fotos y recorrido libre **aprobados como MVP completo, pendientes de desarrollo**. Checkpoint v0.2 = cámara desde puerta fija; MVP final = POV WASD #36.

## Interfaz: Rooms antes que CAD
- Al abrir: **Crear habitación**, **Abrir proyecto**, y tras F4 **Mi casa** dentro del mismo proyecto. No abrumar con propiedades avanzadas.
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
**Checkpoint v0.2:** cámara ligada a posición y dirección de puerta, con paredes/resto de aberturas visibles. Mirada horizontal izquierda/derecha; **sin caminar libremente todavía**. Debe servir para comprobar perspectiva y obstrucciones. No es una sustitución de una medición real ni una simulación lumínica física.

### Evolución comprometida en el MVP completo: POV WASD (#36)
El POV fijo desde la puerta **no se elimina** al certificar v0.2. Está registrada la evolución a una vista de recorrido libre con **W/S** para avanzar/retroceder, **A/D** para desplazarse lateralmente y mirada de cámara con ratón/controles alternativos. Se inicia en la puerta de entrada. Si el proyecto contiene varias puertas, se identificará o seleccionará la **entrada al recorrido**; las puertas interiores servirán para transitar continuamente entre habitaciones conectadas sin resetear la cámara. Se requiere no atravesar paredes, gestión segura de aberturas, accesibilidad y estado de cámara independiente del diseño. El recorrido de una habitación puede implementarse antes de las casas; la transición multiestancia se implementa tras #51/#52 con medianera única RB-027. Véase [issue #36](https://github.com/Pablo-hg/Room-Builder/issues/36).

## Vistas extra existentes
El código actual incluye **Frontal** y **Libre**. Mantenerlas funcionales durante el refactor; mostrarlas como avanzadas o secundarias en el diseño renovado. No eliminarlas sin una decisión explícita y pruebas de no regresión.

## Edición
- Colocar desde catálogo: vista previa de posición, confirmación comprensible, objeto seleccionado.
- Arrastrar mueve en coordenadas del mundo; rotar conserva el pivote y huella coherentes; inspector acepta medidas editables.
- Ajuste opcional a cuadrícula, sin exigir cuadrícula siempre. Las medidas deben ser visualmente manejables.
- Intersecciones: se permiten entre muebles y se señalan mediante borde rojo (RB-039/RB-041); las restricciones de aperturas y decoración mural siguen reglas constructivas distintas. No tratar un mueble atravesado como error que impida guardar.
- Puertas y ventanas pertenecen a una pared y tienen sus propias cotas de alto/umbral/ancho; no se añaden como muebles libres.
- Borrar, duplicar y cambios estructurales deben poder deshacerse, salvo límites documentados.

## Variantes históricas (sin UI en el MVP)
La comparación Original/Alternativa A se implementó durante R5.1, pero **el propietario la retiró del MVP** el 04/11/2026 (RB-040). El editor local muestra una distribución activa; leer diseños v5 históricos no debe provocar pérdida de mobiliario, por lo que la compatibilidad se conserva y se comprueba en pruebas de importación. No reintroducir selector ni edición de variantes por seguir este histórico.

## Principio de sencillez
Un control solo debe aparecer si aporta valor inmediato en el contexto de la tarea. La accesibilidad y la corrección del modelo tienen prioridad sobre animaciones espectaculares.


## Herramientas de precisión y presentación comprometidas
- [#37](https://github.com/Pablo-hg/Room-Builder/issues/37): guías inteligentes **en Plano e Isométrica**, con magnetismo configurable independiente del snap de cuadrícula; `Alt` suspende la atracción. Guías no bloquean solapes intencionales.
- [#38](https://github.com/Pablo-hg/Room-Builder/issues/38): regla entre dos puntos, cotas guardadas/editables y ajuste a geometría. Las **cotas del perímetro** las implementa #26; no duplicarlas.
- [#40](https://github.com/Pablo-hg/Room-Builder/issues/40): modo foto con composición, resolución/proporción/fondo y **cámaras guardadas**; el proyecto persistirá su definición versionada.
- [#41](https://github.com/Pablo-hg/Room-Builder/issues/41): plantillas editables vacías, amuebladas y propias; la inserción de una estancia dentro de casa se integra en #52.
- [#45](https://github.com/Pablo-hg/Room-Builder/issues/45): imagen de plano con escala calibrada, líneas/esquinas sugeridas y trazado corregible; no interpretación automática.

**Vivienda:** la vista Plano pasará de habitación individual a **planta global**, con selección de estancia y selector de nivel (#52/#53). No crear otra escena ni otra unidad de medida. La interacción detallada debe validarse con usuario antes de completar F4.

## F1-03: claridad de controles y gestión de diseños (11/11/2026)

**Implementación de la rama F1-03; pendiente de validación manual y E2E específicos.** Se diferencia la sección «Construir habitación» de «Añadir objetos» en el catálogo, manteniendo los mismos controles, iconos y categorías; el inspector vacío explica cómo editar una selección y dónde se encuentran las dimensiones. La barra de vistas identifica el grupo «Ver» sin ocultar las vistas avanzadas.

La barra inferior refleja el estado **real** del diseño (sin guardar, cambios sin guardar, guardado). La biblioteca muestra un encabezado y conserva «Crear»/«Importar» como acciones directas; el texto explicativo se mueve a una ayuda desplegable para reducir ruido. La selección de un diseño que ya está abierto deja de volver a cargarlo y de generar una confirmación innecesaria, para no perder modificaciones accidentales. Se habilita navegación por flechas/Home/End dentro de la lista de diseños y apertura mediante flechas desde el selector. El formulario de creación indica inline cuando falta el nombre.

**Contraste con referencias:** seguir un orden visual «medir/construir → amueblar → visualizar → guardar» de la comparativa de MyRoomPlanner y la sencillez de acceso al catálogo de Rooms.xyz/MakeRoom, sin clonar sus interfaces; conservar el inspector contextual de inspiración Figma y la estética de la guía visual vigente. No se cambian escenas, geometría, datos de guardado ni vistas.
