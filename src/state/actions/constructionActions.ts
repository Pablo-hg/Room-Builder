import { finishHistoryTransaction } from '../historyTransactions'
import { clampRoomDimension, roomForDoorUpdate, roomForWindowUpdate, safeRoomUpdate } from '../../domain/editingRules'
import { createStructureSurface, structureDimensionMinimum } from '../../domain/structureRules'
import { makeId, structureGridElementId, structureSurfaceElementId } from '../../domain/elementIds'
import { withoutFolderAssignments } from '../../domain/elementFolders'
import { folderSelectionId } from '../../domain/elementFolders'
import { elementName } from '../../domain/selection'
import { FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT, WALL_SIDES } from '../../domain/constants'
import { FURNITURE_PRESETS, isWallMirrorShape, isWallPictureShape, OPENING_CATALOG, openingKindForShape } from '../../domain/objectCatalog'
import { validateOpenings } from '../../domain/geometry'
import { snapMeasurement } from '../../domain/measurements'
import { openingMovementAllowed } from '../../domain/axisLocks'
import { packRoomBox, rebasePack, resizedRoomPack, selectedEditableRoom, worldRoomBoxes } from '../../domain/roomEditing'
import { BASE_ROOM_SURFACE_IDS } from '../../domain/elementFolders'
import { structureDoorError, structureDoorPosition } from '../../domain/structureDoors'
import type { StructurePack, StructureSurfaceKey, WallSide, WindowConfig } from '../../domain/types'
import { recordInteraction } from '../../debug/interactionLog'
import type { RoomActionContext, RoomState } from '../types'

type ConstructionActions = Pick<
  RoomState,
  | 'setDimension'
  | 'setSelectedRoomDimension'
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
    setSelectedRoomDimension: (key, value) => {
      const state = get()
      const target = selectedEditableRoom(state)
      if (!target) return set({ notice: 'Selecciona una carpeta con una habitación rectangular completa.' })
      if (target.kind === 'root') {
        if (BASE_ROOM_SURFACE_IDS.some((id) => state.lockedElementIds.includes(id))) return set({ notice: 'Desbloquea las superficies de la habitación para cambiar sus dimensiones.' })
        return get().setDimension(key, value)
      }
      const pack = state.structurePacks.find((candidate) => candidate.id === target.packId)!
      if (state.lockedElementIds.includes(pack.id) || pack.surfaces.some((surface) => state.lockedElementIds.includes(structureSurfaceElementId(pack.id, surface.id)))) return set({ notice: 'Desbloquea las superficies de la habitación para cambiar sus dimensiones.' })
      const next = resizedRoomPack(pack, state.room, { ...target.size, [key]: clampRoomDimension(key, value) })
      if (!next) return
      const doorError = structureDoorError(next)
      if (doorError) return set({ notice: doorError })
      if (pack.doors?.some((door) => {
        const before = structureDoorPosition(state.room, pack, door)!
        const after = structureDoorPosition(state.room, next, door)!
        return (['x', 'y', 'z'] as const).some((axis) => door.axisLocks?.[axis] && Math.abs(before[axis] - after[axis]) > 1e-9)
      })) return set({ notice: 'El cambio desplazaría un eje bloqueado de una puerta.' })
      if (next.surfaces.some((surface, index) => (['x', 'y', 'z'] as const).some((axis) => (pack.axisLocks?.[axis] || surface.axisLocks?.[axis]) && surface[axis] !== pack.surfaces[index][axis]))) return set({ notice: 'El cambio desplazaría un eje bloqueado de la habitación.' })
      return set({ structurePacks: state.structurePacks.map((candidate) => candidate.id === next.id ? next : candidate), notice: '' })
    },
    setDimension: (key, value) => set((state) => {
      const next = clampRoomDimension(key, value)
      if (key !== 'height' && next !== state.room[key]) {
        const axis = key === 'width' ? 'x' : 'z'
        const openings = [state.room.door, ...state.room.windows]
        const movesLockedOpening = openings.some((opening) => opening.axisLocks?.[axis] && (axis === 'x' ? opening.wall === 'east' || opening.wall === 'west' : opening.wall === 'north' || opening.wall === 'south'))
        if (movesLockedOpening) return { notice: `Desbloquea el eje ${axis.toUpperCase()} de los elementos afectados antes de cambiar la habitación.` }
      }
      recordInteraction('state.room.dimension', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `room-${key}`,
        details: { dimension: key === 'width' ? 'la anchura' : key === 'depth' ? 'la profundidad' : 'la altura', value: next },
      })
      const update = safeRoomUpdate(state, { ...state.room, [key]: next })
      if (update.furniture) {
        const otherRooms = worldRoomBoxes(state.room, state.structurePacks).slice(1)
        update.furniture = update.furniture.map((item, index) => {
          const original = state.furniture[index]
          return otherRooms.some((room) => Math.abs(original.x - room.x) <= room.width / 2 && Math.abs(original.z - room.z) <= room.depth / 2 && original.y >= room.y - 1e-6 && original.y + original.height <= room.y + room.height + 1e-6) ? original : item
        })
      }
      if (update.room) Object.assign(update, { structurePacks: state.structurePacks.map((pack) => rebasePack(pack, state.room, update.room!)) })
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
    addStructurePack: (direction) => set((state) => {
      const id = makeId('floor-pack')
      const folderId = makeId('folder')
      const nextY = Math.max(...worldRoomBoxes(state.room, state.structurePacks).map((box) => box.y + box.height))
      const selectedFolder = state.selectedId?.startsWith('folder:') ? state.selectedId.slice('folder:'.length) : null
      const reference = state.structurePacks.find((pack) => pack.id.startsWith('floor-pack-') && (pack.id === state.selectedId || pack.surfaces.some((surface) => structureSurfaceElementId(pack.id, surface.id) === state.selectedId) || (selectedFolder !== null && state.elementFolderAssignments[pack.id] === selectedFolder)))
        ?? state.structurePacks.find((pack) => pack.id === state.activeRoomId && pack.id.startsWith('floor-pack-'))
      const referenceBox = reference && packRoomBox(reference, state.room)
      const template = { ...state.room, ...(referenceBox ? { width: referenceBox.width, depth: referenceBox.depth, height: referenceBox.height } : {}) }
      const origin = reference ? { x: reference.x + (referenceBox?.x ?? 0), y: reference.y + (referenceBox?.y ?? 0), z: reference.z + (referenceBox?.z ?? 0) } : { x: 0, y: 0, z: 0 }
      let floorNumber = 2
      while (state.structurePacks.some((pack) => pack.name === `Habitación ${floorNumber}`)) floorNumber += 1
      const surfaceIds: StructureSurfaceKey[] = ['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west']
      const pack: StructurePack = rebasePack({
        id,
        name: `Habitación ${floorNumber}`,
        x: origin.x + (direction === 'east' ? template.width : direction === 'west' ? -template.width : 0),
        y: direction ? origin.y + (direction === 'up' ? template.height : direction === 'down' ? -template.height : 0) : nextY,
        z: origin.z + (direction === 'south' ? template.depth : direction === 'north' ? -template.depth : 0),
        surfaces: surfaceIds.map((surfaceId) => createStructureSurface(template, surfaceId)),
      }, template, state.room)
      recordInteraction('state.structure-pack.added', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: pack.name, y: pack.y },
      })
      return {
        structurePacks: [...state.structurePacks, pack],
        elementFolders: [...state.elementFolders, { id: folderId, name: pack.name }],
        elementFolderAssignments: { ...state.elementFolderAssignments, [pack.id]: folderId, ...Object.fromEntries(pack.surfaces.map((surface) => [structureSurfaceElementId(pack.id, surface.id), folderId])) },
        hiddenElementIds: [...state.hiddenElementIds, structureSurfaceElementId(id, 'ceiling')],
        selectedId: folderSelectionId(folderId),
        activeRoomId: id,
        ...(state.view === 'isometric' ? { isoCameraHeight: pack.y } : {}),
        notice: `${pack.name} añadido.`,
      }
    }),
    addStructureObject: (kind) => set((state) => {
      const id = makeId(kind === 'floor' ? 'floor-object' : 'wall-object')
      const surfaceId: StructureSurfaceKey = kind === 'floor' ? 'floor' : 'wall-north'
      const surface = createStructureSurface(state.room, surfaceId)
      surface.name = kind === 'floor' ? 'Suelo independiente' : 'Pared independiente'
      if (kind === 'floor') surface.y = state.room.height / 2
      else surface.z = state.room.depth / 2
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
      if (state.lockedElementIds.includes(id)) return {}
      const pack = state.structurePacks.find((candidate) => candidate.id === id)
      if (!pack || !Number.isFinite(value)) return {}
      if (pack.doors?.some((door) => door.axisLocks?.[axis] || state.lockedElementIds.includes(door.id))) return {}
      if (pack.axisLocks?.[axis] || pack.surfaces.some((surface) => surface.axisLocks?.[axis] || state.lockedElementIds.includes(structureSurfaceElementId(pack.id, surface.id)))) return {}
      if (pack[axis] === value) return {}
      const next = snapMeasurement(value)
      if (pack[axis] === next) return {}
      recordInteraction('state.structure-pack.moved', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `structure-pack-${id}-${axis}`,
        details: { id, name: pack.name, axis, value: next },
      })
      return {
        structurePacks: state.structurePacks.map((candidate) => candidate.id === id ? { ...candidate, [axis]: next } : candidate),
        notice: '',
      }
    }),
    moveStructureSurface: (packId, surfaceId, axis, value) => set((state) => {
      if (state.lockedElementIds.includes(structureSurfaceElementId(packId, surfaceId))) return {}
      const pack = state.structurePacks.find((candidate) => candidate.id === packId)
      const surface = pack?.surfaces.find((item) => item.id === surfaceId)
      if (!pack || !surface || !Number.isFinite(value)) return {}
      if (pack.axisLocks?.[axis] || surface.axisLocks?.[axis] || state.lockedElementIds.includes(pack.id)) return {}
      if (surface[axis] === value) return {}
      const next = snapMeasurement(value)
      if (surface[axis] === next) return {}
      recordInteraction('state.structure-surface.moved', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `structure-surface-${packId}-${surfaceId}-${axis}`,
        details: { packId, surfaceId, name: pack.name, axis, value: next },
      })
      return {
        structurePacks: state.structurePacks.map((candidate) => candidate.id !== packId ? candidate : {
          ...candidate,
          surfaces: candidate.surfaces.map((item) => item.id === surfaceId ? { ...item, [axis]: next } : item),
        }),
        notice: '',
      }
    }),
    resizeStructureSurface: (packId, surfaceId, dimension, value) => set((state) => {
      if (state.lockedElementIds.includes(structureSurfaceElementId(packId, surfaceId))) return {}
      const pack = state.structurePacks.find((candidate) => candidate.id === packId)
      const surface = pack?.surfaces.find((item) => item.id === surfaceId)
      if (!pack || !surface || !Number.isFinite(value)) return {}
      const minimum = structureDimensionMinimum(surface.kind, dimension)
      const next = Math.max(minimum, Math.min(20, snapMeasurement(value)))
      if (surface[dimension] === next) return {}
      recordInteraction('state.structure-surface.resized', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `structure-surface-${packId}-${surfaceId}-${dimension}`,
        details: { packId, surfaceId, name: pack.name, dimension, value: next },
      })
      return {
        structurePacks: state.structurePacks.map((pack) => pack.id !== packId ? pack : {
          ...pack,
          surfaces: pack.surfaces.map((item) => item.id === surfaceId ? { ...item, [dimension]: next } : item),
        }),
        notice: '',
      }
    }),
    setStructureSurfaceRotation: (packId, surfaceId, rotation) => set((state) => {
      if (state.lockedElementIds.includes(structureSurfaceElementId(packId, surfaceId))) return {}
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
        elementFolderAssignments: state.elementFolderAssignments[packId] ? { ...state.elementFolderAssignments, [structureSurfaceElementId(packId, surfaceId)]: state.elementFolderAssignments[packId] } : state.elementFolderAssignments,
        hiddenElementIds: state.hiddenElementIds.filter((id) => id !== structureSurfaceElementId(packId, surfaceId)),
        selectedId: structureSurfaceElementId(packId, surfaceId),
        notice: `${surface.name} añadido a ${pack.name}.`,
      }
    }),
    removeStructurePack: (id) => set((state) => {
      const pack = state.structurePacks.find((candidate) => candidate.id === id)
      if (!pack) return {}
      const surfaceIds = pack.surfaces.map((surface) => structureSurfaceElementId(pack.id, surface.id))
      const gridIds = pack.surfaces.map((surface) => structureGridElementId(pack.id, surface.id))
      const folderId = state.elementFolderAssignments[id]
      const removed = new Set([id, ...surfaceIds])
      const removeFolder = !!folderId && !state.elementFolders.some((folder) => folder.parentId === folderId) && !Object.entries(state.elementFolderAssignments).some(([elementId, assigned]) => assigned === folderId && !removed.has(elementId))
      recordInteraction('state.structure-pack.removed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: pack.name },
      })
      return {
        structurePacks: state.structurePacks.filter((candidate) => candidate.id !== id),
        hiddenElementIds: state.hiddenElementIds.filter((hiddenId) => hiddenId !== id && !surfaceIds.includes(hiddenId) && !gridIds.includes(hiddenId)),
        lockedElementIds: state.lockedElementIds.filter((lockedId) => lockedId !== id && !surfaceIds.includes(lockedId)),
        elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, [id, ...surfaceIds]),
        ...(removeFolder ? { elementFolders: state.elementFolders.filter((folder) => folder.id !== folderId) } : {}),
        selectedId: state.selectedId === id || (removeFolder && state.selectedId === folderSelectionId(folderId)) || surfaceIds.includes(state.selectedId ?? '') ? null : state.selectedId,
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
        hiddenElementIds: state.hiddenElementIds.filter((id) => id !== selectedSurfaceId && id !== structureGridElementId(packId, surfaceId)),
        lockedElementIds: state.lockedElementIds.filter((id) => id !== selectedSurfaceId),
        elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, [selectedSurfaceId]),
        selectedId: state.selectedId === selectedSurfaceId ? null : state.selectedId,
        notice: 'Superficie eliminada.',
      }
    }),
    beginStructureMove: () => {
      get().beginHistoryGesture()
    },
    endStructureMove: () => {
      const token = runtime.activeGesture?.token
      if (token) get().commitHistoryGesture(token)
      else finishHistoryTransaction(runtime)
    },
    setDoor: (partial) => set((state) => {
      if (!openingMovementAllowed(state.room.door, partial)) return {}
      if (state.lockedElementIds.includes('door') && (partial.wall !== undefined || partial.offset !== undefined)) return {}
      const candidate = roomForDoorUpdate(state.room, partial)
      if (!openingMovementAllowed(state.room.door, candidate.door)) return {}
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
      if (state.lockedElementIds.includes(id) && (partial.wall !== undefined || partial.offset !== undefined || partial.sill !== undefined || partial.rotation !== undefined)) return {}
      const currentWindow = state.room.windows.find((window) => window.id === id)
      if (!currentWindow) return {}
      if (!openingMovementAllowed(currentWindow, partial)) return {}
      const candidate = roomForWindowUpdate(state.room, currentWindow, partial)
      const candidateWindow = candidate.windows.find((window) => window.id === id)
      if (candidateWindow && !openingMovementAllowed(currentWindow, candidateWindow)) return {}
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
        lockedElementIds: state.lockedElementIds.filter((elementId) => elementId !== id),
        elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, [id]),
        selectedId: state.selectedId === id ? null : state.selectedId,
        notice: '',
      }
    }),
  }
}
