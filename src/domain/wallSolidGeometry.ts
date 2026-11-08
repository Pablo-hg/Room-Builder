import { counterClockwise, uncoveredPolygons, wallRectangle } from './connectedWallGeometry'
import { aperturePolygon, physicalWalls, wallDerivedOpenings, type ConnectedWall, type WallWorld } from './wallConnections'

export type WallVertex = [number, number, number]
export interface WallFace { points: WallVertex[]; normal: WallVertex }
type Plane = { normal: WallVertex; distance: number; priority: string }
type Face = WallFace & { priority: string }
type Cell = { wallId: string; points: WallVertex[]; faces: Face[]; planes: Plane[]; min: WallVertex; max: WallVertex }
const epsilon = 1e-7
const dot = (a: WallVertex, b: WallVertex) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: WallVertex, b: WallVertex): WallVertex => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: WallVertex, b: WallVertex): WallVertex => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const length = (a: WallVertex) => Math.hypot(...a)

function face(points: WallVertex[], priority: string): Face | null {
  let normal: WallVertex = [0, 0, 0]
  for (let i = 1; i + 1 < points.length && length(normal) < 1e-12; i++) normal = cross(sub(points[i], points[0]), sub(points[i + 1], points[0]))
  const size = length(normal)
  if (size < 1e-12) return null
  return { points, normal: normal.map((value) => value / size) as WallVertex, priority }
}

function wallCells(world: WallWorld, wall: ConnectedWall): Cell[] {
  const cuts = wallDerivedOpenings(world, wall).map((opening) => aperturePolygon(opening)
    .map(([x, y]) => [x + opening.offset, y + opening.bottom] as [number, number]))
  const polygons = uncoveredPolygons(wallRectangle(-wall.width / 2, wall.width / 2, 0, wall.height), cuts)
  const worldPoint = (x: number, y: number, z: number): WallVertex => [wall.x + x * Math.cos(wall.yaw) + z * Math.sin(wall.yaw), wall.y + y,
    wall.z - x * Math.sin(wall.yaw) + z * Math.cos(wall.yaw)]
  return polygons.map((polygon, index): Cell => {
    const ring = counterClockwise(polygon)
    const front = ring.map(([x, y]) => worldPoint(x, y, wall.depth / 2))
    const back = ring.map(([x, y]) => worldPoint(x, y, -wall.depth / 2))
    // Prefer the room-facing skin when two independent walls coincide exactly.
    const faces = [face(front, `0:${wall.id}:${index}`), face([...back].reverse(), `2:${wall.id}:${index}`),
      ...ring.map((_, i) => { const next = (i + 1) % ring.length; return face([front[i], back[i], back[next], front[next]], `1:${wall.id}:${index}:${i}`) })]
      .filter((value): value is Face => !!value)
    const points = [...front, ...back]
    return { wallId: wall.id, points, faces,
      planes: faces.map((face) => ({ normal: face.normal, distance: -dot(face.normal, face.points[0]), priority: face.priority })),
      min: [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))) as WallVertex,
      max: [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))) as WallVertex }
  })
}

function halfPlane(points: WallVertex[], plane: Plane, inside: boolean): WallVertex[] {
  const result: WallVertex[] = []
  for (let i = 0; i < points.length; i++) {
    const from = points[(i + points.length - 1) % points.length], to = points[i]
    const rawFrom = dot(plane.normal, from) + plane.distance, rawTo = dot(plane.normal, to) + plane.distance
    const f = Math.abs(rawFrom) < epsilon ? 0 : rawFrom, t = Math.abs(rawTo) < epsilon ? 0 : rawTo
    const a = inside ? f <= 0 : f >= 0, b = inside ? t <= 0 : t >= 0
    if (a !== b) {
      const amount = f / (f - t)
      result.push([from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount, from[2] + (to[2] - from[2]) * amount])
    }
    if (b) result.push(to)
  }
  return result
}

function area(points: WallVertex[]): number {
  let sum = 0
  for (let i = 1; i + 1 < points.length; i++) sum += length(cross(sub(points[i], points[0]), sub(points[i + 1], points[0]))) / 2
  return sum
}

/** Subtract only the covered area of a face, including partial coplanar contact. */
function subtractCell(source: Face, points: WallVertex[], cell: Cell): WallVertex[][] {
  for (let axis = 0; axis < 3; axis++) {
    if (Math.max(...points.map((point) => point[axis])) < cell.min[axis] - epsilon
      || Math.min(...points.map((point) => point[axis])) > cell.max[axis] + epsilon) return [points]
  }
  for (const plane of cell.planes) {
    if (dot(source.normal, plane.normal) > 1 - epsilon && points.every((point) => Math.abs(dot(plane.normal, point) + plane.distance) <= epsilon)
      && source.priority < plane.priority) return [points]
  }
  const visible: WallVertex[][] = []
  let remainder = points
  for (const plane of cell.planes) {
    if (remainder.length < 3) break
    if (remainder.every((point) => Math.abs(dot(plane.normal, point) + plane.distance) <= epsilon)) continue
    const outside = halfPlane(remainder, plane, false)
    if (outside.length >= 3 && area(outside) > 1e-10) visible.push(outside)
    remainder = halfPlane(remainder, plane, true)
  }
  return visible
}

type CachedFaces = { signature: string; faces: Map<string, WallFace[]> }
const cache = new WeakMap<WallWorld['room'], WeakMap<WallWorld['structurePacks'], CachedFaces>>()

/**
 * Boundary of the visible solid union. Data walls remain independent; only
 * buried/coplanar faces are removed. Same geometry is used by scene and GLB.
 * Visibility affects skins, never physical connections or aperture support.
 */
export function wallUnionFaces(world: WallWorld, visibleIds?: ReadonlySet<string>): Map<string, WallFace[]> {
  const walls = physicalWalls(world).filter((wall) => !visibleIds || visibleIds.has(wall.id))
  const signature = JSON.stringify(walls.map((wall) => wall.id).sort())
  let byPacks = cache.get(world.room)
  if (!byPacks) { byPacks = new WeakMap(); cache.set(world.room, byPacks) }
  const found = byPacks.get(world.structurePacks)
  if (found?.signature === signature) return found.faces
  const cells = walls.flatMap((wall) => wallCells(world, wall))
  const result = new Map(walls.map((wall) => [wall.id, [] as WallFace[]]))
  for (const cell of cells) for (const source of cell.faces) {
    let fragments = [source.points]
    for (const other of cells) {
      if (other === cell) continue
      fragments = fragments.flatMap((points) => subtractCell(source, points, other))
      if (!fragments.length) break
    }
    for (const points of fragments) if (area(points) > 1e-10) result.get(cell.wallId)!.push({ points, normal: source.normal })
  }
  byPacks.set(world.structurePacks, { signature, faces: result })
  return result
}
