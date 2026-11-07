import { makeId, structureGridElementId, structureSurfaceElementId } from '../../domain/elementIds'
import { elementName } from '../../domain/selection'
import { ROOM_LIMITS } from '../../domain/constants'
import { isFolderSelectionId, withoutFolderAssignments } from '../../domain/elementFolders'
import { canPlaceFurniture, clampFurnitureElevation, findFreeFurniturePosition, validateOpenings, wallLength } from '../../domain/geometry'
import { snapMeasurement } from '../../domain/measurements'
import { canElevateFurniture } from '../../domain/objectCatalog'
import { BASE_ROOM_SURFACE_IDS } from '../../domain/elementFolders'
import type { FurnitureItem } from '../../domain/types'
import { recordInteraction } from '../../debug/interactionLog'
import type { RoomActionContext, RoomState } from '../types'

type SelectionActions = Pick<
  RoomState,
  | 'selectElement'
  | 'selectSceneListItem'
  | 'renameElement'
  | 'removeSelected'
  | 'copySelected'
  | 'pasteSelected'
  | 'toggleGridVisibility'
  | 'toggleElementVisibility'
  | 'toggleElementLock'
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
    selectSceneListItem: (id, mode, visibleIds) => set((state) => {
      if (!visibleIds.includes(id)) return {}
      let selectedIds: string[]
      let anchor = id
      if (mode === 'toggle') {
        selectedIds = state.selectedIds.includes(id) ? state.selectedIds.filter((item) => item !== id) : [...state.selectedIds, id]
      } else if (mode === 'range' && state.selectionAnchor && visibleIds.includes(state.selectionAnchor)) {
        const start = visibleIds.indexOf(state.selectionAnchor)
        const end = visibleIds.indexOf(id)
        selectedIds = visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1)
        anchor = state.selectionAnchor
      } else selectedIds = [id]
      return { selectedIds, selectedId: selectedIds.length === 1 ? selectedIds[0] : null, selectionAnchor: selectedIds.length ? anchor : null, notice: '' }
    }),
    renameElement: (id, name) => set((state) => {
      const clean = name.trim().slice(0, 80)
      if (!clean) return {}
      if (id === 'door') return { room: { ...state.room, door: { ...state.room.door, name: clean } } }
      if (state.room.windows.some((window) => window.id === id)) return { room: { ...state.room, windows: state.room.windows.map((window) => window.id === id ? { ...window, name: clean } : window) } }
      if (state.furniture.some((item) => item.id === id)) return { furniture: state.furniture.map((item) => item.id === id ? { ...item, name: clean } : item) }
      if (state.structurePacks.some((pack) => pack.id === id)) return { structurePacks: state.structurePacks.map((pack) => pack.id === id ? { ...pack, name: clean } : pack) }
      for (const pack of state.structurePacks) {
        if (pack.surfaces.some((surface) => structureSurfaceElementId(pack.id, surface.id) === id)) return {
          structurePacks: state.structurePacks.map((candidate) => candidate.id !== pack.id ? candidate : {
            ...candidate, surfaces: candidate.surfaces.map((surface) => structureSurfaceElementId(pack.id, surface.id) === id ? { ...surface, name: clean } : surface),
          }),
        }
      }
      return {}
    }),
    removeSelected: () => set((state) => {
      if (!state.selectedId || state.selectedId === 'door' || isFolderSelectionId(state.selectedId) || BASE_ROOM_SURFACE_IDS.includes(state.selectedId)) return {}
      recordInteraction('state.element.removed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id: state.selectedId, name: elementName(state, state.selectedId) },
      })
      if (state.room.windows.some((window) => window.id === state.selectedId)) {
        return {
          room: { ...state.room, windows: state.room.windows.filter((window) => window.id !== state.selectedId) },
          hiddenElementIds: state.hiddenElementIds.filter((id) => id !== state.selectedId),
          lockedElementIds: state.lockedElementIds.filter((id) => id !== state.selectedId),
          elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, [state.selectedId]),
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
          hiddenElementIds: state.hiddenElementIds.filter((id) => id !== pack.id && !surfaceIds.includes(id) && !pack.surfaces.some((surface) => id === structureGridElementId(pack.id, surface.id))),
          lockedElementIds: state.lockedElementIds.filter((id) => id !== pack.id && !surfaceIds.includes(id)),
          elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, [pack.id, ...surfaceIds]),
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
            hiddenElementIds: state.hiddenElementIds.filter((id) => id !== surfaceId && id !== structureGridElementId(pack.id, surface.id)),
            lockedElementIds: state.lockedElementIds.filter((id) => id !== surfaceId),
            elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, [surfaceId]),
            selectedId: null,
            notice: 'Superficie eliminada.',
          }
        }
      }
      if (!state.furniture.some((item) => item.id === state.selectedId)) return {}
      return {
        furniture: state.furniture.filter((item) => item.id !== state.selectedId),
        hiddenElementIds: state.hiddenElementIds.filter((id) => id !== state.selectedId),
        lockedElementIds: state.lockedElementIds.filter((id) => id !== state.selectedId),
        elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, [state.selectedId]),
        selectedId: null,
        notice: 'Objeto eliminado.',
      }
    }),
    copySelected: () => {
      const state = get()
      if (state.selectedIds.length > 1) {
        const copies = state.selectedIds.map((id) => state.furniture.find((item) => item.id === id) ?? state.room.windows.find((item) => item.id === id))
        if (copies.some((item) => !item)) return false
        runtime.copiedElements = copies.map((item) => ({ ...item! }))
        runtime.copiedElement = null
        set({ notice: `${copies.length} elementos copiados.` })
        return true
      }
      const furniture = state.furniture.find((item) => item.id === state.selectedId)
      if (furniture) {
        runtime.copiedElements = null
        runtime.copiedElement = { ...furniture }
        set({ notice: `${furniture.name} copiado.` })
        return true
      }
      const window = state.room.windows.find((item) => item.id === state.selectedId)
      if (window) {
        runtime.copiedElements = null
        runtime.copiedElement = { ...window }
        set({ notice: `${elementName(state, window.id)} copiado.` })
        return true
      }
      return false
    },
    pasteSelected: () => {
      if (runtime.copiedElements) {
        const copies = runtime.copiedElements
        set((state) => {
          const furniture = [...state.furniture]
          const windows = [...state.room.windows]
          const assignments = { ...state.elementFolderAssignments }
          const pastedIds: string[] = []
          for (const copy of copies) {
            if ('kind' in copy) {
              const item: FurnitureItem = { ...copy, id: makeId(copy.kind), attachmentPolicy: 'by-type' }
              if (!item.axisLocks) item.y = canElevateFurniture(item) ? snapMeasurement(item.y) : clampFurnitureElevation(item, state.room, false)
              const offsets = [[0.5, 0.5], [0.5, 0], [0, 0.5], [-0.5, 0], [0, -0.5], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]] as const
              const room = { ...state.room, windows }
              const position = offsets.map(([x, z]) => ({ x: snapMeasurement(copy.x + x), z: snapMeasurement(copy.z + z) }))
                .find((candidate) => canPlaceFurniture({ ...item, ...candidate }, furniture)) ?? findFreeFurniturePosition(item, room, furniture)
              if (!position) return { notice: 'No hay espacio para duplicar toda la selección.' }
              furniture.push({ ...item, ...position })
              pastedIds.push(item.id)
            } else {
              const id = makeId('window')
              const room = { ...state.room, windows }
              const length = wallLength(room, copy.wall)
              const pasted = [0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2].map((delta) => ({ ...copy, id, offset: snapMeasurement(copy.offset + delta), sill: snapMeasurement(copy.sill) }))
                .find((candidate) => !validateOpenings({ ...room, windows: [...windows, candidate] }))
              if (!pasted || Math.abs(pasted.offset) + pasted.width / 2 > length / 2 - ROOM_LIMITS.edgeMargin) return { notice: 'No hay espacio para duplicar toda la selección.' }
              windows.push(pasted)
              pastedIds.push(id)
            }
            const folder = state.elementFolderAssignments[copy.id]
            if (folder) assignments[pastedIds[pastedIds.length - 1]] = folder
          }
          return { room: { ...state.room, windows }, furniture, elementFolderAssignments: assignments, selectedId: null, selectedIds: pastedIds, selectionAnchor: pastedIds[0] ?? null, notice: `${pastedIds.length} elementos pegados.` }
        })
        return true
      }
      if (!runtime.copiedElement) return false
      const copy = runtime.copiedElement
      set((state) => {
        if ('kind' in copy) {
          const item: FurnitureItem = { ...copy, id: makeId(copy.kind), attachmentPolicy: 'by-type' }
          if (!item.axisLocks) item.y = canElevateFurniture(item) ? snapMeasurement(item.y) : clampFurnitureElevation(item, state.room, false)
          const offsets = [
            [0.5, 0.5], [0.5, 0], [0, 0.5], [-0.5, 0], [0, -0.5],
            [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5],
          ] as const
          const position = offsets
            .map(([x, z]) => ({ x: snapMeasurement(copy.x + x), z: snapMeasurement(copy.z + z) }))
            .find((candidate) => canPlaceFurniture({ ...item, ...candidate }, state.furniture))
            ?? findFreeFurniturePosition(item, state.room, state.furniture)
          if (!position) {
            return { notice: `No queda espacio libre para duplicar ${item.name.toLowerCase()}.` }
          }
          const pasted = {
            ...item,
            ...position,
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
          .map((delta) => ({ ...source, id, offset: snapMeasurement(source.offset + delta), sill: snapMeasurement(source.sill) }))
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
    toggleElementLock: (id) => set((state) => {
      const isLocked = state.lockedElementIds.includes(id)
      recordInteraction('state.element.lock', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: elementName(state, id), locked: !isLocked },
      })
      return {
        lockedElementIds: isLocked
          ? state.lockedElementIds.filter((elementId) => elementId !== id)
          : [...state.lockedElementIds, id],
      }
    }),
    clearNotice: () => set({ notice: '' }),
  }
}
