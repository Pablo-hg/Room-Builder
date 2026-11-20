import type { PhotoResolution } from '../scene/photoResolution'

export function photoGuide(viewLabel: string, { width, height }: PhotoResolution) {
  return `Referencias de Room Builder

1. Abre una herramienta que pueda generar imágenes a partir de una imagen adjunta.
2. Adjunta referencia.png (${viewLabel}, ${width} × ${height} px). Si la herramienta admite JSON y quieres dar más contexto, adjunta también diseno.json, que contiene el diseño editable y sus medidas en metros.
3. Copia el prompt completo de abajo, sustituye los ejemplos por tus preferencias y envíalo. Debe solicitar tanto la imagen realista como el comparador interactivo.
4. Descarga la imagen realista y el comparador que te entregue la herramienta. Si te pide aportar la imagen generada de nuevo, adjúntala en el mismo chat y solicita que complete el comparador.
5. Abre el comparador siguiendo sus instrucciones. Comprueba que el deslizador se mueve y revisa puertas, ventanas, muebles y proporciones. Si solo ves una imagen fija, pide que cree el comparador interactivo.

Prompt para copiar

Quiero dos entregables: (1) una imagen realista de mi diseño y (2) un comparador interactivo de antes y después. Completa ambos pasos o explícame qué necesitas para terminarlos.

PASO 1 — IMAGEN REALISTA
Genera una imagen realista a partir de referencia.png. Si es un plano, mantén la vista cenital. Conserva el encuadre, la perspectiva, las proporciones, la distribución, la posición de los muebles y los huecos de puertas y ventanas visibles. Mantén los tamaños relativos y la misma proporción de imagen. Usa diseno.json como contexto adicional solo si lo he adjuntado y puedes leerlo.

Estilo: [por ejemplo, mediterráneo contemporáneo]
Iluminación: [por ejemplo, luz natural cálida de tarde]
Acabados: [por ejemplo, paredes de cal y roble claro]
Otros cambios que autorizo: [indica cuáles o escribe ninguno]

Si un detalle queda fuera de la imagen o es ambiguo, conserva la composición y evita añadir elementos que cambien la distribución.

PASO 2 — COMPARADOR INTERACTIVO
Crea un comparador de antes y después (split screen slider) con la referencia original y la imagen realista generada en el paso 1. Las dos imágenes deben quedar superpuestas y alineadas en el mismo encuadre, conservando su proporción. Coloca el deslizador inicialmente en el centro y permite moverlo con ratón, pantalla táctil y teclado. Etiqueta los lados «Diseño original» e «Imagen realista». El resultado debe ser interactivo: una imagen fija de un deslizador no cumple este paso.

Entrega el comparador como archivo HTML que pueda abrirse localmente en un navegador, junto con la imagen realista descargable. El HTML debe poder cargar ambas imágenes desde el dispositivo mediante selectores de archivo y funcionar sin conexión, sin dependencias externas. Si puedes entregarlo con las imágenes ya incorporadas, incluye también los selectores como alternativa. Da instrucciones breves para abrirlo y seleccionar referencia.png y la imagen generada. Si no puedes acceder a la imagen creada en el paso 1, pídeme que la descargue y adjunte para completar el comparador. Si no puedes entregar un archivo HTML, proporciona su código completo y explica cómo guardarlo y abrirlo.

El resultado depende de la herramienta que elijas. Puede reinterpretar detalles y medidas, así que úsalo como visualización. El comparador también depende de que dicha herramienta pueda entregar una imagen y un archivo HTML funcional.
`
}

export async function createPhotoPackage(png: Blob, designJson: string, guide: string) {
  const { zipSync, strToU8 } = await import('fflate')
  const bytes = zipSync({
    'referencia.png': [new Uint8Array(await png.arrayBuffer()), { level: 0 }],
    'diseno.json': strToU8(designJson),
    'guia-y-prompt.txt': strToU8(guide),
  })
  return new Blob([new Uint8Array(bytes)], { type: 'application/zip' })
}

export function downloadPhotoFile(file: Blob, filename: string) {
  const url = URL.createObjectURL(file)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
