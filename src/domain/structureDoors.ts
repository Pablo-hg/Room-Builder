import { WALL_SIDES } from './constants'
import { validateAxisLocks } from './axisLocks'
import { surfacePosition } from './roomEditing'
import type { DoorConfig, RoomConfig, StructurePack, StructureSurface, WallOpening } from './types'
import { createStructureSurface } from './structureRules'
import { structureWindowError } from './structureWindows'
import { validateFreeWallPosition, validateWallPosition } from './freeWallPosition'

export type StructureDoor = DoorConfig & { id: string }
export function rootDoorPack(room: RoomConfig): StructurePack {
  return { id: '__root__', name: 'Raíz', x: 0, y: 0, z: 0, surfaces: WALL_SIDES.map((wall) => createStructureSurface(room, `wall-${wall}`)), ...(room.extraDoors === undefined ? {} : { doors: room.extraDoors }) }
}
export function structureDoorPosition(room: RoomConfig, pack: StructurePack, door: StructureDoor) {
  if (door.wallPosition) return door.wallPosition
  const surface = pack.surfaces.find((candidate) => candidate.kind === 'wall' && candidate.wall === door.wall)
  if (!surface) return null
  const [x, y, z] = surfacePosition(room, surface)
  const angle = { north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 }[door.wall] + surface.rotation
  return { x: pack.x + x + Math.cos(angle) * door.offset, y: pack.y + y - surface.height / 2, z: pack.z + z - Math.sin(angle) * door.offset }
}
export function structureDoorOpenings(pack: StructurePack, surface: StructureSurface): WallOpening[] {
  return (pack.doors ?? []).filter((door) => door.wall === surface.wall).map((door) => ({ id: door.id, kind: 'door', offset: door.offset, width: door.width, height: door.height, bottom: 0, rotation: 0, color: door.color ?? '#ac704b' }))
}

export function structureDoorError(pack: StructurePack): string | null {
  if (pack.doors === undefined) return null
  if (!Array.isArray(pack.doors)) return 'Puertas de habitación inválidas.'
  const ids = new Set<string>()
  for (const door of pack.doors) {
    if (!door || typeof door.id !== 'string' || !door.id || ids.has(door.id) || !WALL_SIDES.includes(door.wall)
      || ![door.offset, door.width, door.height].every((number) => typeof number === 'number' && Number.isFinite(number))
      || door.width !== 1 || door.height !== 2.1 || door.rotation !== 0
      || (door.name !== undefined && (typeof door.name !== 'string' || !door.name.trim() || door.name.length > 80))
      || (door.color !== undefined && typeof door.color !== 'string')) return 'Puertas de habitación inválidas.'
    try { validateAxisLocks(door.axisLocks) } catch { return 'Bloqueos de puerta inválidos.' }
    try { validateWallPosition(door.wallPosition) } catch { return 'Posición de puerta inválida.' }
    ids.add(door.id)
    if (door.wallPosition) continue
    const wall = pack.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === door.wall)
    if (!wall) return 'La puerta no cabe en su pared.'
    const horizontalFits = wall.width >= door.width + 0.24 - 1e-9
    if (horizontalFits && Math.abs(door.offset) + door.width / 2 > wall.width / 2 - 0.12) return 'La puerta no cabe en su pared.'
    // Una habitación estrecha/baja puede contener una apertura provisional
    // fuera de su volumen; se informa visualmente, no se bloquea el tamaño.
    // La altura de esta puerta es fija. Si la pared se hace demasiado baja,
    // conservamos la apertura existente sin bloquear el cambio de habitación.
    // Una segunda puerta en el mismo tramo se considera colisión visual.
  }
  return null
}

export function structureDoorsWorldError(room: RoomConfig, packs: StructurePack[]): string | null {
  for (const pack of [rootDoorPack(room), ...packs]) {
    const error = structureDoorError(pack) || structureWindowError(pack)
    if (error) return error
  }
  return null
}
