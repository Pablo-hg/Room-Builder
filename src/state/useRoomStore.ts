import { create } from 'zustand'
import { DEFAULT_ROOM, FURNITURE_PRESETS, ROOM_LIMITS } from '../domain/constants'
import { clampFurniture, validateOpenings, withDoor, withWindow } from '../domain/geometry'
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
  povYaw: number
  gridSnap: boolean
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
  saveDesign: () => void
  loadDesign: () => void
  clearNotice: () => void
}

function safeRoomUpdate(current: RoomState, candidate: RoomConfig): Partial<RoomState> {
  const error = validateOpenings(candidate)
  if (error) return { notice: error }
  return {
    room: candidate,
    furniture: current.furniture.map((item) => ({ ...item, ...clampFurniture(item, candidate, current.gridSnap) })),
    notice: '',
  }
}

export const useRoomStore = create<RoomState>((set, get) => ({
  room: cloneRoom(),
  furniture: [],
  selectedId: null,
  view: 'isometric',
  isoOrientation: 0,
  povYaw: 0,
  gridSnap: true,
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
  removeWindow: (id) => set((state) => ({ room: { ...state.room, windows: state.room.windows.filter((window) => window.id !== id) }, notice: '' })),
  addFurniture: (kind) => set((state) => {
    const preset = FURNITURE_PRESETS[kind]
    const id = makeId(kind)
    const seed = state.furniture.length * 0.45
    const item: FurnitureItem = { ...preset, id, x: seed, z: seed, rotation: 0 }
    const position = clampFurniture(item, state.room, state.gridSnap)
    return { furniture: [...state.furniture, { ...item, ...position }], selectedId: id, notice: `${preset.name} añadido.` }
  }),
  selectFurniture: (selectedId) => set({ selectedId }),
  moveFurniture: (id, x, z) => set((state) => ({
    furniture: state.furniture.map((item) => item.id === id ? { ...item, ...clampFurniture({ ...item, x, z }, state.room, state.gridSnap) } : item),
  })),
  rotateFurniture: () => set((state) => ({
    furniture: state.furniture.map((item) => {
      if (item.id !== state.selectedId) return item
      const rotated = { ...item, rotation: (item.rotation + Math.PI / 2) % (Math.PI * 2) }
      return { ...rotated, ...clampFurniture(rotated, state.room, state.gridSnap) }
    }),
  })),
  removeFurniture: () => set((state) => ({
    furniture: state.furniture.filter((item) => item.id !== state.selectedId),
    selectedId: null,
    notice: state.selectedId ? 'Objeto eliminado.' : state.notice,
  })),
  toggleGrid: () => set((state) => {
    const gridSnap = !state.gridSnap
    return {
      gridSnap,
      furniture: state.furniture.map((item) => ({ ...item, ...clampFurniture(item, state.room, gridSnap) })),
    }
  }),
  saveDesign: () => {
    const state = get()
    const data: PersistedDesign = { version: 1, room: state.room, furniture: state.furniture, gridSnap: state.gridSnap }
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
      set({ room: data.room, furniture: data.furniture, gridSnap: Boolean(data.gridSnap), selectedId: null, notice: 'Diseño recuperado.' })
    } catch {
      set({ notice: 'El diseño guardado no es válido.' })
    }
  },
  clearNotice: () => set({ notice: '' }),
}))
