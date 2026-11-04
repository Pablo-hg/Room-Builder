# Visión de producto — Room Builder

**Estado:** CONFIRMADO en visión general; detalles técnicos indicados como PROPUESTO.

## Problema que resuelve
Quiero representar mi habitación —sus dimensiones, puertas, ventanas y muebles— y experimentar en segundos con otras distribuciones sin mover nada en la realidad. Otros usuarios también podrán crear espacios imaginarios por diversión. El editor debe dar confianza espacial, pero sentirse como un juego.

## Promesa principal
**«Crea, decora y reinventa tus espacios.»**

Una herramienta para construir habitaciones con la sencillez de un videojuego: estética alegre y geométrica, interacción directa, medidas editables bajo demanda y transición inmediata entre distribución en plano y visualización en 3D.

## Usuarios y trabajos
1. **Quien reorganiza una habitación real:** mide aproximadamente su espacio, añade muebles de dimensiones ajustables, guarda el original y prueba alternativas A/B.
2. **Quien juega a decorar:** comienza de cero, coloca muebles visualmente y crea una habitación inventada.
3. **Futuro — quien construye una vivienda:** enlaza estancias y explora su planta o casa completa; no debe necesitar un CAD.

## Dos productos relacionados, no dos motores independientes
- **Room Builder completo (producto independiente):** primero una habitación; después viviendas con varias estancias conectadas. El código debe permitir evolucionar sin rehacerlo.
- **Room Builder Mini (idea para el Laboratorio de Pablo Web 2.0):** edición simplificada de una sola habitación, catálogo acotado y navegación contextual. Integración y fecha aún PENDIENTES. No modificar el repositorio del portfolio desde aquí.

## Imagen de destino: de una habitación a una casa completa (04/11/2026)

**Decisión de visión:** el usuario debe poder empezar por una habitación sin comprometerse a crear una casa y, a partir de ella, **escalar a un proyecto residencial por plantas**, con habitaciones contiguas, paredes/puertas compartidas, vista aérea acotada de una planta, selector de planta y transición a 3D y POV. La imagen aportada por el propietario ilustra el resultado funcional objetivo, no un diseño que deba copiarse.

La meta final de producto ha sido descrita como el **MVP completo de vivienda**. Para no introducir una ampliación masiva en un release en curso, **v0.2 mantiene el MVP inicial de una habitación**, mientras que el siguiente gran hito local es el constructor de casas por etapas. Ver [HOUSE_VISION.md](HOUSE_VISION.md). El Workshop continúa separado.

## Referencias, no objetivos de clonación
- **Rooms.xyz:** principal referencia de tono, facilidad, espíritu juguetón, diorama, selección y personalización sencillas.
- **Room Studio:** referencia secundaria para medidas reales, aberturas, datos de planta, comparación de distribuciones y exportación.
- **MakeRoom:** referencia creativa de interacción accesible, personalización de muebles y estética de diorama; no adoptar sus misiones como requisito del editor.
- **[MyRoomPlanner](https://www.myroomplanner.io/es):** referencia funcional para pasar de medidas y plano 2D a mobiliario en 3D, comprobar distribuciones y visualizar espacios antes de mover muebles reales; no es nuestra referencia estética.
- **Los Sims / modo construcción:** inspiración por facilidad de colocar y mover mobiliario; no se busca simulación de personas.
- **[floorplan-3d](https://github.com/wy51ai/floorplan-3d):** referencia funcional futura para plano SVG de vivienda completa, cotas, muros, vistas Three.js y paseo con WASD; no adoptar sin más su arquitectura monolítica.
No copiar interfaz exacta, código ni arte de estas referencias.

## Diferenciador
La precisión debe existir **debajo** de una interacción comprensible; las medidas reales, vistas y comparación permiten tomar decisiones. No hace falta replicar la marca o modelo exacto de cada mueble: basta aproximar dimensiones y volumen, y ver cómo encaja.

## Principios de producto
- Primero crear **una habitación útil y agradable**; no construir una casa completa en el MVP inicial.
- Un resultado legible y atractivo incluso con geometría sencilla.
- Construcción directa: añadir, seleccionar, mover, girar, redimensionar, ocultar y deshacer.
- No hacer al usuario configurar un motor ni completar tutoriales obligatorios.
- Tres vistas esenciales: **Plano, Isométrica, Interior/POV desde la puerta**. Herramientas avanzadas disponibles solo cuando aporten valor.
- No engañar con precisión: el plan es orientativo, no plano constructivo certificado.
- Estado local y control del usuario. Sin servidor o cuentas en el MVP.
- Preparar la extensión futura a habitaciones conectadas sin implementarla prematuramente.

## No es
Un renderizador fotorrealista, software profesional CAD/BIM, un juego pixel art, un simulador de vida, una tienda de muebles ni una comunidad social en la primera versión.


## Referencia funcional futura: MyRoomPlanner — revisión 03/11/2026

**Estado:** REFERENCIA / ANÁLISIS, no funcionalidad aprobada ni cambio de alcance. Se incorpora a las referencias que deberán revisarse durante la auditoría posterior a R5. La página comercial puede variar con el tiempo y no se ha realizado una evaluación interactiva completa del editor.

**Fuentes oficiales:** [Web del producto](https://www.myroomplanner.io/es), [creador de planos](https://www.myroomplanner.io/es/floor-plan-maker) y [explicación de los renders con IA](https://www.myroomplanner.io/ai-room-render).

### Qué presenta la web y por qué es relevante

- Dibujo de paredes con medidas, ubicación de puertas y ventanas, y transición entre plano 2D y habitación 3D.
- Colocación de muebles a escala, acabados de suelo/pared y previsualización desde diferentes perspectivas.
- Ejemplos o plantillas para comenzar, recorrido a altura de los ojos, enlaces compartibles y posibilidad de aportar modelos GLB, según las capacidades o planes disponibles.
- Renders de inspiración mediante IA: **la imagen puede reinterpretar materiales y muebles** y no garantiza reproducir exactamente la geometría del editor. No equivale a un proyecto 3D editable ni a un plano técnico certificado.
- Las cifras de catálogo y condiciones comerciales cambian; **no** incorporarlas como requisitos, límites ni comparaciones duraderas de Room Builder.

### Aprendizajes potenciales para nuestro editor

1. Facilitar el camino **medir → dibujar → amueblar → comprobar → probar una alternativa**, sin obligar a comprender herramientas 3D avanzadas.
2. Investigar **plantillas opcionales** (dormitorio, salón y habitación vacía) para reducir la fricción del primer uso, sin quitar la creación desde cero.
3. Mostrar **medidas, escala y posibles conflictos** en el momento de editar, sin convertir el producto en CAD.
4. Priorizar la claridad de catálogos, edición de dimensiones y transición entre plano y perspectiva; estudiar después un recorrido interior más flexible.
5. Evaluar estas ideas con pruebas de uso reales antes de planificar nuevos controles o sustituir la interfaz actual.

### Qué no debemos copiar ni priorizar

- Su interfaz concreta, identidad visual, código, contenidos, modelos o flujos comerciales.
- Un gran catálogo como sustituto de un editor fácil de usar.
- El renderizado fotorrealista por IA, que **no es objetivo del MVP ni requisito para v0.2**.
- Una arquitectura ligada a cuentas o servidores que rompa el uso local del editor.

**Síntesis de referencias:** Rooms.xyz inspira creatividad e interactividad; MakeRoom, sencillez visual y personalización; MyRoomPlanner, distribución práctica y medidas reales. Room Builder conserva su identidad de **diorama geométrico cartoon/cozy**, interacción accesible y organización modular inspirada en editores como Figma. Ninguna referencia implica clonación.

## Visión futura: creación de objetos propios mediante texto e IA

**Decisión de producto:** se desea que, **en una fase futura**, el usuario pueda describir con sus palabras un mueble u objeto y obtener una propuesta 3D que cumpla las normas visuales de Room Builder. Se mantiene **RB-014 en estado EXPERIMENTAL** porque no se ha decidido el alcance técnico final, proveedor de IA, fecha ni autorización de desarrollo.

**Ejemplo orientativo:** «Una estantería de madera clara, de 1,5 m de ancho, con cuatro baldas y dos cajones inferiores, bordes redondeados». El sistema interpreta la intención, propone medidas y piezas, permite revisarlas y genera un objeto acorde al lenguaje visual del editor. Si no puede representar cajones u otro detalle, debe explicarlo, no fingir que lo ha generado.

### Experiencia esperada

1. El usuario abre **Crear objeto**, escribe una descripción libre en español y, si procede, aporta medidas aproximadas.
2. Obtiene una **propuesta revisable**: nombre, dimensiones en metros, materiales/colores de nuestra paleta y vista previa, sin introducir nada todavía en la habitación.
3. Puede corregir atributos, confirmar y colocar el objeto. El resultado debe funcionar como el resto del mobiliario: seleccionar, mover, girar, redimensionar cuando el tipo lo permita, recolorear, duplicar y deshacer.
4. Puede **guardar el objeto como propio y reutilizarlo** en otros diseños, con almacenamiento local y exportación/importación editables cuando existan contratos compatibles.
5. En una evolución adicional, podrá editar **piezas internas** (baldas, patas, cajones y similares), siempre que el modelo sea paramétrico y sus componentes lo permitan.

**Restricción fundamental:** que algo se genere desde texto no significa que cualquier descripción pueda convertirse automáticamente en una malla 3D arbitraria. La primera familia de objetos debe tener geometría estructurada, piezas soportadas y límites claros. La generación de formas orgánicas complejas requeriría un enfoque distinto y no está comprometida.

### Estética obligatoria y calidad

- Respetar [VISUAL_STYLE_GUIDE.md](../VISUAL_STYLE_GUIDE.md): formas reconocibles simplificadas, materiales mate, colores coherentes, proporciones legibles y ausencia de hiperrealismo por defecto.
- Separar la **descripción interpretada** de la **especificación geométrica validada** y de la **instancia colocada**; la IA no debe modificar directamente el estado, ejecutar código ni producir shaders/URLs arbitrarias.
- Validar dimensiones, posiciones, número de piezas, tipo de primitivas, colisiones, cargas guardadas y límites de rendimiento antes de mostrar o persistir modelos.
- Mantener compatibilidad con las vistas, historial, guardado/recuperación, duplicación, exportación y futuros cambios de formato; no alterar diseños antiguos silenciosamente.
- Ser accesible para usuarios sin conocimientos de modelado: explicar atributos no comprendidos, ofrecer corrección manual y permitir cancelar o volver atrás sin perder el texto.

### Desarrollo posible por fases (PROPUESTA, no autorización)

| Fase futura | Enfoque | Alcance |
| --- | --- | --- |
| G1 | **Constructor paramétrico por reglas, sin IA** | Un conjunto pequeño de muebles, piezas y dimensiones; funciona localmente y establece el contrato editable. |
| G2 | **Interpretación del texto libre con IA** | Un modelo interpreta la descripción y devuelve el **mismo contrato estructurado**; validación y vista previa independientes del modelo. |
| G3 | **Editor de piezas y biblioteca personal** | Ajustar componentes, reutilizar objetos, preservar autoría y compatibilidad de datos. |
| G4 | **Referencia mediante imagen (opcional)** | Investigar si una imagen ayuda a identificar formas/medidas, con advertencias sobre exactitud, derechos y privacidad. **No está decidido incluir subida de imágenes.** |
| G5 | **Compartición en Workshop (futuro distinto)** | Publicar o importar objetos solo cuando exista infraestructura, licencias, moderación y permisos adecuados. |

**IA y despliegue todavía por decidir:** [GENERADOR_OBJETOS.md](../GENERADOR_OBJETOS.md) describe en detalle una primera fase determinista y propone como segunda fase un **modelo local opcional**. Eso no demuestra que el modelo exista ni obliga a elegir ahora un proveedor o un servicio remoto. Se debe estudiar la viabilidad local (descarga, memoria, navegadores y consumo); cualquier alternativa remota requeriría una decisión explícita sobre privacidad, cuotas, costes y consentimiento. El comportamiento determinista y las herramientas de edición no dependerán de que haya IA disponible.

**Diferencia con MyRoomPlanner:** un render con IA produce una **imagen de inspiración** de la habitación; esta propuesta busca un **objeto 3D reutilizable y editable** que forme parte de la escena y respete sus medidas y reglas. Son funcionalidades distintas, no intercambiables.

### Frontera con el plan vigente

- No pertenece a **R5**, ni al conjunto imprescindible de la **v0.2**, ni al editor Mini inicial.
- No se deben crear issues de implementación, instalar librerías, introducir APIs, desplegar servicios, cambiar el formato persistido ni modificar el estilo visual por este apartado.
- La auditoría **E0** y las etapas de arquitectura de [v0.2](roadmaps/v0.2/ROADMAP_Y_PROMPTS_V0_2.md) pueden **tenerlo en cuenta como extensibilidad futura**, sin adelantar su desarrollo ni bloquear la versión.
- Antes de activarlo: definir escenarios de uso, capacidades mínimas, prueba de viabilidad, costes y límites, modelo de datos, rendimiento y fases independientes. Validar por separado la posible entrada por imagen.
