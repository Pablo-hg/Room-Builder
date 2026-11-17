/** Caja de una habitación en coordenadas del mundo: centro en x/z, `y` en el suelo. */
export interface RoomLabelBox { x: number; y: number; z: number; width: number; depth: number; height: number }

/** Margen para el grosor del forjado entre dos plantas. */
const SLAB_TOLERANCE = 0.3
const EPSILON = 1e-6

const overlap = (a: number, aSize: number, b: number, bSize: number) =>
  Math.min(a + aSize / 2, b + bSize / 2) - Math.max(a - aSize / 2, b - bSize / 2)

/** ¿Hay otra habitación directamente encima, ocupando parte de su huella en planta? */
export function hasRoomAbove(box: RoomLabelBox, boxes: readonly RoomLabelBox[]): boolean {
  return boxes.some((other) => other.y >= box.y + box.height - SLAB_TOLERANCE
    && overlap(box.x, box.width, other.x, other.width) > EPSILON
    && overlap(box.z, box.depth, other.z, other.depth) > EPSILON)
}

/**
 * Dónde se ancla la etiqueta con el nombre de la habitación: arriba (lo habitual) o, si otra habitación
 * está justo encima, en su propio suelo. Arriba, el techo de una habitación coincide con el suelo de la
 * siguiente y el nombre parecería de la de arriba.
 */
export const roomLabelAnchor = (box: RoomLabelBox, boxes: readonly RoomLabelBox[]): 'top' | 'floor' =>
  hasRoomAbove(box, boxes) ? 'floor' : 'top'

const LABEL_LIFT = 0.35

/** Altura del mundo a la que se ancla la etiqueta. */
export const roomLabelHeight = (box: RoomLabelBox, boxes: readonly RoomLabelBox[]): number =>
  roomLabelAnchor(box, boxes) === 'floor' ? box.y + LABEL_LIFT : box.y + box.height + LABEL_LIFT
