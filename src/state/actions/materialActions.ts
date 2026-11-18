import { WALL_SIDES } from '../../domain/constants'
import { BASE_FLOOR_ID, baseWallId } from '../../domain/elementFolders'
import { parseMaterialFinish, type MaterialFinish } from '../../domain/materials'
import { deriveSelection } from '../../domain/selection'
import { worldOpenings } from '../../domain/wallConnections'
import type { RoomActionContext, RoomState } from '../types'

function withMaterial<T extends { material?: MaterialFinish }>(item: T, material: MaterialFinish | null): T {
  const { material: _previous, ...rest } = item
  return { ...rest, ...(material ? { material } : {}) } as T
}

/** Aplicación a una única entidad. El historial la registra como edición del diseño. */
export function createMaterialActions({ set }: Pick<RoomActionContext, 'set'>): Pick<RoomState, 'setMaterialFinish'> {
  return {
    setMaterialFinish: (elementId, finish) => set((state) => {
      const locked = (id: string) => state.lockedElementIds.includes(id)
      const lockedNotice = { notice: 'Desbloquea el elemento antes de cambiar su material.' }
      if (locked(elementId)) return lockedNotice

      const next = finish === null ? null : parseMaterialFinish(finish)
      if (finish !== null && !next) return { notice: 'El acabado no es válido.' }
      if (elementId === BASE_FLOOR_ID) {
        const { floorMaterial: _old, ...room } = state.room
        return { room: next ? { ...room, floorMaterial: next } : room, notice: '' }
      }
      const wall = WALL_SIDES.find((side) => baseWallId(side) === elementId)
      if (wall) {
        const walls = { ...state.room.wallMaterials }
        if (next) walls[wall] = next
        else delete walls[wall]
        const { wallMaterials: _old, ...room } = state.room
        return { room: Object.keys(walls).length ? { ...room, wallMaterials: walls } : room, notice: '' }
      }

      const { selectedFurniture, selectedSurface } = deriveSelection(state, elementId)
      if (selectedFurniture) return {
        furniture: state.furniture.map((item) => item === selectedFurniture ? withMaterial(item, next) : item),
        notice: '',
      }
      if (selectedSurface) {
        const { pack, surface } = selectedSurface
        if (locked(pack.id)) return lockedNotice
        return {
          structurePacks: state.structurePacks.map((item) => item === pack
            ? { ...pack, surfaces: pack.surfaces.map((candidate) => candidate === surface ? withMaterial(surface, next) : candidate) }
            : item),
          notice: '',
        }
      }

      const opening = worldOpenings(state).find((item) => item.id === elementId)
      if (!opening) return { notice: 'Selecciona un elemento para cambiar su material.' }
      if (opening.packId && locked(opening.packId)) return lockedNotice
      const match = <T extends { id: string; material?: MaterialFinish }>(item: T): T => item.id === elementId ? withMaterial(item, next) : item
      if (opening.packId) return {
        structurePacks: state.structurePacks.map((pack) => pack.id !== opening.packId ? pack : {
          ...pack,
          ...(pack.doors ? { doors: pack.doors.map(match) } : {}),
          ...(pack.windows ? { windows: pack.windows.map(match) } : {}),
        }),
        notice: '',
      }
      const { room } = state
      return {
        room: {
          ...room,
          door: elementId === 'door' ? withMaterial(room.door, next) : room.door,
          ...(room.extraDoors ? { extraDoors: room.extraDoors.map(match) } : {}),
          windows: room.windows.map(match),
        },
        notice: '',
      }
    }),
  }
}
