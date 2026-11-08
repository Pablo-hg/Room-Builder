import { structureSurfaceElementId } from './elementIds'
import { elementName } from './selection'
import { structureDoorPosition } from './structureDoors'
import { furnitureSceneBox, independentSceneBoxes, sceneBoxesOverlap, type SceneCollisionBox } from './structureCollisions'
import type { RoomConfig, FurnitureItem, StructurePack, WallSide } from './types'

type SceneWorld = { room: RoomConfig; furniture: FurnitureItem[]; structurePacks: StructurePack[]; hiddenElementIds?: string[] }
type Source = { id: string; name: string; box: SceneCollisionBox; kind: 'furniture' | 'opening' | 'surface'; support?: 'floor' | 'ceiling' | 'wall'; floorY?: number }

export interface SceneCollision {
  firstId: string
  firstName: string
  secondId: string
  secondName: string
}

/** Transform the wall-local offset into world coordinates, as in wallPlacement. */
function wallBox(room: RoomConfig, wall: WallSide, offset: number, bottom: number, width: number, height: number, id: string, name: string): Source {
  const rotation = { north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 }[wall]
  const originX = wall === 'east' ? room.width / 2 : wall === 'west' ? -room.width / 2 : 0
  const originZ = wall === 'south' ? room.depth / 2 : wall === 'north' ? -room.depth / 2 : 0
  return { id, name, kind: 'opening', box: {
    id, x: originX + Math.cos(rotation) * offset, y: bottom + height / 2,
    z: originZ - Math.sin(rotation) * offset, width, height, depth: 0.18, rotation,
  } }
}

function sceneSources(world: SceneWorld): Source[] {
  const hidden = new Set(world.hiddenElementIds ?? [])
  const sources: Source[] = world.furniture.filter((item) => !hidden.has(item.id))
    .map((item) => ({ id: item.id, name: item.name, kind: 'furniture' as const, box: furnitureSceneBox(item, world), floorY: item.y }))

  const rootDoor = world.room.door
  if (!hidden.has('door')) sources.push(wallBox(world.room, rootDoor.wall, rootDoor.offset, 0, rootDoor.width, rootDoor.height, 'door', rootDoor.name || 'Puerta principal'))

  for (const [index, door] of (world.room.extraDoors ?? []).entries()) {
    if (hidden.has(door.id)) continue
    sources.push(wallBox(world.room, door.wall, door.offset, 0, door.width, door.height, door.id, door.name || `Puerta ${index + 2}`))
  }
  for (const window of world.room.windows) {
    if (hidden.has(window.id)) continue
    const name = elementName(world, window.id) ?? 'Ventana'
    sources.push(wallBox(world.room, window.wall, window.offset, window.sill, window.width, window.height, window.id, name))
  }

  for (const pack of world.structurePacks) {
    if (hidden.has(pack.id)) continue
    for (const [index, door] of (pack.doors ?? []).entries()) {
      if (hidden.has(door.id)) continue
      const wall = pack.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === door.wall)
      const position = structureDoorPosition(world.room, pack, door)
      if (!wall || !position || hidden.has(structureSurfaceElementId(pack.id, wall.id))) continue
      const rotation = { north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 }[door.wall] + wall.rotation
      sources.push({ id: door.id, name: door.name || `Puerta ${index + 1} de ${pack.name}`, kind: 'opening',
        box: { id: door.id, x: position.x, y: position.y + door.height / 2, z: position.z,
          width: door.width, height: door.height, depth: Math.max(0.14, wall.depth), rotation } })
    }
  }

  // Only free-standing surfaces participate. Room walls, ceilings and slabs are
  // supports, not objects which should trigger a warning merely by touching.
  const independent = independentSceneBoxes(world)
  for (const box of independent) {
    const pack = world.structurePacks.find((item) => item.surfaces.some((surface) => structureSurfaceElementId(item.id, surface.id) === box.id))
    const surface = pack ? pack.surfaces.find((item) => structureSurfaceElementId(pack.id, item.id) === box.id) : undefined
    if (!pack || !surface || hidden.has(pack.id) || hidden.has(box.id)) continue
    sources.push({ id: box.id, name: surface.name || pack.name, kind: 'surface', support: surface.kind, box })
  }
  return sources
}

/**
 * One entry per pair (never duplicates), including groups of three or more.
 * Uses the editor's existing oriented-box overlap predicate. Normal floor
 * contact and structural room supports are deliberately not reported.
 */
export function detectSceneCollisions(world: SceneWorld): SceneCollision[] {
  const sources = sceneSources(world)
  const collisions: SceneCollision[] = []
  for (let i = 0; i < sources.length; i += 1) {
    for (let j = i + 1; j < sources.length; j += 1) {
      const first = sources[i], second = sources[j]
      if (first.kind === 'surface' && second.kind === 'surface') continue
      const surface = first.kind === 'surface' ? first : second.kind === 'surface' ? second : null
      const other = surface === first ? second : first
      if (surface?.support === 'floor' && other.floorY !== undefined && other.floorY >= surface.box.y - 1e-6) continue
      if (surface?.support === 'floor' && other.kind === 'opening' && other.box.y - other.box.height / 2 >= surface.box.y - 1e-6) continue
      if (surface?.support === 'ceiling' && other.floorY !== undefined && other.floorY + other.box.height <= surface.box.y + 1e-6) continue
      if (!sceneBoxesOverlap(first.box, second.box)) continue
      collisions.push({ firstId: first.id, firstName: first.name, secondId: second.id, secondName: second.name })
    }
  }
  return collisions
}

export function collisionElementIds(collisions: readonly SceneCollision[]): Set<string> {
  return new Set(collisions.flatMap(({ firstId, secondId }) => [firstId, secondId]))
}
