import { DEFAULT_WALL_COLOR } from '../domain/constants'
import { isWallMountedDecoration } from '../domain/geometry'
import { physicalWalls, wallDerivedOpenings, type WallWorld } from '../domain/wallConnections'
import { openingPolygon, polygonInterval, visibleLineIntervals } from './wallGeometry'

export interface PlanWallStrip {
  id: string
  wallId: string
  x: number
  y: number
  z: number
  yaw: number
  length: number
  thickness: number
  color: string
}

/** Trazo visual al 50 % del grosor físico, exclusivo de Plano. */
export const planWallTraceThickness = (depth: number) => depth * 0.5
/** Room traces keep their interior face on the physical face, leaving no artificial furniture gap. */
export const planWallTraceInset = (depth: number) => (depth - planWallTraceThickness(depth)) / 2

/** Thin plan traces; world geometry and furniture contact retain the physical wall thickness. */
export function planWallStrips(world: WallWorld, visibleIds: ReadonlySet<string>): PlanWallStrip[] {
  const rootColor = (side: 'north' | 'east' | 'south' | 'west') =>
    world.room.wallColors?.[side] ?? world.room.wallColor ?? DEFAULT_WALL_COLOR
  return physicalWalls(world).filter((wall) => visibleIds.has(wall.id)).flatMap((wall) => {
    const surfaceColor = wall.packId
      ? world.structurePacks.find((pack) => pack.id === wall.packId)?.surfaces.find((surface) =>
        surface.kind === 'wall' && surface.wall === wall.side
        && `structure-surface:${wall.packId}:${surface.id}` === wall.id)?.color ?? DEFAULT_WALL_COLOR
      : rootColor(wall.side)
    // A plan wall must use the *actual* wall material, including the default.
    const color = surfaceColor
    const pack = wall.packId && world.structurePacks.find((pack) => pack.id === wall.packId)
    const floor = pack ? pack.surfaces.find((surface) => surface.kind === 'floor') : undefined
    const roomBounded = !wall.packId || !!floor
    const roomCenter = { x: pack ? pack.x + (floor?.x ?? 0) : 0, z: pack ? pack.z + (floor?.z ?? 0) : 0 }
    const normalX = Math.sin(wall.yaw), normalZ = Math.cos(wall.yaw)
    const inwardSign = (roomCenter.x - wall.x) * normalX + (roomCenter.z - wall.z) * normalZ < 0 ? -1 : 1
    const inset = roomBounded ? inwardSign * planWallTraceInset(wall.depth) : 0
    // A conventional plan cut through the lower part of the wall, so doors
    // and ordinary-height windows leave a visible gap in the trace.
    const sliceHeight = Math.min(wall.height * 0.5, 1.25)
    const cuts = wallDerivedOpenings(world, wall)
      .filter((opening) => !isWallMountedDecoration(opening.shape))
      .map((opening) => polygonInterval(openingPolygon(opening), sliceHeight, false))
      .filter((interval): interval is [number, number] => !!interval)
    return visibleLineIntervals(-wall.width / 2, wall.width / 2, cuts).map(([start, end], index) => {
      const centre = (start + end) / 2
      return {
        id: `${wall.id}:${index}`,
        wallId: wall.id,
        x: wall.x + centre * Math.cos(wall.yaw) + normalX * inset,
        y: wall.y + wall.height + 0.035,
        z: wall.z - centre * Math.sin(wall.yaw) + normalZ * inset,
        yaw: wall.yaw,
        length: end - start,
        thickness: planWallTraceThickness(wall.depth),
        color,
      }
    })
  })
}
