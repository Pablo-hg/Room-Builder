import type { ElementFolder, FurnitureItem, GridSurface, RoomConfig, StructurePack } from './types'
import { syncActiveLayout, validateLayouts } from './designLayouts'

export interface PersistedDesignLegacy {
  version: 1 | 2 | 3 | 4
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

/** Variantes de una habitación; ProjectV2 mantiene su contrato candidato independiente. */
export interface PersistedLayout {
  id: string
  name: string
  kind: 'original' | 'alternative'
  furniture: FurnitureItem[]
}

export interface PersistedDesignV5 extends Omit<PersistedDesignLegacy, 'version'> {
  version: 5
  layouts: PersistedLayout[]
  activeLayoutId: string
}

export type PersistedDesign = PersistedDesignLegacy | PersistedDesignV5

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

export type DesignState = Required<Omit<PersistedDesignLegacy, 'version'>> & Partial<Pick<PersistedDesignV5, 'layouts' | 'activeLayoutId'>>

export function persistedDesign(state: DesignState): PersistedDesign {
  const common = {
    version: state.sceneElementOrder.length ? 4 : state.elementFolders.some((folder) => folder.parentId) ? 3 : state.room.door.name || state.room.windows.some((window) => window.name) ? 2 : 1,
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
  if (state.layouts && state.activeLayoutId) {
    return { ...common, version: 5, ...syncActiveLayout({ layouts: state.layouts, activeLayoutId: state.activeLayoutId, furniture: state.furniture }) }
  }
  return { ...common, version: common.version as PersistedDesignLegacy['version'] }
}

export function persistedDesignSignature(design: PersistedDesign | PersistedDesignV5) {
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
    ...(design.version === 5 ? { layouts: design.layouts, activeLayoutId: design.activeLayoutId } : {}),
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
  if (design.version === 5) return isPersistedDesignV5(value)
  return (design.version === 1 || design.version === 2 || design.version === 3 || design.version === 4)
    && !!design.room
    && typeof design.room === 'object'
    && Array.isArray(design.furniture)
}

/** v5 comprueba las relaciones de variantes además de la cabecera. */
export function isPersistedDesignV5(value: unknown): value is PersistedDesignV5 {
  if (!value || typeof value !== 'object') return false
  const design = value as Partial<PersistedDesignV5>
  return design.version === 5 && !!design.room && typeof design.room === 'object' && validateLayouts(value).length === 0
}
