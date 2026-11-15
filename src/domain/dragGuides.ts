import { furnitureHalfExtents } from './geometry'
import { furnitureVisualYOffset } from './objectCatalog'
import { measurementCentimetres } from './measurements'
import { physicalWalls, type WallWorld } from './wallConnections'
import type { FurnitureItem } from './types'

/**
 * Guías y magnetismo de arrastre (#37, RB-045). Todo se calcula en metros sobre el
 * plano del suelo (X/Z del mundo): ninguna función conoce píxeles, zoom ni cámara,
 * por lo que Plano e Isométrica producen exactamente el mismo resultado.
 */

/** Distancia de atracción en el mundo. Igual que el imán de paredes existente (6 cm). */
export const GUIDE_TOLERANCE = 0.06
/** Una guía se dibuja cuando el objeto queda alineado a ≤ 5,5 mm de ella (las posiciones se guardan en centímetros). */
export const GUIDE_ALIGNED = 0.0055
/** Solo se muestran distancias a vecinos más cercanos que esto. */
export const GUIDE_MAX_GAP = 4
/** Una pared solo ofrece su centro si el objeto está a menos de esta distancia de ella. */
const WALL_CENTER_REACH = 1.5
const epsilon = 1e-9

export interface GuideBox { minX: number; maxX: number; minZ: number; maxZ: number }
export type Axis = 'x' | 'z'
export type GuideKind = 'edge' | 'center' | 'wall-center' | 'equal'

/** Línea de alineación: en el eje `axis` en `position`, extendida de `from` a `to` en el otro eje. */
export interface AlignGuide { type: 'line'; axis: Axis; position: number; from: number; to: number; kind: GuideKind }
/** Cota entre dos caras enfrentadas, medida en el eje `axis` a la altura `at` del otro eje. */
export interface GapGuide { type: 'gap'; axis: Axis; from: number; to: number; at: number; distance: number; label: string; equal: boolean }
export type DragGuide = AlignGuide | GapGuide

export interface GuideTargets {
  /** Cajas de otros muebles (alineación y distancias). */
  boxes: GuideBox[]
  /** Paredes ortogonales: caja física y centro a lo largo de su longitud. */
  walls: Array<{ box: GuideBox; axis: Axis; center: number }>
}
export interface GuideResult { dx: number; dz: number; guides: DragGuide[] }

const KIND_PRIORITY: Record<GuideKind, number> = { edge: 0, equal: 1, center: 2, 'wall-center': 3 }
const axisOf = (box: GuideBox, axis: Axis) => axis === 'x' ? { min: box.minX, max: box.maxX } : { min: box.minZ, max: box.maxZ }
const otherAxis = (axis: Axis): Axis => axis === 'x' ? 'z' : 'x'
const shifted = (box: GuideBox, dx: number, dz: number): GuideBox => ({ minX: box.minX + dx, maxX: box.maxX + dx, minZ: box.minZ + dz, maxZ: box.maxZ + dz })

/** Caja alineada con los ejes que envuelve al mueble girado (misma convención que el resto del dominio). */
export function furnitureGuideBox(item: Pick<FurnitureItem, 'x' | 'z' | 'width' | 'depth' | 'rotation'>, x = item.x, z = item.z): GuideBox {
  const { halfWidth, halfDepth } = furnitureHalfExtents(item as FurnitureItem)
  return { minX: x - halfWidth, maxX: x + halfWidth, minZ: z - halfDepth, maxZ: z + halfDepth }
}

export function unionGuideBox(boxes: GuideBox[]): GuideBox {
  return { minX: Math.min(...boxes.map((box) => box.minX)), maxX: Math.max(...boxes.map((box) => box.maxX)),
    minZ: Math.min(...boxes.map((box) => box.minZ)), maxZ: Math.max(...boxes.map((box) => box.maxZ)) }
}

type GuideWorld = WallWorld & { furniture: FurnitureItem[]; hiddenElementIds?: string[] }

/**
 * Referencias para un arrastre. Solo cuentan objetos visibles que comparten altura con lo que se mueve
 * (un cojín sobre una estantería no se alinea con una silla del suelo) y paredes que lo cruzan en vertical.
 */
export function guideTargets(world: GuideWorld, movingIds: ReadonlySet<string>, vertical: { min: number; max: number }): GuideTargets {
  const hidden = new Set(world.hiddenElementIds ?? [])
  const boxes: GuideBox[] = []
  for (const item of world.furniture) {
    if (movingIds.has(item.id) || hidden.has(item.id)) continue
    const y = item.y + furnitureVisualYOffset(item, world)
    if (y >= vertical.max - epsilon || y + item.height <= vertical.min + epsilon) continue
    boxes.push(furnitureGuideBox(item))
  }
  const walls: GuideTargets['walls'] = []
  for (const wall of physicalWalls(world)) {
    if (hidden.has(wall.id) || wall.y >= vertical.max - epsilon || wall.y + wall.height <= vertical.min + epsilon) continue
    const quarter = Math.round(wall.yaw / (Math.PI / 2))
    if (Math.abs(wall.yaw - quarter * Math.PI / 2) > 1e-3) continue // las paredes oblicuas no ofrecen guías
    const alongX = Math.abs(quarter) % 2 === 0
    const halfLength = wall.width / 2, halfDepth = wall.depth / 2
    walls.push(alongX
      ? { axis: 'x', center: wall.x, box: { minX: wall.x - halfLength, maxX: wall.x + halfLength, minZ: wall.z - halfDepth, maxZ: wall.z + halfDepth } }
      : { axis: 'z', center: wall.z, box: { minX: wall.x - halfDepth, maxX: wall.x + halfDepth, minZ: wall.z - halfLength, maxZ: wall.z + halfLength } })
  }
  return { boxes, walls }
}

interface Candidate { shift: number; kind: GuideKind }

/** Candidatos de ajuste en un eje: bordes/centros de otros objetos, centro de paredes e igualdad de huecos. */
function candidates(moving: GuideBox, targets: GuideTargets, axis: Axis, tolerance: number): Candidate[] {
  const result: Candidate[] = []
  const m = axisOf(moving, axis), centre = (m.min + m.max) / 2
  const features = [m.min, centre, m.max]
  for (const box of targets.boxes) {
    const t = axisOf(box, axis), targetCentre = (t.min + t.max) / 2
    features.forEach((feature, index) => {
      const edge = index !== 1
      for (const [target, kind] of [[t.min, 'edge'], [t.max, 'edge'], [targetCentre, 'center']] as const) {
        // Borde con borde y centro con centro; el centro de uno no se atrae al borde del otro.
        if ((kind === 'edge') !== edge) continue
        if (Math.abs(target - feature) <= tolerance) result.push({ shift: target - feature, kind })
      }
    })
  }
  for (const wall of targets.walls) {
    if (wall.axis !== axis) continue
    const across = axisOf(wall.box, otherAxis(axis)), movingAcross = axisOf(moving, otherAxis(axis))
    const distance = Math.max(across.min - movingAcross.max, movingAcross.min - across.max, 0)
    if (distance <= WALL_CENTER_REACH && Math.abs(wall.center - centre) <= tolerance) result.push({ shift: wall.center - centre, kind: 'wall-center' })
  }
  const neighbours = nearestNeighbours(moving, targets, axis)
  if (neighbours.before && neighbours.after) {
    const shift = (neighbours.after.gap - neighbours.before.gap) / 2
    if (Math.abs(shift) <= tolerance) result.push({ shift, kind: 'equal' })
  }
  return result
}

interface Neighbour { gap: number; face: number; box: GuideBox }
/** Vecino más cercano a cada lado en `axis` entre los que se solapan con el objeto en el otro eje. */
function nearestNeighbours(moving: GuideBox, targets: GuideTargets, axis: Axis): { before?: Neighbour; after?: Neighbour } {
  const m = axisOf(moving, axis), crossMoving = axisOf(moving, otherAxis(axis))
  let before: Neighbour | undefined, after: Neighbour | undefined
  for (const box of [...targets.boxes, ...targets.walls.map((wall) => wall.box)]) {
    const cross = axisOf(box, otherAxis(axis))
    if (Math.min(cross.max, crossMoving.max) - Math.max(cross.min, crossMoving.min) <= epsilon) continue
    const t = axisOf(box, axis)
    const behind = m.min - t.max, ahead = t.min - m.max
    if (behind >= -epsilon && behind <= GUIDE_MAX_GAP && (!before || behind < before.gap)) before = { gap: Math.max(behind, 0), face: t.max, box }
    if (ahead >= -epsilon && ahead <= GUIDE_MAX_GAP && (!after || ahead < after.gap)) after = { gap: Math.max(ahead, 0), face: t.min, box }
  }
  return { before, after }
}

function alignedLines(moving: GuideBox, targets: GuideTargets, axis: Axis): AlignGuide[] {
  const m = axisOf(moving, axis), centre = (m.min + m.max) / 2
  const crossAxis = otherAxis(axis), mc = axisOf(moving, crossAxis)
  const lines: AlignGuide[] = []
  const add = (position: number, other: { min: number; max: number }, kind: GuideKind) => {
    if (lines.some((line) => Math.abs(line.position - position) < 1e-6 && line.kind === kind)) return
    lines.push({ type: 'line', axis, position, from: Math.min(mc.min, other.min), to: Math.max(mc.max, other.max), kind })
  }
  for (const box of targets.boxes) {
    const t = axisOf(box, axis), tc = (t.min + t.max) / 2, other = axisOf(box, crossAxis)
    for (const feature of [m.min, m.max]) for (const target of [t.min, t.max]) if (Math.abs(target - feature) <= GUIDE_ALIGNED) add(target, other, 'edge')
    if (Math.abs(tc - centre) <= GUIDE_ALIGNED) add(tc, other, 'center')
  }
  for (const wall of targets.walls) {
    if (wall.axis !== axis) continue
    const across = axisOf(wall.box, crossAxis)
    const distance = Math.max(across.min - mc.max, mc.min - across.max, 0)
    if (distance <= WALL_CENTER_REACH && Math.abs(wall.center - centre) <= GUIDE_ALIGNED) add(wall.center, across, 'wall-center')
  }
  return lines
}

function gapGuides(moving: GuideBox, targets: GuideTargets, axis: Axis): GapGuide[] {
  const { before, after } = nearestNeighbours(moving, targets, axis)
  const m = axisOf(moving, axis), crossMoving = axisOf(moving, otherAxis(axis))
  const equal = !!before && !!after && Math.abs(before.gap - after.gap) <= GUIDE_ALIGNED
  const guide = (neighbour: Neighbour, from: number, to: number): GapGuide => {
    const cross = axisOf(neighbour.box, otherAxis(axis))
    const low = Math.max(cross.min, crossMoving.min), high = Math.min(cross.max, crossMoving.max)
    return { type: 'gap', axis, from, to, at: (low + high) / 2, distance: neighbour.gap, label: `${measurementCentimetres(neighbour.gap)} cm`, equal }
  }
  const result: GapGuide[] = []
  if (before && before.gap > epsilon) result.push(guide(before, before.face, m.min))
  if (after && after.gap > epsilon) result.push(guide(after, m.max, after.face))
  return result
}

/**
 * Calcula la guía de un arrastre. `moving` es la caja que el puntero pide (sin ajustar).
 * Con `magnetism` devuelve además el desplazamiento que la deja alineada; sin él solo dibuja
 * lo que ya coincide, de modo que las guías nunca cambian el destino del gesto.
 * `axes` limita en qué ejes puede actuar el imán (un arrastre por flecha solo tiene uno libre).
 */
export function resolveDragGuides(moving: GuideBox, targets: GuideTargets, options: { magnetism: boolean; tolerance?: number; axes?: readonly Axis[] }): GuideResult {
  const tolerance = options.tolerance ?? GUIDE_TOLERANCE
  const freeAxes = options.axes ?? ['x', 'z']
  const shift = { x: 0, z: 0 }
  if (options.magnetism) for (const axis of freeAxes) {
    const best = candidates(moving, targets, axis, tolerance)
      .sort((a, b) => Math.abs(a.shift) - Math.abs(b.shift) || KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind])[0]
    // Redondeo a milímetro: evita residuos de coma flotante que dejarían guías «casi» alineadas.
    if (best) shift[axis] = Math.round(best.shift * 1000) / 1000
  }
  const final = shifted(moving, shift.x, shift.z)
  const guides: DragGuide[] = [
    ...(['x', 'z'] as const).flatMap((axis) => alignedLines(final, targets, axis)),
    ...(['x', 'z'] as const).flatMap((axis) => gapGuides(final, targets, axis)),
  ]
  return { dx: shift.x, dz: shift.z, guides }
}

export function sameGuides(a: readonly DragGuide[], b: readonly DragGuide[]) {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b)
}

const KIND_TEXT: Record<GuideKind, string> = {
  edge: 'Bordes alineados',
  center: 'Centros alineados',
  'wall-center': 'Centrado respecto a la pared',
  equal: 'Huecos iguales a ambos lados',
}

/** Texto para lectores de pantalla y avisos: lo mismo que se ve en el lienzo, sin repetir. */
export function describeGuides(guides: readonly DragGuide[]): string {
  const parts: string[] = []
  const add = (text: string) => { if (!parts.includes(text)) parts.push(text) }
  for (const guide of guides) {
    if (guide.type === 'line') add(KIND_TEXT[guide.kind])
    else add(`${guide.equal ? 'Hueco igual' : 'Distancia'} de ${guide.label}`)
  }
  return parts.join('. ')
}
