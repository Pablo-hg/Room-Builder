import { FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT } from '../../domain/constants'
import { frontWallForOrientation, orientationForAzimuth, orientationForFrontWall } from '../../domain/geometry'
import type { WallSide } from '../../domain/types'
import { recordInteraction } from '../../debug/interactionLog'
import { ISO_BASE_ANGLE, ISO_QUARTER_TURN, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM } from '../defaults'
import type { RoomActionContext, RoomState } from '../types'

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

type CameraActions = Pick<
  RoomState,
  | 'setView'
  | 'lookAtWall'
  | 'setFrontCameraHeight'
  | 'lookFromIsoOrientation'
  | 'setIsoAngle'
  | 'setIsoOrbitDragging'
  | 'lookFromFreeOrbit'
  | 'setFreeOrbit'
  | 'setFreeOrbitDragging'
  | 'adjustCameraZoom'
  | 'rotateFront'
  | 'rotateIso'
  | 'rotatePov'
>

export function createCameraActions(context: Pick<RoomActionContext, 'set'>): CameraActions {
  const { set } = context
  return {
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
      return { freeAzimuth: nextAzimuth, freeElevation: nextElevation }
    }),
    setFreeOrbitDragging: (isFreeOrbitDragging) => set({ isFreeOrbitDragging }),
    adjustCameraZoom: (deltaY) => set((state) => {
      const limitedDelta = Math.max(-120, Math.min(120, deltaY))
      const cameraZoom = state.cameraZoom * Math.exp(-limitedDelta * 0.0015)
      const nextZoom = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, cameraZoom))
      recordInteraction('state.camera.zoom', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: 'camera-zoom',
        details: { zoom: nextZoom },
      })
      return { cameraZoom: nextZoom }
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
