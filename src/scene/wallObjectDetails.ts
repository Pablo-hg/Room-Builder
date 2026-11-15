// Geometría pura de detalles de objetos de pared (sin React ni three), para poder
// comprobar con tests que cada detalle queda dentro de su pieza.

const GLINT_ANGLE = 0.55

export interface Glint { x: number; y: number; length: number; angle: number }

/**
 * Reflejo diagonal de un espejo rectangular, calculado para que la franja completa
 * (largo y grosor) quede dentro del cristal con un margen, sea cual sea su tamaño.
 * Devuelve null si el cristal es demasiado pequeño para dibujarlo.
 */
export function mirrorGlint(glassWidth: number, glassHeight: number, stripeWidth: number): Glint | null {
  const sin = Math.sin(GLINT_ANGLE)
  const cos = Math.cos(GLINT_ANGLE)
  const margin = 0.08 * Math.min(glassWidth, glassHeight)
  const x = -0.15 * glassWidth
  const y = 0.1 * glassHeight
  const byWidth = 2 * (glassWidth / 2 - margin - Math.abs(x) - (stripeWidth / 2) * cos) / sin
  const byHeight = 2 * (glassHeight / 2 - margin - Math.abs(y) - (stripeWidth / 2) * sin) / cos
  const length = Math.min(byWidth, byHeight, glassHeight * 0.62)
  return length > stripeWidth ? { x, y, length, angle: -GLINT_ANGLE } : null
}

/** Extensión (semiancho, semialto) de una franja girada, para comprobaciones. */
export function glintHalfExtent(glint: Glint, stripeWidth: number) {
  const sin = Math.abs(Math.sin(glint.angle))
  const cos = Math.abs(Math.cos(glint.angle))
  return { x: (glint.length / 2) * sin + (stripeWidth / 2) * cos, y: (glint.length / 2) * cos + (stripeWidth / 2) * sin }
}

export interface ShelfBook { key: string; position: [number, number, number]; size: [number, number, number]; tone: number }

/** Medidas de la estructura de la estantería de pared (coinciden con su modelo en Openings.tsx). */
export function wallShelfFrame(width: number, height: number) {
  return {
    shelfY: height * 0.28,
    shelfThickness: Math.min(0.075, height * 0.15),
    sideX: width * 0.46,
    sideWidth: Math.min(0.065, width * 0.08),
    backFront: 0.04,
  }
}

// [inicio como fracción del hueco interior, ancho como fracción, alto como fracción del hueco libre, tono]
const LOWER_BOOKS = [[0.05, 0.05, 0.78, -0.12], [0.11, 0.045, 0.68, 0.22], [0.165, 0.06, 0.86, -0.28], [0.24, 0.045, 0.72, 0.3], [0.58, 0.05, 0.8, -0.05], [0.64, 0.055, 0.7, 0.22]] as const
const UPPER_BOOKS = [[0.62, 0.05, 0.8, 0.22], [0.68, 0.045, 0.7, -0.28], [0.735, 0.055, 0.85, -0.12]] as const

/**
 * Libros de la estantería de pared: de pie sobre cada balda, sin atravesar la balda
 * superior ni salirse de los laterales, el fondo o el borde delantero.
 */
export function shelfBooks(width: number, height: number, shelfDepth: number): ShelfBook[] {
  const frame = wallShelfFrame(width, height)
  const innerLeft = -frame.sideX + frame.sideWidth / 2
  const innerWidth = 2 * (frame.sideX - frame.sideWidth / 2)
  const depth = (shelfDepth - frame.backFront) * 0.75
  const z = frame.backFront + depth / 2 + 0.01
  const row = (books: typeof LOWER_BOOKS | typeof UPPER_BOOKS, bottom: number, gap: number, name: string) => books.map(([start, widthShare, heightShare, tone], index): ShelfBook => {
    const bookHeight = gap * heightShare
    const bookWidth = innerWidth * widthShare
    return { key: `${name}-${index}`, position: [innerLeft + innerWidth * start + bookWidth / 2, bottom + bookHeight / 2, z], size: [bookWidth, bookHeight, depth], tone }
  })
  const lowerBottom = -frame.shelfY + frame.shelfThickness / 2
  const upperBottom = frame.shelfY + frame.shelfThickness / 2
  return [
    ...row(LOWER_BOOKS, lowerBottom, frame.shelfY - frame.shelfThickness / 2 - lowerBottom, 'abajo'),
    ...row(UPPER_BOOKS, upperBottom, height / 2 - upperBottom, 'arriba'),
  ]
}
