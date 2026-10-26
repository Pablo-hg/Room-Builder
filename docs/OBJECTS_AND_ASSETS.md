# Sistema de objetos, estilos y recursos

**Estado:** reglas de consistencia CONFIRMADAS; ampliaciones marcadas PROPUESTAS. La guía visual canónica es [VISUAL_STYLE_GUIDE.md](../VISUAL_STYLE_GUIDE.md).

## Tipos de elementos
1. **Estructura:** suelos, paredes, techos (cuando proceda), futuras habitaciones conectadas.
2. **Aberturas:** puertas, ventanas; geometría anclada a una pared.
3. **Mobiliario de suelo:** cama, mesa, escritorio, silla, sofá, armario, almacenaje.
4. **Elementos apoyados/apilables:** lámparas de mesa, plantas, jarrones, aparatos.
5. **Montados en pared/techo:** cuadros, estantes, espejos, apliques, lámparas de techo.
6. **Superficie/decoro:** alfombras y accesorios que no bloquean circulación como un mueble sólido.
La clasificación en el código actual está repartida entre FurnitureKind, WindowShape, StructureSurface/Pack; **no** asumir que esta taxonomía documental ya está implementada como sistema nuevo.

## Contrato conceptual de cada objeto
- ID estable por instancia; tipo/definición distinta de la instancia; nombre legible.
- Dimensiones expresadas en metros (ancho, fondo, alto) y puntos de apoyo/anclaje.
- Posición XYZ del mundo; rotación/pivote; color base/material estilizado.
- Categoría y capacidades explícitas: mover en suelo, elevar/apilar, fijar en pared, montar en techo, rotar, redimensionar, cambiar pared, borrar.
- Reglas de límites/colisión según volumen real o proxy documentado. Un objeto decorativo no debe heredar por error la física de un armario.
- Representación visual y miniatura coherentes, con mismo color y silueta; textos accesibles independientes de iconos.
- Validación de datos al crear, copiar, importar, migrar y exportar.

## Política visual para modelos
**CONFIRMADO:** estilo 3D low-poly estilizado, ligero, tipo diorama; más cerca del ejemplo geométrico sencillo (estancias conectadas coloridas) que del dormitorio detallado, pero con calidez y personalidad. No realista, no pixel art, no vóxel rígido. Sombras suaves, siluetas legibles, colores agradables y materiales mayoritariamente mates. Una habitación debe verse bien sin adornos.

**Reglas de creación:** geometría razonablemente escasa, proporciones plausibles; detalles secundarios solo si explican función. Nunca mejorar una única cámara a costa de romper planta/POV. Comprobar render de un nuevo modelo en 3 vistas, selección, giro, tamaño, icono y colisiones.

## Formatos de assets (PROPUESTO)
- **SVG:** iconos de catálogo, preferentemente centralizados en el registro actual.
- **GLB/glTF:** modelos complejos puntuales, optimizados y licencia documentada; evitar uno por cada objeto básico si primitivas permiten buen resultado.
- **PNG/WebP:** imágenes o texturas ilustradas cuando aporten valor y tamaños optimizados; no depender de fotos realistas.
- **JSON tipado:** definiciones paramétricas y datos serializables; no permitir JSX, shaders o scripts recibidos como datos.
- Assets versionados/nombrados por tipo; no subir a la web archivos fuente enormes ni texturas de alta resolución innecesarias.

## Catálogo y ampliación
El código actual contiene un catálogo de muebles y aberturas en src/domain/objectCatalog.ts. Mantenerlo como fuente de propiedades implementadas hasta el refactor. Antes de dar por cerrado un objeto: definición, geometría, miniatura, capacidades, interacción, guardado, exportación y pruebas de visibilidad.

**Primer catálogo suficiente:** cama, escritorio/mesa, silla, armario, estantería, sillón/sofá, lámpara y accesorios sencillos. Evitar inflarlo con cien variaciones antes de poder **redimensionar** los esenciales.

## Creador de objetos por texto
[GENERADOR_OBJETOS.md](../GENERADOR_OBJETOS.md) describe una funcionalidad EXPERIMENTAL aún no implementada. No es requisito MVP; no autoriza por sí solo instalar IA ni cambiar el contrato de objetos.

## Derechos
Referencias visuales sirven para estudiar estilos y experiencias; prohibida la copia directa de assets ajenos sin licencia compatible. Documentar origen/licencia/atribución en recursos externos.
