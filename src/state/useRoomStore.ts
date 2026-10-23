import { create } from 'zustand'
import { DEFAULT_ROOM, FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT, FURNITURE_PRESETS, ROOM_LIMITS } from '../domain/constants'
import {
  canPlaceFurniture,
  clampFurniture,
  findFreeFurniturePosition,
  hasFurnitureCollisions,
  snapToPlacementGrid,
  snapToVisibleGrid,
  validateOpenings,
  withDoor,
  withWindow,
} from '../domain/geometry'
import type { FurnitureItem, FurnitureKind, GridSurface, PersistedDesign, RoomConfig, ViewMode, WallSide, WindowConfig } from '../domain/types'
import { recordInteraction } from '../debug/interactionLog'

const STORAGE_KEY = 'room-builder:v0.1:design'
const ISO_BASE_ANGLE = Math.PI / 4
const ISO_QUARTER_TURN = Math.PI / 2
const MIN_CAMERA_ZOOM = 0.55
const MAX_CAMERA_ZOOM = 2
const DEFAULT_GRID_VISIBILITY: Record<GridSurface, boolean> = {
  floor: true,
  north: true,
  east: true,
  south: true,
  west: true,
}

const normalizeIsoAngle = (angle: number) => {
  const fullTurn = Math.PI * 2
  return ((angle % fullTurn) + fullTurn) % fullTurn
}

const orientationForIsoAngle = (angle: number) => (
  Math.round((normalizeIsoAngle(angle) - ISO_BASE_ANGLE) / ISO_QUARTER_TURN) + 4
) % 4

const cloneRoom = (): RoomConfig => JSON.parse(JSON.stringify(DEFAULT_ROOM)) as RoomConfig
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

interface RoomState {
  room: RoomConfig
  furniture: FurnitureItem[]
  selectedId: string | null
  view: ViewMode
  isoOrientation: number
  isoAngle: number
  isIsoOrbitDragging: boolean
  cameraZoom: number
  wallView: WallSide | null
  frontCameraHeight: number
  povYaw: number
  gridSnap: boolean
  gridVisibility: Record<GridSurface, boolean>
  hiddenElementIds: string[]
  notice: string
  setView: (view: ViewMode) => void
  lookAtWall: (wall: WallSide) => void
  setFrontCameraHeight: (height: number) => void
  lookFromIsoOrientation: (orientation: number) => void
  setIsoAngle: (angle: number) => void
  setIsoOrbitDragging: (dragging: boolean) => void
  adjustCameraZoom: (deltaY: number) => void
  rotateFront: (direction: -1 | 1) => void
  rotateIso: (direction: -1 | 1) => void
  rotatePov: (direction: -1 | 1) => void
  setDimension: (key: 'width' | 'depth', value: number) => void
  setDoor: (partial: { wall?: WallSide; offset?: number; rotation?: number }) => void
  addWindow: () => void
  updateWindow: (id: string, partial: Partial<Pick<WindowConfig, 'wall' | 'offset' | 'width' | 'sill' | 'rotation'>>) => void
  removeWindow: (id: string) => void
  addFurniture: (kind: FurnitureKind) => void
  selectElement: (id: string | null) => void
  moveFurniture: (id: string, x: number, z: number) => void
  setFurnitureRotation: (id: string, rotation: number) => void
  rotateFurniture: () => void
  removeFurniture: () => void
  removeSelected: () => void
  toggleGridVisibility: (surface: GridSurface) => void
  toggleElementVisibility: (id: string) => void
  saveDesign: () => void
  loadDesign: () => void
  clearNotice: () => void
}

function elementName(state: Pick<RoomState, 'room' | 'furniture'>, id: string | null) {
  if (!id) return null
  if (id === 'door') return 'Puerta'
  const windowIndex = state.room.windows.findIndex((window) => window.id === id)
  if (windowIndex >= 0) return `Ventana ${windowIndex + 1}`
  return state.furniture.find((item) => item.id === id)?.name ?? id
}

function safeRoomUpdate(current: RoomState, candidate: RoomConfig): Partial<RoomState> {
  const error = validateOpenings(candidate)
  if (error) return { notice: error }
  const furniture = current.furniture.map((item) => ({ ...item, ...clampFurniture(item, candidate, current.gridSnap) }))
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
    }
    const clamped = { ...normalized, ...clampFurniture(normalized, room, snap) }
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

export const useRoomStore = create<RoomState>((set, get) => ({
  room: cloneRoom(),
  furniture: [],
  selectedId: null,
  view: 'isometric',
  isoOrientation: 0,
  isoAngle: ISO_BASE_ANGLE,
  isIsoOrbitDragging: false,
  cameraZoom: 1,
  wallView: null,
  frontCameraHeight: DEFAULT_ROOM.height / 2,
  povYaw: 0,
  gridSnap: true,
  gridVisibility: { ...DEFAULT_GRID_VISIBILITY },
  hiddenElementIds: [],
  notice: '',
  setView: (view) => set((state) => {
    recordInteraction('state.view.changed', {
      view: state.view,
      selectedId: state.selectedId,
      details: { previousView: state.view, nextView: view },
    })
    return {
      view,
      wallView: view === 'front' ? state.wallView ?? 'north' : null,
      isIsoOrbitDragging: false,
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
    const currentIndex = walls.indexOf(state.wallView ?? 'north')
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
    const min = key === 'width' ? ROOM_LIMITS.minWidth : ROOM_LIMITS.minDepth
    const max = key === 'width' ? ROOM_LIMITS.maxWidth : ROOM_LIMITS.maxDepth
    const next = Math.max(min, Math.min(max, value))
    recordInteraction('state.room.dimension', {
      view: state.view,
      selectedId: state.selectedId,
      coalesceKey: `room-${key}`,
      details: { dimension: key === 'width' ? 'la anchura' : 'la profundidad', value: next },
    })
    return safeRoomUpdate(state, { ...state.room, [key]: next })
  }),
  setDoor: (partial) => set((state) => {
    const adjusted = partial.offset === undefined
      ? partial
      : { ...partial, offset: snapToPlacementGrid(partial.offset) }
    const candidate = withDoor(state.room, adjusted)
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
  addWindow: () => set((state) => {
    const walls: WallSide[] = ['north', 'east', 'south', 'west']
    const offsets = [0, -1.25, 1.25, -2, 2]
    for (const wall of walls) {
      for (const offset of offsets) {
        const window: WindowConfig = { id: makeId('window'), wall, offset, width: 1.5, height: 1, sill: 1, rotation: 0 }
        const candidate = { ...state.room, windows: [...state.room.windows, window] }
        if (!validateOpenings(candidate)) {
          recordInteraction('state.window.added', {
            view: state.view,
            selectedId: state.selectedId,
            details: { id: window.id, name: `Ventana ${state.room.windows.length + 1}`, wall, offset, selectedAfter: window.id },
          })
          return { room: candidate, selectedId: window.id, notice: 'Ventana añadida.' }
        }
      }
    }
    return { notice: 'No queda espacio válido para otra ventana.' }
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
  addFurniture: (kind) => set((state) => {
    const preset = FURNITURE_PRESETS[kind]
    const id = makeId(kind)
    const item: FurnitureItem = { ...preset, id, x: 0, z: 0, rotation: 0 }
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
  }),
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
    if (!state.furniture.some((item) => item.id === state.selectedId)) return {}
    return {
      furniture: state.furniture.filter((item) => item.id !== state.selectedId),
      hiddenElementIds: state.hiddenElementIds.filter((id) => id !== state.selectedId),
      selectedId: null,
      notice: 'Objeto eliminado.',
    }
  }),
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
  saveDesign: () => {
    const state = get()
    const data: PersistedDesign = {
      version: 1,
      room: state.room,
      furniture: state.furniture,
      gridSnap: state.gridSnap,
      gridVisibility: state.gridVisibility,
      hiddenElementIds: state.hiddenElementIds,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      recordInteraction('state.design.saved', { view: state.view, selectedId: state.selectedId })
      set({ notice: 'Diseño guardado en este navegador.' })
    } catch {
      set({ notice: 'No se pudo acceder al almacenamiento local.' })
    }
  },
  loadDesign: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return set({ notice: 'Aún no hay un diseño guardado.' })
      const data = JSON.parse(raw) as PersistedDesign
      if (data.version !== 1 || !Array.isArray(data.furniture)) throw new Error('invalid')
      const room: RoomConfig = {
        ...data.room,
        door: {
          ...data.room.door,
          width: DEFAULT_ROOM.door.width,
          rotation: typeof data.room.door.rotation === 'number' ? data.room.door.rotation : 0,
        },
        windows: data.room.windows.map((window) => ({
          ...window,
          width: DEFAULT_ROOM.windows[0].width,
          height: DEFAULT_ROOM.windows[0].height,
          offset: snapToVisibleGrid(window.offset),
          sill: typeof window.sill === 'number'
            ? snapToVisibleGrid(window.sill)
            : DEFAULT_ROOM.windows[0].sill,
          rotation: typeof window.rotation === 'number' ? window.rotation : 0,
        })),
      }
      if (validateOpenings(room)) throw new Error('invalid')
      const furniture = arrangeFurniture(data.furniture, room, true)
      if (!furniture) throw new Error('invalid')
      const current = get()
      recordInteraction('state.design.loaded', { view: current.view, selectedId: current.selectedId })
      set({
        room,
        furniture,
        gridSnap: true,
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
        notice: 'Diseño recuperado.',
      })
    } catch {
      set({ notice: 'El diseño guardado no es válido.' })
    }
  },
  clearNotice: () => set({ notice: '' }),
}))
