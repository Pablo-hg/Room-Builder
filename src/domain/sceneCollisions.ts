import { structureSurfaceElementId } from './elementIds'
import { elementName } from './selection'
import { furnitureOutsideRoom, furnitureSceneBox, independentSceneBoxes, independentSurfaceOutsideRoom, sceneBoxesOverlap, type SceneCollisionBox } from './structureCollisions'
import type { RoomConfig, FurnitureItem, StructurePack } from './types'
import { wallObjectBox, wallObjects } from './wallObjectPlacement'
import { openingCutsOverlap, openingHasSupport, openingWallRun, physicalWalls, wallIntersectionIsCut, wallsConnected, worldOpenings } from './wallConnections'
import { boxOutsideBuilding } from './buildingVolume'

type SceneWorld = { room: RoomConfig; furniture: FurnitureItem[]; structurePacks: StructurePack[]; hiddenElementIds?: string[] }
type Source = { id: string; name: string; box: SceneCollisionBox; kind: 'furniture' | 'opening' | 'surface'; support?: 'floor' | 'ceiling' | 'wall'; floorY?: number }

export interface SceneCollision {
  firstId: string
  firstName: string
  secondId: string
  secondName: string
}

export interface SceneOutsideIssue { id: string; name: string }

function sceneSources(world: SceneWorld): Source[] {
  const hidden = new Set(world.hiddenElementIds ?? [])
  const sources: Source[] = world.furniture.filter((item) => !hidden.has(item.id))
    .map((item) => ({ id: item.id, name: item.name, kind: 'furniture' as const, box: furnitureSceneBox(item, world), floorY: item.y }))

  for (const opening of worldOpenings(world)) {
    if (hidden.has(opening.id)) continue
    const position = opening.position
    const cosine = Math.abs(Math.cos(opening.rotation)), sine = Math.abs(Math.sin(opening.rotation))
    sources.push({ id: opening.id, name: elementName(world, opening.id) ?? 'Apertura', kind: 'opening',
      box: { id: opening.id, x: position.x, y: position.y + opening.height / 2, z: position.z,
        width: opening.width * cosine + opening.height * sine, height: opening.height * cosine + opening.width * sine,
        depth: 0.18, rotation: position.yaw } })
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
  for (const wall of physicalWalls(world)) {
    if (sources.some((source) => source.id === wall.id) || hidden.has(wall.id) || wall.packId && hidden.has(wall.packId)) continue
    sources.push({ id: wall.id, name: elementName(world, wall.id) ?? 'Pared', kind: 'surface', support: 'wall',
      box: { ...wall, y: wall.y + wall.height / 2, rotation: wall.yaw } })
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
  const openings = new Map(worldOpenings(world).map((opening) => [opening.id, opening]))
  const collisions: SceneCollision[] = []
  for (let i = 0; i < sources.length; i += 1) {
    for (let j = i + 1; j < sources.length; j += 1) {
      const first = sources[i], second = sources[j]
      const surface = first.kind === 'surface' ? first : second.kind === 'surface' ? second : null
      const other = surface === first ? second : first
      if (first.support === 'wall' && second.support === 'wall') {
        const firstWall = physicalWalls(world).find((wall) => wall.id === first.id)!
        const secondWall = physicalWalls(world).find((wall) => wall.id === second.id)!
        const roomWall = (packId?: string) => !packId || packId.startsWith('floor-pack-')
        if (wallsConnected(firstWall, secondWall) || roomWall(firstWall.packId) && roomWall(secondWall.packId)) continue
      }
      if (surface?.support === 'wall' && other.kind === 'opening') {
        const opening = openings.get(other.id)
        // Una ventana, cuadro o espejo ANCLADO forma parte de la pared.
        // No es una colisión estructural aunque dos paredes se toquen o
        // se superpongan; los objetos separados de la pared sí colisionan.
        if (opening?.kind === 'window' && !opening.object.freePosition) continue
        // Las puertas conservan la comprobación de paredes sin paso real.
        if (opening && openingWallRun(world, opening).some((wall) => wall.id === surface.id)) continue
      }
      if (surface?.support === 'floor' && other.floorY !== undefined && other.floorY >= surface.box.y - 1e-6) continue
      if (surface?.support === 'floor' && other.kind === 'opening' && other.box.y - other.box.height / 2 >= surface.box.y - 1e-6) continue
      if (surface?.support === 'ceiling' && other.floorY !== undefined && other.floorY + other.box.height <= surface.box.y + 1e-6) continue
      let openingOverlap: boolean | undefined
      if (first.kind === 'opening' && second.kind === 'opening') {
        const a = openings.get(first.id)!, b = openings.get(second.id)!
        const realCut = (opening: typeof a) => !opening.object.freePosition && (opening.kind === 'door' || opening.shape === 'rectangular' || opening.shape === 'circular')
        if (realCut(a) && realCut(b) && openingWallRun(world, a).some((wall) => openingWallRun(world, b).some((other) => other.id === wall.id))) {
          openingOverlap = openingCutsOverlap(world, a.id, b.id)
        }
      }
      if (!(openingOverlap ?? sceneBoxesOverlap(first.box, second.box))) continue
      if (surface?.support === 'wall' && other.kind === 'furniture' && wallIntersectionIsCut(world, surface.id, other.box)) continue
      collisions.push({ firstId: first.id, firstName: first.name, secondId: second.id, secondName: second.name })
    }
  }
  return collisions
}

/** List only elements entirely or partially outside every room, not normal contact. */
export function detectOutsideRoom(world: SceneWorld): SceneOutsideIssue[] {
  const hidden = new Set(world.hiddenElementIds ?? [])
  const outside: SceneOutsideIssue[] = []
  for (const { window, pack } of wallObjects(world)) {
    if (window.freePosition && !hidden.has(window.id) && (!pack || !hidden.has(pack.id)) && boxOutsideBuilding(world, wallObjectBox(world.room, window, pack))) {
      outside.push({ id: window.id, name: elementName(world, window.id) ?? 'Elemento mural' })
    }
  }
  for (const item of world.furniture) {
    if (!hidden.has(item.id) && furnitureOutsideRoom(world, item)) outside.push({ id: item.id, name: item.name })
  }
  for (const pack of world.structurePacks) {
    if (!pack.id.startsWith('floor-object-') && !pack.id.startsWith('wall-object-')) continue
    if (hidden.has(pack.id)) continue
    for (const surface of pack.surfaces) {
      const id = structureSurfaceElementId(pack.id, surface.id)
      if (!hidden.has(id) && independentSurfaceOutsideRoom(world, id)) {
        outside.push({ id, name: elementName(world, id) ?? surface.name })
      }
    }
  }
  return outside
}

export function collisionElementIds(collisions: readonly SceneCollision[]): Set<string> {
  return new Set(collisions.flatMap(({ firstId, secondId }) => [firstId, secondId]))
}

/** Orphaned anchors remain editable and are never mistaken for objects in the void. */
export function detectUnsupportedOpenings(world: SceneWorld): SceneOutsideIssue[] {
  const hidden = new Set(world.hiddenElementIds ?? [])
  return worldOpenings(world).filter((opening) => !hidden.has(opening.id) && !opening.object.freePosition
    && !openingHasSupport(world, opening)).map((opening) => ({ id: opening.id, name: elementName(world, opening.id) ?? 'Apertura' }))
}
