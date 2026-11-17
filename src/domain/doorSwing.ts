import type { DoorConfig, DoorSwing, PersistedDesign } from './types'

/**
 * Giro de las puertas en el Plano (#38, ampliación 16/11/2026). Es solo la representación de plano: el modelo 3D de la
 * puerta sigue cerrado. Se mide mirando la pared desde el interior de la habitación: la bisagra puede quedar a la
 * izquierda o a la derecha y la hoja se abre hacia dentro o hacia fuera de la habitación.
 */
export const DEFAULT_DOOR_SWING: DoorSwing = { hinge: 'left', side: 'inside' }

/** Giro que se dibuja: el elegido o, si la puerta no tiene ninguno, el predeterminado. */
export const doorSwingOf = (door: Pick<DoorConfig, 'swing'>): DoorSwing => door.swing ?? DEFAULT_DOOR_SWING

export const HINGE_LABELS: Record<DoorSwing['hinge'], string> = { left: 'Izquierda', right: 'Derecha' }
export const SWING_SIDE_LABELS: Record<DoorSwing['side'], string> = { inside: 'Hacia dentro', outside: 'Hacia fuera' }

export interface DoorSwingPoint { x: number; z: number }
export interface DoorSwingGeometry {
  /** Punto de la bisagra (jamba) en el marco local de la puerta: X a lo largo de la pared, Z hacia el interior. */
  hinge: DoorSwingPoint
  /** Punta de la hoja abierta a 90°. */
  leafEnd: DoorSwingPoint
  /** Extremo libre de la hoja cerrada (la otra jamba). */
  closedEnd: DoorSwingPoint
  /** Arco de un cuarto de círculo de `closedEnd` a `leafEnd`, centrado en la bisagra. */
  arc: DoorSwingPoint[]
}

/**
 * Geometría del símbolo en el marco local de la puerta (X = largo de la pared, vista desde el interior hacia la
 * derecha; Z = hacia el interior de la habitación). Función pura: se prueba sin escena.
 */
export function doorSwingGeometry(width: number, swing: DoorSwing, segments = 14): DoorSwingGeometry {
  const hingeX = swing.hinge === 'left' ? -width / 2 : width / 2
  const closedX = -hingeX
  const direction = swing.side === 'inside' ? 1 : -1
  const hinge = { x: hingeX, z: 0 }
  const closedEnd = { x: closedX, z: 0 }
  const leafEnd = { x: hingeX, z: direction * width }
  // Ángulo de la hoja cerrada medido desde la bisagra (0 o π) hasta la abierta (±π/2).
  const from = swing.hinge === 'left' ? 0 : Math.PI
  const to = swing.hinge === 'left' ? direction * Math.PI / 2 : Math.PI - direction * Math.PI / 2
  const arc = Array.from({ length: segments + 1 }, (_, index) => {
    const angle = from + (to - from) * index / segments
    return { x: hingeX + Math.cos(angle) * width, z: Math.sin(angle) * width }
  })
  return { hinge, leafEnd, closedEnd, arc }
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** Lectura estricta de `swing`: el objeto exacto con una bisagra y un lado válidos. */
export function validateDoorSwing(value: unknown): void {
  if (value === undefined) return
  if (!record(value) || Object.keys(value).length !== 2 || (value.hinge !== 'left' && value.hinge !== 'right') || (value.side !== 'inside' && value.side !== 'outside')) {
    throw new Error('El giro de una puerta no es válido.')
  }
}

/** Todas las puertas de un diseño: la principal, las adicionales de la habitación y las de cada habitación añadida. */
export function designDoors(design: Pick<PersistedDesign, 'room' | 'structurePacks'>): DoorConfig[] {
  return [design.room?.door, ...(design.room?.extraDoors ?? []), ...(design.structurePacks ?? []).flatMap((pack) => pack.doors ?? [])]
    .filter((door): door is DoorConfig => !!door && typeof door === 'object')
}

export const designHasDoorSwing = (design: Pick<PersistedDesign, 'room' | 'structurePacks'>) => designDoors(design).some((door) => door.swing !== undefined)

/** Un diseño anterior a v14 no puede traer giros de puerta; cualquier giro debe cumplir el contrato. */
export function validateDesignDoorSwings(design: Pick<PersistedDesign, 'room' | 'structurePacks' | 'version'>): void {
  for (const door of designDoors(design)) {
    validateDoorSwing(door.swing)
    if (door.swing !== undefined && design.version < 14) throw new Error('El giro de las puertas requiere un diseño v14.')
  }
}
