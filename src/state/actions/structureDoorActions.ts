import { OPENING_CATALOG } from '../../domain/objectCatalog'
import { rejectDiagnosticAction } from '../../diagnostics/actionScope'
import { WALL_SIDES } from '../../domain/constants'
import { makeId, structureSurfaceElementId } from '../../domain/elementIds'
import { withoutFolderAssignments } from '../../domain/elementFolders'
import { rootDoorPack, structureDoorError, structureDoorPosition } from '../../domain/structureDoors'
import { anchorWallOpenings, connectedOpeningError, openingRunBounds } from '../../domain/wallConnections'
import { openingCreationPack } from '../../domain/windowPlacement'
import { focusedCreationTarget, focusedRoom } from '../../domain/roomEditing'
import { findAvailableOpeningOffset, validateOpenings, wallLength } from '../../domain/geometry'
import { openingMovementAllowed } from '../../domain/axisLocks'
import { snapMeasurement } from '../../domain/measurements'
import type { RoomActionContext, RoomState } from '../types'

export function createStructureDoorActions({ set }: RoomActionContext): Pick<RoomState, 'addStructureDoor' | 'setStructureDoor' | 'removeStructureDoor'> {
  return {
    addStructureDoor: () => set((state) => {
      const target = focusedRoom(state)
      const folderId = focusedCreationTarget(state).folderId
      const selectedPack = openingCreationPack(state)
      const isRoot = !selectedPack && target.kind === 'root'
      const pack = selectedPack ?? (isRoot ? rootDoorPack(state.room) : state.structurePacks.find((candidate) => candidate.id === target.packId)!)
      const walls = WALL_SIDES
      for (const wall of walls) {
        const surface = pack.surfaces.find((candidate) => candidate.kind === 'wall' && candidate.wall === wall)
        if (!surface || state.lockedElementIds.includes(pack.id) || state.lockedElementIds.includes(structureSurfaceElementId(pack.id, surface.id))) continue
        const door = { id: makeId('room-door'), name: 'Puerta', wall, offset: 0, width: OPENING_CATALOG.door.width, height: OPENING_CATALOG.door.height, rotation: 0, color: '#ac704b' }
        const worldAtOffset = (offset: number) => anchorWallOpenings({
          room: isRoot ? { ...state.room, extraDoors: [...(state.room.extraDoors ?? []), { ...door, offset }] } : state.room,
          structurePacks: isRoot ? state.structurePacks : state.structurePacks.map((candidate) => candidate.id === pack.id ? { ...pack, doors: [...(pack.doors ?? []), { ...door, offset }] } : candidate),
        })
        const bounds = openingRunBounds(worldAtOffset(0), door.id)
        const length = bounds ? 2 * (Math.max(Math.abs(bounds.min), Math.abs(bounds.max)) + door.width / 2 + 0.12) : surface.width
        const offset = findAvailableOpeningOffset(length, door.width, 0, (value) => !connectedOpeningError(worldAtOffset(value), new Set([door.id])), 0.12)
        if (offset === null) continue
        const world = worldAtOffset(offset)
        return { ...world, elementFolderAssignments: folderId ? { ...state.elementFolderAssignments, [door.id]: folderId } : state.elementFolderAssignments,
          selectedId: door.id, notice: 'Puerta añadida con un hueco real en las paredes conectadas.' }

      }
      return { notice: 'No hay un tramo de pared compatible con espacio para la puerta.' }
    }),
    setStructureDoor: (id, partial) => set((state) => {
      const rootDoor = state.room.extraDoors?.find((door) => door.id === id)
      if (rootDoor) {
        if (state.lockedElementIds.includes(id) || state.lockedElementIds.includes(`room-wall:${rootDoor.wall}`) || !openingMovementAllowed(rootDoor, partial)) { rejectDiagnosticAction('door-or-axis-locked'); return {} }
        const next = { ...rootDoor, ...partial, ...(partial.offset === undefined ? {} : { offset: rootDoor.wallPosition ? partial.offset : snapMeasurement(partial.offset) }) }
        if (state.lockedElementIds.includes(`room-wall:${next.wall}`)) return {}
        const withOffset = (offset: number) => ({ ...state.room, extraDoors: state.room.extraDoors!.map((door) => door.id === id ? { ...next, offset } : door) })
        let room = withOffset(next.offset)
        let error = structureDoorError(rootDoorPack(room)) || validateOpenings(room)
        if (error && partial.wall !== undefined && partial.wall !== rootDoor.wall && partial.offset === undefined) {
          const offset = findAvailableOpeningOffset(wallLength(state.room, next.wall), next.width, rootDoor.offset, (value) => {
            const candidate = withOffset(value)
            return !structureDoorError(rootDoorPack(candidate)) && !validateOpenings(candidate)
          }, 0.12)
          if (offset !== null) {
            room = withOffset(offset)
            error = null
          }
        }
        return error ? { notice: error } : { room, notice: '' }
      }
      const pack = state.structurePacks.find((candidate) => candidate.doors?.some((door) => door.id === id))
      const door = pack?.doors?.find((candidate) => candidate.id === id)
      if (!pack || !door) return {}
      if (state.lockedElementIds.includes(id) || state.lockedElementIds.includes(pack.id) || !openingMovementAllowed(door, partial)) { rejectDiagnosticAction('door-or-axis-locked'); return {} }
      let nextDoor = { ...door, ...partial, ...(partial.offset === undefined ? {} : { offset: door.wallPosition ? partial.offset : snapMeasurement(partial.offset) }) }
      const currentWall = pack.surfaces.find((surface) => surface.wall === door.wall)
      const wall = pack.surfaces.find((surface) => surface.wall === nextDoor.wall)
      if (partial.wall !== undefined && partial.wall !== door.wall && !wall) return {}
      if ((!wall || !currentWall) && !door.wallPosition || currentWall && state.lockedElementIds.includes(structureSurfaceElementId(pack.id, currentWall.id)) || wall && state.lockedElementIds.includes(structureSurfaceElementId(pack.id, wall.id))) return {}
      const packWithDoor = (value: typeof nextDoor) => ({ ...pack, doors: pack.doors!.map((candidate) => candidate.id === id ? value : candidate) })
      if (wall && partial.wall !== undefined && partial.wall !== door.wall && partial.offset === undefined && structureDoorError(packWithDoor(nextDoor))) {
        const offset = findAvailableOpeningOffset(wall.width, nextDoor.width, door.offset, (value) =>
          !structureDoorError(packWithDoor({ ...nextDoor, offset: value })), 0.12)
        if (offset !== null) nextDoor = { ...nextDoor, offset }
      }
      const before = structureDoorPosition(state.room, pack, door)!
      const after = structureDoorPosition(state.room, pack, nextDoor)!
      if ((['x', 'y', 'z'] as const).some((axis) => door.axisLocks?.[axis] && Math.abs(before[axis] - after[axis]) > 1e-9)) { rejectDiagnosticAction('door-axis-locked'); return {} }
      const next = packWithDoor(nextDoor)
      const error = structureDoorError(next)
      return error ? { notice: error } : { structurePacks: state.structurePacks.map((candidate) => candidate.id === pack.id ? next : candidate), notice: '' }
    }),
    removeStructureDoor: (id) => set((state) => ({
      ...(state.room.extraDoors ? { room: { ...state.room, extraDoors: state.room.extraDoors.filter((door) => door.id !== id) } } : {}),
      structurePacks: state.structurePacks.map((pack) => ({ ...pack, ...(pack.doors ? { doors: pack.doors.filter((door) => door.id !== id) } : {}) })),
      hiddenElementIds: state.hiddenElementIds.filter((candidate) => candidate !== id), lockedElementIds: state.lockedElementIds.filter((candidate) => candidate !== id),
      sceneElementOrder: state.sceneElementOrder.filter((candidate) => candidate !== id),
      elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, [id]), selectedId: null, notice: 'Puerta eliminada; su pared vuelve a cerrarse.',
    })),
  }
}
