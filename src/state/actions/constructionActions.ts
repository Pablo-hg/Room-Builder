import { finishHistoryTransaction } from '../historyTransactions'
import { clampRoomDimension, roomForDoorUpdate, roomForWindowUpdate, safeRoomUpdate } from '../../domain/editingRules'
import { createStructureSurface, structureDimensionMinimum } from '../../domain/structureRules'
import { makeId, structureGridElementId, structureSurfaceElementId } from '../../domain/elementIds'
import { withoutFolderAssignments } from '../../domain/elementFolders'
import { folderSelectionId } from '../../domain/elementFolders'
import { elementName } from '../../domain/selection'
import { FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT, WALL_SIDES } from '../../domain/constants'
import { FURNITURE_PRESETS, isWallMirrorShape, isWallPictureShape, OPENING_CATALOG, openingKindForShape } from '../../domain/objectCatalog'
import { findAvailableOpeningOffset, validateOpenings, wallLength } from '../../domain/geometry'
import { packWindowById, structureWindowError } from '../../domain/structureWindows'
import { snapMeasurement } from '../../domain/measurements'
import { openingMovementAllowed } from '../../domain/axisLocks'
import { focusedCreationTarget, focusedRoom, packRoomBox, rebasePack, resizedRoomPack, selectedEditableRoom, worldRoomBoxes } from '../../domain/roomEditing'
import { planRoomCreation } from '../../domain/roomCreation'
import { windowPlacementWalls } from '../../domain/windowPlacement'
import { wallObjectLocksAllow } from '../../domain/wallObjectPlacement'
import { BASE_ROOM_SURFACE_IDS } from '../../domain/elementFolders'
import { hasCoincidentWall, structureDoorError, structureDoorPosition } from '../../domain/structureDoors'
import type { StructurePack, StructureSurfaceKey, WallSide, WindowConfig } from '../../domain/types'
import { recordInteraction } from '../../debug/interactionLog'
import type { RoomActionContext, RoomState } from '../types'

type ConstructionActions = Pick<
  RoomState,
  | 'setDimension'
  | 'setSelectedRoomDimension'
  | 'setFocusedRoomDimension'
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
  const resizeRoom = (key: 'width' | 'depth' | 'height', value: number, target: ReturnType<typeof selectedEditableRoom>) => {
      const state = get()
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
    }
  return {
    setSelectedRoomDimension: (key, value) => resizeRoom(key, value, selectedEditableRoom(get())),
    setFocusedRoomDimension: (key, value) => resizeRoom(key, value, focusedRoom(get()).editable),
    setDimension: (key, value) => set((state) => {
      const next = clampRoomDimension(key, value)
      if (key !== 'height' && next !== state.room[key]) {
        const axis = key === 'width' ? 'x' : 'z'
        const openings = [state.room.door, ...(state.room.extraDoors ?? []), ...state.room.windows]
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
      const placement = planRoomCreation(state, direction)
      if (placement.occupied) return { notice: 'No se puede crear la habitación: otra habitación ya ocupa ese espacio.' }
      const id = makeId('floor-pack')
      const folderId = makeId('folder')
      let floorNumber = 2
      while (state.structurePacks.some((pack) => pack.name === `Habitación ${floorNumber}`)) floorNumber += 1
      const pack: StructurePack = { ...placement.pack, id, name: `Habitación ${floorNumber}` }
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
      const target = focusedCreationTarget(state)
      const surface = createStructureSurface(state.room, surfaceId)
      surface.name = kind === 'floor' ? 'Suelo independiente' : 'Pared independiente'
      // The surface keeps its local coordinates, but its hidden pack is placed
      // at the world-space centre of the focused room (including other floors).
      if (kind === 'floor') {
        surface.width = target.size.width
        surface.depth = target.size.depth
        surface.y = target.size.height / 2
      } else {
        surface.width = target.size.width
        surface.height = target.size.height
        surface.y = (target.size.height - state.room.height) / 2
        surface.z = state.room.depth / 2 // Cancel root-north wall offset
      }
      const ordinal = state.structurePacks.filter((pack) => pack.surfaces.some((item) => item.kind === kind)).length + 1
      const pack: StructurePack = {
        id,
        name: kind === 'floor' ? `Suelo ${ordinal}` : `Pared ${ordinal}`,
        x: target.center.x,
        y: target.center.y,
        z: target.center.z,
        surfaces: [surface],
      }
      recordInteraction(`state.structure-object.${kind}-added`, {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: pack.name, x: pack.x, z: pack.z },
      })
      return {
        structurePacks: [...state.structurePacks, pack],
        ...(target.folderId ? { elementFolderAssignments: { ...state.elementFolderAssignments, [structureSurfaceElementId(id, surfaceId)]: target.folderId } } : {}),
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
      const box = surface.kind === 'ceiling' && dimension === 'height' ? packRoomBox(pack, state.room) : null
      const topAnchored = box && Math.abs(state.room.height + surface.y + surface.height / 2 - box.y - box.height) < 1e-6
      if (topAnchored && (pack.axisLocks?.y || surface.axisLocks?.y)) return { notice: 'Desbloquea el eje Y para cambiar el grosor del techo manteniendo su cara superior.' }
      recordInteraction('state.structure-surface.resized', {
        view: state.view,
        selectedId: state.selectedId,
        coalesceKey: `structure-surface-${packId}-${surfaceId}-${dimension}`,
        details: { packId, surfaceId, name: pack.name, dimension, value: next },
      })
      return {
        structurePacks: state.structurePacks.map((pack) => pack.id !== packId ? pack : {
          ...pack,
          surfaces: pack.surfaces.map((item) => item.id === surfaceId ? { ...item, [dimension]: next, ...(topAnchored ? { y: item.y - (next - item.height) / 2 } : {}) } : item),
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
      const openingIds = [...(pack.doors ?? []), ...(pack.windows ?? [])].map((opening) => opening.id)
      const folderId = state.elementFolderAssignments[id]
      const removed = new Set([id, ...surfaceIds, ...openingIds])
      const removeFolder = !!folderId && !state.elementFolders.some((folder) => folder.parentId === folderId) && !Object.entries(state.elementFolderAssignments).some(([elementId, assigned]) => assigned === folderId && !removed.has(elementId))
      recordInteraction('state.structure-pack.removed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: pack.name },
      })
      return {
        structurePacks: state.structurePacks.filter((candidate) => candidate.id !== id),
        hiddenElementIds: state.hiddenElementIds.filter((hiddenId) => hiddenId !== id && !surfaceIds.includes(hiddenId) && !gridIds.includes(hiddenId) && !openingIds.includes(hiddenId)),
        lockedElementIds: state.lockedElementIds.filter((lockedId) => lockedId !== id && !surfaceIds.includes(lockedId) && !openingIds.includes(lockedId)),
        elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, [id, ...surfaceIds, ...openingIds]),
        ...(removeFolder ? { elementFolders: state.elementFolders.filter((folder) => folder.id !== folderId) } : {}),
        selectedId: state.selectedId === id || (removeFolder && state.selectedId === folderSelectionId(folderId)) || (surfaceIds.includes(state.selectedId ?? '') || openingIds.includes(state.selectedId ?? '')) ? null : state.selectedId,
        notice: `${pack.name} eliminado.`,
      }
    }),
    removeStructureSurface: (packId, surfaceId) => set((state) => {
      const pack = state.structurePacks.find((candidate) => candidate.id === packId)
      if (!pack || !pack.surfaces.some((surface) => surface.id === surfaceId)) return {}
      const selectedSurfaceId = structureSurfaceElementId(packId, surfaceId)
      const removeIndependentPack = (pack.id.startsWith('floor-object-') || pack.id.startsWith('wall-object-')) && pack.surfaces.length === 1
      recordInteraction('state.structure-surface.removed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { packId, surfaceId, name: pack.name, surfaceName: pack.surfaces.find((surface) => surface.id === surfaceId)?.name },
      })
      return {
        structurePacks: removeIndependentPack
          ? state.structurePacks.filter((candidate) => candidate.id !== packId)
          : state.structurePacks.map((candidate) => candidate.id !== packId ? candidate : {
            ...candidate,
            surfaces: candidate.surfaces.filter((surface) => surface.id !== surfaceId),
          }),
        hiddenElementIds: state.hiddenElementIds.filter((id) => id !== selectedSurfaceId && id !== structureGridElementId(packId, surfaceId) && (!removeIndependentPack || id !== packId)),
        lockedElementIds: state.lockedElementIds.filter((id) => id !== selectedSurfaceId && (!removeIndependentPack || id !== packId)),
        elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, removeIndependentPack ? [selectedSurfaceId, packId] : [selectedSurfaceId]),
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
      const focusedPack = state.structurePacks.find((pack) => pack.id === state.activeRoomId && pack.id.startsWith('floor-pack-'))
      const walls = windowPlacementWalls(state)
      const windowId = makeId('window')
      for (const { wall, visible } of walls) {
        const wallSurface = focusedPack?.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === wall)
        if (focusedPack && (!wallSurface || hasCoincidentWall(state.room, state.structurePacks, focusedPack, wallSurface))) continue
        const buildWindow = (offset: number): WindowConfig => ({
          id: windowId, shape, wall, offset,
          width: definition.width, height: definition.height, sill: definition.defaultBottom, rotation: 0,
          color: isWallPictureShape(shape) ? FURNITURE_PRESETS[shape].color
            : isWallMirrorShape(shape) ? '#9a8067' : shape === 'wallSconce' ? '#d3a755' : '#c88f58',
        })
        const offset = focusedPack
          ? findAvailableOpeningOffset(wallSurface!.width, definition.width, 0,
            (value) => !structureWindowError({ ...focusedPack, windows: [...(focusedPack.windows ?? []), buildWindow(value)] }))
          : findAvailableOpeningOffset(wallLength(state.room, wall), definition.width, 0,
            (value) => !validateOpenings({ ...state.room, windows: [...state.room.windows, buildWindow(value)] }))
        if (offset === null) continue
        const window = buildWindow(offset)
        recordInteraction('state.window.added', { view: state.view, selectedId: state.selectedId,
          details: { id: window.id, name: definition.name, wall, offset, packId: focusedPack?.id, selectedAfter: window.id } })
        const { folderId } = focusedCreationTarget(state)
        return {
          ...(focusedPack ? {
            structurePacks: state.structurePacks.map((pack) => pack.id === focusedPack.id
              ? { ...pack, windows: [...(pack.windows ?? []), window] } : pack),
          } : { room: { ...state.room, windows: [...state.room.windows, window] } }),
          ...(folderId ? { elementFolderAssignments: { ...state.elementFolderAssignments, [window.id]: folderId } } : {}),
          selectedId: window.id, notice: visible ? `${definition.name} añadida.` : `${definition.name} añadida en una pared oculta: no había espacio válido en las visibles.`,
        }
      }
      return { notice: `No queda espacio válido para colocar ${definition.name.toLowerCase()} en la habitación enfocada.` }
    }),
    updateWindow: (id, partial) => set((state) => {
      if (state.lockedElementIds.includes(id) && (partial.wall !== undefined || partial.offset !== undefined || partial.sill !== undefined || partial.rotation !== undefined)) return {}
      const structureSource = packWindowById(state.structurePacks, id)
      if (structureSource) {
        const { pack, window: currentWindow } = structureSource
        if (!openingMovementAllowed(currentWindow, partial)) return {}
        const adjusted = { ...partial,
          ...(partial.offset === undefined ? {} : { offset: snapMeasurement(partial.offset) }),
          ...(partial.sill === undefined ? {} : { sill: snapMeasurement(partial.sill) }),
        }
        const replaceWindow = (window: WindowConfig) => ({ ...pack, windows: pack.windows!.map((item) => item.id === id ? window : item) })
        let nextWindow = { ...currentWindow, ...adjusted }
        if (currentWindow.freePosition && partial.wall !== undefined) {
          const { freePosition: _freePosition, ...attached } = nextWindow
          nextWindow = attached
        }
        let candidatePack = replaceWindow(nextWindow)
        let error = structureWindowError(candidatePack)
        if (error && partial.wall !== undefined && partial.wall !== currentWindow.wall && partial.offset === undefined) {
          const wall = pack.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === partial.wall)
          const offset = wall && findAvailableOpeningOffset(wall.width, nextWindow.width, currentWindow.offset,
            (value) => !structureWindowError(replaceWindow({ ...nextWindow, offset: value })))
          if (offset !== null && offset !== undefined) {
            nextWindow = { ...nextWindow, offset }
            candidatePack = replaceWindow(nextWindow)
            error = structureWindowError(candidatePack)
          }
        }
        if (error) return { notice: error }
        if (!openingMovementAllowed(currentWindow, nextWindow) || !wallObjectLocksAllow(state.room, currentWindow, nextWindow, pack)) return { notice: 'El cambio movería un eje bloqueado.' }
        recordInteraction('state.opening.updated', { view: state.view, selectedId: state.selectedId,
          coalesceKey: `opening-${id}`, details: { ...nextWindow, name: elementName(state, id) } })
        return { structurePacks: state.structurePacks.map((item) => item.id === pack.id ? candidatePack : item), notice: '' }
      }
      const currentWindow = state.room.windows.find((window) => window.id === id)
      if (!currentWindow) return {}
      if (!openingMovementAllowed(currentWindow, partial)) return {}
      const candidate = roomForWindowUpdate(state.room, currentWindow, partial)
      const candidateWindow = candidate.windows.find((window) => window.id === id)
      if (candidateWindow && (!openingMovementAllowed(currentWindow, candidateWindow) || !wallObjectLocksAllow(state.room, currentWindow, candidateWindow))) return { notice: 'El cambio movería un eje bloqueado.' }
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
      const source = packWindowById(state.structurePacks, id)
      if (source) return {
        structurePacks: state.structurePacks.map((pack) => pack.id === source.pack.id
          ? { ...pack, windows: pack.windows?.filter((window) => window.id !== id) } : pack),
        hiddenElementIds: state.hiddenElementIds.filter((item) => item !== id),
        lockedElementIds: state.lockedElementIds.filter((item) => item !== id),
        elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, [id]),
        selectedId: state.selectedId === id ? null : state.selectedId,
        notice: '',
      }
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
