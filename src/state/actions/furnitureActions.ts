import { finishHistoryTransaction } from '../historyTransactions'
import { applyFurnitureRotation, elevatedFurniture, movedFurniture } from '../../domain/editingRules'
import { makeId } from '../../domain/elementIds'
import { elementName } from '../../domain/selection'
import { FURNITURE_PRESETS, isCeilingMountedFurniture, isWallPictureKind } from '../../domain/objectCatalog'
import { findFreeFurniturePosition } from '../../domain/geometry'
import type { FurnitureItem } from '../../domain/types'
import { recordInteraction } from '../../debug/interactionLog'
import type { RoomActionContext, RoomState } from '../types'

type FurnitureActions = Pick<
  RoomState,
  | 'addFurniture'
  | 'beginFurnitureMove'
  | 'endFurnitureMove'
  | 'moveFurniture'
  | 'moveFurnitureVertically'
  | 'setFurnitureColor'
  | 'setFurnitureRotation'
  | 'rotateFurniture'
  | 'removeFurniture'
>

export function createFurnitureActions(context: Pick<RoomActionContext, 'set' | 'get' | 'runtime'>): FurnitureActions {
  const { set, get, runtime } = context
  return {
    addFurniture: (kind) => {
      if (isWallPictureKind(kind)) return get().addWindow(kind)
      return set((state) => {
        const preset = FURNITURE_PRESETS[kind]
        const id = makeId(kind)
        const item: FurnitureItem = {
          ...preset,
          id,
          x: 0,
          y: isCeilingMountedFurniture(kind) ? Math.max(0, state.room.height - preset.height) : 0,
          z: 0,
          rotation: 0,
        }
        const position = findFreeFurniturePosition(item, state.room, state.furniture)
        if (!position) {
          recordInteraction('state.furniture.add-rejected', {
            view: state.view,
            selectedId: state.selectedId,
            details: { kind, name: preset.name, reason: 'no-free-position' },
          })
          return { notice: `No queda espacio libre para añadir ${preset.name.toLowerCase()}.` }
        }
        recordInteraction('state.furniture.added', {
          view: state.view,
          selectedId: state.selectedId,
          details: { id, kind, name: preset.name, x: position.x, z: position.z, selectedAfter: id },
        })
        return { furniture: [...state.furniture, { ...item, ...position }], selectedId: id, notice: `${preset.name} añadido.` }
      })
    },
    beginFurnitureMove: () => {
      get().beginHistoryGesture()
    },
    endFurnitureMove: () => {
      finishHistoryTransaction(runtime)
    },
    moveFurniture: (id, x, z) => set((state) => {
      const item = state.furniture.find((candidate) => candidate.id === id)
      if (!item) return {}
      const moved = movedFurniture(state, item, x, z)
      if (!moved) return {}
      recordInteraction('state.furniture.moved', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `furniture-move-${id}`,
        details: { id, name: item.name, x: moved.x, z: moved.z },
      })
      return { furniture: state.furniture.map((candidate) => candidate.id === id ? moved : candidate) }
    }),
    moveFurnitureVertically: (id, y) => set((state) => {
      const item = state.furniture.find((candidate) => candidate.id === id)
      if (!item) return {}
      const moved = elevatedFurniture(state, item, y)
      if (!moved) return {}
      recordInteraction('state.furniture.elevation-changed', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `furniture-elevation-${id}`,
        details: { id, name: item.name, y: moved.y },
      })
      return {
        furniture: state.furniture.map((candidate) => candidate.id === id ? moved : candidate),
      }
    }),
    setFurnitureColor: (id, color) => set((state) => {
      const item = state.furniture.find((candidate) => candidate.id === id)
      if (!item || item.color === color) return {}
      recordInteraction('state.furniture.color', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `furniture-color-${id}`,
        details: { id, name: item.name, color },
      })
      return {
        furniture: state.furniture.map((candidate) => candidate.id === id ? { ...candidate, color } : candidate),
        notice: '',
      }
    }),
    setFurnitureRotation: (id, rotation) => set((state) => {
      const item = state.furniture.find((candidate) => candidate.id === id)
      if (!item) return {}
      const update = applyFurnitureRotation(state, item, rotation, false)
      if (update.furniture) {
        const rotated = update.furniture.find((candidate) => candidate.id === id)
        recordInteraction('state.furniture.rotated', {
          view: state.view,
          selectedId: state.selectedId,
          coalesceKey: `furniture-rotation-${id}`,
          details: { id, name: item.name, degrees: rotated ? rotated.rotation * 180 / Math.PI : rotation * 180 / Math.PI },
        })
      }
      return update
    }),
    rotateFurniture: () => set((state) => {
      const item = state.furniture.find((candidate) => candidate.id === state.selectedId)
      if (!item) return {}
      const update = applyFurnitureRotation(state, item, item.rotation + Math.PI / 2, true)
      if (update.furniture) {
        const rotated = update.furniture.find((candidate) => candidate.id === item.id)
        recordInteraction('state.furniture.rotated', {
          view: state.view,
          selectedId: state.selectedId,
          details: { id: item.id, name: item.name, degrees: (rotated?.rotation ?? item.rotation) * 180 / Math.PI },
        })
      }
      return update
    }),
    removeFurniture: () => set((state) => {
      if (state.selectedId) recordInteraction('state.element.removed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id: state.selectedId, name: elementName(state, state.selectedId) },
      })
      return {
        furniture: state.furniture.filter((item) => item.id !== state.selectedId),
        hiddenElementIds: state.hiddenElementIds.filter((id) => id !== state.selectedId),
        selectedId: null,
        notice: state.selectedId ? 'Objeto eliminado.' : state.notice,
      }
    }),
  }
}
