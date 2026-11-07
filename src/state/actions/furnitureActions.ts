import { finishHistoryTransaction } from '../historyTransactions'
import { applyFurnitureRotation, elevatedFurniture, movedFurniture } from '../../domain/editingRules'
import { makeId } from '../../domain/elementIds'
import { withoutFolderAssignments } from '../../domain/elementFolders'
import { elementName } from '../../domain/selection'
import { FURNITURE_PRESETS, furnitureVisualYOffset, isCeilingMountedFurniture, isWallPictureKind } from '../../domain/objectCatalog'
import { furnitureAxisLocks, unlockedAxes } from '../../domain/axisLocks'
import { supportingFloorTop } from '../../domain/furniturePlacement'
import { structureSurfaceElementId } from '../../domain/elementIds'
import { findFreeFurniturePosition, validateOpenings } from '../../domain/geometry'
import { snapMeasurement } from '../../domain/measurements'
import { furnitureSelectionBounds } from '../../domain/multiFurniture'
import { multiSelectionItems } from '../../domain/multiSelection'
import type { FurnitureItem } from '../../domain/types'
import { recordInteraction } from '../../debug/interactionLog'
import type { RoomActionContext, RoomState } from '../types'

type FurnitureActions = Pick<
  RoomState,
  | 'addFurniture'
  | 'beginFurnitureMove'
  | 'endFurnitureMove'
  | 'moveFurniture'
  | 'setElementAxisLock'
  | 'moveSelectedFurnitureGroup'
  | 'moveSelectedFurnitureGroupBy'
  | 'rotateSelectedFurnitureGroup'
  | 'colorSelectedFurnitureGroup'
  | 'moveFurnitureVertically'
  | 'setFurnitureColor'
  | 'setFurnitureRotation'
  | 'rotateFurniture'
  | 'removeFurniture'
>

export function createFurnitureActions(context: Pick<RoomActionContext, 'set' | 'get' | 'runtime'>): FurnitureActions {
  const { set, get, runtime } = context
  return {
    setElementAxisLock: (id, axis, locked) => set((state) => {
      if (state.lockedElementIds.includes(id)) return {}
      const item = state.furniture.find((candidate) => candidate.id === id)
      if (item) {
        const locks = furnitureAxisLocks(item)
        if (locks[axis] === locked) return {}
        return { furniture: state.furniture.map((candidate) => candidate.id !== id ? candidate : {
          ...candidate, y: candidate.y + furnitureVisualYOffset(candidate, state), axisLocks: { ...locks, [axis]: locked },
        }) }
      }
      if (id === 'door') return { room: { ...state.room, door: { ...state.room.door, axisLocks: { ...unlockedAxes(), ...state.room.door.axisLocks, [axis]: locked } } } }
      if (state.room.windows.some((window) => window.id === id)) return { room: { ...state.room, windows: state.room.windows.map((window) => window.id !== id ? window : { ...window, axisLocks: { ...unlockedAxes(), ...window.axisLocks, [axis]: locked } }) } }
      return { structurePacks: state.structurePacks.map((pack) => pack.id === id
        ? { ...pack, axisLocks: { ...unlockedAxes(), ...pack.axisLocks, [axis]: locked } }
        : { ...pack, surfaces: pack.surfaces.map((surface) => structureSurfaceElementId(pack.id, surface.id) !== id ? surface : { ...surface, axisLocks: { ...unlockedAxes(), ...surface.axisLocks, [axis]: locked } }) }) }
    }),
    moveSelectedFurnitureGroup: (axis, delta) => get().moveSelectedFurnitureGroupBy({ x: axis === 'x' ? delta : 0, y: axis === 'y' ? delta : 0, z: axis === 'z' ? delta : 0 }),
    moveSelectedFurnitureGroupBy: (delta) => set((state) => {
      const items = multiSelectionItems(state)
      const ids = new Set(items.map((item) => item.id))
      if (items.length < 2 || items.some((item) => state.lockedElementIds.includes(item.id)) || state.selectedIds.some((id) => state.lockedElementIds.includes(id))) return {}
      if (items.some((item) => item.packId && state.lockedElementIds.includes(item.packId))) return {}
      const amount = { x: snapMeasurement(delta.x), y: snapMeasurement(delta.y), z: snapMeasurement(delta.z) }
      if (!Object.values(amount).every(Number.isFinite) || Object.values(amount).every((value) => Math.abs(value) < 1e-9)) return {}
      if ((['x', 'y', 'z'] as const).some((axis) => Math.abs(amount[axis]) > 1e-9 && items.some((item) => !item.axes.includes(axis)))) return { notice: 'Todos los elementos deben poder moverse en este eje.' }
      const furniture = state.furniture.map((item) => ids.has(item.id) ? { ...item, x: item.x + amount.x, y: item.y + amount.y, z: item.z + amount.z } : item)
      const shiftOpening = (wall: 'north' | 'east' | 'south' | 'west') => (wall === 'north' || wall === 'south' ? amount.x : amount.z) * (wall === 'south' || wall === 'west' ? -1 : 1)
      const room = { ...state.room,
        door: ids.has('door') ? { ...state.room.door, offset: state.room.door.offset + shiftOpening(state.room.door.wall) } : state.room.door,
        windows: state.room.windows.map((window) => !ids.has(window.id) ? window : { ...window, sill: window.sill + amount.y, offset: window.offset + shiftOpening(window.wall) }),
      }
      const structurePacks = state.structurePacks.map((pack) => {
        const wholePack = pack.id.startsWith('floor-pack-') && pack.surfaces.length > 0 && pack.surfaces.every((surface) => ids.has(`structure-surface:${pack.id}:${surface.id}`))
        if (wholePack) return { ...pack, x: pack.x + amount.x, y: pack.y + amount.y, z: pack.z + amount.z }
        return { ...pack, surfaces: pack.surfaces.map((surface) => ids.has(`structure-surface:${pack.id}:${surface.id}`) ? { ...surface, x: surface.x + amount.x, y: surface.y + amount.y, z: surface.z + amount.z } : surface) }
      })
      if (validateOpenings(room)) return { notice: 'No hay espacio suficiente para mover toda la selección.' }
      return { furniture, room, structurePacks, notice: '' }
    }),
    rotateSelectedFurnitureGroup: () => set((state) => {
      const selected = multiSelectionItems(state)
      const ids = new Set(selected.map((item) => item.id))
      const items = state.furniture.filter((item) => ids.has(item.id))
      const bounds = furnitureSelectionBounds(items, state)
      if (!bounds || items.length < 2 || items.length !== ids.size || state.selectedIds.some((id) => state.lockedElementIds.includes(id)) || items.some((item) => state.lockedElementIds.includes(item.id) || isCeilingMountedFurniture(item.kind))) return {}
      if (items.some((item) => furnitureAxisLocks(item).x || furnitureAxisLocks(item).z)) return { notice: 'Desbloquea X y Z en todos los objetos para girar la selección.' }
      const { x, z } = bounds.center
      const furniture = state.furniture.map((item) => ids.has(item.id) ? { ...item, x: x + item.z - z, z: z - item.x + x, rotation: (item.rotation + Math.PI / 2) % (2 * Math.PI) } : item)
      return { furniture, notice: '' }
    }),
    colorSelectedFurnitureGroup: (color) => set((state) => {
      const items = multiSelectionItems(state)
      const ids = new Set(items.map((item) => item.id))
      if (items.length < 2 || items.some((item) => state.lockedElementIds.includes(item.id)) || state.selectedIds.some((id) => state.lockedElementIds.includes(id))) return {}
      return { furniture: state.furniture.map((item) => ids.has(item.id) ? { ...item, color } : item), room: { ...state.room, door: ids.has('door') ? { ...state.room.door, color } : state.room.door, windows: state.room.windows.map((window) => ids.has(window.id) ? { ...window, color } : window) }, structurePacks: state.structurePacks.map((pack) => ({ ...pack, surfaces: pack.surfaces.map((surface) => ids.has(`structure-surface:${pack.id}:${surface.id}`) ? { ...surface, color } : surface) })) }
    }),
    addFurniture: (kind) => {
      if (isWallPictureKind(kind)) return get().addWindow(kind)
      return set((state) => {
        const preset = FURNITURE_PRESETS[kind]
        const id = makeId(kind)
        const item: FurnitureItem = {
          ...preset,
          attachmentPolicy: 'by-type',
          id,
          x: 0,
          y: isCeilingMountedFurniture(kind) ? state.room.height - preset.height : 0,
          z: 0,
          rotation: 0,
        }
        const activePack = state.structurePacks.find((pack) => pack.id === state.activeRoomId)
        if (activePack) {
          item.x = activePack.x
          item.z = activePack.z
          item.y += activePack.y
        }
        const localFurniture = activePack ? state.furniture.map((candidate) => ({ ...candidate, x: candidate.x - activePack.x, z: candidate.z - activePack.z })) : state.furniture
        const localPosition = findFreeFurniturePosition(item, state.room, localFurniture)
        const position = localPosition && { x: localPosition.x + (activePack?.x ?? 0), z: localPosition.z + (activePack?.z ?? 0) }
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
        const placed = { ...item, ...position }
        if (kind === 'rug' || kind === 'circularRug' || kind === 'ceilingLamp') {
          placed.axisLocks = { x: false, y: true, z: false }
          if (kind !== 'ceilingLamp') placed.y = supportingFloorTop(placed, state) ?? placed.y
          else if (activePack) {
            const ceiling = activePack.surfaces.find((surface) => surface.kind === 'ceiling')
            placed.y = activePack.y + state.room.height + (ceiling ? ceiling.y - ceiling.height / 2 : 0) - placed.height
          }
        }
        return { furniture: [...state.furniture, placed], selectedId: id, notice: `${preset.name} añadido.` }
      })
    },
    beginFurnitureMove: () => {
      get().beginHistoryGesture()
    },
    endFurnitureMove: () => {
      const token = runtime.activeGesture?.token
      if (token) get().commitHistoryGesture(token)
      else finishHistoryTransaction(runtime)
    },
    moveFurniture: (id, x, z) => set((state) => {
      if (state.lockedElementIds.includes(id)) return {}
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
      if (state.lockedElementIds.includes(id)) return {}
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
      if (state.lockedElementIds.includes(id)) return {}
      const item = state.furniture.find((candidate) => candidate.id === id)
      if (!item) return {}
      const update = applyFurnitureRotation(state, item, rotation)
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
      if (state.selectedId && state.lockedElementIds.includes(state.selectedId)) return {}
      const item = state.furniture.find((candidate) => candidate.id === state.selectedId)
      if (!item) return {}
      const update = applyFurnitureRotation(state, item, item.rotation + Math.PI / 2)
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
        lockedElementIds: state.lockedElementIds.filter((id) => id !== state.selectedId),
        elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, state.selectedId ? [state.selectedId] : []),
        selectedId: null,
        notice: state.selectedId ? 'Objeto eliminado.' : state.notice,
      }
    }),
  }
}
