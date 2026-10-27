import type { WallOpening } from '../domain/types'

type WallPoint = [number, number]

export function openingPolygon(opening: WallOpening): WallPoint[] {
  const cosine = Math.cos(opening.rotation)
  const sine = Math.sin(opening.rotation)
  const centerY = opening.bottom + opening.height / 2
  if (opening.shape === 'circular') {
    return Array.from({ length: 48 }, (_, index): WallPoint => {
      const angle = -index / 48 * Math.PI * 2
      const x = Math.cos(angle) * opening.width / 2
      const y = Math.sin(angle) * opening.height / 2
      return [
        opening.offset + x * cosine - y * sine,
        centerY + x * sine + y * cosine,
      ]
    })
  }
  const corners: WallPoint[] = [
    [-opening.width / 2, -opening.height / 2],
    [-opening.width / 2, opening.height / 2],
    [opening.width / 2, opening.height / 2],
    [opening.width / 2, -opening.height / 2],
  ]
  return corners.map(([x, y]) => [
    opening.offset + x * cosine - y * sine,
    centerY + x * sine + y * cosine,
  ])
}

export function clipPolygonToWall(polygon: WallPoint[], length: number, height: number) {
  const inset = 0.0005
  const left = -length / 2 + inset
  const right = length / 2 - inset
  const bottom = inset
  const top = height - inset
  const clip = (
    points: WallPoint[],
    inside: (point: WallPoint) => boolean,
    intersection: (from: WallPoint, to: WallPoint) => WallPoint,
  ) => {
    const result: WallPoint[] = []
    points.forEach((point, index) => {
      const previous = points[(index + points.length - 1) % points.length]
      const pointInside = inside(point)
      const previousInside = inside(previous)
      if (pointInside !== previousInside) result.push(intersection(previous, point))
      if (pointInside) result.push(point)
    })
    return result
  }
  const atX = (x: number) => (from: WallPoint, to: WallPoint): WallPoint => {
    const ratio = (x - from[0]) / (to[0] - from[0])
    return [x, from[1] + (to[1] - from[1]) * ratio]
  }
  const atY = (y: number) => (from: WallPoint, to: WallPoint): WallPoint => {
    const ratio = (y - from[1]) / (to[1] - from[1])
    return [from[0] + (to[0] - from[0]) * ratio, y]
  }
  let clipped = clip(polygon, ([x]) => x >= left, atX(left))
  clipped = clip(clipped, ([x]) => x <= right, atX(right))
  clipped = clip(clipped, ([, y]) => y >= bottom, atY(bottom))
  return clip(clipped, ([, y]) => y <= top, atY(top))
}

export function polygonInterval(polygon: WallPoint[], coordinate: number, vertical: boolean): [number, number] | null {
  const intersections: number[] = []
  const epsilon = 0.00001
  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    const fixedFrom = vertical ? point[0] : point[1]
    const fixedTo = vertical ? next[0] : next[1]
    const variableFrom = vertical ? point[1] : point[0]
    const variableTo = vertical ? next[1] : next[0]
    if (Math.abs(fixedTo - fixedFrom) < epsilon) {
      if (Math.abs(coordinate - fixedFrom) < epsilon) intersections.push(variableFrom, variableTo)
      return
    }
    const ratio = (coordinate - fixedFrom) / (fixedTo - fixedFrom)
    if (ratio >= -epsilon && ratio <= 1 + epsilon) {
      intersections.push(variableFrom + (variableTo - variableFrom) * ratio)
    }
  })
  const unique = intersections
    .sort((a, b) => a - b)
    .filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > epsilon)
  return unique.length >= 2 ? [unique[0], unique[unique.length - 1]] : null
}

export function visibleLineIntervals(start: number, end: number, cuts: [number, number][]) {
  const merged: [number, number][] = []
  cuts
    .map(([from, to]) => [Math.max(start, from), Math.min(end, to)] as [number, number])
    .filter(([from, to]) => to - from > 0.00001)
    .sort((a, b) => a[0] - b[0])
    .forEach(([from, to]) => {
      const previous = merged[merged.length - 1]
      if (previous && from <= previous[1] + 0.00001) previous[1] = Math.max(previous[1], to)
      else merged.push([from, to])
    })
  const visible: [number, number][] = []
  let cursor = start
  merged.forEach(([from, to]) => {
    if (from > cursor + 0.00001) visible.push([cursor, from])
    cursor = Math.max(cursor, to)
  })
  if (cursor < end - 0.00001) visible.push([cursor, end])
  return visible
}

