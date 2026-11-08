import { create } from 'zustand'
import { DEFAULT_ROOM } from '../domain/constants'
import { DEFAULT_GRID_VISIBILITY, persistedDesign, persistedDesignSignature } from '../domain/designV1'
import { createLocalDesignRepository, type DesignRepository } from '../persistence/localDesignRepository'
import { cloneRoom, ISO_BASE_ANGLE } from './defaults'
import { finishHistoryTransaction, recordHistoryChange } from './historyTransactions'
import type { RoomActionContext, RoomRuntime, RoomState, RoomUpdate } from './types'
import { createCameraActions } from './actions/cameraActions'
import { createConstructionActions } from './actions/constructionActions'
import { createFurnitureActions } from './actions/furnitureActions'
import { createSelectionActions } from './actions/selectionActions'
import { createHistoryActions } from './actions/historyActions'
import { createDesignActions } from './actions/designActions'
import { createFolderActions } from './actions/folderActions'
import { initialRoomFolder } from '../domain/elementFolders'
import { normalizeDesign } from '../persistence/designMigrations'
import { createResizeActions } from './actions/resizeActions'
import { createStructureDoorActions } from './actions/structureDoorActions'
import { rootDoorPack, structureDoorsWorldError, structureDoorPosition } from '../domain/structureDoors'
import { packRoomBox } from '../domain/roomEditing'
import { movedSceneFolderAssignments } from '../domain/spatialFolderPlacement'

export { structureSurfaceElementId } from '../domain/elementIds'

export const createRoomStore = (repository: DesignRepository = createLocalDesignRepository()) => create<RoomState>((storeSet, get) => {
  // Camera navigation is session state, never part of a saved design or undo entry.
  let roomFocusHistory: Array<string | null> = [null]
  const runtime: RoomRuntime = {
    undoHistory: [],
    redoHistory: [],
    copiedElement: null,
    copiedElements: null,
    isUndoing: false,
    activeGesture: null,
  }
  const set = (update: RoomUpdate) => {
    let current = get()
    const rawUpdate = typeof update === 'function' ? update(current) : update
    const interruptsGesture = runtime.activeGesture && ['selectedId', 'selectedIds', 'view'].some((key) => Object.prototype.hasOwnProperty.call(rawUpdate, key))
    if (interruptsGesture) {
      const restore = finishHistoryTransaction(runtime, undefined, persistedDesign(current))
      if (restore) {
        runtime.isUndoing = true
        storeSet({ ...restore, structurePacks: restore.structurePacks ?? [] })
        runtime.isUndoing = false
        current = get()
      }
    }
    let nextUpdate: Partial<RoomState> = Object.prototype.hasOwnProperty.call(rawUpdate, 'selectedId') && !Object.prototype.hasOwnProperty.call(rawUpdate, 'selectedIds')
      ? { ...rawUpdate, selectedIds: rawUpdate.selectedId ? [rawUpdate.selectedId] : [], selectionAnchor: rawUpdate.selectedId ?? null }
      : rawUpdate
    if (nextUpdate.structurePacks || nextUpdate.room) {
      const structurePacks = (nextUpdate.structurePacks ?? current.structurePacks).map((pack) => {
        const old = current.structurePacks.find((candidate) => candidate.id === pack.id)
        const removedWalls = old?.surfaces.filter((surface) => surface.kind === 'wall' && !pack.surfaces.some((candidate) => candidate.id === surface.id)).map((surface) => surface.wall) ?? []
        return pack.doors && removedWalls.length ? { ...pack, doors: pack.doors.filter((door) => !removedWalls.includes(door.wall)) } : pack
      })
      const remaining = new Set([...((nextUpdate.room ?? current.room).extraDoors ?? []).map((door) => door.id), ...structurePacks.flatMap((pack) => pack.doors?.map((door) => door.id) ?? [])])
      const removed = new Set([...(current.room.extraDoors ?? []).map((door) => door.id), ...current.structurePacks.flatMap((pack) => pack.doors?.map((door) => door.id) ?? [])].filter((id) => !remaining.has(id)))
      nextUpdate = { ...nextUpdate, structurePacks }
      if (removed.size) nextUpdate = { ...nextUpdate,
        hiddenElementIds: (nextUpdate.hiddenElementIds ?? current.hiddenElementIds).filter((id) => !removed.has(id)),
        lockedElementIds: (nextUpdate.lockedElementIds ?? current.lockedElementIds).filter((id) => !removed.has(id)),
        sceneElementOrder: (nextUpdate.sceneElementOrder ?? current.sceneElementOrder).filter((id) => !removed.has(id)),
        elementFolderAssignments: Object.fromEntries(Object.entries(nextUpdate.elementFolderAssignments ?? current.elementFolderAssignments).filter(([id]) => !removed.has(id))),
        selectedIds: (nextUpdate.selectedIds ?? current.selectedIds).filter((id) => !removed.has(id)),
        ...(removed.has(nextUpdate.selectedId ?? current.selectedId ?? '') ? { selectedId: null, selectedIds: [], selectionAnchor: null } : {}),
      }
    }
    const packs = nextUpdate.structurePacks ?? current.structurePacks
    const validFocus = (id: string | null) => id === null || packs.some((pack) => pack.id === id && pack.id.startsWith('floor-pack-'))
    const replacingDesign = Object.hasOwn(rawUpdate, 'room') && Object.hasOwn(rawUpdate, 'selectedSavedDesignId')
    let nextFocusHistory = replacingDesign ? [null] : roomFocusHistory.filter(validFocus)
    const requestedFocus = replacingDesign ? null : nextUpdate.activeRoomId === undefined ? current.activeRoomId : nextUpdate.activeRoomId
    const activeRoomId = validFocus(requestedFocus) ? requestedFocus : [...nextFocusHistory].reverse().find(validFocus) ?? null
    if (activeRoomId !== current.activeRoomId || activeRoomId !== requestedFocus || replacingDesign) {
      const pack = packs.find((candidate) => candidate.id === activeRoomId)
      const box = pack && packRoomBox(pack, nextUpdate.room ?? current.room)
      const origin = { x: (pack?.x ?? 0) + (box?.x ?? 0), y: (pack?.y ?? 0) + (box?.y ?? 0), z: (pack?.z ?? 0) + (box?.z ?? 0) }
      nextUpdate = { ...nextUpdate, activeRoomId, isoCameraHeight: origin.y,
        topCameraX: 0, topCameraZ: 0, freeCameraOffset: origin, freeCameraNavigated: false }
      nextFocusHistory = [...nextFocusHistory.filter((id) => id !== activeRoomId), activeRoomId]
    }
    // An element entering another room's 3D volume moves into that room's
    // scene folder in the SAME history entry as its geometry. Undo/redo restore
    // persisted assignments verbatim, without a second automatic reparenting.
    if (!runtime.isUndoing && !replacingDesign && (Object.hasOwn(rawUpdate, 'furniture') || Object.hasOwn(rawUpdate, 'structurePacks'))) {
      const movedAssignments = movedSceneFolderAssignments(
        current, { ...current, ...nextUpdate },
        Object.hasOwn(rawUpdate, 'furniture'), Object.hasOwn(rawUpdate, 'structurePacks'),
      )
      if (movedAssignments) nextUpdate = { ...nextUpdate, elementFolderAssignments: movedAssignments }
    }
    const nextState = { ...current, ...nextUpdate }
    if (Object.hasOwn(rawUpdate, 'room') || Object.hasOwn(rawUpdate, 'structurePacks')) {
      if (!runtime.isUndoing && !Object.hasOwn(rawUpdate, 'selectedSavedDesignId')) {
        for (const pack of [rootDoorPack(current.room), ...current.structurePacks]) for (const door of pack.doors ?? []) {
          const nextPack = pack.id === '__root__' ? rootDoorPack(nextState.room) : nextState.structurePacks.find((candidate) => candidate.id === pack.id)
          const nextDoor = nextPack?.doors?.find((candidate) => candidate.id === door.id)
          if (!nextPack || !nextDoor) continue
          const before = structureDoorPosition(current.room, pack, door)
          const after = structureDoorPosition(nextState.room, nextPack, nextDoor)
          if (before && after && (['x', 'y', 'z'] as const).some((axis) => (door.axisLocks?.[axis] || current.lockedElementIds.includes(door.id)) && Math.abs(before[axis] - after[axis]) > 1e-9)) { storeSet({ notice: 'El movimiento desplazaría un eje bloqueado de una puerta.' }); return }
        }
      }
      const error = structureDoorsWorldError(nextState.room, nextState.structurePacks)
      if (error) { storeSet({ notice: error }); return }
    }
    roomFocusHistory = nextFocusHistory
    const designChanged = persistedDesignSignature(persistedDesign(current)) !== persistedDesignSignature(persistedDesign(nextState))
    if (designChanged) {
      recordHistoryChange(runtime, persistedDesign(current))
      const activeDesign = nextState.savedDesigns.find((design) => design.id === nextState.selectedSavedDesignId)
      let savedSignature = ''
      if (activeDesign) {
        try { savedSignature = persistedDesignSignature(normalizeDesign(activeDesign.data)) }
        catch { /* Una entrada inválida no impide editar el diseño actual. */ }
      }
      storeSet({
        ...nextUpdate,
        undoCount: runtime.undoHistory.length,
        redoCount: runtime.redoHistory.length,
        hasUnsavedChanges: nextUpdate.hasUnsavedChanges ?? (!activeDesign || persistedDesignSignature(persistedDesign(nextState)) !== savedSignature),
      })
      return
    }
    storeSet(nextUpdate)
  }

  const context: RoomActionContext = { set, get, runtime, repository }

  return {
    room: cloneRoom(),
    furniture: [],
    structurePacks: [],
    selectedId: null,
    selectedIds: [],
    selectionAnchor: null,
    view: 'isometric',
    isoOrientation: 0,
    topOrientation: 0,
    topCameraX: 0,
    topCameraZ: 0,
    activeRoomId: null,
    setActiveRoomId: (activeRoomId) => set({ activeRoomId }),
    isoAngle: ISO_BASE_ANGLE,
    isoCameraHeight: 0,
    setIsoCameraHeight: (isoCameraHeight) => set({ isoCameraHeight }),
    freeCameraOffset: { x: 0, y: 0, z: 0 },
    freeCameraNavigated: false,
    moveFreeCamera: (x, y, z) => set((state) => ({ freeCameraNavigated: true, freeCameraOffset: { x: state.freeCameraOffset.x + x, y: state.freeCameraOffset.y + y, z: state.freeCameraOffset.z + z } })),
    isIsoOrbitDragging: false,
    freeAzimuth: ISO_BASE_ANGLE,
    freeElevation: 0.58,
    isFreeOrbitDragging: false,
    cameraZoom: 1,
    freeCameraZoom: 1,
    povCameraZoom: 1,
    wallView: null,
    frontCameraHeight: DEFAULT_ROOM.height / 2,
    povYaw: 0,
    gridSnap: true,
    gridVisibility: { ...DEFAULT_GRID_VISIBILITY },
    hiddenElementIds: [],
    lockedElementIds: [],
    ...initialRoomFolder(DEFAULT_ROOM),
    sceneElementOrder: [],
    notice: '',
    undoCount: 0,
    redoCount: 0,
    savedDesigns: [],
    selectedSavedDesignId: '',
    hasUnsavedChanges: false,
    ...createCameraActions(context),
    ...createConstructionActions(context),
    ...createStructureDoorActions(context),
    ...createFurnitureActions(context),
    ...createSelectionActions(context),
    ...createFolderActions(context),
    ...createHistoryActions(context),
    ...createDesignActions(context),
    ...createResizeActions(context),
  }
})

export const useRoomStore = createRoomStore()
