import { DEFAULT_WALL_COLOR } from '../domain/constants'
import { isWallMountedDecoration } from '../domain/geometry'
import { physicalWalls, wallDerivedOpenings, type WallWorld } from '../domain/wallConnections'
import { openingPolygon, polygonInterval, visibleLineIntervals } from './wallGeometry'

export interface PlanWallStrip {
  id: string
  x: number
  y: number
  z: number
  yaw: number
  length: number
  thickness: number
  color: string
}

/** Plan-only thicker trace: walls stay at their real thickness in 3D and on export. */
export function planWallStrips(world: WallWorld, visibleIds: ReadonlySet<string>): PlanWallStrip[] {
  const rootColor = (side: 'north' | 'east' | 'south' | 'west') =>
    world.room.wallColors?.[side] ?? world.room.wallColor ?? DEFAULT_WALL_COLOR
  const DEFAULT_PLAN_LINE_COLOR = '#6e7d73'
  return physicalWalls(world).filter((wall) => visibleIds.has(wall.id)).flatMap((wall) => {
    const surfaceColor = wall.packId
      ? world.structurePacks.find((pack) => pack.id === wall.packId)?.surfaces.find((surface) =>
        surface.kind === 'wall' && surface.wall === wall.side
        && `structure-surface:${wall.packId}:${surface.id}` === wall.id)?.color ?? DEFAULT_WALL_COLOR
      : rootColor(wall.side)
    const color = surfaceColor.toLowerCase() === DEFAULT_WALL_COLOR ? DEFAULT_PLAN_LINE_COLOR : surfaceColor
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
        x: wall.x + centre * Math.cos(wall.yaw),
        y: wall.y + wall.height + 0.035,
        z: wall.z - centre * Math.sin(wall.yaw),
        yaw: wall.yaw,
        length: end - start,
        thickness: Math.max(0.22, wall.depth * 1.7),
        color,
      }
    })
  })
}
