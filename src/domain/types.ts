export type ViewMode = 'isometric' | 'top' | 'pov'
export type WallSide = 'north' | 'east' | 'south' | 'west'
export type FurnitureKind = 'armchair' | 'table' | 'cabinet'

export interface DoorConfig {
  wall: WallSide
  offset: number
  width: number
  height: number
}

export interface WindowConfig {
  id: string
  wall: WallSide
  offset: number
  width: number
  height: number
  sill: number
}

export interface RoomConfig {
  width: number
  depth: number
  height: number
  door: DoorConfig
  windows: WindowConfig[]
}

export interface FurnitureItem {
  id: string
  kind: FurnitureKind
  name: string
  x: number
  z: number
  rotation: number
  width: number
  depth: number
  height: number
  color: string
}

export interface PersistedDesign {
  version: 1
  room: RoomConfig
  furniture: FurnitureItem[]
  gridSnap: boolean
  hiddenElementIds?: string[]
  lighting?: {
    sunAzimuth: number
    sunElevation: number
    shadowsEnabled: boolean
    realisticLighting?: boolean
  }
}

export interface WallOpening {
  id: string
  kind: 'door' | 'window'
  offset: number
  width: number
  bottom: number
  height: number
}

export interface WallSegment {
  center: [number, number]
  size: [number, number]
}
