import type { MultiItem } from '../domain/multiSelection'
import { BASE_FLOOR_ID, baseWallId, folderElementIds, folderIdFromSelection } from '../domain/elementFolders'
import { WALL_SIDES } from '../domain/constants'

export function selectedBaseWallIndicators(selectedIds: string[], folders: readonly { id: string; parentId?: string }[], assignments: Record<string, string>) {
  const elements = new Set(selectedIds.flatMap((id) => { const folderId = folderIdFromSelection(id); return folderId ? folderElementIds(assignments, folderId, folders) : [] }))
  return elements.has(BASE_FLOOR_ID) ? WALL_SIDES.filter((wall) => elements.has(baseWallId(wall))) : []
}

export function showGroupedWallIndicators(selectedIds: string[], items: MultiItem[]) {
  return selectedIds.some((id) => id.startsWith('folder:') || id.startsWith('floor-pack-'))
    && items.some((item) => item.type === 'surface' && item.surfaceId === 'floor')
    && items.some((item) => item.type === 'surface' && item.surfaceId?.startsWith('wall-'))
}
