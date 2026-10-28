import { DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR } from './constants'
import type { RoomConfig, StructureSurface, StructureSurfaceKey, WallSide } from './types'

export function createStructureSurface(room: RoomConfig, id: StructureSurfaceKey): StructureSurface {
  if (id === 'floor') {
    return { id, kind: 'floor', name: 'Suelo', x: 0, y: 0, z: 0, width: room.width, height: 0.08, depth: room.depth, rotation: 0, color: room.floorColor ?? DEFAULT_FLOOR_COLOR }
  }
  if (id === 'ceiling') {
    return { id, kind: 'ceiling', name: 'Techo', x: 0, y: 0, z: 0, width: room.width, height: 0.08, depth: room.depth, rotation: 0, color: room.wallColor ?? DEFAULT_WALL_COLOR }
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
    depth: 0.08,
    rotation: 0,
    color: room.wallColors?.[wall] ?? room.wallColor ?? DEFAULT_WALL_COLOR,
  }
}
