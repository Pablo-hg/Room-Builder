import type { FurnitureItem, FurnitureKind, GridSurface, PersistedDesign, RoomConfig, StructurePack, StructureSurfaceKey, ViewMode, WallSide, WindowConfig, WindowShape } from '../domain/types'
import type { SavedDesign } from '../domain/designV1'
import type { DesignRepository } from '../persistence/localDesignRepository'

export interface RoomState {
  room: RoomConfig
  furniture: FurnitureItem[]
  structurePacks: StructurePack[]
  selectedId: string | null
  view: ViewMode
  isoOrientation: number
  topOrientation: number
  isoAngle: number
  isIsoOrbitDragging: boolean
  freeAzimuth: number
  freeElevation: number
  isFreeOrbitDragging: boolean
  cameraZoom: number
  wallView: WallSide | null
  frontCameraHeight: number
  povYaw: number
  gridSnap: boolean
  gridVisibility: Record<GridSurface, boolean>
  hiddenElementIds: string[]
  notice: string
  undoCount: number
  redoCount: number
  savedDesigns: SavedDesign[]
  selectedSavedDesignId: string
  hasUnsavedChanges: boolean
  setView: (view: ViewMode) => void
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
  addStructurePack: () => void
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
  beginFurnitureMove: () => void
  endFurnitureMove: () => void
  moveFurniture: (id: string, x: number, z: number) => void
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
  isUndoing: boolean
  activeGesture: { token: HistoryGestureToken; targetId: string | null; before: PersistedDesign; hasChanges: boolean } | null
}

export type RoomUpdate = Partial<RoomState> | ((state: RoomState) => Partial<RoomState>)

export interface RoomActionContext {
  set: (update: RoomUpdate) => void
  get: () => RoomState
  runtime: RoomRuntime
  repository: DesignRepository
}
