import { physicalWalls, type ConnectedWall } from './wallConnections'
import { counterClockwise, intersectPolygon, polygonArea, type WallPolygon } from './connectedWallGeometry'
import type { RoomConfig, StructurePack, WallSide } from './types'

type Point = [number, number]
type Segment = { start: Point; end: Point }
const EPS = 1e-6
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0]

/** The exterior face of a physical wall, rather than its centre-line. */
function exteriorFace(wall: ConnectedWall): Segment {
  const dx = Math.cos(wall.yaw), dz = -Math.sin(wall.yaw)
  // The wall normals point toward the interior in their default orientation.
  const x = wall.x - Math.sin(wall.yaw) * wall.depth / 2
  const z = wall.z - Math.cos(wall.yaw) * wall.depth / 2
  return { start: [x - dx * wall.width / 2, z - dz * wall.width / 2],
    end: [x + dx * wall.width / 2, z + dz * wall.width / 2] }
}

function solidFootprint(wall: ConnectedWall): WallPolygon {
  const tangent: Point = [Math.cos(wall.yaw) * wall.width / 2, -Math.sin(wall.yaw) * wall.width / 2]
  const normal: Point = [Math.sin(wall.yaw) * wall.depth / 2, Math.cos(wall.yaw) * wall.depth / 2]
  const centre: Point = [wall.x, wall.z]
  return counterClockwise([
    [centre[0] - tangent[0] - normal[0], centre[1] - tangent[1] - normal[1]],
    [centre[0] + tangent[0] - normal[0], centre[1] + tangent[1] - normal[1]],
    [centre[0] + tangent[0] + normal[0], centre[1] + tangent[1] + normal[1]],
    [centre[0] - tangent[0] + normal[0], centre[1] - tangent[1] + normal[1]],
  ])
}

function distancePointSegment(point: Point, segment: Segment): number {
  const dx = segment.end[0] - segment.start[0], dz = segment.end[1] - segment.start[1]
  const lengthSq = dx * dx + dz * dz
  const factor = lengthSq > EPS ? Math.max(0, Math.min(1,
    ((point[0] - segment.start[0]) * dx + (point[1] - segment.start[1]) * dz) / lengthSq)) : 0
  return Math.hypot(point[0] - segment.start[0] - factor * dx, point[1] - segment.start[1] - factor * dz)
}

function solidsTouch(a: ConnectedWall, b: ConnectedWall): boolean {
  const verticalOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (verticalOverlap <= EPS) return false
  const polyA = solidFootprint(a), polyB = solidFootprint(b)
  if (polygonArea(intersectPolygon(polyA, polyB)) > EPS * EPS) return true
  // Exact face-to-face contact must still count as a closed corner.
  const sidesA = polyA.map((p, i): Segment => ({ start: p, end: polyA[(i + 1) % polyA.length] }))
  const sidesB = polyB.map((p, i): Segment => ({ start: p, end: polyB[(i + 1) % polyB.length] }))
  const tolerance = 0.002
  return polyA.some((p) => sidesB.some((edge) => distancePointSegment(p, edge) <= tolerance))
    || polyB.some((p) => sidesA.some((edge) => distancePointSegment(p, edge) <= tolerance))
}

function junction(a: ConnectedWall, b: ConnectedWall): Point | null {
  // Physical contact, not intersection of the *centre* of the wall thickness.
  if (!solidsTouch(a, b)) return null
  const lineA = exteriorFace(a), lineB = exteriorFace(b)
  const p = lineA.start, q = lineB.start
  const directionA: Point = [lineA.end[0] - p[0], lineA.end[1] - p[1]]
  const directionB: Point = [lineB.end[0] - q[0], lineB.end[1] - q[1]]
  const denominator = cross(directionA, directionB)
  if (Math.abs(denominator) <= EPS) return null
  const delta: Point = [q[0] - p[0], q[1] - p[1]]
  const t = cross(delta, directionB) / denominator
  return [p[0] + t * directionA[0], p[1] + t * directionA[1]]
}

/** Closed polygon from the four movable walls of a room pack. Never infer it from wall thickness or the root dimensions. */
export function enclosedPackFootprint(room: RoomConfig, packs: StructurePack[], pack: StructurePack): WallPolygon | null {
  const walls = physicalWalls({ room, structurePacks: packs }).filter((wall) => wall.packId === pack.id)
  const bySide = new Map<WallSide, ConnectedWall>()
  for (const wall of walls) if (!bySide.has(wall.side)) bySide.set(wall.side, wall)
  const north = bySide.get('north'), east = bySide.get('east'), south = bySide.get('south'), west = bySide.get('west')
  if (!north || !east || !south || !west) return null
  const nw = junction(north, west), ne = junction(north, east)
  const se = junction(south, east), sw = junction(south, west)
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
