import type { FurnitureItem, GridSurface, RoomConfig, StructurePack } from './types'

export interface PersistedDesign {
  version: 1
  room: RoomConfig
  furniture: FurnitureItem[]
  structurePacks?: StructurePack[]
  gridSnap: boolean
  gridVisibility?: Record<GridSurface, boolean>
  hiddenElementIds?: string[]
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
  return {
    version: 1,
    room: state.room,
    furniture: state.furniture,
    structurePacks: state.structurePacks,
    gridSnap: state.gridSnap,
    gridVisibility: state.gridVisibility,
    hiddenElementIds: state.hiddenElementIds,
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
  })
}

// Header check used by the v1 saved-design list. Nested data is checked during loading.
// Keep this permissive for compatibility; it is not a complete input validator.
export function isPersistedDesign(value: unknown): value is PersistedDesign {
  if (!value || typeof value !== 'object') return false
  const design = value as Partial<PersistedDesign>
  return design.version === 1
    && !!design.room
    && typeof design.room === 'object'
    && Array.isArray(design.furniture)
}
