import type { ElementFolder, FurnitureItem, FurnitureKind, GridSurface, PersistedDesign, RoomConfig, StructurePack, StructureSurfaceKey, ViewMode, WallSide, WindowConfig, WindowShape } from '../domain/types'
import type { PersistedLayout, SavedDesign } from '../domain/designV1'
import type { DesignRepository } from '../persistence/localDesignRepository'

export interface RoomState {
  room: RoomConfig
  furniture: FurnitureItem[]
  layouts: PersistedLayout[]
  activeLayoutId: string
  duplicateActiveLayout: () => void
  activateLayout: (id: string) => void
  renameLayout: (id: string, name: string) => void
  deleteAlternativeLayout: (id: string) => void
  structurePacks: StructurePack[]
  selectedId: string | null
  selectedIds: string[]
  selectionAnchor: string | null
  view: ViewMode
  isoOrientation: number
  topOrientation: number
  topCameraX: number
  topCameraZ: number
  activeRoomId: string | null
  setActiveRoomId: (id: string | null) => void
  isoAngle: number
  isoCameraHeight: number
  setIsoCameraHeight: (height: number) => void
  freeCameraOffset: { x: number; y: number; z: number }
  freeCameraNavigated: boolean
  moveFreeCamera: (x: number, y: number, z: number) => void
  isIsoOrbitDragging: boolean
  freeAzimuth: number
  freeElevation: number
  isFreeOrbitDragging: boolean
  cameraZoom: number
  freeCameraZoom: number
  povCameraZoom: number
  wallView: WallSide | null
  frontCameraHeight: number
  povYaw: number
  gridSnap: boolean
  gridVisibility: Record<GridSurface, boolean>
  showSelectionBounds: boolean
  toggleSelectionBounds: () => void
  hiddenElementIds: string[]
  lockedElementIds: string[]
  elementFolders: ElementFolder[]
  elementFolderAssignments: Record<string, string>
  sceneElementOrder: string[]
  notice: string
  undoCount: number
  redoCount: number
  savedDesigns: SavedDesign[]
  selectedSavedDesignId: string
  hasUnsavedChanges: boolean
  setView: (view: ViewMode) => void
  setTopCameraPosition: (x: number, z: number) => void
  resetTopCamera: () => void
  lookAtWall: (wall: WallSide) => void
  setFrontCameraHeight: (height: number) => void
  lookFromIsoOrientation: (orientation: number) => void
  setIsoAngle: (angle: number) => void
  setIsoOrbitDragging: (dragging: boolean) => void
  lookFromFreeOrbit: (azimuth: number, elevation: number) => void
  setFreeOrbit: (azimuth: number, elevation: number) => void
  setFreeOrbitDragging: (dragging: boolean) => void
  adjustCameraZoom: (deltaY: number) => void
  rotateFront: (direction: -1 | 1) => void
  rotateIso: (direction: -1 | 1) => void
  rotatePov: (direction: -1 | 1) => void
  setDimension: (key: 'width' | 'depth' | 'height', value: number) => void
  setWallColor: (color: string) => void
  setWallSideColor: (wall: WallSide, color: string) => void
  setFloorColor: (color: string) => void
  addStructurePack: (direction?: 'up' | 'down' | 'north' | 'south' | 'east' | 'west') => void
  addStructureObject: (kind: 'floor' | 'wall') => void
  moveStructurePack: (id: string, axis: 'x' | 'y' | 'z', value: number) => void
  moveStructureSurface: (packId: string, surfaceId: StructureSurfaceKey, axis: 'x' | 'y' | 'z', value: number) => void
  resizeStructureSurface: (packId: string, surfaceId: StructureSurfaceKey, dimension: 'width' | 'height' | 'depth', value: number) => void
  setStructureSurfaceRotation: (packId: string, surfaceId: StructureSurfaceKey, rotation: number) => void
  setStructureSurfaceColor: (packId: string, surfaceId: StructureSurfaceKey, color: string) => void
  addStructureSurface: (packId: string, surfaceId: StructureSurfaceKey) => void
  removeStructurePack: (id: string) => void
  removeStructureSurface: (packId: string, surfaceId: StructureSurfaceKey) => void
  beginStructureMove: () => void
  endStructureMove: () => void
  beginHistoryGesture: (targetId?: string | null) => HistoryGestureToken
  commitHistoryGesture: (token: HistoryGestureToken) => void
  cancelHistoryGesture: (token: HistoryGestureToken) => void
  isHistoryGestureActive: (token: HistoryGestureToken) => boolean
  setDoor: (partial: { wall?: WallSide; offset?: number; color?: string }) => void
  addWindow: (shape?: WindowShape) => void
  updateWindow: (id: string, partial: Partial<Pick<WindowConfig, 'wall' | 'offset' | 'width' | 'sill' | 'rotation' | 'color'>>) => void
  removeWindow: (id: string) => void
  addFurniture: (kind: FurnitureKind) => void
  selectElement: (id: string | null) => void
  selectSceneListItem: (id: string, mode: 'single' | 'toggle' | 'range', visibleIds: string[]) => void
  renameElement: (id: string, name: string) => void
  beginFurnitureMove: () => void
  endFurnitureMove: () => void
  moveFurniture: (id: string, x: number, z: number) => void
  moveSelectedFurnitureGroup: (axis: 'x' | 'y' | 'z', delta: number) => void
  moveSelectedFurnitureGroupBy: (delta: { x: number; y: number; z: number }) => void
  rotateSelectedFurnitureGroup: () => void
  colorSelectedFurnitureGroup: (color: string) => void
  moveFurnitureVertically: (id: string, y: number) => void
  setFurnitureColor: (id: string, color: string) => void
  setFurnitureRotation: (id: string, rotation: number) => void
  rotateFurniture: () => void
  removeFurniture: () => void
  removeSelected: () => void
  copySelected: () => boolean
  pasteSelected: () => boolean
  toggleGridVisibility: (surface: GridSurface) => void
  toggleElementVisibility: (id: string) => void
  toggleElementLock: (id: string) => void
  createElementFolder: (name: string, elementId?: string, parentId?: string) => void
  renameElementFolder: (id: string, name: string) => void
  moveElementFolder: (id: string, parentId: string | null) => void
  deleteElementFolder: (id: string, mode?: 'ungroup') => void
  moveElementToFolder: (elementId: string, folderId: string | null) => void
  moveSceneItems: (ids: string[], folderId: string | null, targetId?: string, position?: 'before' | 'after') => void
  groupSceneItems: (ids: string[]) => void
  removeSceneItems: (ids: string[]) => void
  stepSceneItems: (ids: string[], direction: 'up' | 'down') => void
  toggleSceneItemsVisibility: (ids: string[]) => void
  toggleSceneItemsLock: (ids: string[]) => void
  reorderSceneElement: (elementId: string, targetId: string, position: 'before' | 'after') => void
  toggleElementFolderVisibility: (id: string) => void
  toggleElementFolderLock: (id: string) => void
  undo: () => void
  redo: () => void
  initializeSavedDesigns: () => void
  selectSavedDesign: (id: string) => void
  deleteSavedDesign: (id?: string) => void
  createDesign: (mode: 'blank' | 'copy', name: string) => void
  renameSavedDesign: (id: string, name: string) => void
  saveDesign: () => void
  loadDesign: (id?: string) => void
  clearNotice: () => void
}

export type HistoryGestureToken = symbol

// Mutable editing context owned by each store instance, outside persisted world data.
export interface RoomRuntime {
  undoHistory: PersistedDesign[]
  redoHistory: PersistedDesign[]
  copiedElement: FurnitureItem | WindowConfig | null
  copiedElements: (FurnitureItem | WindowConfig)[] | null
  isUndoing: boolean
  activeGesture: {
    token: HistoryGestureToken
    targetId: string | null
    before: PersistedDesign
    hasChanges: boolean
  } | null
}

export type RoomUpdate = Partial<RoomState> | ((state: RoomState) => Partial<RoomState>)

export interface RoomActionContext {
  set: (update: RoomUpdate) => void
  get: () => RoomState
  runtime: RoomRuntime
  repository: DesignRepository
}
