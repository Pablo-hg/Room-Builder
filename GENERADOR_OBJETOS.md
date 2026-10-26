# Generador de objetos a partir de texto

Este documento describe cómo añadir al Room Builder una herramienta para que el usuario describa un mueble, revise una propuesta y la inserte en la habitación. La implementación se plantea en dos etapas: primero un generador determinista que funciona enteramente en el navegador y no usa modelos; después, como mejora opcional, un modelo de lenguaje local que traduzca descripciones más variadas al mismo formato de objeto.

## Objetivo y límites

La herramienta convierte una descripción en un objeto 3D sencillo compuesto por piezas paramétricas conocidas. Por ejemplo:

> Una mesa redonda de madera clara, de 1,2 m de diámetro y 75 cm de alto, con pedestal central.

El resultado no es una malla arbitraria creada por IA. Es una propuesta estructurada —una mesa, un tablero circular, un pedestal y un material— que Room Builder puede validar, mostrar, editar, guardar y exportar.

El primer alcance debe favorecer la previsibilidad:

- Crear objetos de suelo con primitivas sencillas y un repertorio limitado de piezas.
- Mantener el formato de medidas del proyecto: metros.
- Permitir revisar y editar las propiedades antes de añadir el objeto.
- Validar dimensiones, piezas y límites antes de renderizar.
- No ejecutar código generado ni aceptar geometría arbitraria del texto o del modelo.
- Dejar claro qué atributos se han reconocido y pedir aclaración cuando una descripción sea ambigua.

No se pretende generar modelos fotorrealistas, texturas descargadas, mallas libres, muebles de pared ni objetos con comportamiento físico avanzado en la primera entrega.

## Dónde encaja en el proyecto

- [src/App.tsx](./src/App.tsx) contiene `SelectionInspector` y las secciones `panel-section selection-section selection-section--inspector`. Hoy el inspector se centra en el mueble o la apertura seleccionados; el creador debe seguir siendo accesible aunque no haya una selección.
- [src/domain/types.ts](./src/domain/types.ts) define `FurnitureKind`, `FurnitureItem` y `PersistedDesign`. El catálogo de muebles es una unión cerrada, por lo que un objeto construido por el usuario necesita una especificación tipada propia, no un `kind` improvisado.
- [src/domain/objectCatalog.ts](./src/domain/objectCatalog.ts) registra los tipos existentes, sus dimensiones iniciales y capacidades de transformación.
- [src/components/RoomScene.tsx](./src/components/RoomScene.tsx) contiene `FurnitureModel`, que actualmente selecciona la representación por tipo de mueble. La nueva representación debe dibujar una lista validada de primitivas y respetar las dimensiones y el origen del objeto.
- [src/domain/geometry.ts](./src/domain/geometry.ts) implementa límites de la habitación, huellas, colisiones y colocación libre. El objeto generado debe integrarse con estas funciones y no saltarse sus validaciones.
- [src/state/useRoomStore.ts](./src/state/useRoomStore.ts) gestiona alta, movimiento, selección, copia/pegado, deshacer/rehacer y diseños guardados localmente.
- [src/components/iconCatalog.tsx](./src/components/iconCatalog.tsx) comparte iconos entre catálogo e inspector. Para el objeto generado se puede usar una miniatura genérica basada en sus piezas o un icono de objeto personalizado; no se debe bloquear la creación esperando una ilustración dibujada a mano.
- [VISUAL_STYLE_GUIDE.md](./VISUAL_STYLE_GUIDE.md) define la paleta, los materiales y los requisitos visuales de los muebles.

### Ubicación propuesta en la interfaz

Crear un bloque independiente y siempre accesible llamado **Crear objeto**, dentro del panel de inspector donde se usan las secciones `selection-section--inspector`. No hacerlo depender de que haya un mueble seleccionado: seleccionar una pieza debe seguir mostrando su inspector normal sin borrar el texto o la propuesta. Se puede conservar el borrador mientras se cambia la selección.

El bloque incluye:

1. Un `textarea` con un ejemplo y un límite de longitud visible.
2. El botón **Generar propuesta**.
3. Una lista de atributos reconocidos, como tipo, forma, medidas y color.
4. Una previsualización 3D pequeña y aislada de la escena principal, o una vista previa clara de las piezas propuestas.
5. Controles para corregir los atributos permitidos.
6. El botón **Añadir a la habitación**, habilitado solo después de validar la propuesta.
7. Mensajes explícitos para descripción vacía, atributo no reconocido, propuesta no válida o falta de espacio.

Si mantener un segundo visor 3D resulta demasiado costoso o complejo en el MVP, presentar una ficha de piezas y dimensiones en vez de montar otro `Canvas`. La vista principal podrá servir para revisar el objeto después de añadirlo; no añadirlo automáticamente al pulsar «Generar propuesta».

## Modelo de datos propuesto

Separar la descripción del usuario, el resultado interpretado y la instancia colocada. El resultado de un generador debe ser datos serializables, no JSX, una función, código JavaScript ni objetos de Three.js.

Una forma inicial de la especificación:

```ts
type PrimitiveType = 'box' | 'cylinder' | 'sphere' | 'cone'

interface GeneratedPart {
  id: string
  primitive: PrimitiveType
  position: [number, number, number]
  size: [number, number, number]
  color: string
}

interface GeneratedObjectSpec {
  schemaVersion: 1
  name: string
  description: string
  width: number
  depth: number
  height: number
  color: string
  parts: GeneratedPart[]
}
```

La estructura es orientativa: ajustarla a las convenciones existentes antes de implementarla. Las dimensiones `size` deben tener un significado inequívoco por primitiva y quedar dentro de la huella y altura declaradas. Las posiciones de las piezas son locales al centro horizontal y a la base del objeto; `x`, `y` y `z` de la instancia continúan siendo la posición global que ya usa la escena. La rotación global se mantiene en el elemento de mobiliario existente.

Al incorporar la especificación a los datos de la habitación:

- Guardarla como datos ordinarios dentro de la instancia del mueble.
- Validarla al crearla y al recuperar diseños guardados.
- Preservar la lectura de diseños v1 existentes. Si hace falta ampliar el formato persistido, definir una migración explícita y probarla; no invalidar silenciosamente el almacenamiento anterior.
- Incluirla en historial, guardar/recuperar, duplicar, copiar/pegar y exportar GLB.
- Mantener un identificador único y un nombre editable.
- Rechazar cantidades no finitas, colores inválidos, arrays demasiado grandes y piezas fuera de los límites admitidos.

## Etapa 1: generación local sin modelo

Esta es la primera implementación y debe ser útil por sí misma. Toda la interpretación se ejecuta en TypeScript en el navegador; no realiza peticiones de red, no descarga pesos de modelos y no necesita API key.

### Funcionamiento

1. Normalizar la descripción: minúsculas, espacios y unidades reconocibles, conservando el texto original.
2. Reconocer un vocabulario documentado de tipos, formas, materiales/colores, dimensiones y componentes.
3. Convertir unidades a metros. Como mínimo, admitir metros, centímetros y milímetros, con reglas claras para separador decimal.
4. Elegir una plantilla de un repertorio acotado. Por ejemplo, mesa rectangular o redonda, estante sencillo, banco o taburete.
5. Aplicar atributos reconocidos a esa plantilla y completar con valores por defecto visibles.
6. Comprobar las reglas geométricas y mostrar una propuesta corregible.
7. Solo al confirmar, encontrar una posición libre mediante las funciones de geometría actuales y añadir la instancia al estado.

Ejemplos iniciales:

- «mesa redonda de madera clara, 1,2 m de diámetro y 75 cm de alto»
- «estantería verde de 80 cm de ancho, 30 cm de fondo y 1,8 m de alto, con cuatro baldas»
- «taburete terracota de 40 cm»

La interpretación no debe fingir que entiende atributos que no soporta. Si «con cajones» aún no está disponible para una plantilla, explicarlo y permitir generar el resto de la propuesta sin ese detalle o corregirla.

### Reglas para el MVP

- Empezar con pocas plantillas bien construidas, con geometría proporcional y ajustada a las dimensiones declaradas.
- Definir rangos razonables para dimensiones, cantidad de piezas y complejidad; centralizarlos y probar sus límites.
- Si falta una dimensión necesaria, aplicar un valor por defecto y marcarlo como sugerido, para que el usuario pueda revisarlo.
- Si una misma descripción produce interpretaciones razonables distintas, mostrar las opciones en vez de elegir silenciosamente.
- Mantener toda la lógica del parser pura y separada de React, Zustand y Three.js, para probar entradas y salidas de forma determinista.
- Mostrar errores concretos y recuperables; no capturar errores de forma amplia para devolver una pieza de éxito vacía.
- No intentar resolver el lenguaje libre con una cantidad creciente de expresiones regulares opacas. Mantener alias y unidades como datos legibles y ampliar el vocabulario de forma incremental.

## Etapa 2: modelo local opcional

Esta etapa se construye después de validar la primera. El modelo amplía la variedad de descripciones, pero produce exactamente la misma estructura `GeneratedObjectSpec` que el parser local. El renderizador, la validación, la edición y la persistencia no dependen del origen de la propuesta.

### Flujo

1. El usuario elige **Interpretación sencilla** o **Modelo local**, o activa el modelo desde ajustes.
2. La interfaz comprueba que el runtime/modelo está disponible en ese dispositivo y comunica claramente su estado: no instalado, descargando, listo, sin soporte o error.
3. El adaptador local recibe el texto y devuelve un objeto de datos según el esquema acordado.
4. La aplicación valida y normaliza el resultado con las mismas reglas estrictas que usa la primera etapa.
5. El usuario inspecciona y corrige la propuesta antes de insertarla.
6. Ante fallo, falta de memoria o indisponibilidad, se conserva el texto y se ofrece volver al generador determinista; no se añade un objeto por defecto como si la generación hubiera tenido éxito.

### Decisiones de producto y técnica

- No seleccionar ahora una librería o modelo sin comprobar su compatibilidad, licencia, tamaño, formato y soporte real en los navegadores objetivo.
- Mantener una interfaz/adaptador, por ejemplo `ObjectDescriptionInterpreter`, con implementaciones separadas para las reglas locales y el modelo local.
- La segunda etapa no debe hacer llamadas a servicios alojados, enviar descripciones a terceros ni requerir tokens de pago. La descarga inicial de pesos, si se ofrece, debe ser explícita, indicar tamaño y requerir consentimiento.
- Tratar la salida del modelo como entrada no fiable: validar esquema, unidades, límites, lista permitida de primitivas, cantidad de piezas y colores.
- No permitir que el modelo elija o genere código, URLs, shaders, archivos GLB ni primitivas no admitidas.
- Cargar el runtime y los pesos solo cuando se solicite el modo local, de forma dinámica, para no aumentar el peso inicial de la aplicación.
- Probar memoria, tiempo de inicio, rendimiento y compatibilidad en los dispositivos previstos antes de presentar esta opción como disponible.
- Mantener siempre disponible la generación por reglas, que no depende de WebGPU ni de que el dispositivo pueda cargar el modelo.

## Criterios de aceptación

La primera etapa se considera terminada cuando:

- Se puede crear una propuesta desde el inspector aunque no haya ningún objeto seleccionado.
- La misma descripción da el mismo resultado en ejecuciones repetidas.
- Se reconocen y convierten correctamente los ejemplos y las unidades soportadas.
- El usuario puede corregir nombre, dimensiones y color antes de insertar.
- Una descripción vacía, ambigua, demasiado larga o fuera de rango muestra un mensaje claro y no modifica la habitación.
- El objeto se representa en las vistas de escena existentes, se puede seleccionar, mover, rotar, recolorear, duplicar y eliminar.
- Las colisiones y los límites de habitación siguen impidiendo colocaciones inválidas; no se fuerza la inserción si no existe un espacio válido.
- Deshacer/rehacer, guardar/recuperar y exportar GLB conservan el objeto y sus piezas.
- Los diseños guardados antes de la función siguen cargándose.
- No hay ninguna petición de red ni dependencia de inferencia en la primera etapa.
- Las pruebas cubren parser, validación, geometría, estado/persistencia y el recorrido principal de interfaz.

La segunda etapa se considera terminada solo cuando, además:

- El modo local está realmente disponible sin API ni servicio remoto y se comunica su estado.
- Su salida se valida con el mismo esquema y no puede saltarse las restricciones del renderizador.
- Los fallos se muestran explícitamente y permiten volver a la generación por reglas sin perder el texto.
- El modelo no se descarga ni carga en memoria hasta que el usuario activa esa opción.

## Prompt listo para implementar

El siguiente prompt solicita únicamente la **Etapa 1**. La arquitectura debe dejar una frontera limpia para la segunda etapa, pero no debe instalar ni cargar un modelo local durante este primer trabajo.

```text
Implementa en este repositorio la primera etapa de un creador de muebles a partir de texto para Room Builder. Lee antes GENERADOR_OBJETOS.md, VISUAL_STYLE_GUIDE.md y los archivos relevantes del proyecto. No cambies la versión de la aplicación.

OBJETIVO
Añadir al panel de inspector una sección accesible “Crear objeto” donde el usuario describe un mueble en español, obtiene una propuesta determinista construida enteramente en el navegador, revisa y corrige sus parámetros y decide si añadirla a la habitación. No usar IA, inferencia, servicios externos, peticiones de red, API keys ni dependencias de modelos. No instalar ni descargar un modelo local en esta etapa.

INSPECCIÓN Y DISEÑO
- Revisa SelectionInspector en src/App.tsx, FurnitureItem/PersistedDesign en src/domain/types.ts, el catálogo en src/domain/objectCatalog.ts, FurnitureModel y el render de elementos en src/components/RoomScene.tsx, las funciones geométricas y el estado/persistencia en src/domain/geometry.ts y src/state/useRoomStore.ts, las pruebas existentes y VISUAL_STYLE_GUIDE.md.
- Integra la sección en la zona de inspector que usa selection-section--inspector, pero no la hagas depender de que haya un elemento seleccionado. Cambiar la selección no debe borrar un borrador o una propuesta en curso. Mantén el inspector habitual del objeto seleccionado.
- Antes de elegir el modelo de datos, sigue el patrón más simple y tipado que permita guardar una definición paramétrica personalizada sin fingir que es un FurnitureKind del catálogo.

GENERACIÓN DETERMINISTA
- Implementa un módulo puro, independiente de React/Zustand/Three.js, que traduzca texto a una propuesta de datos versionada. El mismo texto y configuración deben producir la misma propuesta.
- Empieza con un vocabulario pequeño y explícito en español y plantillas geométricas bien soportadas (por ejemplo, mesa rectangular/redonda, estantería sencilla y taburete); no intentes comprender cualquier frase.
- Reconoce tipo/plantilla, forma cuando corresponda, dimensiones y unidades m/cm/mm, número de baldas si la plantilla lo soporta y colores de una paleta cálida compatible con la guía visual. Convierte todas las medidas a metros.
- Muestra los atributos reconocidos, los valores por defecto sugeridos y cualquier atributo que no se haya entendido. Si existe ambigüedad material, pide elegir; no la ocultes.
- Usa una lista cerrada de primitivas Three.js permitidas y una lista serializable de piezas relativas al origen. No generes ni ejecutes código, JSX, shaders, URLs, mallas arbitrarias ni archivos.
- Define y aplica límites centralizados y probados para longitud de texto, dimensiones, tamaño total del objeto y número de piezas. Rechaza números no finitos, dimensiones imposibles, colores inválidos y piezas que excedan la huella/altura declaradas.

INTERFAZ Y FLUJO
- Añade un textarea etiquetado, límite de caracteres visible, una descripción de ejemplo, botón “Generar propuesta”, resultado editable y botón “Añadir a la habitación”.
- Generar propuesta no debe modificar todavía la escena. La inserción ocurre solo con confirmación explícita.
- La propuesta se debe poder revisar y corregir al menos en nombre, dimensiones y color; representa las piezas de forma legible. Evita añadir un segundo Canvas si una vista de lista/dimensiones resuelve bien el MVP.
- Deshabilita acciones cuando corresponda y muestra errores/avisos claros, accesibles y localizados en español. No descartes texto ante errores ni reportes éxito si la interpretación o inserción falla.
- Al confirmar, encuentra una posición válida usando las funciones existentes de colocación libre y colisiones. Si no hay espacio, muestra el aviso existente o uno consistente y conserva la propuesta para corregir/reintentar.
- Respeta responsive, accesibilidad, componentes y estilos existentes; consulta la guía visual para colores y materiales.

ESCENA, ESTADO Y PERSISTENCIA
- Renderiza la definición validada usando solo la allowlist de primitivas. Mantén las posiciones locales de las piezas separadas de la posición global del FurnitureItem y ajusta las piezas a las dimensiones declaradas.
- Integra el elemento con selección, movimiento, rotación, cambio de color, ocultación, copia/pegado, duplicado, eliminación y exportación GLB. Reutiliza las acciones actuales cuando sea posible.
- Incluye la especificación serializable en deshacer/rehacer y en diseños guardados. Conserva la carga de diseños existentes. Si hace falta ampliar/versionar la persistencia, implementa migración explícita y prueba la compatibilidad; no conviertas datos inválidos silenciosamente en un objeto vacío.
- Proporciona una identificación/miniatura coherente en catálogo, lista e inspector según encaje con la arquitectura. No dupliques geometría de iconos de forma inconsistente.
- Mantén una interfaz de interpretación extensible para que una etapa posterior pueda añadir un intérprete de modelo local, pero no implementes ni instales dicho modelo ahora. Ambos intérpretes futuros deberán emitir el mismo esquema y pasar por la misma validación.

PRUEBAS Y ENTREGA
- Añade pruebas unitarias deterministas para alias, unidades, valores por defecto, errores, ambigüedad, límites y validación de piezas.
- Añade pruebas para inserción/colisión, copia, deshacer/rehacer y persistencia/migración, más una prueba e2e del flujo “describir → generar → corregir o revisar → añadir”.
- Ejecuta el conjunto mínimo apropiado y después npm run build. Corrige los fallos causados por el cambio.
- No alteres trabajo ajeno ni cambios sin relación. No edites logs de interacción. No hagas commit.
- Al terminar, resume los archivos modificados, las capacidades implementadas, límites intencionados de la interpretación y comandos de validación ejecutados.
```

## Fuera del primer prompt

No mezclar la primera entrega con la instalación de un runtime de inferencia, selección de modelo, descarga de pesos, procesamiento WebGPU, controles de consentimiento para descargas ni garantías de rendimiento en móviles. Esas decisiones pertenecen a la segunda etapa y requieren medir el tamaño, licencias, compatibilidad y experiencia real del modelo candidato.
