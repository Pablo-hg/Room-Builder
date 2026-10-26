export type ViewMode = 'isometric' | 'top' | 'front' | 'pov' | 'free'
export type WallSide = 'north' | 'east' | 'south' | 'west'
export type GridSurface = 'floor' | WallSide
export type FurnitureKind =
  | 'armchair'
  | 'sofa'
  | 'table'
  | 'chair'
  | 'bed'
  | 'singleBed'
  | 'bedsideTable'
  | 'cabinet'
  | 'bookshelf'
  | 'wardrobe'
  | 'wastebasket'
  | 'pictureSmall'
  | 'pictureMedium'
  | 'pictureLarge'
  | 'lamp'
  | 'coffeeTable'
  | 'desk'
  | 'deskChair'
  | 'tvStand'
  | 'television'
  | 'rug'
  | 'circularRug'
  | 'plant'
  | 'vase'
  | 'tableLamp'
  | 'ceilingLamp'
export type WindowShape = 'rectangular' | 'circular' | 'wallShelf' | 'pictureSmall' | 'pictureMedium' | 'pictureLarge' | 'mirrorRectangular' | 'mirrorCircular' | 'wallSconce'

export interface DoorConfig {
  wall: WallSide
  offset: number
  width: number
  height: number
  rotation: number
  color?: string
}

export interface WindowConfig {
  id: string
  shape: WindowShape
  wall: WallSide
  offset: number
  width: number
  height: number
  sill: number
  rotation: number
  color?: string
}

export interface RoomConfig {
  width: number
  depth: number
  height: number
  wallColor?: string
  wallColors?: Partial<Record<WallSide, string>>
  floorColor?: string
  door: DoorConfig
  windows: WindowConfig[]
}

export interface FurnitureItem {
  id: string
  kind: FurnitureKind
  name: string
  x: number
  y: number
  z: number
  rotation: number
  width: number
  depth: number
  height: number
  color: string
}

export type StructureSurfaceKind = 'wall' | 'floor' | 'ceiling'
export type StructureSurfaceKey = 'floor' | 'ceiling' | `wall-${WallSide}`

export interface StructureSurface {
  id: StructureSurfaceKey
  kind: StructureSurfaceKind
  name: string
  wall?: WallSide
  x: number
  y: number
  z: number
  width: number
  height: number
  depth: number
  rotation: number
  color: string
}

export interface StructurePack {
  id: string
  name: string
  x: number
  y: number
  z: number
  surfaces: StructureSurface[]
}

export interface PersistedDesign {
  version: 1
  room: RoomConfig
  furniture: FurnitureItem[]
  structurePacks?: StructurePack[]
  gridSnap: boolean
  gridVisibility?: Record<GridSurface, boolean>
  hiddenElementIds?: string[]
}

export interface WallOpening {
  id: string
  kind: 'door' | 'window'
  shape?: WindowShape
  offset: number
  width: number
  bottom: number
  height: number
  rotation: number
  color: string
}

export interface WallSegment {
  center: [number, number]
  size: [number, number]
}
