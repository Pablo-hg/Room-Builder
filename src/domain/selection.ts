import { structureSurfaceElementId } from './elementIds'
import { OPENING_CATALOG, openingKindForShape } from './objectCatalog'
import type { FurnitureItem, RoomConfig, StructurePack, StructureSurface } from './types'

export interface SelectionSource {
  room: RoomConfig
  furniture: FurnitureItem[]
  structurePacks: StructurePack[]
}

export function deriveSelection(state: SelectionSource, id: string | null) {
  const selectedPack = state.structurePacks.find((pack) => pack.id === id)
  let selectedSurface: { pack: StructurePack; surface: StructureSurface } | undefined
  for (const pack of state.structurePacks) {
    const surface = pack.surfaces.find((item) => structureSurfaceElementId(pack.id, item.id) === id)
    if (surface) {
      selectedSurface = { pack, surface }
      break
    }
  }
  const selectedFurniture = state.furniture.find((item) => item.id === id)
  const selectedWindow = state.room.windows.find((window) => window.id === id)
  const selectedOpening = id === 'door'
    ? { ...state.room.door, id: 'door' as const, kind: 'door' as const, sill: 0 }
    : selectedWindow ? { ...selectedWindow, kind: 'window' as const } : null

  return { selectedPack, selectedSurface, selectedFurniture, selectedWindow, selectedOpening }
}

export function elementName(state: SelectionSource, id: string | null) {
  if (!id) return null
  if (id === 'door') return 'Puerta'
  const windowIndex = state.room.windows.findIndex((window) => window.id === id)
  if (windowIndex >= 0) {
    const item = state.room.windows[windowIndex]
    const name = OPENING_CATALOG[openingKindForShape(item.shape)].name
    return `${name} ${windowIndex + 1}`
  }
  const { selectedPack, selectedSurface, selectedFurniture } = deriveSelection(state, id)
  if (selectedPack) return selectedPack.name
  if (selectedSurface) return `${selectedSurface.pack.name} · ${selectedSurface.surface.name}`
  return selectedFurniture?.name ?? id
}
