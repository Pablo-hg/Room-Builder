import { furnitureHalfExtents } from './geometry'
import { snapMeasurement } from './measurements'
import {
  formatPlanDimension, isRoomPack, planDimensionsForSegments, roomInteriorPoint, wallSegment,
  type PlanDimension, type PlanPoint,
} from './planDimensions'
import type { FurnitureItem } from './types'
import { physicalWalls, worldOpenings, type ConnectedWall, type WallWorld } from './wallConnections'

/**
 * Cotas automáticas del «Plano detallado» (#38, ampliación 09/11/2026): cadena de huecos de cada pared y
 * distancias de un mueble a las paredes. Son datos derivados para dibujar: se recalculan al mover o redimensionar
 * los referentes y nunca se guardan. Reutilizan la geometría de paredes y aberturas de las cotas del perímetro (#26).
 */

/**
 * Cadena de huecos de cada pared de habitación, como en un plano de arquitectura: tramo de pared hasta el hueco,
 * ancho del hueco y resto hasta el otro extremo. Las ventanas despegadas (`freePosition`) no forman parte de ninguna
 * pared y no se acotan. Devuelve cotas de nivel 1 (por fuera de la cota total del perímetro).
 */
export function planOpeningDimensions(world: WallWorld, includeWall: (wall: ConnectedWall) => boolean = () => true): PlanDimension[] {
  const openings = worldOpenings(world).filter((opening) => !opening.object.freePosition)
  const groups = new Map<string | null, ConnectedWall[]>()
  for (const wall of physicalWalls(world)) {
    if (!isRoomPack(wall.packId) || !includeWall(wall)) continue
    const key = wall.packId ?? null
    groups.set(key, [...(groups.get(key) ?? []), wall])
  }
  const result: PlanDimension[] = []
  for (const [roomId, walls] of groups) {
    const centre = roomInteriorPoint(world, roomId)
    for (const wall of walls) {
      const segment = wallSegment(wall)
      const dx = segment.end.x - segment.start.x, dz = segment.end.z - segment.start.z
      const length = Math.hypot(dx, dz)
      if (length < 1e-6) continue
      const t = { x: dx / length, z: dz / length }
      const placed = openings
        .filter((opening) => opening.position.supportId ? opening.position.supportId === wall.id : opening.object.wall === wall.side && opening.packId === wall.packId)
        .map((opening) => {
          const u = (opening.position.x - segment.start.x) * t.x + (opening.position.z - segment.start.z) * t.z
          return { id: opening.id, from: Math.max(0, u - opening.width / 2), to: Math.min(length, u + opening.width / 2) }
        })
        .filter((item) => item.to - item.from > 0.005)
        .sort((a, b) => a.from - b.from)
      if (!placed.length) continue
      const pieces: Array<{ from: number; to: number; kind: 'opening' | 'gap'; openingId?: string }> = []
      let cursor = 0
      for (const item of placed) {
        const from = Math.max(item.from, cursor)
        if (from - cursor > 0.005) pieces.push({ from: cursor, to: from, kind: 'gap' })
        if (item.to - from > 0.005) pieces.push({ from, to: item.to, kind: 'opening', openingId: item.id })
        cursor = Math.max(cursor, item.to)
      }
      if (length - cursor > 0.005) pieces.push({ from: cursor, to: length, kind: 'gap' })
      const at = (distance: number) => ({ x: segment.start.x + t.x * distance, z: segment.start.z + t.z * distance })
      const sub = pieces.map((piece, index) => ({ ...segment, id: `${wall.id}#${index}`, start: at(piece.from), end: at(piece.to) }))
      planDimensionsForSegments(sub, centre).forEach((dimension) => {
        const index = Number(dimension.wallId.split('#')[1])
        result.push({ ...dimension, id: `plan-dimension:${wall.id}:chain:${index}`, wallId: wall.id, tier: 1, kind: pieces[index].kind, openingId: pieces[index].openingId })
      })
    }
  }
  return result
}

/** «Pared A: 2,00 m · hueco 1,50 m · 2,00 m; …» para lectores de pantalla. */
export function planOpeningDimensionsSummary(dimensions: readonly PlanDimension[]): string {
  const walls = [...new Set(dimensions.map((dimension) => dimension.wallId))]
  return walls.map((wallId) => {
    const chain = dimensions.filter((dimension) => dimension.wallId === wallId)
    return `Pared ${chain[0].wallLabel}: ${chain.map((dimension) => `${dimension.kind === 'opening' ? 'hueco ' : ''}${dimension.label}`).join(' · ')}`
  }).join('; ')
}

/** Distancia de un mueble a la pared más cercana en una dirección del plano. */
export interface PlanDistance {
  id: string
  axis: 'x' | 'z'
  start: PlanPoint
  end: PlanPoint
  length: number
  label: string
}

const REACH = 12

/**
 * Distancias del mueble (su huella girada) a la pared más cercana en cada una de las cuatro direcciones del plano,
 * medidas desde el borde del mueble hasta la cara de la pared. Solo cuentan paredes ortogonales que comparten altura
 * con el mueble y a las que el mueble «mira» (se solapan en el otro eje).
 */
export function planFurnitureDistances(world: WallWorld, item: Pick<FurnitureItem, 'id' | 'x' | 'z' | 'y' | 'width' | 'depth' | 'height' | 'rotation'>): PlanDistance[] {
  const half = furnitureHalfExtents(item as FurnitureItem)
  const box = { minX: item.x - half.halfWidth, maxX: item.x + half.halfWidth, minZ: item.z - half.halfDepth, maxZ: item.z + half.halfDepth }
  const walls = physicalWalls(world).flatMap((wall) => {
    if (wall.y >= item.y + item.height || wall.y + wall.height <= item.y) return []
    const quarter = Math.round(wall.yaw / (Math.PI / 2))
    if (Math.abs(wall.yaw - quarter * Math.PI / 2) > 1e-3) return []
    const along = Math.abs(quarter) % 2 === 0
    const l = wall.width / 2, d = wall.depth / 2
    return [along ? { minX: wall.x - l, maxX: wall.x + l, minZ: wall.z - d, maxZ: wall.z + d } : { minX: wall.x - d, maxX: wall.x + d, minZ: wall.z - l, maxZ: wall.z + l }]
  })
  const result: PlanDistance[] = []
  const add = (axis: 'x' | 'z', sign: -1 | 1) => {
    const edge = axis === 'x' ? (sign < 0 ? box.minX : box.maxX) : (sign < 0 ? box.minZ : box.maxZ)
    let best: { gap: number; face: number; cross: number } | null = null
    for (const wall of walls) {
      const overlapMin = axis === 'x' ? Math.max(wall.minZ, box.minZ) : Math.max(wall.minX, box.minX)
      const overlapMax = axis === 'x' ? Math.min(wall.maxZ, box.maxZ) : Math.min(wall.maxX, box.maxX)
      if (overlapMax - overlapMin <= 0.01) continue
      const face = axis === 'x' ? (sign < 0 ? wall.maxX : wall.minX) : (sign < 0 ? wall.maxZ : wall.minZ)
      const gap = (face - edge) * sign
      if (gap < -1e-6 || gap > REACH || (best && gap >= best.gap)) continue
      best = { gap, face, cross: (overlapMin + overlapMax) / 2 }
    }
    if (!best || best.gap < 0.005) return
    const length = snapMeasurement(best.gap)
    const start = axis === 'x' ? { x: edge, z: best.cross } : { x: best.cross, z: edge }
    const end = axis === 'x' ? { x: best.face, z: best.cross } : { x: best.cross, z: best.face }
    result.push({ id: `plan-distance:${item.id}:${axis}${sign < 0 ? '-' : '+'}`, axis, start, end, length, label: formatPlanDimension(length) })
  }
  add('x', -1); add('x', 1); add('z', -1); add('z', 1)
  return result
}

/** «oeste 1,20 m; este 0,80 m; …» para lectores de pantalla. */
export function planFurnitureDistancesSummary(distances: readonly PlanDistance[]): string {
  return distances.map((distance) => `${distance.axis === 'x' ? (distance.end.x < distance.start.x ? 'oeste' : 'este') : (distance.end.z < distance.start.z ? 'norte' : 'sur')} ${distance.label}`).join('; ')
}
