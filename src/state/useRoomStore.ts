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

export { structureSurfaceElementId } from '../domain/elementIds'

export const createRoomStore = (repository: DesignRepository = createLocalDesignRepository()) => create<RoomState>((storeSet, get) => {
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
    const nextState = { ...current, ...nextUpdate }
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
    setActiveRoomId: (activeRoomId) => set((state) => ({ activeRoomId, ...(state.view === 'isometric' ? { isoCameraHeight: state.structurePacks.find((pack) => pack.id === activeRoomId)?.y ?? 0 } : {}) })),
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
    ...createFurnitureActions(context),
    ...createSelectionActions(context),
    ...createFolderActions(context),
    ...createHistoryActions(context),
    ...createDesignActions(context),
    ...createResizeActions(context),
  }
})

export const useRoomStore = createRoomStore()
