export function withoutFolderAssignments(assignments: Record<string, string>, elementIds: readonly string[]) {
  const next = { ...assignments }
  elementIds.forEach((id) => {
    delete next[id]
  })
  return next
}

// Las carpetas no son objetos 3D: usan un id propio para no confundirse con elementos de la escena.
export const folderSelectionId = (folderId: string) => `folder:${folderId}`

export function isFolderSelectionId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.startsWith('folder:')
}

export function folderIdFromSelection(id: string | null | undefined) {
  return isFolderSelectionId(id) ? id.slice('folder:'.length) : null
}

export function canMoveFolder(folders: readonly { id: string; parentId?: string }[], folderId: string, parentId: string | null) {
  if (folderId === ROOT_ROOM_FOLDER) return false
  if (!folders.some((folder) => folder.id === folderId)) return false
  if (parentId === null) return true
  const visited = new Set<string>()
  let current: string | undefined = parentId
  while (current) {
    if (current === folderId || visited.has(current)) return false
    visited.add(current)
    const folder = folders.find((candidate) => candidate.id === current)
    if (!folder) return false
    current = folder.parentId
  }
  return true
}

export function folderElementIds(assignments: Record<string, string>, folderId: string, folders: readonly { id: string; parentId?: string }[] = []) {
  const descendants = new Set([folderId])
  let changed = true
  while (changed) {
    changed = false
    for (const folder of folders) if (folder.parentId && descendants.has(folder.parentId) && !descendants.has(folder.id)) {
      descendants.add(folder.id)
      changed = true
    }
  }
  return Object.entries(assignments)
    .filter(([, assignedFolderId]) => descendants.has(assignedFolderId))
    .map(([elementId]) => elementId)
}
import { structureSurfaceElementId } from './elementIds'
import type { FurnitureItem, RoomConfig, StructurePack } from './types'

export const ROOT_ROOM_FOLDER = 'room-root'
export const BASE_FLOOR_ID = 'room-floor'
export const baseWallId = (wall: string) => `room-wall:${wall}`
export const BASE_ROOM_SURFACE_IDS = [BASE_FLOOR_ID, ...['north', 'east', 'south', 'west'].map(baseWallId)]
export function initialRoomFolder(room: RoomConfig) {
  return {
    elementFolders: [{ id: ROOT_ROOM_FOLDER, name: 'Raíz' }],
    elementFolderAssignments: Object.fromEntries([...BASE_ROOM_SURFACE_IDS, 'door', ...room.windows.map((window) => window.id), ...(room.extraDoors ?? []).map((door) => door.id)].map((id) => [id, ROOT_ROOM_FOLDER])),
  }
}

/** A pack assigned to a folder is represented by that folder in the scene list. */
export function folderRoomPack(folders: readonly { id: string }[], assignments: Record<string, string>, packs: readonly StructurePack[], folderId: string) {
  if (!folders.some((folder) => folder.id === folderId)) return undefined
  return packs.find((pack) => pack.id.startsWith('floor-pack-') && assignments[pack.id] === folderId)
}

export function orderedSceneIds(state: { room: RoomConfig; furniture: FurnitureItem[]; structurePacks: StructurePack[]; sceneElementOrder: string[]; elementFolders?: readonly { id: string }[] }) {
  const folderIds = (state.elementFolders ?? []).map((folder) => folderSelectionId(folder.id))
  const ids = [...folderIds, ...(folderIds.includes(folderSelectionId(ROOT_ROOM_FOLDER)) ? BASE_ROOM_SURFACE_IDS : []), 'door', ...(state.room.extraDoors ?? []).map((door) => door.id), ...state.room.windows.map((window) => window.id), ...state.furniture.map((item) => item.id), ...state.structurePacks.flatMap((pack) => [pack.id, ...pack.surfaces.map((surface) => structureSurfaceElementId(pack.id, surface.id)), ...(pack.doors ?? []).map((door) => door.id)])]
  const valid = new Set(ids)
  const ordered = state.sceneElementOrder.filter((id) => valid.has(id))
  const known = new Set(ordered)
  return [...folderIds.filter((id) => !known.has(id)), ...ordered, ...ids.filter((id) => !known.has(id) && !folderIds.includes(id))]
}

export function sceneEntryParent(id: string, folders: readonly { id: string; parentId?: string }[], assignments: Record<string, string>) {
  const folderId = folderIdFromSelection(id)
  return folderId ? folders.find((folder) => folder.id === folderId)?.parentId ?? null : assignments[id] ?? null
}
