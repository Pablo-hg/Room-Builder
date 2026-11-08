import type { ElementFolder, FurnitureItem, GridSurface, RoomConfig, StructurePack } from './types'

/**
 * Diseño persistido de un único mobiliario.
 *
 * La versión 5 solo aparece en datos locales de la etapa de variantes (R5.1):
 * al leer se aplana a su variante activa y se guarda de nuevo como v4.
 */
export interface PersistedDesign {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  room: RoomConfig
  furniture: FurnitureItem[]
  structurePacks?: StructurePack[]
  gridSnap: boolean
  gridVisibility?: Record<GridSurface, boolean>
  hiddenElementIds?: string[]
  lockedElementIds?: string[]
  elementFolders?: ElementFolder[]
  elementFolderAssignments?: Record<string, string>
  sceneElementOrder?: string[]
}

export interface SavedDesign {
  id: string
  name: string
  savedAt: string
  data: PersistedDesign
}

export const DEFAULT_GRID_VISIBILITY: Record<GridSurface, boolean> = {
  floor: true,
  north: true,
  east: true,
  south: true,
  west: true,
}

export type DesignState = Required<Omit<PersistedDesign, 'version'>>

export function persistedDesign(state: DesignState): PersistedDesign {
  const hasAxisLocks = state.furniture.some((item) => item.axisLocks)
    || !!state.room.door.axisLocks || state.room.windows.some((item) => item.axisLocks)
    || state.structurePacks.some((pack) => pack.axisLocks || pack.surfaces.some((surface) => surface.axisLocks))
  const version: PersistedDesign['version'] = state.room.extraDoors?.length || state.structurePacks.some((pack) => pack.windows?.length) ? 8 : state.structurePacks.some((pack) => pack.doors?.length) ? 7 : hasAxisLocks ? 6 : state.sceneElementOrder.length
    ? 4
    : state.elementFolders.some((folder) => folder.parentId) ? 3 : state.room.door.name || state.room.windows.some((window) => window.name) ? 2 : 1
  return {
    version,
    room: state.room,
    furniture: state.furniture,
    structurePacks: state.structurePacks,
    gridSnap: state.gridSnap,
    gridVisibility: state.gridVisibility,
    hiddenElementIds: state.hiddenElementIds,
    lockedElementIds: state.lockedElementIds,
    elementFolders: state.elementFolders,
    elementFolderAssignments: state.elementFolderAssignments,
    sceneElementOrder: state.sceneElementOrder,
  }
}

export function persistedDesignSignature(design: PersistedDesign) {
  return JSON.stringify({
    version: design.version,
    room: design.room,
    furniture: design.furniture,
    structurePacks: design.structurePacks ?? [],
    gridSnap: design.gridSnap,
    gridVisibility: design.gridVisibility ?? DEFAULT_GRID_VISIBILITY,
    hiddenElementIds: design.hiddenElementIds ?? [],
    lockedElementIds: design.lockedElementIds ?? [],
    elementFolders: design.elementFolders ?? [],
    elementFolderAssignments: design.elementFolderAssignments ?? {},
    sceneElementOrder: design.sceneElementOrder ?? [],
  }, (_key, value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
  })
}

// Header check used by the v1 saved-design list. Nested data is checked during loading.
// Keep this permissive for compatibility; it is not a complete input validator.
export function isPersistedDesign(value: unknown): value is PersistedDesign {
  if (!value || typeof value !== 'object') return false
  const design = value as Partial<PersistedDesign>
  return (design.version === 1 || design.version === 2 || design.version === 3 || design.version === 4 || design.version === 5 || design.version === 6 || design.version === 7 || design.version === 8)
    && !!design.room
    && typeof design.room === 'object'
    && Array.isArray(design.furniture)
}
