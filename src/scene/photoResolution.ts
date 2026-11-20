// Límites conservadores para evitar asignaciones excesivas en el navegador.
export const PHOTO_MAX_SIDE = 4096
export const PHOTO_MAX_PIXELS = 12_000_000

export type PhotoResolution = { width: number; height: number }

/** Comprueba también el límite real del dispositivo antes de crear buffers WebGL. */
export function validatePhotoResolution(width: number, height: number, deviceMaxSide: number): PhotoResolution {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error('La anchura y la altura deben ser números enteros positivos.')
  }
  if (!Number.isSafeInteger(deviceMaxSide) || deviceMaxSide < 1) {
    throw new Error('No se ha podido comprobar el tamaño máximo de imagen del dispositivo.')
  }
  const maxSide = Math.min(PHOTO_MAX_SIDE, deviceMaxSide)
  if (width > maxSide || height > maxSide || width * height > PHOTO_MAX_PIXELS) {
    throw new Error(`La resolución es demasiado grande. El límite es ${maxSide} píxeles por lado y ${PHOTO_MAX_PIXELS.toLocaleString('es-ES')} píxeles en total.`)
  }
  return { width, height }
}
