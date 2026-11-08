import type { AxisLocks, FurnitureItem, PositionAxis, WallSide } from './types'

export const POSITION_AXES: PositionAxis[] = ['x', 'y', 'z']
export const unlockedAxes = (): AxisLocks => ({ x: false, y: false, z: false })

/** Absence preserves legacy attachment behaviour; explicit locks freeze coordinates. */
export function furnitureAxisLocks(item: Pick<FurnitureItem, 'kind' | 'attachmentPolicy' | 'axisLocks'>): AxisLocks {
  return item.axisLocks ?? { x: false, y: item.attachmentPolicy === 'by-type' && ['rug', 'circularRug', 'ceilingLamp'].includes(item.kind), z: false }
}

export function validateAxisLocks(value: unknown): void {
  if (value === undefined) return
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 3
    || POSITION_AXES.some((axis) => typeof (value as AxisLocks)[axis] !== 'boolean')) {
    throw new Error('Bloqueos de posición inválidos.')
  }
}

export function openingMovementAllowed(current: { wall: WallSide; offset: number; axisLocks?: AxisLocks; sill?: number; wallPosition?: { yaw: number } }, partial: { wall?: WallSide; offset?: number; sill?: number }): boolean {
  const locks = current.axisLocks
  if (!locks) return true
  // Changing wall changes both world coordinates; keep the existing wall when either is locked.
  if (partial.wall !== undefined && partial.wall !== current.wall && (locks.x || locks.z)) return false
  if (current.wallPosition) {
    const delta = (partial.offset ?? current.offset) - current.offset
    return !(locks.x && Math.abs(delta * Math.cos(current.wallPosition.yaw)) > 1e-9)
      && !(locks.z && Math.abs(delta * Math.sin(current.wallPosition.yaw)) > 1e-9)
      && !(partial.sill !== undefined && partial.sill !== current.sill && locks.y)
  }
  const horizontal = current.wall === 'north' || current.wall === 'south' ? 'x' : 'z'
  return !(partial.offset !== undefined && partial.offset !== current.offset && locks[horizontal])
    && !(partial.sill !== undefined && partial.sill !== current.sill && locks.y)
}
