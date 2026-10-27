import type { FurnitureItem, GridSurface, RoomConfig, StructurePack, ViewMode, WallSide } from '../domain/types'

export interface SceneProps {
  room: RoomConfig
  view: ViewMode
  orientation: number
  isoAngle: number
  isIsoOrbitDragging: boolean
  freeAzimuth: number
  freeElevation: number
  isFreeOrbitDragging: boolean
  cameraZoom: number
  wallView: WallSide | null
  frontCameraHeight: number
  povYaw: number
  gridSnap: boolean
  gridVisibility: Record<GridSurface, boolean>
  furniture: FurnitureItem[]
  structurePacks: StructurePack[]
  exportMode: boolean
  exportRequest: number
  exportDesignName: string
  onExportComplete: (error?: Error) => void
}

