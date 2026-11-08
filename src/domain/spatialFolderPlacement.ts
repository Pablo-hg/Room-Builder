import { structureSurfaceElementId } from './elementIds'
import { ROOT_ROOM_FOLDER } from './elementFolders'
import { surfacePosition, worldRoomBoxes } from './roomEditing'
import type { RoomState } from '../state/types'

type SpatialState = Pick<RoomState, 'room' | 'structurePacks' | 'furniture' | 'elementFolderAssignments' | 'elementFolders'>
type Point = { x: number; y: number; z: number }

/**
 * Finds a UNIQUE room whose interior contains the element's centre.
 * A point on a shared wall, outside all rooms or inside overlapping rooms
 * is ambiguous: keep the existing manual folder instead of guessing.
 */
export function spatialRoomFolder(state: SpatialState, point: Point): string | null {
  const packs = state.structurePacks.filter((pack) => pack.id.startsWith('floor-pack-'))
  const boxes = worldRoomBoxes(state.room, state.structurePacks)
  const eps = 1e-5
  const matches: string[] = []
  boxes.forEach((box, index) => {
    if (Math.abs(point.x - box.x) >= box.width / 2 - eps
      || Math.abs(point.z - box.z) >= box.depth / 2 - eps
      || point.y <= box.y + eps || point.y >= box.y + box.height - eps) return
    const folder = index === 0 ? ROOT_ROOM_FOLDER : state.elementFolderAssignments[packs[index - 1]?.id]
    if (folder && state.elementFolders.some((item) => item.id === folder)) matches.push(folder)
  })
  return matches.length === 1 ? matches[0] : null
}

const furnitureCenter = (item: SpatialState['furniture'][number]) =>
  ({ x: item.x, y: item.y + item.height / 2, z: item.z })

/**
 * Only REAL spatial movements of pre-existing elements trigger reparenting.
 * Reordering the tree explicitly, creating a room or merely resizing objects
 * must not overwrite a folder chosen manually by the user.
 */
export function movedSceneFolderAssignments(
  before: SpatialState,
  after: SpatialState,
  furnitureChanged: boolean,
  packsChanged: boolean,
): Record<string, string> | null {
  let assignments: Record<string, string> | null = null
  const setFolder = (id: string, from: Point, to: Point) => {
    if (from.x === to.x && from.y === to.y && from.z === to.z) return
    const previousFolder = spatialRoomFolder(before, from)
    const nextFolder = spatialRoomFolder(after, to)
    if (!nextFolder || previousFolder === nextFolder) return
    if (!assignments) assignments = { ...after.elementFolderAssignments }
    assignments[id] = nextFolder
  }
  if (furnitureChanged) {
    const previous = new Map(before.furniture.map((item) => [item.id, item]))
    for (const item of after.furniture) {
      const old = previous.get(item.id)
      if (old) setFolder(item.id, furnitureCenter(old), furnitureCenter(item))
    }
  }
  if (packsChanged) {
    const previousPacks = new Map(before.structurePacks.map((pack) => [pack.id, pack]))
    for (const pack of after.structurePacks) {
      if (!pack.id.startsWith('floor-object-') && !pack.id.startsWith('wall-object-')) continue
      const oldPack = previousPacks.get(pack.id)
      if (!oldPack) continue
      for (const surface of pack.surfaces) {
        const old = oldPack.surfaces.find((candidate) => candidate.id === surface.id)
        if (!old) continue
        const oldPosition = surfacePosition(before.room, old)
        const newPosition = surfacePosition(after.room, surface)
        setFolder(structureSurfaceElementId(pack.id, surface.id),
          { x: oldPack.x + oldPosition[0], y: oldPack.y + oldPosition[1], z: oldPack.z + oldPosition[2] },
          { x: pack.x + newPosition[0], y: pack.y + newPosition[1], z: pack.z + newPosition[2] })
      }
    }
  }
  return assignments
}
