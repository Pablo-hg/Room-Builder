import { folderElementIds, folderIdFromSelection } from './elementFolders'
import { structureSurfaceElementId } from './elementIds'
import { furnitureHalfExtents } from './geometry'
import { canElevateFurniture, furnitureVisualYOffset, openingCapabilities } from './objectCatalog'
import type { RoomState } from '../state/types'
import type { WallSide } from './types'
import { elementName } from './selection'
import { furnitureAxisLocks } from './axisLocks'
import { furnitureWallAxes } from './furnitureWalls'
import { wallObjectAvailableAxes, wallObjectBox, wallObjects } from './wallObjectPlacement'
import { worldOpenings } from './wallConnections'

type Axis = 'x' | 'y' | 'z'
export type MultiItem = { id: string; name: string; color: string; min: Record<Axis, number>; max: Record<Axis, number>; axes: Axis[]; type: 'furniture' | 'opening' | 'surface'; packId?: string; surfaceId?: string; wall?: WallSide }

export function multiSelectionItems(state: Pick<RoomState, 'room' | 'furniture' | 'structurePacks' | 'elementFolders' | 'elementFolderAssignments' | 'selectedIds'> & Partial<Pick<RoomState, 'hiddenElementIds'>>): MultiItem[] {
  const ids = new Set<string>()
  for (const id of state.selectedIds) {
    const folder = folderIdFromSelection(id)
    if (folder) folderElementIds(state.elementFolderAssignments, folder, state.elementFolders).forEach((child) => ids.add(child))
    else ids.add(id)
  }
  for (const id of state.hiddenElementIds ?? []) ids.delete(id)
  for (const pack of state.structurePacks) if (ids.has(pack.id)) {
    ids.delete(pack.id)
    pack.surfaces.forEach((surface) => ids.add(structureSurfaceElementId(pack.id, surface.id)))
    pack.doors?.forEach((door) => ids.add(door.id))
    pack.windows?.forEach((window) => ids.add(window.id))
  }
  const items: MultiItem[] = []
  for (const item of state.furniture) if (ids.has(item.id)) {
    const ext = furnitureHalfExtents(item)
    const y = item.y + furnitureVisualYOffset(item, state)
    const locks = furnitureAxisLocks(item)
    const available = furnitureWallAxes(state, item)
    const axes: Axis[] = (['x', 'y', 'z'] as const).filter((axis) => !locks[axis] && available[axis] && (axis !== 'y' || canElevateFurniture(item)))
    items.push({ id: item.id, name: item.name, color: item.color, type: 'furniture', axes, min: { x: item.x - ext.halfWidth, y, z: item.z - ext.halfDepth }, max: { x: item.x + ext.halfWidth, y: y + item.height, z: item.z + ext.halfDepth } })
  }
  for (const { window, pack } of wallObjects(state)) {
    if (!ids.has(window.id)) continue
    const box = wallObjectBox(state.room, window, pack)
    const available = wallObjectAvailableAxes(state.room, window, pack)
    const wholePack = pack && pack.surfaces.length > 0 && pack.surfaces.every((surface) => ids.has(structureSurfaceElementId(pack.id, surface.id)))
    const halfX = (Math.abs(Math.cos(box.rotation)) * box.width + Math.abs(Math.sin(box.rotation)) * box.depth) / 2
    const halfZ = (Math.abs(Math.sin(box.rotation)) * box.width + Math.abs(Math.cos(box.rotation)) * box.depth) / 2
    items.push({ id: window.id, name: elementName(state, window.id) ?? 'Ventana', color: window.color ?? '#c88f58', type: 'opening', packId: pack?.id,
      axes: (['x', 'y', 'z'] as const).filter((axis) => (wholePack || available[axis]) && !window.axisLocks?.[axis] && !pack?.axisLocks?.[axis]),
      min: { x: box.x - halfX, y: box.y - box.height / 2, z: box.z - halfZ }, max: { x: box.x + halfX, y: box.y + box.height / 2, z: box.z + halfZ } })
  }
  for (const pack of state.structurePacks) for (const surface of pack.surfaces) {
    const id = structureSurfaceElementId(pack.id, surface.id)
    if (!ids.has(id)) continue
    const wall = surface.wall ?? 'north'
    const rotation = surface.kind === 'wall' ? ({ north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 }[wall] + surface.rotation) : 0
    const halfX = (Math.abs(Math.cos(rotation)) * surface.width + Math.abs(Math.sin(rotation)) * surface.depth) / 2
    const halfZ = (Math.abs(Math.sin(rotation)) * surface.width + Math.abs(Math.cos(rotation)) * surface.depth) / 2
    const x = pack.x + surface.x + (surface.kind === 'wall' ? wall === 'east' ? state.room.width / 2 : wall === 'west' ? -state.room.width / 2 : 0 : 0)
    const z = pack.z + surface.z + (surface.kind === 'wall' ? wall === 'north' ? -state.room.depth / 2 : wall === 'south' ? state.room.depth / 2 : 0 : 0)
    const y = pack.y + surface.y + (surface.kind === 'wall' ? state.room.height / 2 : surface.kind === 'ceiling' ? state.room.height : 0)
    items.push({ id, name: surface.name, color: surface.color, type: 'surface', packId: pack.id, surfaceId: surface.id, axes: ['x', 'y', 'z'], min: { x: x - halfX, y: y - surface.height / 2, z: z - halfZ }, max: { x: x + halfX, y: y + surface.height / 2, z: z + halfZ } })
  }
  for (const opening of worldOpenings(state).filter((item) => item.kind === 'door' && ids.has(item.id))) {
    const pack = state.structurePacks.find((item) => item.id === opening.packId)
    const wholePack = pack && pack.surfaces.length > 0 && pack.surfaces.every((surface) => ids.has(structureSurfaceElementId(pack.id, surface.id)))
    const { x, y, z, yaw } = opening.position
    const halfX = Math.abs(Math.cos(yaw)) * opening.width / 2 + Math.abs(Math.sin(yaw)) * 0.09
    const halfZ = Math.abs(Math.sin(yaw)) * opening.width / 2 + Math.abs(Math.cos(yaw)) * 0.09
    items.push({ id: opening.id, name: elementName(state, opening.id) ?? 'Puerta', color: opening.object.color ?? '#ac704b', type: 'opening', packId: opening.packId, wall: opening.object.wall,
      axes: (['x', 'y', 'z'] as const).filter((axis) => !opening.object.axisLocks?.[axis] && !pack?.axisLocks?.[axis]
        && (wholePack || axis === 'x' && Math.abs(Math.sin(yaw)) < 1e-7 || axis === 'z' && Math.abs(Math.cos(yaw)) < 1e-7)),
      min: { x: x - halfX, y, z: z - halfZ }, max: { x: x + halfX, y: y + opening.height, z: z + halfZ } })
  }
  return items.map((item) => {
    if (item.type === 'furniture') return item
    if (item.type === 'opening') {
      if (item.packId) return item
      const opening = item.id === 'door' ? state.room.door : state.room.extraDoors?.find((door) => door.id === item.id) ?? state.room.windows.find((window) => window.id === item.id)
      return { ...item, axes: item.axes.filter((axis) => !opening?.axisLocks?.[axis]) }
    }
    const pack = state.structurePacks.find((candidate) => candidate.id === item.packId)
    const surface = pack?.surfaces.find((candidate) => candidate.id === item.surfaceId)
    return { ...item, axes: item.axes.filter((axis) => !pack?.axisLocks?.[axis] && !surface?.axisLocks?.[axis]) }
  })
}

export function multiSelectionBounds(items: MultiItem[]) {
  if (!items.length) return null
  const min = { x: Math.min(...items.map((item) => item.min.x)), y: Math.min(...items.map((item) => item.min.y)), z: Math.min(...items.map((item) => item.min.z)) }
  const max = { x: Math.max(...items.map((item) => item.max.x)), y: Math.max(...items.map((item) => item.max.y)), z: Math.max(...items.map((item) => item.max.z)) }
  return { min, max, center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 } }
}
