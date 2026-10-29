// Preserve the v1 identifiers: saved selections and hidden elements use these strings.
export const structureSurfaceElementId = (packId: string, surfaceId: string) => `structure-surface:${packId}:${surfaceId}`
export const structureGridElementId = (packId: string, surfaceId: string) => `structure-grid:${packId}:${surfaceId}`

export const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
