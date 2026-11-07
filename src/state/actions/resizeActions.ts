import { resizedFurniture, resizedWallObject } from '../../domain/furnitureResize'
import { furnitureHasSpatialWarning } from '../../domain/structureCollisions'
import type { RoomActionContext, RoomState } from '../types'
import { openingMovementAllowed } from '../../domain/axisLocks'

export function createResizeActions({ set }: RoomActionContext): Pick<RoomState, 'resizeFurniture' | 'resizeWallObject'> {
  return {
    resizeFurniture: (id, dimension, value) => set((state) => {
      if (state.lockedElementIds.includes(id)) return { notice: 'Desbloquea el objeto para cambiar su tamaño.' }
      const item = state.furniture.find((candidate) => candidate.id === id)
      if (!item) return {}
      const result = resizedFurniture(item, state.room, dimension, value)
      if (!result.value) return { notice: result.error }
      const furniture = state.furniture.map((candidate) => candidate.id === id ? result.value! : candidate)
      const warning = furnitureHasSpatialWarning({ ...state, furniture }, result.value)
      return { furniture, notice: warning ? 'Tamaño cambiado. El borde rojo indica un atravesamiento o que el objeto está fuera.' : '' }
    }),
    resizeWallObject: (id, dimension, value) => set((state) => {
      if (state.lockedElementIds.includes(id)) return { notice: 'Desbloquea el objeto para cambiar su tamaño.' }
      const item = state.room.windows.find((candidate) => candidate.id === id)
      if (!item) return {}
      const result = resizedWallObject(state.room, item, dimension, value)
      const candidate = result.value?.windows.find((window) => window.id === id)
      if (candidate && !openingMovementAllowed(item, candidate)) return { notice: 'El cambio movería un eje bloqueado.' }
      return result.value ? { room: result.value, notice: '' } : { notice: result.error }
    }),
  }
}
