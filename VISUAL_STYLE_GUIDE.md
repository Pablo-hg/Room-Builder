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

Los modelos son funciones puras de primitivas: muebles en `src/scene/FurnitureModels.tsx` y objetos de pared (puerta, ventanas, espejos, aplique, estantería de pared y cuadros) en `src/scene/WallObjectModels.tsx`. `Openings.tsx` solo añade la colocación y la interacción. **El mismo modelo dibuja la escena y genera el icono**: no hay una segunda versión de ningún objeto.

- **Solo piezas simples:** `group`, `mesh`, geometrías básicas (caja, cilindro, cono, esfera, círculo, anillo, plano, toro, torno y cápsula) y `meshStandardMaterial`/`meshBasicMaterial`. Sin componentes con hooks ni luces: las lámparas no iluminan la escena (decisión del propietario, 14/11/2026).
- **Medidas del catálogo:** el volumen del modelo no supera en más de un 15 % el ancho, alto o fondo declarados, ni queda por debajo del 60 % de su huella (85 % de su altura en muebles de suelo).
- **Apoyo y pivote:** centrado en su huella horizontal. Los muebles de suelo apoyan en `y = 0`; los de techo tocan el techo. Los objetos de pared quedan centrados en su medida y por delante de la pared.
- **Color:** todas las piezas usan tonos derivados del color del objeto (`colorTone`). Únicos colores fijos permitidos: cristal de espejo `#dce7e4`, reflejo `#fffdf9` y tierra de maceta `#59493c`.
- **Minimalismo:** como máximo 450 caras visibles en el icono generado; curvas con pocos segmentos.
- **Sin caras coplanares solapadas:** encajar las piezas (por ejemplo, fondo y baldas entre los laterales), para que no parpadeen al mover la cámara. Las superficies abiertas (pantallas de lámpara, papelera) se dibujan por las dos caras.
- Mantener proporciones plausibles y una lectura consistente en Plano, Isométrica, Frontal y POV. Los objetos de pared tienen un espesor discreto y una cara frontal con detalles; puertas y ventanas distinguen marco, cristal y divisiones.

Estas reglas las comprueba `src/scene/modelStandards.test.ts` para **todos** los objetos del catálogo, incluidos los que se añadan.

## Iconos y miniaturas

Los iconos del catálogo, el inspector y la lista de escena **se generan desde el modelo 3D** (`src/components/modelIcon.ts`): se proyecta el modelo con la cámara isométrica de la escena (azimut 45°, elevación ≈26°) y un sombreado plano calibrado con ella (cara superior algo más clara, frontal casi igual, lateral derecha más oscura). No se dibujan a mano.

- Lienzo SVG compartido `0 0 48 42` (se muestra a 38 × 33 px), con 4 de margen; el objeto se encuadra llenando el marco. Fondo redondeado tintado con el color del objeto.
- El icono sigue el color del objeto (se recalcula con caché por tipo y color).
- Excepción: los tres cuadros mantienen un icono 2D dibujado en `ICON_CATALOG` (decisión del propietario), con el paisaje siempre dentro del lienzo interior del marco.
- Los iconos son decorativos (`aria-hidden="true"`); el nombre de la pieza sigue visible como texto.

`src/components/modelIcon.test.ts` comprueba que cada objeto tiene icono generado, encuadrado y del color del objeto.

## Alta de un objeto nuevo

1. Definirlo en `src/domain/objectCatalog.ts`: clave estable, nombre visible único en español, familia, medidas en metros, color base y anclaje.
2. Escribir su modelo con primitivas en `FurnitureModels.tsx` (mueble) o `WallObjectModels.tsx` (objeto de pared) y registrarlo en `FURNITURE_MODELS` o `standaloneOpeningModel`.
3. No dibujar icono: se genera solo. Revisar en el Catálogo que se reconoce.
4. Ejecutar los tests de catálogo, modelos e iconos (`objectCatalog`, `catalogItems`, `modelStandards`, `modelIcon`, `FurnitureModels`) y regenerar el inventario (`npx tsx scripts/catalog-inventory.ts`). Añadir su firma en `src/scene/fixtures/furniture-model-signatures.json`.
5. Comprobarlo en Plano, Isométrica, Frontal y POV: apoyo, selección, hover, gizmos, duplicado y redimensionado.

Si se cambia el tipo, color, medidas o detalles visibles de un objeto existente, el icono cambia con él; actualizar a propósito su firma de modelo y anotarlo.

## Referencias del proyecto

- Catálogo, dimensiones y colores base: `src/domain/objectCatalog.ts`.
- Modelos 3D: `src/scene/FurnitureModels.tsx` y `src/scene/WallObjectModels.tsx`; colocación e interacción de los objetos de pared: `src/scene/Openings.tsx`.
- Generación de iconos: `src/components/modelIcon.ts`; componentes de icono: `src/components/iconCatalog.tsx`.
- Estándares comprobados: `src/scene/modelStandards.test.ts` y `src/components/modelIcon.test.ts`.
- Composición del catálogo y del inspector: `src/components/editor`.
- Estilo compartido del lienzo SVG: `src/styles.css`.
