import { ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from './constants'
import { isWindowShape } from './objectCatalog'
import { surfacePosition } from './roomEditing'
import { validateAxisLocks } from './axisLocks'
import type { RoomConfig, StructurePack, StructureSurface, WallOpening, WallSide, WindowConfig } from './types'

/** Apertures are local to the corresponding wall; root windows remain in RoomConfig. */
export function structurePackOpenings(pack: StructurePack, surface: StructureSurface): WallOpening[] {
  if (surface.kind !== 'wall' || !surface.wall) return []
  const doors: WallOpening[] = (pack.doors ?? []).filter((door) => door.wall === surface.wall)
    .map((door) => ({ id: door.id, kind: 'door', offset: door.offset, bottom: 0, width: door.width, height: door.height, rotation: 0, color: door.color ?? '#ac704b' }))
  const windows: WallOpening[] = (pack.windows ?? []).filter((window) => window.wall === surface.wall)
    .map((window) => ({ id: window.id, kind: 'window', shape: window.shape, offset: window.offset, bottom: window.sill, width: window.width, height: window.height, rotation: window.rotation, color: window.color ?? '#c88f58' }))
  return [...doors, ...windows]
}

/** World frame of a pack wall; local X runs along its opening offsets. */
export function structureWindowFrame(room: RoomConfig, pack: StructurePack, wallSide: WallSide) {
  const wall = pack.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === wallSide)
  if (!wall) return null
  const [x, y, z] = surfacePosition(room, wall)
  const yaw = ({ north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 } as Record<WallSide, number>)[wallSide] + wall.rotation
  return {
    x: pack.x + x, z: pack.z + z,
    floorY: pack.y + y - wall.height / 2,
    yaw, width: wall.width, height: wall.height, depth: wall.depth,
  }
}

/** Same safe margins and vertical gap as the original root-room validator. */
export function structureWindowError(pack: StructurePack): string | null {
  if (pack.windows === undefined) return null
  if (!Array.isArray(pack.windows)) return 'Ventanas de habitación inválidas.'
  const ids = new Set<string>()
  for (const window of pack.windows) {
    if (!window || typeof window.id !== 'string' || !window.id || ids.has(window.id)
      || !isWindowShape(window.shape) || !WALL_SIDES.includes(window.wall)
      || ![window.offset, window.width, window.height, window.sill, window.rotation].every((value) => typeof value === 'number' && Number.isFinite(value))
      || window.width <= 0 || window.height <= 0
      || (window.name !== undefined && (typeof window.name !== 'string' || !window.name.trim() || window.name.length > 80))
      || (window.color !== undefined && typeof window.color !== 'string')) return 'Ventanas de habitación inválidas.'
    try { validateAxisLocks(window.axisLocks) } catch { return 'Bloqueos de ventana inválidos.' }
    ids.add(window.id)
    const surface = pack.surfaces.find((wall) => wall.kind === 'wall' && wall.wall === window.wall)
    if (!surface || Math.abs(window.offset) + window.width / 2 > surface.width / 2 - ROOM_LIMITS.edgeMargin + 1e-8
      || window.sill < 0 || window.sill + window.height > surface.height - 0.08) {
      return `Una ventana queda fuera de la pared ${WALL_LABELS[window.wall]}.`
    }
    const entries = structurePackOpenings(pack, surface).filter((opening) => opening.id !== window.id)
    for (const other of entries) {
      const horizontal = Math.abs(window.offset - other.offset) < (window.width + other.width) / 2 + ROOM_LIMITS.openingGap
      const vertical = window.sill < other.bottom + other.height + ROOM_LIMITS.openingGap
        && other.bottom < window.sill + window.height + ROOM_LIMITS.openingGap
      if (horizontal && vertical) return `Dos aperturas de la pared ${WALL_LABELS[window.wall]} se solapan.`
    }
  }
  return null
}

export function packWindowById(packs: readonly StructurePack[], id: string): { pack: StructurePack; window: WindowConfig } | null {
  for (const pack of packs) {
    const window = pack.windows?.find((candidate) => candidate.id === id)
    if (window) return { pack, window }
  }
  return null
}

