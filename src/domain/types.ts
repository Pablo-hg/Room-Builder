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

export interface ElementFolder {
  id: string
  name: string
  parentId?: string
}

export interface DoorConfig {
  name?: string
  wall: WallSide
  offset: number
  width: number
  height: number
  rotation: number
  color?: string
}

export interface WindowConfig {
  name?: string
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
  /** Ausente en objetos antiguos: conserva su libertad de movimiento previa. */
  attachmentPolicy?: 'by-type'
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

export type { PersistedDesign } from './designV1'

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
