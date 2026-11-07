# Sistema de objetos, estilos y recursos

**Estado actualizado 04/11/2026:** reglas visuales CONFIRMADAS. Materiales/pintura/cuentagotas [#39](https://github.com/Pablo-hg/Room-Builder/issues/39) y editor modular de modelos [#47](https://github.com/Pablo-hg/Room-Builder/issues/47) están **aprobados para el MVP completo, no implementados**. La guía visual canónica es [VISUAL_STYLE_GUIDE.md](../VISUAL_STYLE_GUIDE.md).

## Tipos de elementos
1. **Estructura:** suelos, paredes, techos y **habitaciones conectadas** cuando se implemente #51/#52.
2. **Aberturas:** puertas, ventanas; geometría anclada a una pared.
3. **Mobiliario de suelo:** cama, mesa, escritorio, silla, sofá, armario, almacenaje.
4. **Elementos apoyados/apilables:** lámparas de mesa, plantas, jarrones, aparatos.
5. **Montados en pared/techo:** cuadros, estantes, espejos, apliques, lámparas de techo.
6. **Superficie/decoro:** alfombras y accesorios que no bloquean circulación como un mueble sólido.

**Fijación por tipo (D9/D10 confirmadas en R5.1):** las alfombras nuevas se fijan al suelo y las lámparas de techo nuevas al techo; ventanas y estantes murales pertenecen a su pared. Las lámparas de pie/mesa conservan libertad vertical. No confundir esta fijación con el candado de edición. Los muebles antiguos sin `attachmentPolicy: 'by-type'` conservan sus posiciones y movilidad anteriores por compatibilidad; los nuevos objetos creados o pegados aplican la política del catálogo. Cambiar de variante o guardar/recargar conserva esa distinción.
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

## Materiales y editor modular — tareas del MVP completo

**#39 (materiales):** biblioteca local de acabados estilizados (madera, baldosa, pintura, papel, tejidos), parámetros de tono/escala/rotación cuando apliquen, pintar superficies y copiar estilo mediante cuentagotas. Los colores actuales siguen disponibles. Guardar material/params de forma versionada y exportar sin pérdida; sin fotorrealismo.

**#47 (muebles propios):** editor de primitivas con cubos/cilindros/esferas sencillas, agrupar, duplicar, alinear y aplicar materiales #39; guardar definiciones reutilizables en biblioteca local e instancias independientes. Compatible con pivote de base RB-038 y con la futura IA, **sin necesitar IA**.

**Exclusiones:** los objetos apoyados sobre otros con grafo de dependencias (#43), presets de grupos de muebles (#44), importación GLB externo (#48) y objetos que ejecutan acciones (#50) quedan para [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md). No confundir un GLB **exportado** con la importación de GLB ajeno.

## Creador de objetos por texto
[GENERADOR_OBJETOS.md](../GENERADOR_OBJETOS.md) describe una funcionalidad EXPERIMENTAL aún no implementada. No es requisito MVP; no autoriza por sí solo instalar IA ni cambiar el contrato de objetos.

## Derechos
Referencias visuales sirven para estudiar estilos y experiencias; prohibida la copia directa de assets ajenos sin licencia compatible. Documentar origen/licencia/atribución en recursos externos.
