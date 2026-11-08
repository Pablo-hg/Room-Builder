import type { FurnitureItem, RoomConfig, StructurePack } from './types'

export type PlacementWorld = { room: RoomConfig; structurePacks: StructurePack[] }

/** Pick the floor at the object's own level, never the highest floor in the scene. */
export function supportingFloorTop(item: Pick<FurnitureItem, 'x' | 'y' | 'z'>, world: PlacementWorld): number | null {
  const floors = world.structurePacks.flatMap((pack) => pack.surfaces.filter((surface) => surface.kind === 'floor').map((surface) => ({
    x: pack.x + surface.x, z: pack.z + surface.z, y: pack.y + surface.y,
    width: surface.width, depth: surface.depth, thickness: surface.height,
  })))
  floors.push({ x: 0, z: 0, y: 0, width: world.room.width, depth: world.room.depth, thickness: 0.08 })
  const atLevel = floors.filter((floor) => Math.abs(item.x - floor.x) <= floor.width / 2
    && Math.abs(item.z - floor.z) <= floor.depth / 2
    && Math.abs(item.y - floor.y) <= floor.thickness / 2 + 0.021)
  return atLevel.length ? Math.max(...atLevel.map((floor) => floor.y + floor.thickness / 2)) : null
}
