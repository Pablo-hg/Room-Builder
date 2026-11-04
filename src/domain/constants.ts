import type { RoomConfig, WallSide } from './types'
import { OPENING_CATALOG } from './objectCatalog'

export const WALL_SIDES: WallSide[] = ['north', 'east', 'south', 'west']
export const DEFAULT_WALL_COLOR = '#f5eadb'
export const DEFAULT_FLOOR_COLOR = '#dcc3a3'
export const FRONT_CAMERA_MIN_HEIGHT = 1.35
export const FRONT_CAMERA_MAX_HEIGHT = 10
export const WALL_LABELS: Record<WallSide, string> = {
  north: 'A',
  east: 'B',
  south: 'C',
  west: 'D',
}

export const ROOM_LIMITS = {
  minWidth: 3,
  maxWidth: 10,
  minDepth: 3,
  maxDepth: 10,
  minHeight: 2.5,
  maxHeight: 10,
  wallHeight: 2.7,
  edgeMargin: 0.25,
  openingGap: 0.15,
  gridSize: 0.25,
  placementStep: 0.05,
} as const

export const DEFAULT_ROOM: RoomConfig = {
  width: 5.5,
  depth: 4.5,
  height: ROOM_LIMITS.wallHeight,
  wallColor: DEFAULT_WALL_COLOR,
  door: { wall: 'south', offset: 0, width: OPENING_CATALOG.door.width, height: OPENING_CATALOG.door.height, rotation: 0, color: '#ac704b' },
  windows: [
    {
      id: 'window-1',
      shape: 'rectangular',
      wall: 'north',
      offset: 0,
      width: OPENING_CATALOG.window.width,
      height: OPENING_CATALOG.window.height,
      sill: OPENING_CATALOG.window.defaultBottom,
      rotation: 0,
      color: '#c88f58',
    },
  ],
}
