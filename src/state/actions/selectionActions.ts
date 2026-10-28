import { makeId, structureSurfaceElementId } from '../../domain/elementIds'
import { elementName } from '../../domain/selection'
import { ROOM_LIMITS } from '../../domain/constants'
import { canPlaceFurniture, clampFurniture, clampFurnitureElevation, findFreeFurniturePosition, validateOpenings, wallLength } from '../../domain/geometry'
import type { FurnitureItem } from '../../domain/types'
import { recordInteraction } from '../../debug/interactionLog'
import type { RoomActionContext, RoomState } from '../types'

type SelectionActions = Pick<
  RoomState,
  | 'selectElement'
  | 'removeSelected'
  | 'copySelected'
  | 'pasteSelected'
  | 'toggleGridVisibility'
  | 'toggleElementVisibility'
  | 'clearNotice'
>

export function createSelectionActions(context: Pick<RoomActionContext, 'set' | 'get' | 'runtime'>): SelectionActions {
  const { set, get, runtime } = context
  return {
    selectElement: (selectedId) => set((state) => {
      recordInteraction('state.selection.requested', {
        view: state.view,
        selectedId: state.selectedId,
        details: {
          previousId: state.selectedId,
          previousName: elementName(state, state.selectedId),
          requestedId: selectedId,
          requestedName: elementName(state, selectedId),
          changed: state.selectedId !== selectedId,
        },
      })
      return { selectedId, notice: '' }
    }),
    removeSelected: () => set((state) => {
      if (!state.selectedId || state.selectedId === 'door') return {}
      recordInteraction('state.element.removed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id: state.selectedId, name: elementName(state, state.selectedId) },
      })
      if (state.room.windows.some((window) => window.id === state.selectedId)) {
        return {
          room: { ...state.room, windows: state.room.windows.filter((window) => window.id !== state.selectedId) },
          hiddenElementIds: state.hiddenElementIds.filter((id) => id !== state.selectedId),
          selectedId: null,
          notice: 'Ventana eliminada.',
        }
      }
      if (state.structurePacks.some((pack) => pack.id === state.selectedId)) {
        const pack = state.structurePacks.find((candidate) => candidate.id === state.selectedId)
        if (!pack) return {}
        const surfaceIds = pack.surfaces.map((surface) => structureSurfaceElementId(pack.id, surface.id))
        return {
          structurePacks: state.structurePacks.filter((candidate) => candidate.id !== pack.id),
          hiddenElementIds: state.hiddenElementIds.filter((id) => id !== pack.id && !surfaceIds.includes(id)),
          selectedId: null,
          notice: `${pack.name} eliminado.`,
        }
      }
      for (const pack of state.structurePacks) {
        const surface = pack.surfaces.find((candidate) => structureSurfaceElementId(pack.id, candidate.id) === state.selectedId)
        if (surface) {
          const surfaceId = structureSurfaceElementId(pack.id, surface.id)
          return {
            structurePacks: state.structurePacks.map((candidate) => candidate.id !== pack.id ? candidate : {
              ...candidate,
              surfaces: candidate.surfaces.filter((item) => item.id !== surface.id),
            }),
            hiddenElementIds: state.hiddenElementIds.filter((id) => id !== surfaceId),
            selectedId: null,
            notice: 'Superficie eliminada.',
          }
        }
      }
      if (!state.furniture.some((item) => item.id === state.selectedId)) return {}
      return {
        furniture: state.furniture.filter((item) => item.id !== state.selectedId),
        hiddenElementIds: state.hiddenElementIds.filter((id) => id !== state.selectedId),
        selectedId: null,
        notice: 'Objeto eliminado.',
      }
    }),
    copySelected: () => {
      const state = get()
      const furniture = state.furniture.find((item) => item.id === state.selectedId)
      if (furniture) {
        runtime.copiedElement = { ...furniture }
        set({ notice: `${furniture.name} copiado.` })
        return true
      }
      const window = state.room.windows.find((item) => item.id === state.selectedId)
      if (window) {
        runtime.copiedElement = { ...window }
        set({ notice: `${elementName(state, window.id)} copiado.` })
        return true
      }
      return false
    },
    pasteSelected: () => {
      if (!runtime.copiedElement) return false
      const copy = runtime.copiedElement
      set((state) => {
        if ('kind' in copy) {
          const item: FurnitureItem = { ...copy, id: makeId(copy.kind) }
          const offsets = [
            [0.5, 0.5], [0.5, 0], [0, 0.5], [-0.5, 0], [0, -0.5],
            [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5],
          ] as const
          const position = offsets
            .map(([x, z]) => clampFurniture({ ...item, x: copy.x + x, z: copy.z + z }, state.room, state.gridSnap))
            .find((candidate) => canPlaceFurniture({ ...item, ...candidate }, state.furniture))
            ?? findFreeFurniturePosition(item, state.room, state.furniture)
          if (!position) {
            return { notice: `No queda espacio libre para duplicar ${item.name.toLowerCase()}.` }
          }
          const pasted = {
            ...item,
            ...position,
            y: clampFurnitureElevation(item, state.room, state.gridSnap),
          }
          recordInteraction('state.furniture.added', {
            view: state.view,
            selectedId: state.selectedId,
            details: { id: pasted.id, kind: pasted.kind, name: pasted.name, x: pasted.x, z: pasted.z, source: 'clipboard' },
          })
          return { furniture: [...state.furniture, pasted], selectedId: pasted.id, notice: `${pasted.name} pegado.` }
        }
  
        const sourceIndex = state.room.windows.findIndex((item) => item.id === copy.id)
        const source = sourceIndex >= 0 ? state.room.windows[sourceIndex] : copy
        const id = makeId('window')
        const length = wallLength(state.room, source.wall)
        const offsets = [0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2]
        const pasted = offsets
          .map((delta) => ({ ...source, id, offset: source.offset + delta }))
          .find((candidate) => !validateOpenings({ ...state.room, windows: [...state.room.windows, candidate] }))
        if (!pasted || Math.abs(pasted.offset) + pasted.width / 2 > length / 2 - ROOM_LIMITS.edgeMargin) {
          return { notice: 'No hay espacio en la pared para pegar este elemento.' }
        }
        recordInteraction('state.opening.added', {
          view: state.view,
          selectedId: state.selectedId,
          details: { id, name: elementName(state, source.id), wall: source.wall, offset: pasted.offset, source: 'clipboard' },
        })
        return {
          room: { ...state.room, windows: [...state.room.windows, pasted] },
          selectedId: id,
          notice: `${elementName(state, source.id)} pegado.`,
        }
      })
      return true
    },
    toggleGridVisibility: (surface) => set((state) => {
      const visible = !state.gridVisibility[surface]
      recordInteraction('state.grid.visibility', {
        view: state.view,
        selectedId: state.selectedId,
        details: { surface, visible },
      })
      return { gridVisibility: { ...state.gridVisibility, [surface]: visible } }
    }),
    toggleElementVisibility: (id) => set((state) => {
      const isHidden = state.hiddenElementIds.includes(id)
      recordInteraction('state.element.visibility', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: elementName(state, id), visible: isHidden },
      })
      return {
        hiddenElementIds: isHidden
          ? state.hiddenElementIds.filter((elementId) => elementId !== id)
          : [...state.hiddenElementIds, id],
        selectedId: !isHidden && state.selectedId === id ? null : state.selectedId,
      }
    }),
    clearNotice: () => set({ notice: '' }),
  }
}
