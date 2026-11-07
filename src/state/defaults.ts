import { DEFAULT_ROOM } from '../domain/constants'
import type { RoomConfig, ViewMode } from '../domain/types'

export const MAX_UNDO_STEPS = 50
export const ISO_BASE_ANGLE = Math.PI / 4
export const ISO_QUARTER_TURN = Math.PI / 2
export const MIN_CAMERA_ZOOM = 0.25
export const MAX_CAMERA_ZOOM = 3
export const cameraZoomLimits = (view: ViewMode) => ({ min: view === 'pov' ? 1 : MIN_CAMERA_ZOOM, max: view === 'free' ? 4 : MAX_CAMERA_ZOOM })

export const cloneRoom = (): RoomConfig => JSON.parse(JSON.stringify(DEFAULT_ROOM)) as RoomConfig
