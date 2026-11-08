/** Convex polygon operations in a wall's (horizontal, vertical) plane. */
export type WallPoint = [number, number]
export type WallPolygon = WallPoint[]
const epsilon = 1e-8

export function polygonArea(points: WallPolygon): number {
  return Math.abs(points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length]
    return sum + point[0] * next[1] - point[1] * next[0]
  }, 0)) / 2
}

function halfPlane(points: WallPolygon, a: WallPoint, b: WallPoint, inside: boolean): WallPolygon {
  const side = (p: WallPoint) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
  const result: WallPolygon = []
  for (let i = 0; i < points.length; i++) {
    const from = points[(i + points.length - 1) % points.length], to = points[i]
    const rawFrom = side(from), rawTo = side(to)
    const f = Math.abs(rawFrom) < epsilon ? 0 : rawFrom, t = Math.abs(rawTo) < epsilon ? 0 : rawTo
    const fromInside = inside ? f >= 0 : f <= 0
    const toInside = inside ? t >= 0 : t <= 0
    if (fromInside !== toInside) {
      const ratio = f / (f - t)
      result.push([from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio])
    }
    if (toInside) result.push(to)
  }
  return result
}

export function counterClockwise(points: WallPolygon): WallPolygon {
  const area = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]
    return sum + p[0] * q[1] - p[1] * q[0]
  }, 0)
  return area < 0 ? [...points].reverse() : points
}

export function intersectPolygon(subject: WallPolygon, clip: WallPolygon): WallPolygon {
  let result = subject
  const boundary = counterClockwise(clip)
  for (let i = 0; i < boundary.length && result.length >= 3; i++) result = halfPlane(result, boundary[i], boundary[(i + 1) % boundary.length], true)
  return result
}

/** A disjoint convex decomposition; handles holes touching/crossing any edge. */
export function subtractPolygon(subject: WallPolygon, cut: WallPolygon): WallPolygon[] {
  if (cut.length < 3) return [subject]
  let remainder = subject
  const parts: WallPolygon[] = [], clipping = counterClockwise(cut)
  for (let i = 0; i < clipping.length && remainder.length >= 3; i++) {
    const a = clipping[i], b = clipping[(i + 1) % clipping.length]
    const outside = halfPlane(remainder, a, b, false)
    if (outside.length >= 3 && polygonArea(outside) > epsilon) parts.push(outside)
    remainder = halfPlane(remainder, a, b, true)
  }
  return parts
}

export const wallRectangle = (left: number, right: number, bottom: number, top: number): WallPolygon =>
  [[left, bottom], [right, bottom], [right, top], [left, top]]

export function uncoveredPolygons(subject: WallPolygon, supports: WallPolygon[]): WallPolygon[] {
  let parts = [subject]
  for (const support of supports) {
    parts = parts.flatMap((part) => subtractPolygon(part, support))
    if (!parts.length) break
  }
  return parts
}

export function convexHull(points: WallPolygon): WallPolygon {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (a: WallPoint, b: WallPoint, c: WallPoint) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const chain = (values: WallPolygon) => {
    const result: WallPolygon = []
    for (const point of values) {
      while (result.length > 1 && cross(result[result.length - 2], result[result.length - 1], point) <= epsilon) result.pop()
      result.push(point)
    }
    return result.slice(0, -1)
  }
  return [...chain(sorted), ...chain([...sorted].reverse())]
}
