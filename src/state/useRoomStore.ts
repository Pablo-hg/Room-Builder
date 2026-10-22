import { create } from 'zustand'
import { DEFAULT_ROOM, FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT, FURNITURE_PRESETS, ROOM_LIMITS } from '../domain/constants'
import {
  canPlaceFurniture,
  clampFurniture,
  findFreeFurniturePosition,
  hasFurnitureCollisions,
  snapToPlacementGrid,
  validateOpenings,
  withDoor,
  withWindow,
} from '../domain/geometry'
import type { FurnitureItem, FurnitureKind, PersistedDesign, RoomConfig, ViewMode, WallSide, WindowConfig } from '../domain/types'

const STORAGE_KEY = 'room-builder:v0.1:design'

const cloneRoom = (): RoomConfig => JSON.parse(JSON.stringify(DEFAULT_ROOM)) as RoomConfig
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

interface RoomState {
  room: RoomConfig
  furniture: FurnitureItem[]
  selectedId: string | null
  view: ViewMode
  isoOrientation: number
  wallView: WallSide | null
  frontCameraHeight: number
  povYaw: number
  gridSnap: boolean
  hiddenElementIds: string[]
  notice: string
  setView: (view: ViewMode) => void
  lookAtWall: (wall: WallSide) => void
  setFrontCameraHeight: (height: number) => void
  lookFromIsoOrientation: (orientation: number) => void
  rotateFront: (direction: -1 | 1) => void
  rotateIso: (direction: -1 | 1) => void
  rotatePov: (direction: -1 | 1) => void
  setDimension: (key: 'width' | 'depth', value: number) => void
  setDoor: (partial: { wall?: WallSide; offset?: number }) => void
  addWindow: () => void
  updateWindow: (id: string, partial: Partial<Pick<WindowConfig, 'wall' | 'offset' | 'width' | 'sill'>>) => void
  removeWindow: (id: string) => void
  addFurniture: (kind: FurnitureKind) => void
  selectElement: (id: string | null) => void
  moveFurniture: (id: string, x: number, z: number) => void
  setFurnitureRotation: (id: string, rotation: number) => void
  rotateFurniture: () => void
  removeFurniture: () => void
  removeSelected: () => void
  toggleGrid: () => void
  toggleElementVisibility: (id: string) => void
  saveDesign: () => void
  loadDesign: () => void
  clearNotice: () => void
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
  wallView: null,
  frontCameraHeight: DEFAULT_ROOM.height / 2,
  povYaw: 0,
  gridSnap: true,
  hiddenElementIds: [],
  notice: '',
  setView: (view) => set((state) => ({
    view,
    wallView: view === 'front' ? state.wallView ?? 'north' : null,
    notice: '',
  })),
  lookAtWall: (wallView) => set({ view: 'front', wallView, notice: '' }),
  setFrontCameraHeight: (frontCameraHeight) => set({
    frontCameraHeight: Math.max(FRONT_CAMERA_MIN_HEIGHT, Math.min(FRONT_CAMERA_MAX_HEIGHT, frontCameraHeight)),
  }),
  lookFromIsoOrientation: (orientation) => set({
    view: 'isometric',
    isoOrientation: ((orientation % 4) + 4) % 4,
    wallView: null,
    notice: '',
  }),
  rotateFront: (direction) => set((state) => {
    const walls: WallSide[] = ['north', 'east', 'south', 'west']
    const currentIndex = walls.indexOf(state.wallView ?? 'north')
    return {
      view: 'front',
      wallView: walls[(currentIndex + direction + walls.length) % walls.length],
      notice: '',
    }
  }),
  rotateIso: (direction) => set((state) => ({ isoOrientation: (state.isoOrientation + direction + 4) % 4, wallView: null })),
  rotatePov: (direction) => set((state) => ({ povYaw: Math.max(-55, Math.min(55, state.povYaw + direction * 15)) })),
  setDimension: (key, value) => set((state) => {
    const min = key === 'width' ? ROOM_LIMITS.minWidth : ROOM_LIMITS.minDepth
    const max = key === 'width' ? ROOM_LIMITS.maxWidth : ROOM_LIMITS.maxDepth
    const next = Math.max(min, Math.min(max, value))
    return safeRoomUpdate(state, { ...state.room, [key]: next })
  }),
  setDoor: (partial) => set((state) => {
    const adjusted = partial.offset === undefined
      ? partial
      : { ...partial, offset: snapToPlacementGrid(partial.offset) }
    return safeRoomUpdate(state, withDoor(state.room, adjusted))
  }),
  addWindow: () => set((state) => {
    const walls: WallSide[] = ['north', 'east', 'south', 'west']
    const offsets = [0, -1.25, 1.25, -2, 2]
    for (const wall of walls) {
      for (const offset of offsets) {
        const window: WindowConfig = { id: makeId('window'), wall, offset, width: 1.5, height: 1.1, sill: 0.9 }
        const candidate = { ...state.room, windows: [...state.room.windows, window] }
        if (!validateOpenings(candidate)) return { room: candidate, selectedId: window.id, notice: 'Ventana añadida.' }
      }
    }
    return { notice: 'No queda espacio válido para otra ventana.' }
  }),
  updateWindow: (id, partial) => set((state) => {
    const adjusted = partial.offset === undefined
      ? partial
      : { ...partial, offset: snapToPlacementGrid(partial.offset) }
    return safeRoomUpdate(state, withWindow(state.room, id, adjusted))
  }),
  removeWindow: (id) => set((state) => ({
    room: { ...state.room, windows: state.room.windows.filter((window) => window.id !== id) },
    hiddenElementIds: state.hiddenElementIds.filter((elementId) => elementId !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
    notice: '',
  })),
  addFurniture: (kind) => set((state) => {
    const preset = FURNITURE_PRESETS[kind]
    const id = makeId(kind)
    const item: FurnitureItem = { ...preset, id, x: 0, z: 0, rotation: 0 }
    const position = findFreeFurniturePosition(item, state.room, state.furniture)
    if (!position) return { notice: `No queda espacio libre para añadir ${preset.name.toLowerCase()}.` }
    return { furniture: [...state.furniture, { ...item, ...position }], selectedId: id, notice: `${preset.name} añadido.` }
  }),
  selectElement: (selectedId) => set({ selectedId, notice: '' }),
  moveFurniture: (id, x, z) => set((state) => {
    const item = state.furniture.find((candidate) => candidate.id === id)
    if (!item) return {}
    const moved = { ...item, ...clampFurniture({ ...item, x, z }, state.room, state.gridSnap) }
    if (!canPlaceFurniture(moved, state.furniture)) return {}
    return { furniture: state.furniture.map((candidate) => candidate.id === id ? moved : candidate) }
  }),
  setFurnitureRotation: (id, rotation) => set((state) => {
    const item = state.furniture.find((candidate) => candidate.id === id)
    if (!item) return {}
    return applyFurnitureRotation(state, item, rotation, false)
  }),
  rotateFurniture: () => set((state) => {
    const item = state.furniture.find((candidate) => candidate.id === state.selectedId)
    if (!item) return {}
    return applyFurnitureRotation(state, item, item.rotation + Math.PI / 2, true)
  }),
  removeFurniture: () => set((state) => ({
    furniture: state.furniture.filter((item) => item.id !== state.selectedId),
    hiddenElementIds: state.hiddenElementIds.filter((id) => id !== state.selectedId),
    selectedId: null,
    notice: state.selectedId ? 'Objeto eliminado.' : state.notice,
  })),
  removeSelected: () => set((state) => {
    if (!state.selectedId || state.selectedId === 'door') return {}
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
  toggleGrid: () => set((state) => {
    const gridSnap = !state.gridSnap
    const furniture = state.furniture.map((item) => ({ ...item, ...clampFurniture(item, state.room, gridSnap) }))
    if (hasFurnitureCollisions(furniture)) {
      return { notice: 'No se puede activar la cuadrícula porque algunos muebles quedarían solapados.' }
    }
    return {
      gridSnap,
      furniture,
      notice: '',
    }
  }),
  toggleElementVisibility: (id) => set((state) => {
    const isHidden = state.hiddenElementIds.includes(id)
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
      hiddenElementIds: state.hiddenElementIds,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
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
        door: { ...data.room.door, width: DEFAULT_ROOM.door.width },
        windows: data.room.windows.map((window) => ({ ...window, width: DEFAULT_ROOM.windows[0].width })),
      }
      if (validateOpenings(room)) throw new Error('invalid')
      const furniture = arrangeFurniture(data.furniture, room, Boolean(data.gridSnap))
      if (!furniture) throw new Error('invalid')
      set({
        room,
        furniture,
        gridSnap: Boolean(data.gridSnap),
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
