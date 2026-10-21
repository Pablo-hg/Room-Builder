import type { FurnitureKind, RoomConfig, WallSide } from './types'

export const WALL_SIDES: WallSide[] = ['north', 'east', 'south', 'west']
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
} as const

export const DEFAULT_ROOM: RoomConfig = {
  width: 5.5,
  depth: 4.5,
  height: ROOM_LIMITS.wallHeight,
  door: { wall: 'south', offset: 0, width: 0.9, height: 2.1 },
  windows: [
    { id: 'window-1', wall: 'north', offset: 0, width: 1.4, height: 1.1, sill: 0.9 },
  ],
}

export const FURNITURE_PRESETS: Record<FurnitureKind, Omit<import('./types').FurnitureItem, 'id' | 'x' | 'z' | 'rotation'>> = {
  armchair: { kind: 'armchair', name: 'Sillón', width: 0.9, depth: 0.9, height: 0.85, color: '#d07a63' },
  table: { kind: 'table', name: 'Mesa', width: 1.2, depth: 0.75, height: 0.74, color: '#c69765' },
  cabinet: { kind: 'cabinet', name: 'Aparador', width: 1.35, depth: 0.45, height: 0.9, color: '#748d84' },
}
