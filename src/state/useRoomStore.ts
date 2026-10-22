import { create } from 'zustand'
import { DEFAULT_ROOM, FURNITURE_PRESETS, ROOM_LIMITS } from '../domain/constants'
import {
  canPlaceFurniture,
  clampFurniture,
  findFreeFurniturePosition,
  hasFurnitureCollisions,
  validateOpenings,
  withDoor,
  withWindow,
} from '../domain/geometry'
import type { FurnitureItem, FurnitureKind, PersistedDesign, RoomConfig, ViewMode, WallSide, WindowConfig } from '../domain/types'

const STORAGE_KEY = 'room-builder:v0.1:design'

const cloneRoom = (): RoomConfig => JSON.parse(JSON.stringify(DEFAULT_ROOM)) as RoomConfig
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const normalizeAzimuth = (value: number) => ((value % 360) + 360) % 360
const clampElevation = (value: number) => Math.max(10, Math.min(80, value))

interface RoomState {
  room: RoomConfig
  furniture: FurnitureItem[]
  selectedId: string | null
  view: ViewMode
  isoOrientation: number
  povYaw: number
  gridSnap: boolean
  sunAzimuth: number
  sunElevation: number
  realisticLighting: boolean
  shadowsEnabled: boolean
  hiddenElementIds: string[]
  notice: string
  setView: (view: ViewMode) => void
  rotateIso: (direction: -1 | 1) => void
  rotatePov: (direction: -1 | 1) => void
  setDimension: (key: 'width' | 'depth', value: number) => void
  setDoor: (partial: { wall?: WallSide; offset?: number }) => void
  addWindow: () => void
  updateWindow: (id: string, partial: Partial<Pick<WindowConfig, 'wall' | 'offset' | 'width' | 'sill'>>) => void
  removeWindow: (id: string) => void
  addFurniture: (kind: FurnitureKind) => void
  selectFurniture: (id: string | null) => void
  moveFurniture: (id: string, x: number, z: number) => void
  rotateFurniture: () => void
  removeFurniture: () => void
  toggleGrid: () => void
  setSunPosition: (partial: { azimuth?: number; elevation?: number }) => void
  toggleRealisticLighting: () => void
  toggleShadows: () => void
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
    const clamped = { ...item, ...clampFurniture(item, room, snap) }
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

export const useRoomStore = create<RoomState>((set, get) => ({
  room: cloneRoom(),
  furniture: [],
  selectedId: null,
  view: 'isometric',
  isoOrientation: 0,
  povYaw: 0,
  gridSnap: true,
  sunAzimuth: 0,
  sunElevation: 42,
  realisticLighting: true,
  shadowsEnabled: true,
  hiddenElementIds: [],
  notice: '',
  setView: (view) => set({ view, selectedId: null, notice: '' }),
  rotateIso: (direction) => set((state) => ({ isoOrientation: (state.isoOrientation + direction + 4) % 4 })),
  rotatePov: (direction) => set((state) => ({ povYaw: Math.max(-55, Math.min(55, state.povYaw + direction * 15)) })),
  setDimension: (key, value) => set((state) => {
    const min = key === 'width' ? ROOM_LIMITS.minWidth : ROOM_LIMITS.minDepth
    const max = key === 'width' ? ROOM_LIMITS.maxWidth : ROOM_LIMITS.maxDepth
    const next = Math.max(min, Math.min(max, value))
    return safeRoomUpdate(state, { ...state.room, [key]: next })
  }),
  setDoor: (partial) => set((state) => safeRoomUpdate(state, withDoor(state.room, partial))),
  addWindow: () => set((state) => {
    const walls: WallSide[] = ['north', 'east', 'south', 'west']
    const offsets = [0, -1.25, 1.25, -2, 2]
    for (const wall of walls) {
      for (const offset of offsets) {
        const window: WindowConfig = { id: makeId('window'), wall, offset, width: 1.2, height: 1.1, sill: 0.9 }
        const candidate = { ...state.room, windows: [...state.room.windows, window] }
        if (!validateOpenings(candidate)) return { room: candidate, notice: '' }
      }
    }
    return { notice: 'No queda espacio válido para otra ventana.' }
  }),
  updateWindow: (id, partial) => set((state) => safeRoomUpdate(state, withWindow(state.room, id, partial))),
  removeWindow: (id) => set((state) => ({
    room: { ...state.room, windows: state.room.windows.filter((window) => window.id !== id) },
    hiddenElementIds: state.hiddenElementIds.filter((elementId) => elementId !== id),
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
  selectFurniture: (selectedId) => set({ selectedId }),
  moveFurniture: (id, x, z) => set((state) => {
    const item = state.furniture.find((candidate) => candidate.id === id)
    if (!item) return {}
    const moved = { ...item, ...clampFurniture({ ...item, x, z }, state.room, state.gridSnap) }
    if (!canPlaceFurniture(moved, state.furniture)) return {}
    return { furniture: state.furniture.map((candidate) => candidate.id === id ? moved : candidate) }
  }),
  rotateFurniture: () => set((state) => {
    const item = state.furniture.find((candidate) => candidate.id === state.selectedId)
    if (!item) return {}
    const rotated = { ...item, rotation: (item.rotation + Math.PI / 2) % (Math.PI * 2) }
    const positioned = { ...rotated, ...clampFurniture(rotated, state.room, state.gridSnap) }
    if (!canPlaceFurniture(positioned, state.furniture)) {
      return { notice: 'No hay espacio suficiente para girar el objeto.' }
    }
    return {
      furniture: state.furniture.map((candidate) => candidate.id === item.id ? positioned : candidate),
      notice: '',
    }
  }),
  removeFurniture: () => set((state) => ({
    furniture: state.furniture.filter((item) => item.id !== state.selectedId),
    hiddenElementIds: state.hiddenElementIds.filter((id) => id !== state.selectedId),
    selectedId: null,
    notice: state.selectedId ? 'Objeto eliminado.' : state.notice,
  })),
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
  setSunPosition: (partial) => set((state) => ({
    sunAzimuth: partial.azimuth === undefined || !Number.isFinite(partial.azimuth)
      ? state.sunAzimuth
      : normalizeAzimuth(partial.azimuth),
    sunElevation: partial.elevation === undefined || !Number.isFinite(partial.elevation)
      ? state.sunElevation
      : clampElevation(partial.elevation),
  })),
  toggleRealisticLighting: () => set((state) => ({ realisticLighting: !state.realisticLighting })),
  toggleShadows: () => set((state) => ({ shadowsEnabled: !state.shadowsEnabled })),
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
      lighting: {
        sunAzimuth: state.sunAzimuth,
        sunElevation: state.sunElevation,
        realisticLighting: state.realisticLighting,
        shadowsEnabled: state.shadowsEnabled,
      },
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
      if (data.version !== 1 || validateOpenings(data.room) || !Array.isArray(data.furniture)) throw new Error('invalid')
      const furniture = arrangeFurniture(data.furniture, data.room, Boolean(data.gridSnap))
      if (!furniture) throw new Error('invalid')
      const savedAzimuth = data.lighting?.sunAzimuth
      const savedElevation = data.lighting?.sunElevation
      set({
        room: data.room,
        furniture,
        gridSnap: Boolean(data.gridSnap),
        sunAzimuth: typeof savedAzimuth === 'number' && Number.isFinite(savedAzimuth)
          ? normalizeAzimuth(savedAzimuth)
          : 0,
        sunElevation: typeof savedElevation === 'number' && Number.isFinite(savedElevation)
          ? clampElevation(savedElevation)
          : 42,
        realisticLighting: typeof data.lighting?.realisticLighting === 'boolean'
          ? data.lighting.realisticLighting
          : true,
        shadowsEnabled: typeof data.lighting?.shadowsEnabled === 'boolean'
          ? data.lighting.shadowsEnabled
          : true,
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
