import { OPENING_CATALOG } from '../../domain/objectCatalog'
import { WALL_SIDES } from '../../domain/constants'
import { makeId, structureSurfaceElementId } from '../../domain/elementIds'
import { folderRoomPack, folderIdFromSelection, withoutFolderAssignments, ROOT_ROOM_FOLDER, BASE_ROOM_SURFACE_IDS } from '../../domain/elementFolders'
import { hasCoincidentWall, structureDoorError, structureDoorPosition } from '../../domain/structureDoors'
import { openingMovementAllowed } from '../../domain/axisLocks'
import { snapMeasurement } from '../../domain/measurements'
import type { RoomActionContext, RoomState } from '../types'

export function createStructureDoorActions({ set }: RoomActionContext): Pick<RoomState, 'addStructureDoor' | 'setStructureDoor' | 'removeStructureDoor'> {
  return {
    addStructureDoor: () => set((state) => {
      const folderId = folderIdFromSelection(state.selectedId)
      if (folderId === ROOT_ROOM_FOLDER || state.selectedId === 'door' || BASE_ROOM_SURFACE_IDS.includes(state.selectedId ?? '')) return { notice: 'La raíz tiene su puerta principal. Selecciona otra habitación o una de sus paredes para añadir una puerta.' }
      const pack = state.structurePacks.find((candidate) => candidate.id === state.selectedId || candidate.doors?.some((door) => door.id === state.selectedId) || candidate.surfaces.some((surface) => structureSurfaceElementId(candidate.id, surface.id) === state.selectedId))
        ?? (folderId ? folderRoomPack(state.elementFolders, state.elementFolderAssignments, state.structurePacks, folderId) : undefined)
        ?? state.structurePacks.find((candidate) => candidate.id === state.activeRoomId)
      if (!pack) return { notice: 'Selecciona la carpeta o una pared de otra habitación para añadir su puerta.' }
      const selectedWall = pack.surfaces.find((surface) => structureSurfaceElementId(pack.id, surface.id) === state.selectedId)?.wall
      const walls = selectedWall ? [selectedWall] : WALL_SIDES
      for (const wall of walls) {
        const surface = pack.surfaces.find((candidate) => candidate.kind === 'wall' && candidate.wall === wall)
        if (!surface || state.lockedElementIds.includes(pack.id) || state.lockedElementIds.includes(structureSurfaceElementId(pack.id, surface.id)) || hasCoincidentWall(state.room, state.structurePacks, pack, surface)) continue
        for (const offset of [0, -1.25, 1.25, -2.5, 2.5]) {
          const door = { id: makeId('room-door'), name: `Puerta ${(pack.doors?.length ?? 0) + 1}`, wall, offset, width: OPENING_CATALOG.door.width, height: OPENING_CATALOG.door.height, rotation: 0, color: '#ac704b' }
          const next = { ...pack, doors: [...(pack.doors ?? []), door] }
          if (structureDoorError(next)) continue
          const parent = state.elementFolderAssignments[pack.id]
          return { structurePacks: state.structurePacks.map((candidate) => candidate.id === pack.id ? next : candidate),
            elementFolderAssignments: parent ? { ...state.elementFolderAssignments, [door.id]: parent } : state.elementFolderAssignments,
            selectedId: door.id, notice: 'Puerta añadida con un hueco real en su pared.' }
        }
      }
      return { notice: 'No hay una pared libre compatible. Las paredes coincidentes necesitan una medianera única antes de abrir un paso.' }
    }),
    setStructureDoor: (id, partial) => set((state) => {
      const pack = state.structurePacks.find((candidate) => candidate.doors?.some((door) => door.id === id))
      const door = pack?.doors?.find((candidate) => candidate.id === id)
      if (!pack || !door) return {}
      if (state.lockedElementIds.includes(id) || state.lockedElementIds.includes(pack.id) || !openingMovementAllowed(door, partial)) return {}
      const nextDoor = { ...door, ...partial, ...(partial.offset === undefined ? {} : { offset: snapMeasurement(partial.offset) }) }
      const currentWall = pack.surfaces.find((surface) => surface.wall === door.wall)
      const wall = pack.surfaces.find((surface) => surface.wall === nextDoor.wall)
      if (!wall || !currentWall || state.lockedElementIds.includes(structureSurfaceElementId(pack.id, currentWall.id)) || state.lockedElementIds.includes(structureSurfaceElementId(pack.id, wall.id))) return {}
      const before = structureDoorPosition(state.room, pack, door)!
      const after = structureDoorPosition(state.room, pack, nextDoor)!
      if ((['x', 'y', 'z'] as const).some((axis) => door.axisLocks?.[axis] && Math.abs(before[axis] - after[axis]) > 1e-9)) return {}
      if (hasCoincidentWall(state.room, state.structurePacks, pack, wall)) return { notice: 'Esta pared necesita una medianera única para abrir un paso real.' }
      const next = { ...pack, doors: pack.doors!.map((candidate) => candidate.id === id ? nextDoor : candidate) }
      const error = structureDoorError(next)
      return error ? { notice: error } : { structurePacks: state.structurePacks.map((candidate) => candidate.id === pack.id ? next : candidate), notice: '' }
    }),
    removeStructureDoor: (id) => set((state) => ({
      structurePacks: state.structurePacks.map((pack) => ({ ...pack, ...(pack.doors ? { doors: pack.doors.filter((door) => door.id !== id) } : {}) })),
      hiddenElementIds: state.hiddenElementIds.filter((candidate) => candidate !== id), lockedElementIds: state.lockedElementIds.filter((candidate) => candidate !== id),
      sceneElementOrder: state.sceneElementOrder.filter((candidate) => candidate !== id),
      elementFolderAssignments: withoutFolderAssignments(state.elementFolderAssignments, [id]), selectedId: null, notice: 'Puerta eliminada; su pared vuelve a cerrarse.',
    })),
  }
}
