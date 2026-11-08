import { WALL_SIDES } from './constants'
import { structureGridElementId, structureSurfaceElementId } from './elementIds'
import type { ElementFolder, GridSurface, StructurePack } from './types'

export type GridScope = 'focused' | 'all'
export const ROOT_GRID_SURFACES: readonly GridSurface[] = ['floor', ...WALL_SIDES]

export type GridGroupState = {
  activeRoomId: string | null
  gridVisibility: Record<GridSurface, boolean>
  hiddenElementIds: string[]
  structurePacks: StructurePack[]
  elementFolderAssignments: Record<string, string>
  elementFolders: ElementFolder[]
}

type GridTargets = { root: boolean; ids: string[] }

/** Returns the closest enclosing room folder for a scene element.
 * A child folder of a room belongs to that room, never to the root merely
 * because the room folder is nested below it.
 */
function owningRoomId(state: GridGroupState, elementId: string): string | null {
  const owners = new Map(state.structurePacks
    .filter((pack) => pack.id.startsWith('floor-pack-'))
    .map((pack) => [state.elementFolderAssignments[pack.id], pack.id]))
  const folders = new Map(state.elementFolders.map((folder) => [folder.id, folder.parentId]))
  let folder: string | undefined = state.elementFolderAssignments[elementId]
  const seen = new Set<string>()
  while (folder && !seen.has(folder)) {
    seen.add(folder)
    if (owners.has(folder)) return owners.get(folder)!
    folder = folders.get(folder)
  }
  return null
}

export function gridGroupTargets(state: GridGroupState, scope: GridScope): GridTargets {
  const focused = state.structurePacks.find((pack) =>
    pack.id === state.activeRoomId && pack.id.startsWith('floor-pack-'))
  const root = scope === 'all' || !focused
  const ids: string[] = []
  for (const pack of state.structurePacks) {
    if (pack.id.startsWith('floor-pack-')) {
      if (scope === 'all' || pack.id === focused?.id) {
        ids.push(...pack.surfaces.filter((surface) => surface.kind !== 'ceiling')
          .map((surface) => structureGridElementId(pack.id, surface.id)))
      }
      continue
    }
    if (!pack.id.startsWith('wall-object-') && !pack.id.startsWith('floor-object-')) continue
    for (const surface of pack.surfaces) {
      const surfaceId = structureSurfaceElementId(pack.id, surface.id)
      if (scope === 'all' || owningRoomId(state, surfaceId) === (focused?.id ?? null)) {
        ids.push(structureGridElementId(pack.id, surface.id))
      }
    }
  }
  return { root, ids: [...new Set(ids)] }
}

export function gridGroupStatus(state: GridGroupState, scope: GridScope) {
  const group = gridGroupTargets(state, scope)
  const hidden = new Set(state.hiddenElementIds)
  const values = [...(group.root ? ROOT_GRID_SURFACES.map((surface) => state.gridVisibility[surface]) : []),
    ...group.ids.map((id) => !hidden.has(id))]
  return { visible: values.length > 0 && values.every(Boolean), partial: values.some(Boolean) && !values.every(Boolean), count: values.length }
}

export function setGridGroup(state: GridGroupState, scope: GridScope, visible: boolean) {
  const targets = gridGroupTargets(state, scope)
  const hidden = new Set(state.hiddenElementIds)
  for (const id of targets.ids) {
    if (visible) hidden.delete(id)
    else hidden.add(id)
  }
  const gridVisibility = targets.root
    ? Object.fromEntries(ROOT_GRID_SURFACES.map((surface) => [surface, visible])) as Record<GridSurface, boolean>
    : state.gridVisibility
  return { gridVisibility, hiddenElementIds: [...hidden] }
}
