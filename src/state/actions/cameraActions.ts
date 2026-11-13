import { FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT } from '../../domain/constants'
import { frontWallForOrientation, orientationForAzimuth, orientationForFrontWall } from '../../domain/geometry'
import type { WallSide } from '../../domain/types'
import { recordInteraction } from '../../debug/interactionLog'
import { cameraZoomLimits, ISO_BASE_ANGLE, ISO_QUARTER_TURN } from '../defaults'
import type { RoomActionContext, RoomState } from '../types'
import { packRoomBox } from '../../domain/roomEditing'

const focusedElevation = (state: RoomState) => {
  const pack = state.structurePacks.find((candidate) => candidate.id === state.activeRoomId)
  return pack ? pack.y + (packRoomBox(pack, state.room)?.y ?? 0) : 0
}

const normalizeIsoAngle = (angle: number) => {
  const fullTurn = Math.PI * 2
  return ((angle % fullTurn) + fullTurn) % fullTurn
}

const normalizeFreeAzimuth = (azimuth: number) => {
  const fullTurn = Math.PI * 2
  return ((azimuth % fullTurn) + fullTurn) % fullTurn
}

const orientationForIsoAngle = (angle: number) => (
  Math.round((normalizeIsoAngle(angle) - ISO_BASE_ANGLE) / ISO_QUARTER_TURN) + 4
) % 4

function freeOrbitPosition(state: RoomState, azimuth: number, elevation: number) {
  if (!state.freeCameraNavigated) return {}
  const height = Math.max(state.room.height, ...state.structurePacks.filter((pack) => pack.id.startsWith('floor-pack-')).map((pack) => pack.y + state.room.height))
  const radius = Math.max(state.room.width, state.room.depth, height) * 2.6
  const vector = (angle: number, tilt: number) => ({ x: Math.cos(angle) * Math.cos(tilt) * radius, y: Math.sin(tilt) * radius, z: Math.sin(angle) * Math.cos(tilt) * radius })
  const before = vector(state.freeAzimuth, state.freeElevation)
  const after = vector(azimuth, elevation)
  return { freeCameraOffset: { x: state.freeCameraOffset.x + before.x - after.x, y: state.freeCameraOffset.y + before.y - after.y, z: state.freeCameraOffset.z + before.z - after.z } }
}

type CameraActions = Pick<
  RoomState,
  | 'setView'
  | 'setTopCameraPosition'
  | 'resetTopCamera'
  | 'setPlanDetailsVisible'
  | 'setAreaSelect'
  | 'lookAtWall'
  | 'setFrontCameraHeight'
  | 'lookFromIsoOrientation'
  | 'setIsoAngle'
  | 'setIsoOrbitDragging'
  | 'lookFromFreeOrbit'
  | 'setFreeOrbit'
  | 'setFreeOrbitDragging'
  | 'adjustCameraZoom'
  | 'setCameraZoom'
  | 'rotateFront'
  | 'rotateIso'
  | 'rotatePov'
>

export function createCameraActions(context: Pick<RoomActionContext, 'set'>): CameraActions {
  const { set } = context
  return {
    setTopCameraPosition: (topCameraX, topCameraZ) => set({ topCameraX, topCameraZ }),
    resetTopCamera: () => set({ topCameraX: 0, topCameraZ: 0, cameraZoom: 1 }),
    // Solo alterna la capa de cotas: no cambia cámara, selección ni diseño.
    setPlanDetailsVisible: (planDetailsVisible) => set({ planDetailsVisible }),
    setAreaSelect: (areaSelect) => set({ areaSelect }),
    setView: (view) => set((state) => {
      recordInteraction('state.view.changed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { previousView: state.view, nextView: view },
      })
      const orientation = state.view === 'free'
        ? orientationForAzimuth(state.freeAzimuth)
        : state.view === 'top'
          ? state.topOrientation
          : state.view === 'front' && state.wallView
            ? orientationForFrontWall(state.wallView)
            : state.isoOrientation
      const frontWall = state.view === 'front' && state.wallView
        ? state.wallView
        : frontWallForOrientation(orientation)
      return {
        view,
        ...(view === 'isometric' && state.view !== 'isometric' ? { isoCameraHeight: focusedElevation(state) } : {}),
        topOrientation: view === 'top' ? orientation : state.topOrientation,
        wallView: view === 'front' || view === 'top' ? frontWall : null,
        isIsoOrbitDragging: false,
        isFreeOrbitDragging: false,
        notice: '',
      }
    }),
    lookAtWall: (wallView) => set((state) => {
      recordInteraction('state.wall-view.changed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { previousWall: state.wallView, nextWall: wallView },
      })
      return { view: 'front', wallView, notice: '' }
    }),
    setFrontCameraHeight: (frontCameraHeight) => set((state) => {
      const nextHeight = Math.max(FRONT_CAMERA_MIN_HEIGHT, Math.min(FRONT_CAMERA_MAX_HEIGHT, frontCameraHeight))
      recordInteraction('state.camera.height', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: 'camera-height',
        details: { height: nextHeight },
      })
      return { frontCameraHeight: nextHeight }
    }),
    lookFromIsoOrientation: (orientation) => set((state) => {
      const normalizedOrientation = ((orientation % 4) + 4) % 4
      recordInteraction('state.camera.orientation', {
        view: state.view,
        selectedId: state.selectedId,
        details: { orientation: normalizedOrientation, mode: 'isometric' },
      })
      return {
        view: 'isometric',
        ...(state.view !== 'isometric' ? { isoCameraHeight: focusedElevation(state) } : {}),
        isoOrientation: normalizedOrientation,
        isoAngle: normalizeIsoAngle(ISO_BASE_ANGLE + normalizedOrientation * ISO_QUARTER_TURN),
        isIsoOrbitDragging: false,
        wallView: null,
        notice: '',
      }
    }),
    setIsoAngle: (angle) => set((state) => {
      const nextAngle = normalizeIsoAngle(angle)
      recordInteraction('state.camera.orientation', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: 'camera-orbit',
        details: { angle: nextAngle, degrees: nextAngle * 180 / Math.PI, mode: 'isometric' },
      })
      return {
        view: 'isometric',
        isoAngle: nextAngle,
        isoOrientation: orientationForIsoAngle(angle),
        wallView: null,
      }
    }),
    setIsoOrbitDragging: (isIsoOrbitDragging) => set({ isIsoOrbitDragging }),
    lookFromFreeOrbit: (freeAzimuth, freeElevation) => set((state) => {
      const nextAzimuth = normalizeFreeAzimuth(freeAzimuth)
      const nextElevation = Math.max(-1.48, Math.min(1.48, freeElevation))
      recordInteraction('state.camera.orientation', {
        view: state.view,
        selectedId: state.selectedId,
        details: { azimuth: nextAzimuth, elevation: nextElevation, mode: 'free' },
      })
      return {
        view: 'free',
        freeAzimuth: nextAzimuth,
        freeElevation: nextElevation,
        ...freeOrbitPosition(state, nextAzimuth, nextElevation),
        isFreeOrbitDragging: false,
        isIsoOrbitDragging: false,
        wallView: null,
        notice: '',
      }
    }),
    setFreeOrbit: (freeAzimuth, freeElevation) => set((state) => {
      const nextAzimuth = normalizeFreeAzimuth(freeAzimuth)
      const nextElevation = Math.max(-1.48, Math.min(1.48, freeElevation))
      recordInteraction('state.camera.orientation', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: 'camera-free-orbit',
        details: { azimuth: nextAzimuth, elevation: nextElevation, mode: 'free' },
      })
      return { freeAzimuth: nextAzimuth, freeElevation: nextElevation, ...freeOrbitPosition(state, nextAzimuth, nextElevation) }
    }),
    setFreeOrbitDragging: (isFreeOrbitDragging) => set({ isFreeOrbitDragging }),
    setCameraZoom: (zoom) => set((state) => {
      if (!Number.isFinite(zoom)) return {}
      const { min, max } = cameraZoomLimits(state.view)
      const value = Math.max(min, Math.min(max, zoom))
      return state.view === 'pov' ? { povCameraZoom: value } : state.view === 'free' ? { freeCameraZoom: value } : { cameraZoom: value }
    }),
    adjustCameraZoom: (deltaY) => set((state) => {
      const limitedDelta = Math.max(-120, Math.min(120, deltaY))
      const isPov = state.view === 'pov'
      const isFree = state.view === 'free'
      const cameraZoom = (isPov ? state.povCameraZoom : isFree ? state.freeCameraZoom : state.cameraZoom) * Math.exp(-limitedDelta * 0.0015)
      const { min, max } = cameraZoomLimits(state.view)
      const nextZoom = Math.max(min, Math.min(max, cameraZoom))
      recordInteraction('state.camera.zoom', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: 'camera-zoom',
        details: { zoom: nextZoom },
      })
      return isPov ? { povCameraZoom: nextZoom } : isFree ? { freeCameraZoom: nextZoom } : { cameraZoom: nextZoom }
    }),
    rotateFront: (direction) => set((state) => {
      const walls: WallSide[] = ['north', 'east', 'south', 'west']
      const currentIndex = walls.indexOf(state.wallView ?? frontWallForOrientation(state.isoOrientation))
      const wallView = walls[(currentIndex + direction + walls.length) % walls.length]
      recordInteraction('state.wall-view.changed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { previousWall: state.wallView, nextWall: wallView },
      })
      return {
        view: 'front',
        wallView,
        notice: '',
      }
    }),
    rotateIso: (direction) => set((state) => {
      const isoAngle = normalizeIsoAngle(state.isoAngle + direction * ISO_QUARTER_TURN)
      recordInteraction('state.camera.orientation', {
        view: state.view,
        selectedId: state.selectedId,
        details: { angle: isoAngle, degrees: isoAngle * 180 / Math.PI, mode: 'isometric-step' },
      })
      return { isoAngle, isoOrientation: orientationForIsoAngle(isoAngle), isIsoOrbitDragging: false, wallView: null }
    }),
    rotatePov: (direction) => set((state) => {
      const povYaw = Math.max(-55, Math.min(55, state.povYaw + direction * 15))
      recordInteraction('state.camera.orientation', {
        view: state.view,
        selectedId: state.selectedId,
        details: { degrees: povYaw, mode: 'pov' },
      })
      return { povYaw }
    }),
  }
}
