import { WALL_SIDES } from './constants'
import { validateAxisLocks } from './axisLocks'
import { surfacePosition } from './roomEditing'
import type { DoorConfig, RoomConfig, StructurePack, StructureSurface, WallOpening } from './types'
import { createStructureSurface } from './structureRules'
import { structureWindowError } from './structureWindows'

export type StructureDoor = DoorConfig & { id: string }
export function rootDoorPack(room: RoomConfig): StructurePack {
  return { id: '__root__', name: 'Raíz', x: 0, y: 0, z: 0, surfaces: WALL_SIDES.map((wall) => createStructureSurface(room, `wall-${wall}`)), ...(room.extraDoors === undefined ? {} : { doors: room.extraDoors }) }
}
export function structureDoorPosition(room: RoomConfig, pack: StructurePack, door: StructureDoor) {
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
    ids.add(door.id)
    const wall = pack.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === door.wall)
    if (!wall || Math.abs(door.offset) + door.width / 2 > wall.width / 2 - 0.12 || door.height > wall.height - 0.08) return 'La puerta no cabe en su pared.'
    if (pack.doors.some((other) => other !== door && other.wall === door.wall && Math.abs(other.offset - door.offset) < (other.width + door.width) / 2 + 0.12)) return 'Las puertas de la pared se solapan.'
  }
  return null
}

/** Do not cut one of two overlapping walls and pretend that it creates a passage. */
export function hasCoincidentWall(room: RoomConfig, packs: StructurePack[], pack: StructurePack, surface: StructureSurface): boolean {
  if (surface.kind !== 'wall' || !surface.wall) return false
  const position = surfacePosition(room, surface)
  const horizontal = surface.wall === 'north' || surface.wall === 'south'
  const angle = (horizontal ? 0 : Math.PI / 2) + surface.rotation
  const entries = [{ id: '__root__', x: 0, y: 0, z: 0, surfaces: WALL_SIDES.map((wall) => ({
    ...surface, wall, rotation: 0, x: 0, y: 0, z: 0,
    width: wall === 'north' || wall === 'south' ? room.width : room.depth, height: room.height,
  })) }, ...packs]
  return entries.some((otherPack) => otherPack.id !== pack.id && otherPack.surfaces.some((other) => {
    if (other.kind !== 'wall' || !other.wall) return false
    const otherHorizontal = other.wall === 'north' || other.wall === 'south'
    const otherAngle = (otherHorizontal ? 0 : Math.PI / 2) + other.rotation
    if (Math.abs(Math.sin(angle - otherAngle)) > 1e-6) return false
    const otherPosition = surfacePosition(room, other)
    const dx = otherPack.x + otherPosition[0] - pack.x - position[0]
    const dz = otherPack.z + otherPosition[2] - pack.z - position[2]
    const normalDistance = Math.abs(-Math.sin(angle) * dx + Math.cos(angle) * dz)
    const alongDistance = Math.abs(Math.cos(angle) * dx + Math.sin(angle) * dz)
    return normalDistance < (surface.depth + other.depth) / 2 + 1e-6
      && alongDistance < (surface.width + other.width) / 2 - 1e-6
      && Math.abs(otherPack.y + otherPosition[1] - pack.y - position[1]) < (surface.height + other.height) / 2 - 1e-6
  }))
}

export function structureDoorsWorldError(room: RoomConfig, packs: StructurePack[]): string | null {
  for (const pack of [rootDoorPack(room), ...packs]) {
    const error = structureDoorError(pack) || structureWindowError(pack)
    if (error) return error
    for (const door of pack.doors ?? []) {
      const wall = pack.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === door.wall)!
      if (hasCoincidentWall(room, packs, pack, wall)) return 'La pared de una puerta coincide con otra pared. Resuelve la medianera antes de abrir el paso.'
    }
  }
  return null
}
