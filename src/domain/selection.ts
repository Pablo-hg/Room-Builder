import { structureSurfaceElementId } from './elementIds'
import { OPENING_CATALOG, openingKindForShape } from './objectCatalog'
import type { FurnitureItem, RoomConfig, StructurePack, StructureSurface } from './types'
import { BASE_FLOOR_ID, BASE_ROOM_SURFACE_IDS } from './elementFolders'
import { WALL_LABELS } from './constants'
import type { WallSide } from './types'

export interface SelectionSource {
  room: RoomConfig
  furniture: FurnitureItem[]
  structurePacks: StructurePack[]
}

/** Display old generated compass names without rewriting saved/custom names. */
export function structureSurfaceName(surface: StructureSurface) {
  return surface.kind === 'wall' && surface.wall && surface.name === `Pared ${surface.wall.toUpperCase()}`
    ? `Pared ${WALL_LABELS[surface.wall]}` : surface.name
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
  const extraDoor = state.room.extraDoors?.find((door) => door.id === id)
  const doorPack = state.structurePacks.find((pack) => pack.doors?.some((door) => door.id === id))
  const selectedStructureDoor = doorPack ? { pack: doorPack, door: doorPack.doors!.find((door) => door.id === id)! } : undefined
  const selectedOpening = id === 'door'
    ? { ...state.room.door, id: 'door' as const, kind: 'door' as const, sill: 0 }
    : extraDoor ? { ...extraDoor, kind: 'door' as const, sill: 0 } : selectedWindow ? { ...selectedWindow, kind: 'window' as const } : null

  return { selectedPack, selectedSurface, selectedFurniture, selectedWindow, selectedOpening, selectedStructureDoor }
}

export function elementName(state: SelectionSource, id: string | null) {
  if (!id) return null
  if (id === BASE_FLOOR_ID) return 'Suelo'
  if (BASE_ROOM_SURFACE_IDS.includes(id)) return `Pared ${WALL_LABELS[id.slice('room-wall:'.length) as WallSide]}`
  if (id === 'door') return state.room.door.name || 'Puerta'
  const extraDoor = state.room.extraDoors?.find((door) => door.id === id)
  if (extraDoor) return extraDoor.name || 'Puerta'
  const windowIndex = state.room.windows.findIndex((window) => window.id === id)
  if (windowIndex >= 0) {
    const item = state.room.windows[windowIndex]
    const name = OPENING_CATALOG[openingKindForShape(item.shape)].name
    return item.name || `${name} ${windowIndex + 1}`
  }
  const { selectedPack, selectedSurface, selectedFurniture, selectedStructureDoor } = deriveSelection(state, id)
  if (selectedStructureDoor) return selectedStructureDoor.door.name || 'Puerta'
  if (selectedPack) return selectedPack.name
  if (selectedSurface) return structureSurfaceName(selectedSurface.surface)
  return selectedFurniture?.name ?? id
}
