import type { DoorSwing, ElementFolder, FurnitureItem, FurnitureKind, GridSurface, PersistedDesign, RoomConfig, StructurePack, StructureSurfaceKey, ViewMode, WallSide, WindowConfig, WindowShape } from '../domain/types'
import type { SavedDesign } from '../domain/designV1'
import type { MeasureEnd, PlanMeasure, PlanPoint } from '../domain/planMeasures'
import type { DragGuide } from '../domain/dragGuides'
import type { DesignRepository } from '../persistence/localDesignRepository'

/** Qué cotas se superponen en «Mostrar detalles»: paredes, huecos, muebles (del seleccionado) y cotas guardadas. */
export interface PlanDetailCategories { walls: boolean; openings: boolean; furniture: boolean; annotations: boolean }

export interface RoomState {
  room: RoomConfig
  furniture: FurnitureItem[]
  structurePacks: StructurePack[]
  selectedId: string | null
  selectedIds: string[]
  selectionAnchor: string | null
  view: ViewMode
  isoOrientation: number
  topOrientation: number
  topCameraX: number
  topCameraZ: number
  /** Plano detallado: estado visual de sesión; no se guarda ni entra en el historial. */
  planDetailsVisible: boolean
  setPlanDetailsVisible: (visible: boolean) => void
  /** Categorías de cotas del Plano detallado (sesión): ni se guardan ni modifican el diseño. */
  planDetailCategories: PlanDetailCategories
  setPlanDetailCategory: (category: keyof PlanDetailCategories, visible: boolean) => void
  setMeasureToolActive: (active: boolean) => void
  setMeasureAxis: (axis: 'free' | 'horizontal' | 'vertical') => void
  setMeasureSnap: (snap: boolean) => void
  setMeasureDraft: (draft: { start: MeasureEnd; end: MeasureEnd | null } | null) => void
  setMeasureEditId: (id: string | null) => void
  /** Devuelve el id de la cota creada, o `null` si no era válida. */
  addMeasure: (start: MeasureEnd, end: MeasureEnd, name?: string) => string | null
  saveMeasureDraft: (name?: string) => string | null
  updateMeasure: (id: string, patch: { name?: string; hidden?: boolean; start?: PlanPoint | MeasureEnd; end?: PlanPoint | MeasureEnd }) => void
  /** Da por revisada la advertencia de una cota cuyo referente desapareció. */
  acknowledgeMeasure: (id: string) => void
  removeMeasure: (id: string) => void
  areaSelect: boolean
  setAreaSelect: (active: boolean) => void
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
  /** Preferencias de edición locales: no se guardan en el diseño ni entran en el historial (#37). */
  magnetismEnabled: boolean
  /** Unidad con la que se muestran las medidas (preferencia del navegador). */
  lengthUnit: import('../domain/lengthUnit').LengthUnit
  guidesEnabled: boolean
  /** Guías del arrastre en curso; solo existen mientras dura el gesto. */
  activeGuides: DragGuide[]
  gridVisibility: Record<GridSurface, boolean>
  /** Cotas manuales guardadas en el diseño (#38). */
  measurements: PlanMeasure[]
  /** Herramienta Medir: estado de sesión, ni se guarda ni entra en el historial. */
  measureToolActive: boolean
  /** Herramientas Pintar / Cuentagotas (#39): estado de sesión, ni se guarda ni entra en el historial. */
  paintTool: import('../domain/paintTool').PaintToolState | null
  /** Elemento bajo el pincel (vista previa), o null. */
  paintHoverId: string | null
  measureAxis: 'free' | 'horizontal' | 'vertical'
  measureSnap: boolean
  measureDraft: { start: MeasureEnd; end: MeasureEnd | null } | null
  /** Cota cuyos puntos se están moviendo en el plano (sesión; excluye a la herramienta Medir). */
  measureEditId: string | null
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
  setCameraZoom: (zoom: number) => void
  rotateFront: (direction: -1 | 1) => void
  rotateIso: (direction: -1 | 1) => void
  /** Gira el Plano un cuarto de vuelta (+1 = a la izquierda, −1 = a la derecha); solo cámara de sesión. */
  rotateTop: (direction: -1 | 1) => void
  rotatePov: (direction: -1 | 1) => void
  centerPov: () => void
  setDimension: (key: 'width' | 'depth' | 'height', value: number) => void
  setSelectedRoomDimension: (key: 'width' | 'depth' | 'height', value: number) => void
  setFocusedRoomDimension: (key: 'width' | 'depth' | 'height', value: number) => void
  setWallColor: (color: string) => void
  setWallSideColor: (wall: WallSide, color: string) => void
  setMaterialFinish: (elementId: string, finish: import('../domain/materials').MaterialFinish | null) => void
  startPaintTool: () => void
  stopPaintTool: () => void
  setPaintMode: (mode: import('../domain/paintTool').PaintMode) => void
  setPaintFinish: (finish: import('../domain/materials').MaterialFinish) => void
  setPaintHover: (id: string | null) => void
  /** Aplica el pincel al elemento; devuelve si se pintó (false si estaba bloqueado o no es pintable). */
  applyPaint: (id: string) => boolean
  /** Pinta varios elementos de una vez (un paso de deshacer); devuelve cuántos se pintaron. */
  applyPaintToMany: (ids: string[]) => number
  /** Copia el acabado del elemento al pincel; devuelve si había algo que copiar. */
  samplePaint: (id: string) => boolean
  setFloorColor: (color: string) => void
  addStructurePack: (direction?: 'up' | 'down' | 'north' | 'south' | 'east' | 'west') => void
  addStructureObject: (kind: 'floor' | 'wall') => void
  addStructureDoor: () => void
  setStructureDoor: (id: string, partial: { wall?: WallSide; offset?: number; color?: string; swing?: DoorSwing }) => void
  removeStructureDoor: (id: string) => void
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
  /** Abre un gesto que continúa el último paso del historial (creado justo antes a partir de `before`). */
  continueHistoryGesture: (before: PersistedDesign, targetId?: string | null) => HistoryGestureToken
  /** Deshace lo hecho durante el gesto sin dejar paso en el historial. */
  revertHistoryGesture: (token: HistoryGestureToken) => void
  isHistoryGestureActive: (token: HistoryGestureToken) => boolean
  setDoor: (partial: { wall?: WallSide; offset?: number; color?: string; swing?: DoorSwing }) => void
  addWindow: (shape?: WindowShape) => void
  updateWindow: (id: string, partial: Partial<Pick<WindowConfig, 'wall' | 'offset' | 'width' | 'sill' | 'rotation' | 'color'>>) => void
  moveWallObject: (id: string, axis: 'x' | 'y' | 'z', value: number) => void
  detachWallObject: (id: string) => void
  /** Deja el objeto de pared libre en esa posición (base) y orientación, en su misma habitación. */
  setWallObjectFreePosition: (id: string, position: { x: number; y: number; z: number; yaw: number }) => void
  removeWindow: (id: string) => void
  addFurniture: (kind: FurnitureKind) => void
  selectElement: (id: string | null) => void
  selectElements: (ids: string[], additive?: boolean) => void
  selectSceneListItem: (id: string, mode: 'single' | 'toggle' | 'range', visibleIds: string[]) => void
  renameElement: (id: string, name: string) => void
  beginFurnitureMove: () => void
  endFurnitureMove: () => void
  moveFurniture: (id: string, x: number, z: number, source?: 'pointer', axis?: 'x' | 'z') => void
  setMagnetism: (enabled: boolean) => void
  setLengthUnit: (unit: import('../domain/lengthUnit').LengthUnit) => void
  setGuides: (enabled: boolean) => void
  setGridSnap: (enabled: boolean) => void
  clearDragGuides: () => void
  guideGroupMove: (box: { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number }, delta: { x: number; z: number }, ids: string[], axes?: Array<'x' | 'z'>) => { dx: number; dz: number }
  setFurnitureWallAttachment: (id: string, attached: boolean) => void
  setFurnitureWallLateralLock: (id: string, locked: boolean) => void
  setElementAxisLock: (id: string, axis: 'x' | 'y' | 'z', locked: boolean) => void
  moveSelectedFurnitureGroup: (axis: 'x' | 'y' | 'z', delta: number) => void
  moveSelectedFurnitureGroupBy: (delta: { x: number; y: number; z: number }) => void
  rotateSelectedFurnitureGroup: () => void
  colorSelectedFurnitureGroup: (color: string) => void
  moveFurnitureVertically: (id: string, y: number) => void
  resizeFurniture: (id: string, dimension: 'width' | 'depth' | 'height', value: number) => void
  resizeWallObject: (id: string, dimension: 'width' | 'height', value: number) => void
  setFurnitureColor: (id: string, color: string) => void
  setFurnitureRotation: (id: string, rotation: number) => void
  rotateFurniture: () => void
  removeFurniture: () => void
  removeSelected: () => void
  copySelected: () => boolean
  cutSelected: () => boolean
  pasteSelected: () => boolean
  toggleGridVisibility: (surface: GridSurface) => void
  setGridGroupVisibility: (scope: 'focused' | 'all', visible: boolean) => void
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
  importDesign: (design: SavedDesign, open?: boolean) => string | null
  loadDesign: (id?: string) => void
  clearNotice: () => void
}

export type HistoryGestureToken = symbol

// Mutable editing context owned by each store instance, outside persisted world data.
export interface RoomRuntime {
  furnitureMoveSource?: 'pointer'
  undoHistory: PersistedDesign[]
  redoHistory: PersistedDesign[]
  copiedElement: FurnitureItem | WindowConfig | null
  copiedElements: (FurnitureItem | WindowConfig)[] | null
  /** Carpeta de cada elemento copiado en el momento de copiar o cortar. */
  copiedFolders: Record<string, string>
  copiedRoomOrigins: Record<string, { x: number; y: number; z: number }>
  /** El portapapeles viene de «Cortar»: el primer pegado conserva la posición original. */
  copiedCut: boolean
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
