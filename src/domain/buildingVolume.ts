import { ROOT_FLOOR_THICKNESS, ROOT_PLATFORM_THICKNESS, ROOT_PLATFORM_Y } from './constants'
import { roomVerticalBounds, worldRoomBoxes } from './roomEditing'
import type { RoomConfig, StructurePack } from './types'

type World = { room: RoomConfig; structurePacks: StructurePack[] }
export type SpatialBox = { x: number; y: number; z: number; width: number; height: number; depth: number; rotation: number }
type Volume = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
type Point = { x: number; z: number }
const epsilon = 1e-7

/** Union of room bodies, including their support thickness, never a house-wide bounding box. */
export function buildingVolumes(world: World): Volume[] {
  const packs = world.structurePacks.filter((pack) => pack.id.startsWith('floor-pack-'))
  const volumes = worldRoomBoxes(world.room, world.structurePacks).flatMap((room, index) => {
    const pack = index ? packs[index - 1] : undefined
    if (pack && !pack.surfaces.length) return []
    const bounds = roomVerticalBounds(world.room, pack)
    const thickness = (wall: string) => pack
      ? (pack.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === wall)?.depth ?? 0) / 2
      : 0.06
    return [{ minX: room.x - room.width / 2 - thickness('west'), maxX: room.x + room.width / 2 + thickness('east'),
      minZ: room.z - room.depth / 2 - thickness('north'), maxZ: room.z + room.depth / 2 + thickness('south'),
      minY: pack ? bounds.bottom : -ROOT_FLOOR_THICKNESS / 2, maxY: bounds.top }]
  })
  volumes.push({ minX: -world.room.width / 2 - 0.14, maxX: world.room.width / 2 + 0.14,
    minZ: -world.room.depth / 2 - 0.14, maxZ: world.room.depth / 2 + 0.14,
    minY: ROOT_PLATFORM_Y - ROOT_PLATFORM_THICKNESS / 2, maxY: ROOT_PLATFORM_Y + ROOT_PLATFORM_THICKNESS / 2 })
  return volumes
}

function footprint(box: SpatialBox): Point[] {
  const cosine = Math.cos(box.rotation), sine = Math.sin(box.rotation)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({
    x: box.x + x * box.width / 2 * cosine + z * box.depth / 2 * sine,
    z: box.z - x * box.width / 2 * sine + z * box.depth / 2 * cosine,
  }))
}

function clip(points: Point[], axis: 'x' | 'z', edge: number, greater: boolean): Point[] {
  const result: Point[] = []
  const inside = (point: Point) => greater ? point[axis] >= edge : point[axis] <= edge
  for (let index = 0; index < points.length; index++) {
    const from = points[(index + points.length - 1) % points.length], to = points[index]
    if (inside(from) !== inside(to)) {
      const amount = (edge - from[axis]) / (to[axis] - from[axis])
      result.push({ x: from.x + (to.x - from.x) * amount, z: from.z + (to.z - from.z) * amount })
    }
    if (inside(to)) result.push(to)
  }
  return result
}

function area(points: Point[]) {
  const origin = points[0]
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    return sum + (point.x - origin.x) * (next.z - origin.z) - (next.x - origin.x) * (point.z - origin.z)
  }, 0)) / 2
}

/** Subtract a room rectangle, retaining only uncovered convex fragments. */
function subtract(points: Point[], room: Volume): Point[][] {
  let remaining = points
  const outside: Point[][] = []
  const edges: Array<['x' | 'z', number, boolean]> = [
    ['x', room.minX - epsilon, true], ['x', room.maxX + epsilon, false],
    ['z', room.minZ - epsilon, true], ['z', room.maxZ + epsilon, false],
  ]
  for (const [axis, edge, greater] of edges) {
    const fragment = clip(remaining, axis, edge, !greater)
    if (area(fragment) > 1e-10) outside.push(fragment)
    remaining = clip(remaining, axis, edge, greater)
    if (!remaining.length) break
  }
  return outside
}

/** True only if some positive part of the oriented object occupies actual void. */
export function boxOutsideBuilding(world: World, box: SpatialBox): boolean {
  const polygon = footprint(box), bottom = box.y - box.height / 2, top = box.y + box.height / 2
  const contains = (room: Volume, point: Point) => point.x >= room.minX - epsilon && point.x <= room.maxX + epsilon
    && point.z >= room.minZ - epsilon && point.z <= room.maxZ + epsilon
  const rooms = buildingVolumes(world)
  if (rooms.some((room) => bottom >= room.minY - epsilon && top <= room.maxY + epsilon && polygon.every((point) => contains(room, point)))) return false
  const cuts = [...new Set([bottom, top, ...rooms.flatMap((room) => [room.minY, room.maxY]).filter((y) => y > bottom && y < top)])].sort((a, b) => a - b)
  for (let index = 1; index < cuts.length; index++) {
    if (cuts[index] - cuts[index - 1] < epsilon) continue
    const y = (cuts[index] + cuts[index - 1]) / 2
    let uncovered = [polygon]
    for (const room of rooms) {
      if (y < room.minY - epsilon || y > room.maxY + epsilon) continue
      uncovered = uncovered.flatMap((fragment) => subtract(fragment, room))
      if (!uncovered.length) break
    }
    if (uncovered.length) return true
  }
  return false
}
