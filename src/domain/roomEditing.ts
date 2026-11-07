import { BASE_ROOM_SURFACE_IDS, folderElementIds, folderIdFromSelection } from './elementFolders'
import { structureSurfaceElementId } from './elementIds'
import { WALL_SIDES } from './constants'
import type { RoomState } from '../state/types'
import type { RoomConfig, StructurePack, StructureSurface } from './types'

const close = (a: number, b: number) => Math.abs(a - b) < 1e-6
export function surfacePosition(room: RoomConfig, surface: StructureSurface): [number, number, number] {
  return [surface.x + (surface.wall === 'east' ? room.width / 2 : surface.wall === 'west' ? -room.width / 2 : 0),
    surface.y + (surface.kind === 'wall' ? room.height / 2 : surface.kind === 'ceiling' ? room.height : 0),
    surface.z + (surface.wall === 'south' ? room.depth / 2 : surface.wall === 'north' ? -room.depth / 2 : 0)]
}

/** Only a coherent rectangular enclosure has a meaningful room-size operation. */
export function packRoomBox(pack: StructurePack, room: RoomConfig) {
  const floor = pack.surfaces.find((surface) => surface.kind === 'floor')
  const walls = WALL_SIDES.map((wall) => pack.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === wall))
  if (!floor || walls.some((wall) => !wall)) return null
  const height = walls[0]!.height
  for (const wall of walls) {
    if (!wall || !close(wall.rotation, 0) || !close(wall.height, height)) return null
    const [x, y, z] = surfacePosition(room, wall)
    if (!close(x, floor.x + (wall.wall === 'east' ? floor.width / 2 : wall.wall === 'west' ? -floor.width / 2 : 0))
      || !close(z, floor.z + (wall.wall === 'south' ? floor.depth / 2 : wall.wall === 'north' ? -floor.depth / 2 : 0))
      || !close(y, floor.y + height / 2)
      || !close(wall.width, wall.wall === 'north' || wall.wall === 'south' ? floor.width : floor.depth)) return null
  }
  const ceiling = pack.surfaces.find((surface) => surface.kind === 'ceiling')
  if (ceiling && (!close(ceiling.x, floor.x) || !close(ceiling.z, floor.z)
    || !close(room.height + ceiling.y, floor.y + height)
    || !close(ceiling.width, floor.width) || !close(ceiling.depth, floor.depth))) return null
  return { width: floor.width, depth: floor.depth, height, x: floor.x, y: floor.y, z: floor.z }
}

type RoomSelectionState = Pick<RoomState, 'selectedIds' | 'elementFolders' | 'elementFolderAssignments' | 'structurePacks' | 'room'>
export function selectedEditableRoom(state: RoomSelectionState) {
  if (state.selectedIds.length !== 1) return null
  const folderId = folderIdFromSelection(state.selectedIds[0])
  if (!folderId || !state.elementFolders.some((folder) => folder.id === folderId)) return null
  const ids = new Set(folderElementIds(state.elementFolderAssignments, folderId, state.elementFolders))
  const candidates: Array<{ kind: 'root' | 'pack'; packId?: string; name: string; size: Pick<RoomConfig, 'width' | 'height' | 'depth'> }> = []
  const name = state.elementFolders.find((folder) => folder.id === folderId)!.name
  if (BASE_ROOM_SURFACE_IDS.every((id) => ids.has(id))) candidates.push({ kind: 'root', name, size: state.room })
  for (const pack of state.structurePacks) {
    const box = packRoomBox(pack, state.room)
    if (box && pack.surfaces.filter((surface) => surface.kind !== 'ceiling').every((surface) => ids.has(structureSurfaceElementId(pack.id, surface.id)))) candidates.push({ kind: 'pack', packId: pack.id, name, size: box })
  }
  return candidates.length === 1 ? candidates[0] : null
}

export function resizedRoomPack(pack: StructurePack, room: RoomConfig, size: Pick<RoomConfig, 'width' | 'height' | 'depth'>): StructurePack | null {
  const box = packRoomBox(pack, room)
  if (!box) return null
  return { ...pack, surfaces: pack.surfaces.map((surface) => {
    if (surface.kind === 'floor') return { ...surface, width: size.width, depth: size.depth }
    if (surface.kind === 'ceiling') return { ...surface, width: size.width, depth: size.depth, y: box.y + size.height - room.height }
    return { ...surface, width: surface.wall === 'north' || surface.wall === 'south' ? size.width : size.depth, height: size.height,
      x: box.x + (surface.wall === 'east' ? (size.width - room.width) / 2 : surface.wall === 'west' ? (room.width - size.width) / 2 : 0),
      y: box.y + (size.height - room.height) / 2,
      z: box.z + (surface.wall === 'south' ? (size.depth - room.depth) / 2 : surface.wall === 'north' ? (room.depth - size.depth) / 2 : 0) }
  }) }
}

/** RoomConfig remains the legacy anchor; resizing it must not resize/move other packs. */
export function rebasePack(pack: StructurePack, before: RoomConfig, after: RoomConfig): StructurePack {
  return { ...pack, surfaces: pack.surfaces.map((surface) => ({ ...surface,
    x: surface.x + (surface.wall === 'east' ? (before.width - after.width) / 2 : surface.wall === 'west' ? (after.width - before.width) / 2 : 0),
    y: surface.y + (surface.kind === 'wall' ? (before.height - after.height) / 2 : surface.kind === 'ceiling' ? before.height - after.height : 0),
    z: surface.z + (surface.wall === 'south' ? (before.depth - after.depth) / 2 : surface.wall === 'north' ? (after.depth - before.depth) / 2 : 0),
  })) }
}

export function worldRoomBoxes(room: RoomConfig, packs: StructurePack[]) {
  return [{ x: 0, y: 0, z: 0, width: room.width, depth: room.depth, height: room.height }, ...packs.filter((pack) => pack.id.startsWith('floor-pack-')).map((pack) => {
    const box = packRoomBox(pack, room)
    return { x: pack.x + (box?.x ?? 0), y: pack.y + (box?.y ?? 0), z: pack.z + (box?.z ?? 0), width: box?.width ?? room.width, depth: box?.depth ?? room.depth, height: box?.height ?? room.height }
  })]
}
