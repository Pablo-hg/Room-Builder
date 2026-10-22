import type { FurnitureKind, RoomConfig, WallSide } from './types'

export const WALL_SIDES: WallSide[] = ['north', 'east', 'south', 'west']
export const FURNITURE_ROTATION_STEP = Math.PI / 12
export const FRONT_CAMERA_MIN_HEIGHT = 1.35
export const FRONT_CAMERA_MAX_HEIGHT = 7.5
export const WALL_LABELS: Record<WallSide, string> = {
  north: 'Norte',
  east: 'Este',
  south: 'Sur',
  west: 'Oeste',
}

export const ROOM_LIMITS = {
  minWidth: 3,
  maxWidth: 10,
  minDepth: 3,
  maxDepth: 10,
  wallHeight: 2.7,
  edgeMargin: 0.25,
  openingGap: 0.15,
  gridSize: 0.25,
  placementStep: 0.125,
} as const

export const DEFAULT_ROOM: RoomConfig = {
  width: 5.5,
  depth: 4.5,
  height: ROOM_LIMITS.wallHeight,
  door: { wall: 'south', offset: 0, width: 1, height: 2.1 },
  windows: [
    { id: 'window-1', wall: 'north', offset: 0, width: 1.5, height: 1.1, sill: 0.9 },
  ],
}

export const FURNITURE_PRESETS: Record<FurnitureKind, Omit<import('./types').FurnitureItem, 'id' | 'x' | 'z' | 'rotation'>> = {
  armchair: { kind: 'armchair', name: 'Sillón', width: 1, depth: 1, height: 0.85, color: '#d07a63' },
  sofa: { kind: 'sofa', name: 'Sofá', width: 2, depth: 0.75, height: 0.85, color: '#b86f5e' },
  table: { kind: 'table', name: 'Mesa', width: 1.25, depth: 0.75, height: 0.74, color: '#c69765' },
  chair: { kind: 'chair', name: 'Silla', width: 0.5, depth: 0.5, height: 0.85, color: '#bd8b5f' },
  bed: { kind: 'bed', name: 'Cama', width: 1.5, depth: 2, height: 0.55, color: '#8ba5a1' },
  cabinet: { kind: 'cabinet', name: 'Aparador', width: 1.5, depth: 0.5, height: 0.9, color: '#748d84' },
  bookshelf: { kind: 'bookshelf', name: 'Estantería', width: 1, depth: 0.25, height: 1.8, color: '#9b7354' },
  lamp: { kind: 'lamp', name: 'Lámpara', width: 0.5, depth: 0.5, height: 1.65, color: '#d3a755' },
}
