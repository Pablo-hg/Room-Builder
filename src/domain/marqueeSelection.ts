export type MarqueePoint = { x: number; y: number; z: number }
export type MarqueeBox = { id: string; min: MarqueePoint; max: MarqueePoint }
export type ScreenRect = { left: number; top: number; right: number; bottom: number }

/** Por debajo de este recorrido (px) un arrastre se considera un simple clic. */
export const MARQUEE_MIN_DRAG = 5

export function normalizedRect(a: { x: number; y: number }, b: { x: number; y: number }): ScreenRect {
  return { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) }
}

function boxCorners(box: MarqueeBox): MarqueePoint[] {
  const { min, max } = box
  return [min.x, max.x].flatMap((x) => [min.y, max.y].flatMap((y) => [min.z, max.z].map((z) => ({ x, y, z }))))
}

/**
 * Devuelve los elementos cuya caja, proyectada en pantalla, toca el rectángulo.
 * Es una selección «por contacto»: no hace falta rodear el objeto entero.
 * `project` devuelve `null` para puntos detrás de la cámara.
 */
export function marqueeHits(boxes: readonly MarqueeBox[], project: (point: MarqueePoint) => { x: number; y: number } | null, rect: ScreenRect) {
  const hits: string[] = []
  for (const box of boxes) {
    const points = boxCorners(box).map(project)
    if (points.some((point) => !point)) continue
    const xs = points.map((point) => point!.x)
    const ys = points.map((point) => point!.y)
    if (Math.max(...xs) < rect.left || Math.min(...xs) > rect.right || Math.max(...ys) < rect.top || Math.min(...ys) > rect.bottom) continue
    hits.push(box.id)
  }
  return hits
}
