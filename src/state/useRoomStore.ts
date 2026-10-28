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

export { structureSurfaceElementId } from '../domain/elementIds'

export const createRoomStore = (repository: DesignRepository = createLocalDesignRepository()) => create<RoomState>((storeSet, get) => {
  const runtime: RoomRuntime = {
    undoHistory: [],
    redoHistory: [],
    copiedElement: null,
    isUndoing: false,
    activeGesture: null,
  }
  const set = (update: RoomUpdate) => {
    const current = get()
    const nextUpdate = typeof update === 'function' ? update(current) : update
    const nextState = { ...current, ...nextUpdate }
    if (runtime.activeGesture && (current.selectedId !== nextState.selectedId || current.view !== nextState.view)) {
      finishHistoryTransaction(runtime)
    }
    const designChanged = persistedDesignSignature(persistedDesign(current)) !== persistedDesignSignature(persistedDesign(nextState))
    if (designChanged) {
      recordHistoryChange(runtime, persistedDesign(current))
      const activeDesign = nextState.savedDesigns.find((design) => design.id === nextState.selectedSavedDesignId)
      storeSet({
        ...nextUpdate,
        undoCount: runtime.undoHistory.length,
        redoCount: runtime.redoHistory.length,
        hasUnsavedChanges: !activeDesign || persistedDesignSignature(persistedDesign(nextState)) !== persistedDesignSignature(activeDesign.data),
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
    view: 'isometric',
    isoOrientation: 0,
    topOrientation: 0,
    isoAngle: ISO_BASE_ANGLE,
    isIsoOrbitDragging: false,
    freeAzimuth: ISO_BASE_ANGLE,
    freeElevation: 0.58,
    isFreeOrbitDragging: false,
    cameraZoom: 1,
    wallView: null,
    frontCameraHeight: DEFAULT_ROOM.height / 2,
    povYaw: 0,
    gridSnap: true,
    gridVisibility: { ...DEFAULT_GRID_VISIBILITY },
    hiddenElementIds: [],
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
    ...createHistoryActions(context),
    ...createDesignActions(context),
  }
})

export const useRoomStore = createRoomStore()
