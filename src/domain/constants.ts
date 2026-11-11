import type { RoomConfig, WallSide } from './types'
import { OPENING_CATALOG } from './objectCatalog'

export const WALL_SIDES: WallSide[] = ['north', 'east', 'south', 'west']
export const DEFAULT_WALL_COLOR = '#f5eadb'
export const DEFAULT_FLOOR_COLOR = '#dcc3a3'
// Root slab and diorama base: shared by rendering and vertical room placement.
export const ROOT_FLOOR_THICKNESS = 0.08
export const ROOT_PLATFORM_THICKNESS = 0.14
export const ROOT_PLATFORM_Y = -0.11
export const FRONT_CAMERA_MIN_HEIGHT = 1.35
export const FRONT_CAMERA_MAX_HEIGHT = 10
export const WALL_LABELS: Record<WallSide, string> = {
  north: 'A',
  east: 'B',
  south: 'C',
  west: 'D',
}

export const ROOM_LIMITS = {
  // Límites de edición (10/11/2026, petición del propietario): 50 m de planta
  // y 15 m de alto. La importación sigue aceptando diseños antiguos de hasta
  // 100 m para no romperlos; al editarlos se ajustan a estos límites.
  minWidth: 0.01,
  maxWidth: 50,
  minDepth: 0.01,
  maxDepth: 50,
  minHeight: 0.01,
  maxHeight: 15,
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
