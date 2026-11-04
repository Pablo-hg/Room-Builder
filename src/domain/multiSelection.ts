import { folderElementIds, folderIdFromSelection } from './elementFolders'
import { structureSurfaceElementId } from './elementIds'
import { furnitureHalfExtents } from './geometry'
import { canElevateFurniture, furnitureVisualYOffset, openingCapabilities } from './objectCatalog'
import type { RoomState } from '../state/types'
import type { WallSide } from './types'
import { elementName } from './selection'

type Axis = 'x' | 'y' | 'z'
export type MultiItem = { id: string; name: string; color: string; min: Record<Axis, number>; max: Record<Axis, number>; axes: Axis[]; type: 'furniture' | 'opening' | 'surface'; packId?: string; surfaceId?: string; wall?: WallSide }

export function multiSelectionItems(state: Pick<RoomState, 'room' | 'furniture' | 'structurePacks' | 'elementFolders' | 'elementFolderAssignments' | 'selectedIds'>): MultiItem[] {
  const ids = new Set<string>()
  for (const id of state.selectedIds) {
    const folder = folderIdFromSelection(id)
    if (folder) folderElementIds(state.elementFolderAssignments, folder, state.elementFolders).forEach((child) => ids.add(child))
    else ids.add(id)
  }
  for (const pack of state.structurePacks) if (ids.has(pack.id)) {
    ids.delete(pack.id)
    pack.surfaces.forEach((surface) => ids.add(structureSurfaceElementId(pack.id, surface.id)))
  }
  const items: MultiItem[] = []
  for (const item of state.furniture) if (ids.has(item.id)) {
    const ext = furnitureHalfExtents(item)
    const y = item.y + furnitureVisualYOffset(item)
    items.push({ id: item.id, name: item.name, color: item.color, type: 'furniture', axes: canElevateFurniture(item) ? ['x', 'y', 'z'] : ['x', 'z'], min: { x: item.x - ext.halfWidth, y, z: item.z - ext.halfDepth }, max: { x: item.x + ext.halfWidth, y: y + item.height, z: item.z + ext.halfDepth } })
  }
  const openings = [{ ...state.room.door, id: 'door', sill: 0, name: state.room.door.name ?? 'Puerta', shape: undefined }, ...state.room.windows.map((item) => ({ ...item, name: elementName(state, item.id) ?? 'Ventana' }))]
  for (const item of openings) if (ids.has(item.id)) {
    const wall = item.wall
    const horizontal = wall === 'north' || wall === 'south'
    const sign = wall === 'south' || wall === 'west' ? -1 : 1
    const angle = item.rotation
    const halfWidth = (Math.abs(Math.cos(angle)) * item.width + Math.abs(Math.sin(angle)) * item.height) / 2
    const halfHeight = (Math.abs(Math.sin(angle)) * item.width + Math.abs(Math.cos(angle)) * item.height) / 2
    const x = horizontal ? sign * item.offset : (wall === 'east' ? state.room.width / 2 : -state.room.width / 2)
    const z = horizontal ? (wall === 'north' ? -state.room.depth / 2 : state.room.depth / 2) : sign * item.offset
    const y = item.sill + item.height / 2
    const depth = item.shape === 'wallShelf' ? 0.3 : 0.18
    const vertical = item.id !== 'door' && openingCapabilities('window').translation.includes('wall-vertical')
    items.push({ id: item.id, name: item.name, color: item.color ?? (item.id === 'door' ? '#ac704b' : '#c88f58'), type: 'opening', wall, axes: [...(horizontal ? ['x' as const] : ['z' as const]), ...(vertical ? ['y' as const] : [])], min: { x: x - (horizontal ? halfWidth : depth / 2), y: y - halfHeight, z: z - (horizontal ? depth / 2 : halfWidth) }, max: { x: x + (horizontal ? halfWidth : depth / 2), y: y + halfHeight, z: z + (horizontal ? depth / 2 : halfWidth) } })
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
    items.push({ id, name: `${pack.name} · ${surface.name}`, color: surface.color, type: 'surface', packId: pack.id, surfaceId: surface.id, axes: ['x', 'y', 'z'], min: { x: x - halfX, y: y - surface.height / 2, z: z - halfZ }, max: { x: x + halfX, y: y + surface.height / 2, z: z + halfZ } })
  }
  return items
}

export function multiSelectionBounds(items: MultiItem[]) {
  if (!items.length) return null
  const min = { x: Math.min(...items.map((item) => item.min.x)), y: Math.min(...items.map((item) => item.min.y)), z: Math.min(...items.map((item) => item.min.z)) }
  const max = { x: Math.max(...items.map((item) => item.max.x)), y: Math.max(...items.map((item) => item.max.y)), z: Math.max(...items.map((item) => item.max.z)) }
  return { min, max, center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 } }
}
