import { physicalWalls, type ConnectedWall } from './wallConnections'
import { counterClockwise, polygonArea, type WallPolygon } from './connectedWallGeometry'
import type { RoomConfig, StructurePack, WallSide } from './types'

type Point = [number, number]
type Segment = { start: Point; end: Point }
const EPS = 1e-6
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0]

function segment(wall: ConnectedWall): Segment {
  const dx = Math.cos(wall.yaw) * wall.width / 2
  const dz = -Math.sin(wall.yaw) * wall.width / 2
  return { start: [wall.x - dx, wall.z - dz], end: [wall.x + dx, wall.z + dz] }
}

/** Intersection of wall centre lines; thickness never changes the enclosure. */
function junction(a: Segment, b: Segment): Point | null {
  const p = a.start, q = b.start
  const directionA: Point = [a.end[0] - p[0], a.end[1] - p[1]]
  const directionB: Point = [b.end[0] - q[0], b.end[1] - q[1]]
  const denominator = cross(directionA, directionB)
  if (Math.abs(denominator) <= EPS) return null
  const difference: Point = [q[0] - p[0], q[1] - p[1]]
  const t = cross(difference, directionB) / denominator
  const u = cross(difference, directionA) / denominator
  const toleranceA = 0.015 / Math.max(Math.hypot(...directionA), EPS)
  const toleranceB = 0.015 / Math.max(Math.hypot(...directionB), EPS)
  if (t < -toleranceA || t > 1 + toleranceA || u < -toleranceB || u > 1 + toleranceB) return null
  return [p[0] + t * directionA[0], p[1] + t * directionA[1]]
}

/** Closed polygon from the four movable walls of a room pack. Never infer it from wall thickness or the root dimensions. */
export function enclosedPackFootprint(room: RoomConfig, packs: StructurePack[], pack: StructurePack): WallPolygon | null {
  const walls = physicalWalls({ room, structurePacks: packs }).filter((wall) => wall.packId === pack.id)
  const bySide = new Map<WallSide, ConnectedWall>()
  for (const wall of walls) if (!bySide.has(wall.side)) bySide.set(wall.side, wall)
  const north = bySide.get('north'), east = bySide.get('east'), south = bySide.get('south'), west = bySide.get('west')
  if (!north || !east || !south || !west) return null
  const n = segment(north), e = segment(east), s = segment(south), w = segment(west)
  const nw = junction(n, w), ne = junction(n, e), se = junction(s, e), sw = junction(s, w)
  if (!nw || !ne || !se || !sw) return null
  const polygon = counterClockwise([nw, ne, se, sw])
  if (polygonArea(polygon) <= 1e-5) return null
  const edges = polygon.map((point, i) => {
    const next = polygon[(i + 1) % polygon.length]
    return [next[0] - point[0], next[1] - point[1]] as Point
  })
  if (edges.some((edge, i) => cross(edge, edges[(i + 1) % edges.length]) <= EPS)) return null
  return polygon
}
