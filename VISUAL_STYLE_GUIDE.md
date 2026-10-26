# Guía de estilo visual

> **Dirección visual actual — 26/10/2026 · CONFIRMADA para Room Builder.** Referencia principal: sencillez juguetona de Rooms.xyz y dioramas de habitaciones/casas conectadas; el aspecto buscado se acerca más a **formas geométricas sencillas** que a una miniatura de interior realista. Se permiten detalles cálidos moderados para que los muebles sean reconocibles. **No** pixel art, hiperrealismo, CAD, vóxel estricto ni texturas muy recargadas. Usar 3D simplificado y coherente entre cámaras, con colores expresivos pero controlados. Esta preferencia prevalece cuando alguna recomendación de saturación baja de esta guía se interprete de forma demasiado restrictiva; evitar neones y ruido visual, pero no convertir todo en tonos apagados.

> **Estado de las reglas:** los tokens cromáticos exactos y la biblioteca definitiva de assets están PENDIENTES. No sustituir automáticamente los estilos ya implementados sin comparación visual y revisión. Véanse [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md), [docs/OBJECTS_AND_ASSETS.md](docs/OBJECTS_AND_ASSETS.md) y [docs/DECISION_LOG.md](docs/DECISION_LOG.md).


Este documento define el lenguaje visual de los objetos 3D y sus iconos en Room Builder. **Hay que consultarlo antes de crear o modificar muebles, aperturas, decoración, miniaturas o cualquier otro elemento visual de la escena.** Si una propuesta se aparta de estas reglas, se debe justificar y actualizar esta guía en el mismo cambio.

## Principios

- **Cálido, natural y sereno:** usar tonos tierra, madera, verdes apagados y neutros cálidos. Evitar colores neón, saturación alta y contrastes duros.
- **Formas legibles:** cada elemento se reconoce primero por su silueta. Mantener geometría sencilla y proporcionada; añadir solo los detalles necesarios para distinguirlo.
- **Una sola identidad:** el icono es una representación simplificada del mismo objeto 3D, no un diseño independiente. Deben coincidir en forma principal, orientación y color.
- **Claridad antes que decoración:** los detalles no deben ocultar la función ni la silueta, ni interferir con selección, movimiento o lectura en las distintas vistas.

## Paleta y superficies

La interfaz combina fondos papel y crema (`--paper`, `--cream`), tinta verde grisácea (`--ink`), verde bosque (`--forest`) y terracota (`--accent`). Los objetos usan tonos propios, suaves y desaturados; los valores de color base se definen en `src/domain/objectCatalog.ts`.

- El color principal de un objeto debe proceder de su definición del catálogo y usarse también en su miniatura. No duplicar colores base independientes en CSS.
- Se pueden añadir tonos secundarios para estructura, contorno, tapicería, herrajes o detalles, pero deben armonizar con el color principal y la paleta cálida.
- En la escena 3D, priorizar materiales mates y naturales. El material general de muebles usa rugosidad alta (aprox. `0.78`); reservar brillo o metal para detalles pequeños que lo necesiten.
- Mantener contraste suficiente entre las partes del objeto y el fondo, sin recurrir a bordes negros o sombras pesadas.

## Objetos 3D

Los modelos se implementan en `FurnitureModel` y los elementos murales/aperturas en los componentes de escena de `src/components/RoomScene.tsx`.

- Usar geometría simple (cajas, cilindros, planos y formas básicas) ensamblada para representar piezas reconocibles: asiento y respaldo, tablero y patas, colchón y cabecero, marco y lámina, etc.
- Respetar las dimensiones en metros del catálogo. Centrar el objeto en su huella horizontal y apoyar los muebles de suelo en `y = 0`; los elementos de pared deben conservar su colocación y orientación sobre la pared.
- Mantener proporciones plausibles respecto a la habitación y a otros objetos. Las piezas que forman un mismo objeto deben quedar dentro de su ancho, fondo y altura definidos, salvo detalles mínimos justificados.
- Usar `castShadow` en las piezas que deban proyectar sombra. Evitar geometría innecesaria, superficies superpuestas que parpadeen y detalles que sobresalgan de forma accidental.
- Conservar una lectura consistente en perspectiva, planta, frontal e interior. La forma no debe depender de una sola cámara para resultar identificable.
- Los elementos montados en pared (cuadros, estantería) deben tener un espesor discreto y una cara frontal con detalles; puertas y ventanas deben distinguir marco, hoja/cristal y divisiones sin confundirse con un mueble.

## Iconos y miniaturas

Los iconos vectoriales se definen en el registro central `ICON_CATALOG` de `src/components/iconCatalog.tsx`; `FurnitureIcon` y `OpeningIcon` los muestran tanto en el catálogo como en el inspector. No dibujar una segunda versión de un icono con pseudo-elementos CSS ni duplicar la geometría en componentes.

- Mantener el lienzo compacto común de **38 × 33 px**, con el objeto centrado, margen visible y proporción reconocible. En el inspector se conserva el mismo tamaño para evitar recortes.
- Reutilizar el mismo componente para catálogo e inspector; no crear una segunda ilustración para una misma pieza.
- Usar SVG con un `viewBox` compartido de `0 0 48 42`; el tamaño reducido exige priorizar contorno, orientación y señales identificativas.
- Obtener el color principal de los muebles desde `FURNITURE_CATALOG`. Los fondos pueden ser una versión clara del color principal; contornos, patas y detalles pueden usar tonos secundarios coherentes con el modelo.
- Mantener todas las piezas dentro del `viewBox`; no recortar accidentalmente contornos, marcos, patas ni tiradores.
- Los iconos son decorativos: conservar el marcado accesible existente con `aria-hidden="true"`; el nombre de la pieza debe seguir estando visible como texto.

## Regla de correspondencia 3D–icono

Antes de dar por terminado un nuevo elemento, verificar juntos el modelo y la miniatura:

1. Tienen la misma silueta esencial y orientación reconocible.
2. Comparten el color principal definido en el catálogo.
3. Los detalles que los identifican en el modelo también aparecen simplificados en la miniatura.
4. Sus dimensiones, huella y colocación corresponden al tipo de objeto (suelo o pared).
5. Se ven completos y distinguibles en el catálogo y el inspector, y en las vistas relevantes de la escena.

Si se cambia el tipo, color, dimensiones o detalles visibles de un objeto existente, actualizar las dos representaciones en el mismo cambio. Para un objeto nuevo, registrar su definición en el catálogo, implementar su representación 3D y su miniatura, e incluir las aperturas en su representación correspondiente. No añadir primero una de las dos versiones para dejar la otra como tarea posterior.

## Referencias del proyecto

- Catálogo, dimensiones y colores base: `src/domain/objectCatalog.ts`.
- Registro único de iconos SVG y componentes reutilizables: `src/components/iconCatalog.tsx`.
- Modelos 3D y aperturas: `src/components/RoomScene.tsx`.
- Composición del catálogo y del inspector: `src/App.tsx`.
- Estilo compartido del lienzo SVG: `src/styles.css`.
