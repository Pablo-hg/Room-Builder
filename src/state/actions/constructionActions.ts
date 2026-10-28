import { finishHistoryTransaction } from '../historyTransactions'
import { clampRoomDimension, roomForDoorUpdate, roomForWindowUpdate, safeRoomUpdate } from '../../domain/editingRules'
import { createStructureSurface } from '../../domain/structureRules'
import { makeId, structureSurfaceElementId } from '../../domain/elementIds'
import { elementName } from '../../domain/selection'
import { FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT, WALL_SIDES } from '../../domain/constants'
import { FURNITURE_PRESETS, isWallMirrorShape, isWallPictureShape, OPENING_CATALOG, openingKindForShape } from '../../domain/objectCatalog'
import { validateOpenings } from '../../domain/geometry'
import type { StructurePack, StructureSurfaceKey, WallSide, WindowConfig } from '../../domain/types'
import { recordInteraction } from '../../debug/interactionLog'
import type { RoomActionContext, RoomState } from '../types'

type ConstructionActions = Pick<
  RoomState,
  | 'setDimension'
  | 'setWallColor'
  | 'setWallSideColor'
  | 'setFloorColor'
  | 'addStructurePack'
  | 'addStructureObject'
  | 'moveStructurePack'
  | 'moveStructureSurface'
  | 'resizeStructureSurface'
  | 'setStructureSurfaceRotation'
  | 'setStructureSurfaceColor'
  | 'addStructureSurface'
  | 'removeStructurePack'
  | 'removeStructureSurface'
  | 'beginStructureMove'
  | 'endStructureMove'
  | 'setDoor'
  | 'addWindow'
  | 'updateWindow'
  | 'removeWindow'
>

export function createConstructionActions(context: Pick<RoomActionContext, 'set' | 'get' | 'runtime'>): ConstructionActions {
  const { set, get, runtime } = context
  return {
    setDimension: (key, value) => set((state) => {
      const next = clampRoomDimension(key, value)
      recordInteraction('state.room.dimension', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `room-${key}`,
        details: { dimension: key === 'width' ? 'la anchura' : key === 'depth' ? 'la profundidad' : 'la altura', value: next },
      })
      const update = safeRoomUpdate(state, { ...state.room, [key]: next })
      if (key === 'height' && update.room && Math.abs(state.frontCameraHeight - state.room.height / 2) < 0.001) {
        return {
          ...update,
          frontCameraHeight: Math.max(FRONT_CAMERA_MIN_HEIGHT, Math.min(FRONT_CAMERA_MAX_HEIGHT, next / 2)),
        }
      }
      return update
    }),
    setWallColor: (wallColor) => set((state) => {
      recordInteraction('state.room.wall-color', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: 'room-wall-color',
        details: { color: wallColor },
      })
      return {
        room: {
          ...state.room,
          wallColor,
          wallColors: Object.fromEntries(WALL_SIDES.map((wall) => [wall, wallColor])),
        },
        notice: '',
      }
    }),
    setWallSideColor: (wall, color) => set((state) => {
      recordInteraction('state.room.wall-color', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `room-wall-color-${wall}`,
        details: { wall, color },
      })
      return {
        room: { ...state.room, wallColors: { ...state.room.wallColors, [wall]: color } },
        notice: '',
      }
    }),
    setFloorColor: (floorColor) => set((state) => {
      recordInteraction('state.room.floor-color', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: 'room-floor-color',
        details: { color: floorColor },
      })
      return { room: { ...state.room, floorColor }, notice: '' }
    }),
    addStructurePack: () => set((state) => {
      const id = makeId('floor-pack')
      const nextY = Math.max(state.room.height, ...state.structurePacks.map((pack) => pack.y + state.room.height))
      let floorNumber = 2
      while (state.structurePacks.some((pack) => pack.name === `Piso ${floorNumber}`)) floorNumber += 1
      const surfaceIds: StructureSurfaceKey[] = ['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west']
      const pack: StructurePack = {
        id,
        name: `Piso ${floorNumber}`,
        x: 0,
        y: nextY,
        z: 0,
        surfaces: surfaceIds.map((surfaceId) => createStructureSurface(state.room, surfaceId)),
      }
      recordInteraction('state.structure-pack.added', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: pack.name, y: pack.y },
      })
      return {
        structurePacks: [...state.structurePacks, pack],
        hiddenElementIds: [...state.hiddenElementIds, structureSurfaceElementId(id, 'ceiling')],
        selectedId: id,
        notice: `${pack.name} añadido.`,
      }
    }),
    addStructureObject: (kind) => set((state) => {
      const id = makeId(kind === 'floor' ? 'floor-object' : 'wall-object')
      const surfaceId: StructureSurfaceKey = kind === 'floor' ? 'floor' : 'wall-north'
      const surface = createStructureSurface(state.room, surfaceId)
      surface.name = kind === 'floor' ? 'Suelo independiente' : 'Pared independiente'
      if (kind === 'floor') surface.y = state.room.height / 2
      const ordinal = state.structurePacks.filter((pack) => pack.surfaces.some((item) => item.kind === kind)).length + 1
      const pack: StructurePack = {
        id,
        name: kind === 'floor' ? `Suelo ${ordinal}` : `Pared ${ordinal}`,
        x: 0,
        y: 0,
        z: 0,
        surfaces: [surface],
      }
      recordInteraction(`state.structure-object.${kind}-added`, {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: pack.name, x: pack.x, z: pack.z },
      })
      return {
        structurePacks: [...state.structurePacks, pack],
        selectedId: structureSurfaceElementId(id, surfaceId),
        notice: `${pack.name} añadido.`,
      }
    }),
    moveStructurePack: (id, axis, value) => set((state) => {
      const pack = state.structurePacks.find((candidate) => candidate.id === id)
      if (!pack || !Number.isFinite(value)) return {}
      recordInteraction('state.structure-pack.moved', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `structure-pack-${id}-${axis}`,
        details: { id, name: pack.name, axis, value },
      })
      return {
        structurePacks: state.structurePacks.map((candidate) => candidate.id === id ? { ...candidate, [axis]: value } : candidate),
        notice: '',
      }
    }),
    moveStructureSurface: (packId, surfaceId, axis, value) => set((state) => {
      const pack = state.structurePacks.find((candidate) => candidate.id === packId)
      if (!pack || !Number.isFinite(value) || !pack.surfaces.some((surface) => surface.id === surfaceId)) return {}
      recordInteraction('state.structure-surface.moved', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `structure-surface-${packId}-${surfaceId}-${axis}`,
        details: { packId, surfaceId, name: pack.name, axis, value },
      })
      return {
        structurePacks: state.structurePacks.map((candidate) => candidate.id !== packId ? candidate : {
          ...candidate,
          surfaces: candidate.surfaces.map((surface) => surface.id === surfaceId ? { ...surface, [axis]: value } : surface),
        }),
        notice: '',
      }
    }),
    resizeStructureSurface: (packId, surfaceId, dimension, value) => set((state) => {
      if (!Number.isFinite(value) || value < 0.25 || value > 20) return {}
      const pack = state.structurePacks.find((candidate) => candidate.id === packId)
      const surface = pack?.surfaces.find((item) => item.id === surfaceId)
      if (!pack || !surface || surface[dimension] === value) return {}
      recordInteraction('state.structure-surface.resized', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `structure-surface-${packId}-${surfaceId}-${dimension}`,
        details: { packId, surfaceId, name: pack.name, dimension, value },
      })
      return {
        structurePacks: state.structurePacks.map((pack) => pack.id !== packId ? pack : {
          ...pack,
          surfaces: pack.surfaces.map((item) => item.id === surfaceId ? { ...item, [dimension]: value } : item),
        }),
        notice: '',
      }
    }),
    setStructureSurfaceRotation: (packId, surfaceId, rotation) => set((state) => {
      const pack = state.structurePacks.find((candidate) => candidate.id === packId)
      const surface = pack?.surfaces.find((item) => item.id === surfaceId)
      if (!pack || !surface || surface.kind !== 'wall' || !Number.isFinite(rotation)) return {}
      const nextRotation = ((rotation + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
      if (surface.rotation === nextRotation) return {}
      recordInteraction('state.structure-surface.rotated', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `structure-surface-${packId}-${surfaceId}-rotation`,
        details: { packId, surfaceId, name: pack.name, rotation: nextRotation },
      })
      return {
        structurePacks: state.structurePacks.map((pack) => pack.id !== packId ? pack : {
          ...pack,
          surfaces: pack.surfaces.map((item) => item.id === surfaceId ? { ...item, rotation: nextRotation } : item),
        }),
        notice: '',
      }
    }),
    setStructureSurfaceColor: (packId, surfaceId, color) => set((state) => {
      const pack = state.structurePacks.find((candidate) => candidate.id === packId)
      const surface = pack?.surfaces.find((item) => item.id === surfaceId)
      if (!pack || !surface || surface.color === color) return {}
      recordInteraction('state.structure-surface.color', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `structure-surface-color-${packId}-${surfaceId}`,
        details: { packId, surfaceId, name: pack.name, color },
      })
      return {
        structurePacks: state.structurePacks.map((pack) => pack.id !== packId ? pack : {
          ...pack,
          surfaces: pack.surfaces.map((item) => item.id === surfaceId ? { ...item, color } : item),
        }),
        notice: '',
      }
    }),
    addStructureSurface: (packId, surfaceId) => set((state) => {
      const pack = state.structurePacks.find((candidate) => candidate.id === packId)
      if (!pack || pack.surfaces.some((surface) => surface.id === surfaceId)) return {}
      const surface = createStructureSurface(state.room, surfaceId)
      recordInteraction('state.structure-surface.added', {
        view: state.view,
        selectedId: state.selectedId,
        details: { packId, surfaceId, name: pack.name, surfaceName: surface.name },
      })
      return {
        structurePacks: state.structurePacks.map((candidate) => candidate.id === packId ? { ...candidate, surfaces: [...candidate.surfaces, surface] } : candidate),
        hiddenElementIds: state.hiddenElementIds.filter((id) => id !== structureSurfaceElementId(packId, surfaceId)),
        selectedId: structureSurfaceElementId(packId, surfaceId),
        notice: `${surface.name} añadido a ${pack.name}.`,
      }
    }),
    removeStructurePack: (id) => set((state) => {
      const pack = state.structurePacks.find((candidate) => candidate.id === id)
      if (!pack) return {}
      const surfaceIds = pack.surfaces.map((surface) => structureSurfaceElementId(pack.id, surface.id))
      recordInteraction('state.structure-pack.removed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: pack.name },
      })
      return {
        structurePacks: state.structurePacks.filter((candidate) => candidate.id !== id),
        hiddenElementIds: state.hiddenElementIds.filter((hiddenId) => hiddenId !== id && !surfaceIds.includes(hiddenId)),
        selectedId: state.selectedId === id || surfaceIds.includes(state.selectedId ?? '') ? null : state.selectedId,
        notice: `${pack.name} eliminado.`,
      }
    }),
    removeStructureSurface: (packId, surfaceId) => set((state) => {
      const pack = state.structurePacks.find((candidate) => candidate.id === packId)
      if (!pack || !pack.surfaces.some((surface) => surface.id === surfaceId)) return {}
      const selectedSurfaceId = structureSurfaceElementId(packId, surfaceId)
      recordInteraction('state.structure-surface.removed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { packId, surfaceId, name: pack.name, surfaceName: pack.surfaces.find((surface) => surface.id === surfaceId)?.name },
      })
      return {
        structurePacks: state.structurePacks.map((candidate) => candidate.id !== packId ? candidate : {
          ...candidate,
          surfaces: candidate.surfaces.filter((surface) => surface.id !== surfaceId),
        }),
        hiddenElementIds: state.hiddenElementIds.filter((id) => id !== selectedSurfaceId),
        selectedId: state.selectedId === selectedSurfaceId ? null : state.selectedId,
        notice: 'Superficie eliminada.',
      }
    }),
    beginStructureMove: () => {
      get().beginHistoryGesture()
    },
    endStructureMove: () => {
      finishHistoryTransaction(runtime)
    },
    setDoor: (partial) => set((state) => {
      const candidate = roomForDoorUpdate(state.room, partial)
      const update = safeRoomUpdate(state, candidate)
      if (update.room) {
        recordInteraction('state.opening.updated', {
          view: state.view,
          selectedId: state.selectedId,
          coalesceKey: 'opening-door',
          details: { id: 'door', name: 'Puerta', ...candidate.door },
        })
      }
      return update
    }),
    addWindow: (shape = 'rectangular') => set((state) => {
      const definition = OPENING_CATALOG[openingKindForShape(shape)]
      const walls: WallSide[] = ['north', 'east', 'south', 'west']
      const offsets = [0, -1.25, 1.25, -2, 2]
      for (const wall of walls) {
        for (const offset of offsets) {
          const window: WindowConfig = {
            id: makeId('window'),
            shape,
            wall,
            offset,
            width: definition.width,
            height: definition.height,
            sill: definition.defaultBottom,
            rotation: 0,
            color: isWallPictureShape(shape)
              ? FURNITURE_PRESETS[shape].color
              : isWallMirrorShape(shape)
                ? '#9a8067'
                : shape === 'wallSconce'
                  ? '#d3a755'
                : '#c88f58',
          }
          const candidate = { ...state.room, windows: [...state.room.windows, window] }
          if (!validateOpenings(candidate)) {
            recordInteraction('state.window.added', {
              view: state.view,
              selectedId: state.selectedId,
              details: { id: window.id, name: `${definition.name} ${state.room.windows.length + 1}`, wall, offset, selectedAfter: window.id },
            })
            return { room: candidate, selectedId: window.id, notice: `${definition.name} añadida.` }
          }
        }
      }
      return { notice: `No queda espacio válido para colocar ${definition.name.toLowerCase()}.` }
    }),
    updateWindow: (id, partial) => set((state) => {
      const currentWindow = state.room.windows.find((window) => window.id === id)
      if (!currentWindow) return {}
      const candidate = roomForWindowUpdate(state.room, currentWindow, partial)
      const update = safeRoomUpdate(state, candidate)
      const nextWindow = candidate.windows.find((window) => window.id === id)
      if (update.room && nextWindow) {
        recordInteraction('state.opening.updated', {
          view: state.view,
          selectedId: state.selectedId,
          coalesceKey: `opening-${id}`,
          details: { ...nextWindow, name: elementName(state, id) },
        })
      }
      return update
    }),
    removeWindow: (id) => set((state) => {
      recordInteraction('state.element.removed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: elementName(state, id) },
      })
      return {
        room: { ...state.room, windows: state.room.windows.filter((window) => window.id !== id) },
        hiddenElementIds: state.hiddenElementIds.filter((elementId) => elementId !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
        notice: '',
      }
    }),
  }
}
