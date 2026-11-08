import { ROOT_FLOOR_THICKNESS, ROOT_PLATFORM_THICKNESS, ROOT_PLATFORM_Y } from './constants'
import { roomVerticalBounds } from './roomEditing'
import { enclosedPackFootprint } from './roomEnclosure'
import { subtractPolygon, wallRectangle, type WallPolygon } from './connectedWallGeometry'
import type { RoomConfig, StructurePack } from './types'

type World = { room: RoomConfig; structurePacks: StructurePack[] }
export type SpatialBox = { x: number; y: number; z: number; width: number; height: number; depth: number; rotation: number }
type Volume = { polygon: WallPolygon; minY: number; maxY: number }
type Point = { x: number; z: number }
const epsilon = 1e-7
const rectangle = (minX: number, maxX: number, minZ: number, maxZ: number) => wallRectangle(minX, maxX, minZ, maxZ)

/** Spatial union of actually enclosed rooms, not a fallback box when a wall moves. */
export function buildingVolumes(world: World): Volume[] {
  const root = world.room
  const volumes: Volume[] = [{
    polygon: rectangle(-root.width / 2 - 0.06, root.width / 2 + 0.06, -root.depth / 2 - 0.06, root.depth / 2 + 0.06),
    minY: -ROOT_FLOOR_THICKNESS / 2, maxY: root.height,
  }]
  for (const pack of world.structurePacks) {
    if (!pack.id.startsWith('floor-pack-')) continue
    const polygon = enclosedPackFootprint(root, world.structurePacks, pack)
    if (!polygon) continue
    const bounds = roomVerticalBounds(root, pack)
    volumes.push({ polygon, minY: bounds.bottom, maxY: bounds.top })
  }
  volumes.push({
    polygon: rectangle(-root.width / 2 - 0.14, root.width / 2 + 0.14, -root.depth / 2 - 0.14, root.depth / 2 + 0.14),
    minY: ROOT_PLATFORM_Y - ROOT_PLATFORM_THICKNESS / 2, maxY: ROOT_PLATFORM_Y + ROOT_PLATFORM_THICKNESS / 2,
  })
  return volumes
}

function footprint(box: SpatialBox): Point[] {
  const cosine = Math.cos(box.rotation), sine = Math.sin(box.rotation)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({
    x: box.x + x * box.width / 2 * cosine + z * box.depth / 2 * sine,
    z: box.z - x * box.width / 2 * sine + z * box.depth / 2 * cosine,
  }))
}

/** Subtract a convex room footprint, including moved or rotated walls. */
function subtract(points: Point[], room: Volume): Point[][] {
  return subtractPolygon(points.map((point): [number, number] => [point.x, point.z]), room.polygon)
    .map((polygon) => polygon.map(([x, z]) => ({ x, z })))
}

/** True only if some positive part of the oriented object occupies actual void. */
export function boxOutsideBuilding(world: World, box: SpatialBox): boolean {
  const polygon = footprint(box), bottom = box.y - box.height / 2, top = box.y + box.height / 2
  const contains = (room: Volume) => subtract(polygon, room).length === 0
  const rooms = buildingVolumes(world)
  if (rooms.some((room) => bottom >= room.minY - epsilon && top <= room.maxY + epsilon && contains(room))) return false
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
