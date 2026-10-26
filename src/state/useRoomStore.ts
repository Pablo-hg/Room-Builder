import { create } from 'zustand'
import { DEFAULT_FLOOR_COLOR, DEFAULT_ROOM, DEFAULT_WALL_COLOR, FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT, ROOM_LIMITS, WALL_SIDES } from '../domain/constants'
import { FURNITURE_PRESETS, isCeilingMountedFurniture, isWallMirrorShape, isWallPictureKind, isWallPictureShape, isWindowShape, OPENING_CATALOG, openingKindForShape } from '../domain/objectCatalog'
import {
  canPlaceFurniture,
  clampFurniture,
  clampFurnitureElevation,
  findFreeFurniturePosition,
  frontWallForOrientation,
  hasFurnitureCollisions,
  orientationForAzimuth,
  orientationForFrontWall,
  snapToPlacementGrid,
  snapToVisibleGrid,
  validateOpenings,
  wallLength,
  withDoor,
  withWindow,
} from '../domain/geometry'
import type { FurnitureItem, FurnitureKind, GridSurface, PersistedDesign, RoomConfig, StructurePack, StructureSurface, StructureSurfaceKey, ViewMode, WallSide, WindowConfig, WindowShape } from '../domain/types'
import { recordInteraction } from '../debug/interactionLog'

const STORAGE_KEY = 'room-builder:v0.1:design'
const SAVED_DESIGNS_KEY = 'room-builder:v0.1:designs'
const MAX_SAVED_DESIGNS = 5
const MAX_UNDO_STEPS = 50
const ISO_BASE_ANGLE = Math.PI / 4
const ISO_QUARTER_TURN = Math.PI / 2
const MIN_CAMERA_ZOOM = 0.25
const MAX_CAMERA_ZOOM = 3
const DEFAULT_GRID_VISIBILITY: Record<GridSurface, boolean> = {
  floor: true,
  north: true,
  east: true,
  south: true,
  west: true,
}

interface SavedDesign {
  id: string
  name: string
  savedAt: string
  data: PersistedDesign
}

const normalizeIsoAngle = (angle: number) => {
  const fullTurn = Math.PI * 2
  return ((angle % fullTurn) + fullTurn) % fullTurn
}

const normalizeFreeAzimuth = (azimuth: number) => {
  const fullTurn = Math.PI * 2
  return ((azimuth % fullTurn) + fullTurn) % fullTurn
}

const orientationForIsoAngle = (angle: number) => (
  Math.round((normalizeIsoAngle(angle) - ISO_BASE_ANGLE) / ISO_QUARTER_TURN) + 4
) % 4

const cloneRoom = (): RoomConfig => JSON.parse(JSON.stringify(DEFAULT_ROOM)) as RoomConfig
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
export const structureSurfaceElementId = (packId: string, surfaceId: string) => `structure-surface:${packId}:${surfaceId}`

function createStructureSurface(room: RoomConfig, id: StructureSurfaceKey): StructureSurface {
  if (id === 'floor') {
    return { id, kind: 'floor', name: 'Suelo', x: 0, y: 0, z: 0, width: room.width, height: 0.08, depth: room.depth, rotation: 0, color: room.floorColor ?? DEFAULT_FLOOR_COLOR }
  }
  if (id === 'ceiling') {
    return { id, kind: 'ceiling', name: 'Techo', x: 0, y: 0, z: 0, width: room.width, height: 0.08, depth: room.depth, rotation: 0, color: room.wallColor ?? DEFAULT_WALL_COLOR }
  }
  const wall = id.slice('wall-'.length) as WallSide
  const width = wall === 'east' || wall === 'west' ? room.depth : room.width
  return {
    id,
    kind: 'wall',
    wall,
    name: `Pared ${wall.toUpperCase()}`,
    x: 0,
    y: 0,
    z: 0,
    width,
    height: room.height,
    depth: 0.08,
    rotation: 0,
    color: room.wallColors?.[wall] ?? room.wallColor ?? DEFAULT_WALL_COLOR,
  }
}

function normalizeStructurePacks(value: unknown, room: RoomConfig): StructurePack[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('invalid structure packs')
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== 'object') throw new Error('invalid structure pack')
    const pack = candidate as Partial<StructurePack>
    if (
      typeof pack.id !== 'string'
      || typeof pack.name !== 'string'
      || ![pack.x, pack.y, pack.z].every((position) => typeof position === 'number' && Number.isFinite(position))
      || !Array.isArray(pack.surfaces)
    ) throw new Error('invalid structure pack')
    const seen = new Set<string>()
    const surfaces = pack.surfaces.map((surfaceCandidate) => {
      if (!surfaceCandidate || typeof surfaceCandidate !== 'object') throw new Error('invalid structure surface')
      const surface = surfaceCandidate as Partial<StructureSurface>
      const validWall = surface.wall === 'north' || surface.wall === 'east' || surface.wall === 'south' || surface.wall === 'west'
      const defaultSurface = ['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west'].includes(surface.id ?? '')
        ? createStructureSurface(room, surface.id as StructureSurfaceKey)
        : null
      if (
        typeof surface.id !== 'string'
        || !['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west'].includes(surface.id)
        || typeof surface.name !== 'string'
        || !['wall', 'floor', 'ceiling'].includes(surface.kind ?? '')
        || ![surface.x, surface.y, surface.z].every((position) => typeof position === 'number' && Number.isFinite(position))
        || ![surface.width ?? defaultSurface?.width, surface.height ?? defaultSurface?.height, surface.depth ?? defaultSurface?.depth, surface.rotation ?? 0]
          .every((dimension) => typeof dimension === 'number' && Number.isFinite(dimension) && dimension > 0)
        || typeof surface.color !== 'string'
        || seen.has(surface.id)
        || (surface.kind === 'wall' && (!validWall || surface.id !== `wall-${surface.wall}`))
        || (surface.kind !== 'wall' && surface.wall !== undefined)
        || (surface.id === 'floor' && surface.kind !== 'floor')
        || (surface.id === 'ceiling' && surface.kind !== 'ceiling')
      ) throw new Error('invalid structure surface')
      seen.add(surface.id)
      return {
        ...defaultSurface,
        ...surface,
        width: surface.width ?? defaultSurface!.width,
        height: surface.height ?? defaultSurface!.height,
        depth: surface.depth ?? defaultSurface!.depth,
        rotation: surface.rotation ?? 0,
      } as StructureSurface
    })
    return { ...pack, surfaces } as StructurePack
  })
}

interface RoomState {
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

function persistedDesign(state: Pick<RoomState, 'room' | 'furniture' | 'structurePacks' | 'gridSnap' | 'gridVisibility' | 'hiddenElementIds'>): PersistedDesign {
  return {
    version: 1,
    room: state.room,
    furniture: state.furniture,
    structurePacks: state.structurePacks,
    gridSnap: state.gridSnap,
    gridVisibility: state.gridVisibility,
    hiddenElementIds: state.hiddenElementIds,
  }
}

function persistedDesignSignature(design: PersistedDesign) {
  return JSON.stringify({
    version: design.version,
    room: design.room,
    furniture: design.furniture,
    structurePacks: design.structurePacks ?? [],
    gridSnap: design.gridSnap,
    gridVisibility: design.gridVisibility ?? DEFAULT_GRID_VISIBILITY,
    hiddenElementIds: design.hiddenElementIds ?? [],
  })
}

function isPersistedDesign(value: unknown): value is PersistedDesign {
  if (!value || typeof value !== 'object') return false
  const design = value as Partial<PersistedDesign>
  return design.version === 1
    && !!design.room
    && typeof design.room === 'object'
    && Array.isArray(design.furniture)
}

function readSavedDesigns(): SavedDesign[] {
  const rawDesigns = localStorage.getItem(SAVED_DESIGNS_KEY)
  if (rawDesigns !== null) {
    const parsed: unknown = JSON.parse(rawDesigns)
    if (!Array.isArray(parsed)) throw new Error('invalid saved designs')
    return parsed.slice(0, MAX_SAVED_DESIGNS).map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') throw new Error('invalid saved design')
      const saved = entry as Partial<SavedDesign>
      if (
        typeof saved.id !== 'string'
        || typeof saved.name !== 'string'
        || typeof saved.savedAt !== 'string'
        || !isPersistedDesign(saved.data)
      ) throw new Error('invalid saved design')
      return saved as SavedDesign
    })
  }

  const legacyDesign = localStorage.getItem(STORAGE_KEY)
  if (!legacyDesign) return []
  const data: unknown = JSON.parse(legacyDesign)
  if (!isPersistedDesign(data)) throw new Error('invalid saved design')
  const migrated: SavedDesign[] = [{
    id: makeId('design'),
    name: 'Diseño guardado anteriormente',
    savedAt: new Date().toISOString(),
    data,
  }]
  localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(migrated))
  return migrated
}

function elementName(state: Pick<RoomState, 'room' | 'furniture' | 'structurePacks'>, id: string | null) {
  if (!id) return null
  if (id === 'door') return 'Puerta'
  const windowIndex = state.room.windows.findIndex((window) => window.id === id)
  if (windowIndex >= 0) {
    const item = state.room.windows[windowIndex]
    const name = OPENING_CATALOG[openingKindForShape(item.shape)].name
    return `${name} ${windowIndex + 1}`
  }
  const pack = state.structurePacks.find((candidate) => candidate.id === id)
  if (pack) return pack.name
  for (const candidate of state.structurePacks) {
    const surface = candidate.surfaces.find((item) => structureSurfaceElementId(candidate.id, item.id) === id)
    if (surface) return `${candidate.name} · ${surface.name}`
  }
  return state.furniture.find((item) => item.id === id)?.name ?? id
}

function safeRoomUpdate(current: RoomState, candidate: RoomConfig): Partial<RoomState> {
  const error = validateOpenings(candidate)
  if (error) return { notice: error }
  const furniture = current.furniture.map((item) => ({ ...item, ...clampFurniture(item, candidate, current.gridSnap) }))
  furniture.forEach((item) => {
    item.y = isCeilingMountedFurniture(item.kind)
      ? Math.max(0, candidate.height - item.height)
      : clampFurnitureElevation(item, candidate, current.gridSnap)
  })
  if (hasFurnitureCollisions(furniture)) {
    return { notice: 'No se puede reducir la habitación porque los muebles quedarían solapados.' }
  }
  return {
    room: candidate,
    furniture,
    notice: '',
  }
}

function arrangeFurniture(items: FurnitureItem[], room: RoomConfig, snap: boolean) {
  const arranged: FurnitureItem[] = []
  for (const item of items) {
    const preset = FURNITURE_PRESETS[item.kind]
    if (!preset) return null
    const normalized = {
      ...item,
      width: preset.width,
      depth: preset.depth,
      height: preset.height,
      y: isCeilingMountedFurniture(item.kind)
        ? Math.max(0, room.height - preset.height)
        : typeof item.y === 'number' && Number.isFinite(item.y) ? item.y : 0,
    }
    const clamped = { ...normalized, ...clampFurniture(normalized, room, snap) }
    clamped.y = clampFurnitureElevation(clamped, room, snap)
    if (canPlaceFurniture(clamped, arranged)) {
      arranged.push(clamped)
      continue
    }
    const position = findFreeFurniturePosition(clamped, room, arranged)
    if (!position) return null
    arranged.push({ ...clamped, ...position })
  }
  return arranged
}

function migrateWallPictures(room: RoomConfig, furniture: FurnitureItem[]) {
  const windows = [...room.windows]
  const remainingFurniture: FurnitureItem[] = []
  const preferredWallFor = (item: FurnitureItem): { wall: WallSide; offset: number } => {
    const distances: { wall: WallSide; distance: number; offset: number }[] = [
      { wall: 'north', distance: Math.abs(item.z + room.depth / 2), offset: item.x },
      { wall: 'east', distance: Math.abs(item.x - room.width / 2), offset: item.z },
      { wall: 'south', distance: Math.abs(item.z - room.depth / 2), offset: -item.x },
      { wall: 'west', distance: Math.abs(item.x + room.width / 2), offset: -item.z },
    ]
    const preferred = distances.sort((a, b) => a.distance - b.distance)[0]
    return { wall: preferred.wall, offset: snapToVisibleGrid(preferred.offset) }
  }
  const offsets = [0, -0.5, 0.5, -1, 1, -1.5, 1.5, -2, 2]

  furniture.forEach((item) => {
    const legacyMirror = String(item.kind) === 'mirror'
    if (!isWallPictureKind(item.kind) && !legacyMirror) {
      remainingFurniture.push(item)
      return
    }
    const preferred = preferredWallFor(item)
    const shape = isWallPictureKind(item.kind) ? item.kind : 'mirrorRectangular'
    const definition = OPENING_CATALOG[shape]
    const walls = [preferred.wall, ...(['north', 'east', 'south', 'west'] as WallSide[]).filter((wall) => wall !== preferred.wall)]
    let placed = false

    for (const wall of walls) {
      const candidates = [preferred.offset, ...offsets.filter((offset) => offset !== preferred.offset)]
      for (const offset of candidates) {
        const picture: WindowConfig = {
          id: item.id,
          shape,
          wall,
          offset,
          width: definition.width,
          height: definition.height,
          sill: definition.defaultBottom,
          rotation: 0,
          color: item.color,
        }
        const candidateRoom = { ...room, windows: [...windows, picture] }
        if (validateOpenings(candidateRoom)) continue
        windows.push(picture)
        placed = true
        break
      }
      if (placed) break
    }

    if (!placed) remainingFurniture.push(item)
  })

  return { room: { ...room, windows }, remainingFurniture }
}

function applyFurnitureRotation(state: RoomState, item: FurnitureItem, rotation: number, showNotice: boolean): Partial<RoomState> {
  const fullTurn = Math.PI * 2
  const normalizedRotation = ((rotation % fullTurn) + fullTurn) % fullTurn
  const rotated = { ...item, rotation: normalizedRotation }
  const positioned = { ...rotated, ...clampFurniture(rotated, state.room, state.gridSnap) }
  if (!canPlaceFurniture(positioned, state.furniture)) {
    return showNotice ? { notice: 'No hay espacio suficiente para girar el objeto.' } : {}
  }
  return {
    furniture: state.furniture.map((candidate) => candidate.id === item.id ? positioned : candidate),
    notice: '',
  }
}

export const useRoomStore = create<RoomState>((storeSet, get) => {
  const undoHistory: PersistedDesign[] = []
  const redoHistory: PersistedDesign[] = []
  let copiedElement: FurnitureItem | WindowConfig | null = null
  let isUndoing = false
  let groupedMoveSnapshot: PersistedDesign | null = null
  let groupedMoveChanged = false
  const set = (update: Partial<RoomState> | ((state: RoomState) => Partial<RoomState>)) => {
    const current = get()
    const nextUpdate = typeof update === 'function' ? update(current) : update
    const nextState = { ...current, ...nextUpdate }
    const designChanged = persistedDesignSignature(persistedDesign(current)) !== persistedDesignSignature(persistedDesign(nextState))
    if (designChanged) {
      if (!isUndoing) {
        if (groupedMoveSnapshot) {
          if (!groupedMoveChanged) {
            undoHistory.push(groupedMoveSnapshot)
            groupedMoveChanged = true
            redoHistory.length = 0
          }
        } else {
          undoHistory.push(persistedDesign(current))
          redoHistory.length = 0
        }
        if (undoHistory.length > MAX_UNDO_STEPS) undoHistory.shift()
      }
      const activeDesign = nextState.savedDesigns.find((design) => design.id === nextState.selectedSavedDesignId)
      storeSet({
        ...nextUpdate,
        undoCount: undoHistory.length,
        redoCount: redoHistory.length,
        hasUnsavedChanges: !activeDesign || persistedDesignSignature(persistedDesign(nextState)) !== persistedDesignSignature(activeDesign.data),
      })
      return
    }
    storeSet(nextUpdate)
  }

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
  setView: (view) => set((state) => {
    recordInteraction('state.view.changed', {
      view: state.view,
      selectedId: state.selectedId,
      details: { previousView: state.view, nextView: view },
    })
    const orientation = state.view === 'free'
      ? orientationForAzimuth(state.freeAzimuth)
      : state.view === 'top'
        ? state.topOrientation
        : state.view === 'front' && state.wallView
          ? orientationForFrontWall(state.wallView)
          : state.isoOrientation
    const frontWall = state.view === 'front' && state.wallView
      ? state.wallView
      : frontWallForOrientation(orientation)
    return {
      view,
      topOrientation: view === 'top' ? orientation : state.topOrientation,
      wallView: view === 'front' || view === 'top' ? frontWall : null,
      isIsoOrbitDragging: false,
      isFreeOrbitDragging: false,
      notice: '',
    }
  }),
  lookAtWall: (wallView) => set((state) => {
    recordInteraction('state.wall-view.changed', {
      view: state.view,
      selectedId: state.selectedId,
      details: { previousWall: state.wallView, nextWall: wallView },
    })
    return { view: 'front', wallView, notice: '' }
  }),
  setFrontCameraHeight: (frontCameraHeight) => set((state) => {
    const nextHeight = Math.max(FRONT_CAMERA_MIN_HEIGHT, Math.min(FRONT_CAMERA_MAX_HEIGHT, frontCameraHeight))
    recordInteraction('state.camera.height', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: 'camera-height',
      details: { height: nextHeight },
    })
    return { frontCameraHeight: nextHeight }
  }),
  lookFromIsoOrientation: (orientation) => set((state) => {
    const normalizedOrientation = ((orientation % 4) + 4) % 4
    recordInteraction('state.camera.orientation', {
      view: state.view,
      selectedId: state.selectedId,
      details: { orientation: normalizedOrientation, mode: 'isometric' },
    })
    return {
      view: 'isometric',
      isoOrientation: normalizedOrientation,
      isoAngle: normalizeIsoAngle(ISO_BASE_ANGLE + normalizedOrientation * ISO_QUARTER_TURN),
      isIsoOrbitDragging: false,
      wallView: null,
      notice: '',
    }
  }),
  setIsoAngle: (angle) => set((state) => {
    const nextAngle = normalizeIsoAngle(angle)
    recordInteraction('state.camera.orientation', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: 'camera-orbit',
      details: { angle: nextAngle, degrees: nextAngle * 180 / Math.PI, mode: 'isometric' },
    })
    return {
      view: 'isometric',
      isoAngle: nextAngle,
      isoOrientation: orientationForIsoAngle(angle),
      wallView: null,
    }
  }),
  setIsoOrbitDragging: (isIsoOrbitDragging) => set({ isIsoOrbitDragging }),
  lookFromFreeOrbit: (freeAzimuth, freeElevation) => set((state) => {
    const nextAzimuth = normalizeFreeAzimuth(freeAzimuth)
    const nextElevation = Math.max(-1.48, Math.min(1.48, freeElevation))
    recordInteraction('state.camera.orientation', {
      view: state.view,
      selectedId: state.selectedId,
      details: { azimuth: nextAzimuth, elevation: nextElevation, mode: 'free' },
    })
    return {
      view: 'free',
      freeAzimuth: nextAzimuth,
      freeElevation: nextElevation,
      isFreeOrbitDragging: false,
      isIsoOrbitDragging: false,
      wallView: null,
      notice: '',
    }
  }),
  setFreeOrbit: (freeAzimuth, freeElevation) => set((state) => {
    const nextAzimuth = normalizeFreeAzimuth(freeAzimuth)
    const nextElevation = Math.max(-1.48, Math.min(1.48, freeElevation))
    recordInteraction('state.camera.orientation', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: 'camera-free-orbit',
      details: { azimuth: nextAzimuth, elevation: nextElevation, mode: 'free' },
    })
    return { freeAzimuth: nextAzimuth, freeElevation: nextElevation }
  }),
  setFreeOrbitDragging: (isFreeOrbitDragging) => set({ isFreeOrbitDragging }),
  adjustCameraZoom: (deltaY) => set((state) => {
    const limitedDelta = Math.max(-120, Math.min(120, deltaY))
    const cameraZoom = state.cameraZoom * Math.exp(-limitedDelta * 0.0015)
    const nextZoom = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, cameraZoom))
    recordInteraction('state.camera.zoom', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: 'camera-zoom',
      details: { zoom: nextZoom },
    })
    return { cameraZoom: nextZoom }
  }),
  rotateFront: (direction) => set((state) => {
    const walls: WallSide[] = ['north', 'east', 'south', 'west']
    const currentIndex = walls.indexOf(state.wallView ?? frontWallForOrientation(state.isoOrientation))
    const wallView = walls[(currentIndex + direction + walls.length) % walls.length]
    recordInteraction('state.wall-view.changed', {
      view: state.view,
      selectedId: state.selectedId,
      details: { previousWall: state.wallView, nextWall: wallView },
    })
    return {
      view: 'front',
      wallView,
      notice: '',
    }
  }),
  rotateIso: (direction) => set((state) => {
    const isoAngle = normalizeIsoAngle(state.isoAngle + direction * ISO_QUARTER_TURN)
    recordInteraction('state.camera.orientation', {
      view: state.view,
      selectedId: state.selectedId,
      details: { angle: isoAngle, degrees: isoAngle * 180 / Math.PI, mode: 'isometric-step' },
    })
    return { isoAngle, isoOrientation: orientationForIsoAngle(isoAngle), isIsoOrbitDragging: false, wallView: null }
  }),
  rotatePov: (direction) => set((state) => {
    const povYaw = Math.max(-55, Math.min(55, state.povYaw + direction * 15))
    recordInteraction('state.camera.orientation', {
      view: state.view,
      selectedId: state.selectedId,
      details: { degrees: povYaw, mode: 'pov' },
    })
    return { povYaw }
  }),
  setDimension: (key, value) => set((state) => {
    const min = key === 'width'
      ? ROOM_LIMITS.minWidth
      : key === 'depth'
        ? ROOM_LIMITS.minDepth
        : ROOM_LIMITS.minHeight
    const max = key === 'width'
      ? ROOM_LIMITS.maxWidth
      : key === 'depth'
        ? ROOM_LIMITS.maxDepth
        : ROOM_LIMITS.maxHeight
    const next = Math.max(min, Math.min(max, value))
    recordInteraction('state.room.dimension', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: `room-${key}`,
      details: { dimension: key === 'width' ? 'la anchura' : key === 'depth' ? 'la profundidad' : 'la altura', value: next },
    })
    const update = safeRoomUpdate(state, { ...state.room, [key]: next })
    if (key === 'height' && update.room && Math.abs(state.frontCameraHeight - state.room.height / 2) < 0.001) {
      return {
        ...update,
        frontCameraHeight: Math.max(FRONT_CAMERA_MIN_HEIGHT, Math.min(FRONT_CAMERA_MAX_HEIGHT, next / 2)),
      }
    }
    return update
  }),
  setWallColor: (wallColor) => set((state) => {
    recordInteraction('state.room.wall-color', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: 'room-wall-color',
      details: { color: wallColor },
    })
    return {
      room: {
        ...state.room,
        wallColor,
        wallColors: Object.fromEntries(WALL_SIDES.map((wall) => [wall, wallColor])),
      },
      notice: '',
    }
  }),
  setWallSideColor: (wall, color) => set((state) => {
    recordInteraction('state.room.wall-color', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: `room-wall-color-${wall}`,
      details: { wall, color },
    })
    return {
      room: { ...state.room, wallColors: { ...state.room.wallColors, [wall]: color } },
      notice: '',
    }
  }),
  setFloorColor: (floorColor) => set((state) => {
    recordInteraction('state.room.floor-color', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: 'room-floor-color',
      details: { color: floorColor },
    })
    return { room: { ...state.room, floorColor }, notice: '' }
  }),
  addStructurePack: () => set((state) => {
    const id = makeId('floor-pack')
    const nextY = Math.max(state.room.height, ...state.structurePacks.map((pack) => pack.y + state.room.height))
    let floorNumber = 2
    while (state.structurePacks.some((pack) => pack.name === `Piso ${floorNumber}`)) floorNumber += 1
    const surfaceIds: StructureSurfaceKey[] = ['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west']
    const pack: StructurePack = {
      id,
      name: `Piso ${floorNumber}`,
      x: 0,
      y: nextY,
      z: 0,
      surfaces: surfaceIds.map((surfaceId) => createStructureSurface(state.room, surfaceId)),
    }
    recordInteraction('state.structure-pack.added', {
      view: state.view,
      selectedId: state.selectedId,
      details: { id, name: pack.name, y: pack.y },
    })
    return {
      structurePacks: [...state.structurePacks, pack],
      hiddenElementIds: [...state.hiddenElementIds, structureSurfaceElementId(id, 'ceiling')],
      selectedId: id,
      notice: `${pack.name} añadido.`,
    }
  }),
  addStructureObject: (kind) => set((state) => {
    const id = makeId(kind === 'floor' ? 'floor-object' : 'wall-object')
    const surfaceId: StructureSurfaceKey = kind === 'floor' ? 'floor' : 'wall-north'
    const surface = createStructureSurface(state.room, surfaceId)
    surface.name = kind === 'floor' ? 'Suelo independiente' : 'Pared independiente'
    if (kind === 'floor') surface.y = state.room.height / 2
    const ordinal = state.structurePacks.filter((pack) => pack.surfaces.some((item) => item.kind === kind)).length + 1
    const pack: StructurePack = {
      id,
      name: kind === 'floor' ? `Suelo ${ordinal}` : `Pared ${ordinal}`,
      x: 0,
      y: 0,
      z: 0,
      surfaces: [surface],
    }
    recordInteraction(`state.structure-object.${kind}-added`, {
      view: state.view,
      selectedId: state.selectedId,
      details: { id, name: pack.name, x: pack.x, z: pack.z },
    })
    return {
      structurePacks: [...state.structurePacks, pack],
      selectedId: structureSurfaceElementId(id, surfaceId),
      notice: `${pack.name} añadido.`,
    }
  }),
  moveStructurePack: (id, axis, value) => set((state) => {
    const pack = state.structurePacks.find((candidate) => candidate.id === id)
    if (!pack || !Number.isFinite(value)) return {}
    recordInteraction('state.structure-pack.moved', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: `structure-pack-${id}-${axis}`,
      details: { id, name: pack.name, axis, value },
    })
    return {
      structurePacks: state.structurePacks.map((candidate) => candidate.id === id ? { ...candidate, [axis]: value } : candidate),
      notice: '',
    }
  }),
  moveStructureSurface: (packId, surfaceId, axis, value) => set((state) => {
    const pack = state.structurePacks.find((candidate) => candidate.id === packId)
    if (!pack || !Number.isFinite(value) || !pack.surfaces.some((surface) => surface.id === surfaceId)) return {}
    recordInteraction('state.structure-surface.moved', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: `structure-surface-${packId}-${surfaceId}-${axis}`,
      details: { packId, surfaceId, name: pack.name, axis, value },
    })
    return {
      structurePacks: state.structurePacks.map((candidate) => candidate.id !== packId ? candidate : {
        ...candidate,
        surfaces: candidate.surfaces.map((surface) => surface.id === surfaceId ? { ...surface, [axis]: value } : surface),
      }),
      notice: '',
    }
  }),
  resizeStructureSurface: (packId, surfaceId, dimension, value) => set((state) => {
    if (!Number.isFinite(value) || value < 0.25 || value > 20) return {}
    const pack = state.structurePacks.find((candidate) => candidate.id === packId)
    const surface = pack?.surfaces.find((item) => item.id === surfaceId)
    if (!pack || !surface || surface[dimension] === value) return {}
    recordInteraction('state.structure-surface.resized', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: `structure-surface-${packId}-${surfaceId}-${dimension}`,
      details: { packId, surfaceId, name: pack.name, dimension, value },
    })
    return {
      structurePacks: state.structurePacks.map((pack) => pack.id !== packId ? pack : {
        ...pack,
        surfaces: pack.surfaces.map((item) => item.id === surfaceId ? { ...item, [dimension]: value } : item),
      }),
      notice: '',
    }
  }),
  setStructureSurfaceRotation: (packId, surfaceId, rotation) => set((state) => {
    const pack = state.structurePacks.find((candidate) => candidate.id === packId)
    const surface = pack?.surfaces.find((item) => item.id === surfaceId)
    if (!pack || !surface || surface.kind !== 'wall' || !Number.isFinite(rotation)) return {}
    const nextRotation = ((rotation + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
    if (surface.rotation === nextRotation) return {}
    recordInteraction('state.structure-surface.rotated', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: `structure-surface-${packId}-${surfaceId}-rotation`,
      details: { packId, surfaceId, name: pack.name, rotation: nextRotation },
    })
    return {
      structurePacks: state.structurePacks.map((pack) => pack.id !== packId ? pack : {
        ...pack,
        surfaces: pack.surfaces.map((item) => item.id === surfaceId ? { ...item, rotation: nextRotation } : item),
      }),
      notice: '',
    }
  }),
  setStructureSurfaceColor: (packId, surfaceId, color) => set((state) => {
    const pack = state.structurePacks.find((candidate) => candidate.id === packId)
    const surface = pack?.surfaces.find((item) => item.id === surfaceId)
    if (!pack || !surface || surface.color === color) return {}
    recordInteraction('state.structure-surface.color', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: `structure-surface-color-${packId}-${surfaceId}`,
      details: { packId, surfaceId, name: pack.name, color },
    })
    return {
      structurePacks: state.structurePacks.map((pack) => pack.id !== packId ? pack : {
        ...pack,
        surfaces: pack.surfaces.map((item) => item.id === surfaceId ? { ...item, color } : item),
      }),
      notice: '',
    }
  }),
  addStructureSurface: (packId, surfaceId) => set((state) => {
    const pack = state.structurePacks.find((candidate) => candidate.id === packId)
    if (!pack || pack.surfaces.some((surface) => surface.id === surfaceId)) return {}
    const surface = createStructureSurface(state.room, surfaceId)
    recordInteraction('state.structure-surface.added', {
      view: state.view,
      selectedId: state.selectedId,
      details: { packId, surfaceId, name: pack.name, surfaceName: surface.name },
    })
    return {
      structurePacks: state.structurePacks.map((candidate) => candidate.id === packId ? { ...candidate, surfaces: [...candidate.surfaces, surface] } : candidate),
      hiddenElementIds: state.hiddenElementIds.filter((id) => id !== structureSurfaceElementId(packId, surfaceId)),
      selectedId: structureSurfaceElementId(packId, surfaceId),
      notice: `${surface.name} añadido a ${pack.name}.`,
    }
  }),
  removeStructurePack: (id) => set((state) => {
    const pack = state.structurePacks.find((candidate) => candidate.id === id)
    if (!pack) return {}
    const surfaceIds = pack.surfaces.map((surface) => structureSurfaceElementId(pack.id, surface.id))
    recordInteraction('state.structure-pack.removed', {
      view: state.view,
      selectedId: state.selectedId,
      details: { id, name: pack.name },
    })
    return {
      structurePacks: state.structurePacks.filter((candidate) => candidate.id !== id),
      hiddenElementIds: state.hiddenElementIds.filter((hiddenId) => hiddenId !== id && !surfaceIds.includes(hiddenId)),
      selectedId: state.selectedId === id || surfaceIds.includes(state.selectedId ?? '') ? null : state.selectedId,
      notice: `${pack.name} eliminado.`,
    }
  }),
  removeStructureSurface: (packId, surfaceId) => set((state) => {
    const pack = state.structurePacks.find((candidate) => candidate.id === packId)
    if (!pack || !pack.surfaces.some((surface) => surface.id === surfaceId)) return {}
    const selectedSurfaceId = structureSurfaceElementId(packId, surfaceId)
    recordInteraction('state.structure-surface.removed', {
      view: state.view,
      selectedId: state.selectedId,
      details: { packId, surfaceId, name: pack.name, surfaceName: pack.surfaces.find((surface) => surface.id === surfaceId)?.name },
    })
    return {
      structurePacks: state.structurePacks.map((candidate) => candidate.id !== packId ? candidate : {
        ...candidate,
        surfaces: candidate.surfaces.filter((surface) => surface.id !== surfaceId),
      }),
      hiddenElementIds: state.hiddenElementIds.filter((id) => id !== selectedSurfaceId),
      selectedId: state.selectedId === selectedSurfaceId ? null : state.selectedId,
      notice: 'Superficie eliminada.',
    }
  }),
  beginStructureMove: () => {
    groupedMoveSnapshot = persistedDesign(get())
    groupedMoveChanged = false
  },
  endStructureMove: () => {
    groupedMoveSnapshot = null
    groupedMoveChanged = false
  },
  setDoor: (partial) => set((state) => {
    const adjusted = partial.offset === undefined
      ? partial
      : { ...partial, offset: snapToPlacementGrid(partial.offset) }
    const candidate = withDoor(state.room, { ...adjusted, rotation: 0 })
    const update = safeRoomUpdate(state, candidate)
    if (update.room) {
      recordInteraction('state.opening.updated', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: 'opening-door',
        details: { id: 'door', name: 'Puerta', ...candidate.door },
      })
    }
    return update
  }),
  addWindow: (shape = 'rectangular') => set((state) => {
    const definition = OPENING_CATALOG[openingKindForShape(shape)]
    const walls: WallSide[] = ['north', 'east', 'south', 'west']
    const offsets = [0, -1.25, 1.25, -2, 2]
    for (const wall of walls) {
      for (const offset of offsets) {
        const window: WindowConfig = {
          id: makeId('window'),
          shape,
          wall,
          offset,
          width: definition.width,
          height: definition.height,
          sill: definition.defaultBottom,
          rotation: 0,
          color: isWallPictureShape(shape)
            ? FURNITURE_PRESETS[shape].color
            : isWallMirrorShape(shape)
              ? '#9a8067'
              : shape === 'wallSconce'
                ? '#d3a755'
              : '#c88f58',
        }
        const candidate = { ...state.room, windows: [...state.room.windows, window] }
        if (!validateOpenings(candidate)) {
          recordInteraction('state.window.added', {
            view: state.view,
            selectedId: state.selectedId,
            details: { id: window.id, name: `${definition.name} ${state.room.windows.length + 1}`, wall, offset, selectedAfter: window.id },
          })
          return { room: candidate, selectedId: window.id, notice: `${definition.name} añadida.` }
        }
      }
    }
    return { notice: `No queda espacio válido para colocar ${definition.name.toLowerCase()}.` }
  }),
  updateWindow: (id, partial) => set((state) => {
    const currentWindow = state.room.windows.find((window) => window.id === id)
    if (!currentWindow) return {}
    const adjusted = {
      ...partial,
      ...(partial.offset === undefined ? {} : { offset: snapToVisibleGrid(partial.offset) }),
      ...(partial.sill === undefined ? {} : {
        sill: Math.max(
          0,
          Math.min(
            Math.floor((state.room.height - currentWindow.height - 0.08) / ROOM_LIMITS.gridSize) * ROOM_LIMITS.gridSize,
            snapToVisibleGrid(partial.sill),
          ),
        ),
      }),
    }
    const candidate = withWindow(state.room, id, adjusted)
    const update = safeRoomUpdate(state, candidate)
    const nextWindow = candidate.windows.find((window) => window.id === id)
    if (update.room && nextWindow) {
      recordInteraction('state.opening.updated', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `opening-${id}`,
        details: { ...nextWindow, name: elementName(state, id) },
      })
    }
    return update
  }),
  removeWindow: (id) => set((state) => {
    recordInteraction('state.element.removed', {
      view: state.view,
      selectedId: state.selectedId,
      details: { id, name: elementName(state, id) },
    })
    return {
      room: { ...state.room, windows: state.room.windows.filter((window) => window.id !== id) },
      hiddenElementIds: state.hiddenElementIds.filter((elementId) => elementId !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      notice: '',
    }
  }),
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
  beginFurnitureMove: () => {
    groupedMoveSnapshot = persistedDesign(get())
    groupedMoveChanged = false
  },
  endFurnitureMove: () => {
    groupedMoveSnapshot = null
    groupedMoveChanged = false
  },
  moveFurniture: (id, x, z) => set((state) => {
    const item = state.furniture.find((candidate) => candidate.id === id)
    if (!item) return {}
    const moved = { ...item, ...clampFurniture({ ...item, x, z }, state.room, state.gridSnap) }
    if (!canPlaceFurniture(moved, state.furniture)) return {}
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
    if (!item || isWallPictureKind(item.kind)) return {}
    const movedY = clampFurnitureElevation({ ...item, y }, state.room, state.gridSnap)
    if (movedY === item.y) return {}
    const moved = { ...item, y: movedY }
    if (!canPlaceFurniture(moved, state.furniture)) return {}
    recordInteraction('state.furniture.elevation-changed', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: `furniture-elevation-${id}`,
      details: { id, name: item.name, y: movedY },
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
      copiedElement = { ...furniture }
      set({ notice: `${furniture.name} copiado.` })
      return true
    }
    const window = state.room.windows.find((item) => item.id === state.selectedId)
    if (window) {
      copiedElement = { ...window }
      set({ notice: `${elementName(state, window.id)} copiado.` })
      return true
    }
    return false
  },
  pasteSelected: () => {
    if (!copiedElement) return false
    const copy = copiedElement
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
  undo: () => {
    groupedMoveSnapshot = null
    groupedMoveChanged = false
    const previous = undoHistory.pop()
    if (!previous) return set({ notice: 'No hay cambios anteriores que deshacer.' })
    const current = get()
    redoHistory.push(persistedDesign(current))
    isUndoing = true
    set({
      ...previous,
      structurePacks: previous.structurePacks ?? [],
      selectedId: null,
      undoCount: undoHistory.length,
      redoCount: redoHistory.length,
      notice: 'Cambio anterior deshecho.',
    })
    isUndoing = false
    recordInteraction('state.design.undo', { view: current.view, selectedId: current.selectedId })
  },
  redo: () => {
    groupedMoveSnapshot = null
    groupedMoveChanged = false
    const next = redoHistory.pop()
    if (!next) return set({ notice: 'No hay cambios posteriores que rehacer.' })
    const current = get()
    undoHistory.push(persistedDesign(current))
    if (undoHistory.length > MAX_UNDO_STEPS) undoHistory.shift()
    isUndoing = true
    set({
      ...next,
      structurePacks: next.structurePacks ?? [],
      selectedId: null,
      undoCount: undoHistory.length,
      redoCount: redoHistory.length,
      notice: 'Cambio anterior rehecho.',
    })
    isUndoing = false
    recordInteraction('state.design.redo', { view: current.view, selectedId: current.selectedId })
  },
  initializeSavedDesigns: () => {
    try {
      const savedDesigns = readSavedDesigns()
      set({ savedDesigns, selectedSavedDesignId: '' })
    } catch {
      set({ notice: 'No se pudieron leer los diseños guardados.' })
    }
  },
  selectSavedDesign: (selectedSavedDesignId) => set({ selectedSavedDesignId }),
  deleteSavedDesign: (id) => {
    const state = get()
    const designId = id ?? state.selectedSavedDesignId
    if (!designId) return
    const savedDesigns = state.savedDesigns.filter((design) => design.id !== designId)
    try {
      localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(savedDesigns))
      recordInteraction('state.design.deleted', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id: designId },
      })
      set({
        savedDesigns,
        selectedSavedDesignId: state.selectedSavedDesignId === designId ? '' : state.selectedSavedDesignId,
        hasUnsavedChanges: state.selectedSavedDesignId === designId || state.hasUnsavedChanges,
        notice: 'Diseño guardado eliminado.',
      })
    } catch {
      set({ notice: 'No se pudo eliminar el diseño guardado.' })
    }
  },
  createDesign: (mode, name) => {
    const state = get()
    const cleanName = name.trim()
    if (!cleanName) return set({ notice: 'Escribe un nombre para el diseño.' })
    if (state.savedDesigns.length >= MAX_SAVED_DESIGNS) {
      return set({ notice: 'Ya hay 5 diseños guardados. Elimina uno antes de crear otro.' })
    }
    const data: PersistedDesign = mode === 'copy'
      ? persistedDesign(state)
      : {
        version: 1,
        room: cloneRoom(),
        furniture: [],
        structurePacks: [],
        gridSnap: true,
        gridVisibility: { ...DEFAULT_GRID_VISIBILITY },
        hiddenElementIds: [],
      }
    const savedAt = new Date().toISOString()
    const design: SavedDesign = {
      id: makeId('design'),
      name: cleanName,
      savedAt,
      data,
    }
    const savedDesigns = [...state.savedDesigns, design]
    try {
      localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(savedDesigns))
      recordInteraction('state.design.created', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id: design.id, mode },
      })
      set({
        savedDesigns,
        selectedSavedDesignId: design.id,
        room: data.room,
        furniture: data.furniture,
        structurePacks: data.structurePacks ?? [],
        gridSnap: data.gridSnap,
        gridVisibility: data.gridVisibility ?? { ...DEFAULT_GRID_VISIBILITY },
        hiddenElementIds: data.hiddenElementIds ?? [],
        selectedId: null,
        hasUnsavedChanges: false,
        notice: mode === 'blank' ? 'Diseño nuevo creado en blanco.' : 'Copia del diseño creada.',
      })
    } catch {
      set({ notice: 'No se pudo crear el diseño en el almacenamiento local.' })
    }
  },
  renameSavedDesign: (id, name) => {
    const state = get()
    const cleanName = name.trim()
    if (!cleanName) return set({ notice: 'El nombre del diseño no puede estar vacío.' })
    const savedDesigns = state.savedDesigns.map((design) => design.id === id ? { ...design, name: cleanName } : design)
    try {
      localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(savedDesigns))
      recordInteraction('state.design.renamed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id },
      })
      set({ savedDesigns, notice: 'Nombre del diseño actualizado.' })
    } catch {
      set({ notice: 'No se pudo cambiar el nombre del diseño.' })
    }
  },
  saveDesign: () => {
    const state = get()
    const activeDesign = state.savedDesigns.find((design) => design.id === state.selectedSavedDesignId)
    if (!activeDesign && state.savedDesigns.length >= MAX_SAVED_DESIGNS) {
      return set({ notice: 'Ya hay 5 diseños guardados. Elimina uno antes de guardar otro.' })
    }
    const data = persistedDesign(state)
    const savedAt = new Date().toISOString()
    const savedDesign: SavedDesign = activeDesign
      ? { ...activeDesign, savedAt, data }
      : {
        id: makeId('design'),
        name: `Diseño ${state.savedDesigns.length + 1}`,
        savedAt,
        data,
      }
    const savedDesigns = activeDesign
      ? state.savedDesigns.map((design) => design.id === activeDesign.id ? savedDesign : design)
      : [...state.savedDesigns, savedDesign]
    try {
      localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(savedDesigns))
      recordInteraction(activeDesign ? 'state.design.updated' : 'state.design.saved', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id: savedDesign.id },
      })
      set({
        savedDesigns,
        selectedSavedDesignId: savedDesign.id,
        hasUnsavedChanges: false,
        notice: activeDesign ? 'Cambios guardados en el diseño actual.' : 'Diseño guardado en este navegador.',
      })
    } catch {
      set({ notice: 'No se pudo acceder al almacenamiento local.' })
    }
  },
  loadDesign: (id) => {
    try {
      const current = get()
      const saved = current.savedDesigns.find((design) => design.id === (id ?? current.selectedSavedDesignId))
      if (!saved) return set({ notice: 'Selecciona un diseño guardado para recuperarlo.' })
      const data = saved.data
      if (!isPersistedDesign(data)) throw new Error('invalid')
      const normalizedRoom: RoomConfig = {
        ...data.room,
        wallColor: typeof data.room.wallColor === 'string' ? data.room.wallColor : DEFAULT_WALL_COLOR,
        wallColors: Object.fromEntries(WALL_SIDES.flatMap((wall) => {
          const color = data.room.wallColors?.[wall]
          return typeof color === 'string' ? [[wall, color]] : []
        })),
        floorColor: typeof data.room.floorColor === 'string' ? data.room.floorColor : DEFAULT_FLOOR_COLOR,
        door: {
          ...data.room.door,
          width: OPENING_CATALOG.door.width,
          height: OPENING_CATALOG.door.height,
          rotation: 0,
          color: typeof data.room.door.color === 'string' ? data.room.door.color : '#ac704b',
        },
        windows: data.room.windows.map((window) => {
          const shape = isWindowShape(window.shape) ? window.shape : 'rectangular'
          const definition = OPENING_CATALOG[openingKindForShape(shape)]
          return {
            ...window,
            shape,
            width: definition.width,
            height: definition.height,
            offset: snapToVisibleGrid(window.offset),
            sill: typeof window.sill === 'number'
              ? snapToVisibleGrid(window.sill)
              : definition.defaultBottom,
            rotation: typeof window.rotation === 'number' ? window.rotation : 0,
            color: typeof window.color === 'string'
              ? window.color
              : isWallPictureShape(shape)
                ? FURNITURE_PRESETS[shape].color
                : isWallMirrorShape(shape)
                  ? '#9a8067'
                  : shape === 'wallSconce'
                    ? '#d3a755'
                  : '#c88f58',
          }
        }),
      }
      const structurePacks = normalizeStructurePacks(data.structurePacks, normalizedRoom)
      if (validateOpenings(normalizedRoom)) throw new Error('invalid')
      const migrated = migrateWallPictures(normalizedRoom, data.furniture)
      const furniture = arrangeFurniture(migrated.remainingFurniture, migrated.room, true)
      if (!furniture) throw new Error('invalid')
      recordInteraction('state.design.loaded', {
        view: current.view,
        selectedId: current.selectedId,
        details: { id: saved.id },
      })
      set({
        room: migrated.room,
        furniture,
        structurePacks,
        selectedSavedDesignId: saved.id,
        gridSnap: typeof data.gridSnap === 'boolean' ? data.gridSnap : true,
        gridVisibility: (Object.keys(DEFAULT_GRID_VISIBILITY) as GridSurface[]).reduce<Record<GridSurface, boolean>>(
          (visibility, surface) => ({
            ...visibility,
            [surface]: typeof data.gridVisibility?.[surface] === 'boolean'
              ? data.gridVisibility[surface]
              : DEFAULT_GRID_VISIBILITY[surface],
          }),
          { ...DEFAULT_GRID_VISIBILITY },
        ),
        hiddenElementIds: Array.isArray(data.hiddenElementIds)
          ? data.hiddenElementIds.filter((id): id is string => typeof id === 'string')
          : [],
        selectedId: null,
        hasUnsavedChanges: false,
        notice: 'Diseño recuperado.',
      })
    } catch {
      set({ notice: 'El diseño guardado no es válido.' })
    }
  },
  clearNotice: () => set({ notice: '' }),
  }
})
