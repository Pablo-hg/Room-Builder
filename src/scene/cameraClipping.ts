/** Plano lejano mínimo: el valor histórico del lienzo. */
export const MIN_CAMERA_FAR = 80
/** Margen para suelo, plataforma, cuadrículas y etiquetas que sobresalen. */
const FAR_MARGIN = 10

interface Point { x: number; y: number; z: number }
interface Box { x: number; y: number; z: number; width: number; depth: number; height: number }

/**
 * Plano lejano necesario para que ninguna habitación quede recortada.
 * Con salas grandes las cámaras Isométrica, Frontal y Libre se alejan más de
 * 80 m y el plano lejano fijo cortaba las paredes del fondo. Se usa la
 * esquina más lejana de cualquier habitación vista desde cualquiera de las
 * posiciones de cámara implicadas (origen y destino de una transición).
 */
export function cameraFarPlane(positions: readonly Point[], boxes: readonly Box[]): number {
  let farthest = 0
  for (const box of boxes) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const top of [0, 1]) {
      const corner = { x: box.x + sx * box.width / 2, y: box.y + top * box.height, z: box.z + sz * box.depth / 2 }
      for (const position of positions) {
        const distance = Math.hypot(corner.x - position.x, corner.y - position.y, corner.z - position.z)
        if (Number.isFinite(distance)) farthest = Math.max(farthest, distance)
      }
    }
  }
  return Math.max(MIN_CAMERA_FAR, Math.ceil(farthest + FAR_MARGIN))
}
