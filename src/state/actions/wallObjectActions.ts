import { rehomeFreeWallObjects, wallObjectAvailableAxes, wallObjectLocksAllow, wallObjectPosition, wallObjects } from '../../domain/wallObjectPlacement'
import { spatialRoomFolder } from '../../domain/spatialFolderPlacement'
import { snapMeasurement } from '../../domain/measurements'
import { rejectDiagnosticAction } from '../../diagnostics/actionScope'
import { structureSurfaceElementId } from '../../domain/elementIds'
import { baseWallId } from '../../domain/elementFolders'
import { validateOpenings } from '../../domain/geometry'
import { structureWindowError } from '../../domain/structureWindows'
import { recordInteraction } from '../../debug/interactionLog'
import type { RoomActionContext, RoomState } from '../types'
import { worldOpenings } from '../../domain/wallConnections'

function movementSource(state: RoomState, id: string) {
  const source = wallObjects(state).find((entry) => entry.window.id === id)
  if (!source || state.lockedElementIds.includes(id) || source.pack && state.lockedElementIds.includes(source.pack.id)) return null
  if (!source.window.freePosition) {
    const wall = source.pack?.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === source.window.wall)
    const wallId = source.pack && wall ? structureSurfaceElementId(source.pack.id, wall.id) : baseWallId(source.window.wall)
    if (state.lockedElementIds.includes(wallId)) return null
  }
  return source
}

export function createWallObjectActions({ set, get }: RoomActionContext): Pick<RoomState, 'moveWallObject' | 'detachWallObject'> {
  return {
    detachWallObject: (id) => set((state) => {
      const source = movementSource(state, id)
      if (!source || source.window.freePosition) return {}
      const { wallPosition: _wallPosition, ...detached } = source.window
      const { x, y, z, yaw } = wallObjectPosition(state.room, source.window, source.pack)
      const changed = { ...detached, freePosition: { x, y, z, yaw } }
      recordInteraction('state.opening.updated', { view: state.view, selectedId: state.selectedId, details: { id, detached: true } })
      return { ...(source.pack ? { structurePacks: state.structurePacks.map((pack) => pack.id === source.pack!.id ? { ...pack, windows: pack.windows!.map((window) => window.id === id ? changed : window) } : pack) }
        : { room: { ...state.room, windows: state.room.windows.map((window) => window.id === id ? changed : window) } }), notice: 'Elemento despegado de la pared.' }
    }),
    moveWallObject: (id, axis, value) => {
      const current = get()
      const door = worldOpenings(current).find((item) => item.id === id && item.kind === 'door')
      if (door) {
        if (axis === 'y' || !Number.isFinite(value) || door.object.axisLocks?.[axis] || current.lockedElementIds.includes(id)) return
        const component = axis === 'x' ? Math.cos(door.position.yaw) : -Math.sin(door.position.yaw)
        if (Math.abs(component) < 1 - 1e-6) return
        const offset = door.object.offset + (snapMeasurement(value) - door.position[axis]) / component
        if (id === 'door') current.setDoor({ offset })
        else current.setStructureDoor(id, { offset })
        return
      }
      const attached = movementSource(current, id)
      if (!attached || !Number.isFinite(value) || attached.window.axisLocks?.[axis]) { rejectDiagnosticAction('wall-object-position-restricted'); return }
      if (!attached.window.freePosition) {
        if (!wallObjectAvailableAxes(current.room, attached.window, attached.pack)[axis]) { rejectDiagnosticAction('wall-object-axis-unavailable'); return }
        const position = wallObjectPosition(current.room, attached.window, attached.pack)
        const next = snapMeasurement(value)
        const delta = next - position[axis]
        if (Math.abs(delta) < 1e-9) return
        const changed = { ...attached.window, ...(axis === 'y' ? { sill: attached.window.sill + delta }
          : { offset: attached.window.offset + delta * (axis === 'x' ? Math.cos(position.yaw) : -Math.sin(position.yaw)) }) }
        if (!wallObjectLocksAllow(current.room, attached.window, changed, attached.pack)) { rejectDiagnosticAction('wall-object-axis-locked'); return }
        const room = { ...current.room, windows: current.room.windows.map((window) => window.id === id ? changed : window) }
        const pack = attached.pack && { ...attached.pack, windows: attached.pack.windows!.map((window) => window.id === id ? changed : window) }
        const error = pack ? structureWindowError(pack) : validateOpenings(room)
        if (error) { set({ notice: error }); return }
        recordInteraction('state.opening.updated', { view: current.view, selectedId: current.selectedId, coalesceKey: `opening-${id}`, details: { id, axis, value: next, attached: true } })
        set({ ...(pack ? { structurePacks: current.structurePacks.map((candidate) => candidate.id === pack.id ? pack : candidate) } : { room }), notice: '' })
        return
      }
      set((state) => {
        const source = movementSource(state, id)
        if (!source?.window.freePosition || source.window.axisLocks?.[axis]) return {}
        const { window, pack } = source
        const position = wallObjectPosition(state.room, window, pack)
        const next = snapMeasurement(value)
        if (Math.abs(position[axis] - next) < 1e-9) return {}
        const freePosition = { ...position, [axis]: next }
        const centre = { ...freePosition, y: freePosition.y + window.height / 2 }
        const previousFolder = spatialRoomFolder(state, { ...position, y: position.y + window.height / 2 })
        const targetFolder = spatialRoomFolder(state, centre)
        const changed = { ...window, freePosition }
        const room = { ...state.room, windows: state.room.windows.filter((item) => item.id !== id) }
        if (!pack) room.windows.push(changed)
        const structurePacks = state.structurePacks.map((candidate) => {
          if (candidate.id !== pack?.id) return candidate
          const windows = (candidate.windows ?? []).filter((item) => item.id !== id)
          windows.push(changed)
          return { ...candidate, windows }
        })
        recordInteraction('state.opening.updated', { view: state.view, selectedId: state.selectedId,
          coalesceKey: `opening-${id}`, details: { id, axis, value: next, position: freePosition, detached: true } })
        return { ...rehomeFreeWallObjects({ room, structurePacks }),
          ...(targetFolder && targetFolder !== previousFolder ? { elementFolderAssignments: { ...state.elementFolderAssignments, [id]: targetFolder } } : {}), notice: '' }
      })
    },
  }
}
