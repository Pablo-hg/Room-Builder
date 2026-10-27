import { useMemo } from 'react'
import { ROOM_LIMITS } from '../domain/constants'
import { isWallMountedDecoration } from '../domain/geometry'
import type { WallOpening } from '../domain/types'
import { clipPolygonToWall, openingPolygon, polygonInterval, visibleLineIntervals } from './wallGeometry'

export function WallGrid({ length, height, openings }: { length: number; height: number; openings: WallOpening[] }) {
  const positions = useMemo(() => {
    const lines: number[] = []
    const step = ROOM_LIMITS.gridSize
    const epsilon = 0.001
    const polygons = openings
      .filter((opening) => !isWallMountedDecoration(opening.shape))
      .map((opening) => clipPolygonToWall(openingPolygon(opening), length, height))
    for (let x = Math.ceil((-length / 2 - epsilon) / step) * step; x <= length / 2 + epsilon; x += step) {
      const cuts = polygons.map((polygon) => polygonInterval(polygon, x, true)).filter((interval): interval is [number, number] => interval !== null)
      visibleLineIntervals(0, height, cuts).forEach(([from, to]) => lines.push(x, from, 0.066, x, to, 0.066))
    }
    for (let y = 0; y <= height + epsilon; y += step) {
      const cuts = polygons.map((polygon) => polygonInterval(polygon, y, false)).filter((interval): interval is [number, number] => interval !== null)
      visibleLineIntervals(-length / 2, length / 2, cuts).forEach(([from, to]) => lines.push(from, y, 0.066, to, y, 0.066))
    }
    return new Float32Array(lines)
  }, [height, length, openings])

  return (
    <lineSegments renderOrder={2} raycast={() => undefined}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#8b8176" transparent opacity={0.44} depthWrite={false} />
    </lineSegments>
  )
}
