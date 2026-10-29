import { DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR, ROOM_LIMITS } from './constants'
import type { RoomConfig, StructureSurface, StructureSurfaceKey, WallSide } from './types'

const DEFAULT_SURFACE_THICKNESS = ROOM_LIMITS.placementStep

export function structureDimensionMinimum(kind: StructureSurface['kind'], dimension: 'width' | 'height' | 'depth') {
  return (kind === 'wall' && dimension === 'depth') || (kind !== 'wall' && dimension === 'height') ? DEFAULT_SURFACE_THICKNESS : ROOM_LIMITS.gridSize
}

export function createStructureSurface(room: RoomConfig, id: StructureSurfaceKey): StructureSurface {
  if (id === 'floor') {
    return { id, kind: 'floor', name: 'Suelo', x: 0, y: 0, z: 0, width: room.width, height: DEFAULT_SURFACE_THICKNESS, depth: room.depth, rotation: 0, color: room.floorColor ?? DEFAULT_FLOOR_COLOR }
  }
  if (id === 'ceiling') {
    return { id, kind: 'ceiling', name: 'Techo', x: 0, y: 0, z: 0, width: room.width, height: DEFAULT_SURFACE_THICKNESS, depth: room.depth, rotation: 0, color: room.wallColor ?? DEFAULT_WALL_COLOR }
  }
  const wall = id.slice('wall-'.length) as WallSide
  const width = wall === 'east' || wall === 'west' ? room.depth : room.width
  return {
    id,
    kind: 'wall',
    wall,
    name: `Pared ${wall.toUpperCase()}`,
    x: 0,
    y: 0,
    z: 0,
    width,
    height: room.height,
    depth: DEFAULT_SURFACE_THICKNESS,
    rotation: 0,
    color: room.wallColors?.[wall] ?? room.wallColor ?? DEFAULT_WALL_COLOR,
  }
}
