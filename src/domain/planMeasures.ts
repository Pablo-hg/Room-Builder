import { formatPlanDimension } from './planDimensions'
import { physicalWalls, type WallWorld } from './wallConnections'
import type { FurnitureItem } from './types'

/**
 * Cotas manuales del Plano (#38, RB-046). Todo está en metros sobre el plano del suelo (X/Z del mundo).
 * Una cota guardada tiene dos extremos; cada uno guarda siempre sus coordenadas absolutas y, cuando es
 * fiable, el anclaje a una entidad (esquina/centro de un mueble o esquina de una pared). Con anclaje, las
 * coordenadas se recalculan solas cuando el referente se mueve (`syncMeasures`); si el referente
 * desaparece, la cota queda fija en su última posición y marcada como obsoleta (`stale`): nunca miente.
 */

export type FurniturePointKey = 'center' | 'c0' | 'c1' | 'c2' | 'c3' | 'm0' | 'm1' | 'm2' | 'm3'
export const FURNITURE_POINT_KEYS: readonly FurniturePointKey[] = ['center', 'c0', 'c1', 'c2', 'c3', 'm0', 'm1', 'm2', 'm3']

export type MeasureAnchor =
  | { kind: 'furniture'; id: string; point: FurniturePointKey }
  | { kind: 'wall'; id: string; corner: 0 | 1 | 2 | 3 }

export interface MeasureEnd { x: number; z: number; anchor?: MeasureAnchor }

export interface PlanMeasure {
  id: string
  /** Nombre opcional que ve el usuario (máx. 80 caracteres). */
  name?: string
  start: MeasureEnd
  end: MeasureEnd
  /** Oculta solo esta cota; los datos se conservan. */
  hidden?: boolean
  /** Un referente desapareció o no se pudo recuperar: la cota se muestra con una advertencia. */
  stale?: boolean
}

export const MEASURE_NAME_LIMIT = 80
export const MEASURE_COORDINATE_LIMIT = 10_000
export const MAX_MEASURES = 200
const COORDINATE_STEP = 1000

/** Redondeo a milímetro: las posiciones de muebles giradas no son centímetros enteros. */
export const roundCoordinate = (value: number) => Math.round(value * COORDINATE_STEP) / COORDINATE_STEP

export interface PlanPoint { x: number; z: number }

/** Distancia real entre los dos extremos, y sus componentes sobre los ejes del mundo. */
export function measureGeometry(start: PlanPoint, end: PlanPoint) {
  const dx = end.x - start.x, dz = end.z - start.z
  return { dx, dz, length: Math.hypot(dx, dz) }
}

/** «5,00 m» — misma precisión y formato que las cotas automáticas del perímetro (#26). */
export const formatMeasureLength = (length: number) => formatPlanDimension(length)

/** Texto accesible y de etiqueta: la distancia y, si es oblicua, sus componentes. */
export function describeMeasure(start: PlanPoint, end: PlanPoint) {
  const { dx, dz, length } = measureGeometry(start, end)
  const oblique = Math.abs(dx) > 0.005 && Math.abs(dz) > 0.005
  return {
    label: formatMeasureLength(length),
    detail: oblique ? `${formatMeasureLength(Math.abs(dx))} × ${formatMeasureLength(Math.abs(dz))}` : '',
  }
}

// ── Puntos de las entidades ────────────────────────────────────────────────────────────────────────

/** Esquinas y puntos medios de la huella (girada) de un mueble. */
export function furniturePoint(item: Pick<FurnitureItem, 'x' | 'z' | 'width' | 'depth' | 'rotation'>, key: FurniturePointKey): PlanPoint {
  const widthAxis = { x: Math.cos(item.rotation), z: -Math.sin(item.rotation) }
  const depthAxis = { x: Math.sin(item.rotation), z: Math.cos(item.rotation) }
  const at = (u: number, v: number) => ({
    x: roundCoordinate(item.x + widthAxis.x * u * item.width / 2 + depthAxis.x * v * item.depth / 2),
    z: roundCoordinate(item.z + widthAxis.z * u * item.width / 2 + depthAxis.z * v * item.depth / 2),
  })
  switch (key) {
    case 'center': return at(0, 0)
    case 'c0': return at(-1, -1)
    case 'c1': return at(1, -1)
    case 'c2': return at(1, 1)
    case 'c3': return at(-1, 1)
    case 'm0': return at(0, -1)
    case 'm1': return at(1, 0)
    case 'm2': return at(0, 1)
    case 'm3': return at(-1, 0)
  }
}

/** Esquinas del sólido de una pared (planta): 0 = −largo/−grosor, 1 = +largo/−grosor, 2 = +/+, 3 = −/+. */
export function wallCorner(wall: { x: number; z: number; yaw: number; width: number; depth: number }, corner: 0 | 1 | 2 | 3): PlanPoint {
  const t = { x: Math.cos(wall.yaw), z: -Math.sin(wall.yaw) }, n = { x: Math.sin(wall.yaw), z: Math.cos(wall.yaw) }
  const u = corner === 0 || corner === 3 ? -1 : 1, v = corner < 2 ? -1 : 1
  return {
    x: roundCoordinate(wall.x + t.x * u * wall.width / 2 + n.x * v * wall.depth / 2),
    z: roundCoordinate(wall.z + t.z * u * wall.width / 2 + n.z * v * wall.depth / 2),
  }
}

type MeasureWorld = WallWorld & { furniture: FurnitureItem[] }

/** Posición actual del referente, o `null` si ya no existe. */
export function resolveAnchor(world: MeasureWorld, anchor: MeasureAnchor): PlanPoint | null {
  if (anchor.kind === 'furniture') {
    const item = world.furniture.find((candidate) => candidate.id === anchor.id)
    return item ? furniturePoint(item, anchor.point) : null
  }
  const wall = physicalWalls(world).find((candidate) => candidate.id === anchor.id)
  return wall ? wallCorner(wall, anchor.corner) : null
}

const samePoint = (a: PlanPoint, b: PlanPoint) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9

/**
 * Mantiene las cotas ancladas coherentes con el mundo. Devuelve el mismo array si no cambia nada
 * (así no se serializa ni se registra historial en cada movimiento de puntero).
 * - Referente movido: se recalculan las coordenadas del extremo.
 * - Referente eliminado: el extremo queda fijo en su última posición, sin anclaje, y la cota `stale`.
 */
export function syncMeasures(world: MeasureWorld, measures: readonly PlanMeasure[]): readonly PlanMeasure[] {
  let changed = false
  const next = measures.map((measure) => {
    let updated = measure
    for (const side of ['start', 'end'] as const) {
      const anchor = updated[side].anchor
      if (!anchor) continue
      const point = resolveAnchor(world, anchor)
      if (!point) {
        const { anchor: _lost, ...fixed } = updated[side]
        updated = { ...updated, [side]: fixed, stale: true }
      } else if (!samePoint(point, updated[side])) {
        updated = { ...updated, [side]: { ...updated[side], x: point.x, z: point.z } }
      }
    }
    if (updated !== measure) changed = true
    return updated
  })
  return changed ? next : measures
}

/**
 * Qué cotas guardadas se dibujan: solo en la vista Plano, con «Mostrar detalles» activado y mientras no estén
 * ocultas una a una. Ocultar o desactivar los detalles nunca borra datos.
 */
export function visiblePlanMeasures(measures: readonly PlanMeasure[], options: { detailsVisible: boolean; view: string }): PlanMeasure[] {
  return options.detailsVisible && options.view === 'top' ? measures.filter((measure) => !measure.hidden) : []
}

// ── Ajuste (magnetismo) de la herramienta Medir ─────────────────────────────────────────────────────

export interface MeasureSnapTarget extends PlanPoint { anchor: MeasureAnchor; kind: 'wall-corner' | 'furniture-corner' | 'furniture-center' | 'furniture-mid' }

/** Puntos a los que puede engancharse un extremo: esquinas de pared y esquinas/centros/medios de muebles visibles. */
export function measureSnapTargets(world: MeasureWorld, hiddenIds: readonly string[] = []): MeasureSnapTarget[] {
  const hidden = new Set(hiddenIds)
  const targets: MeasureSnapTarget[] = []
  for (const wall of physicalWalls(world)) {
    if (hidden.has(wall.id) || (wall.packId && hidden.has(wall.packId))) continue
    for (const corner of [0, 1, 2, 3] as const) targets.push({ ...wallCorner(wall, corner), anchor: { kind: 'wall', id: wall.id, corner }, kind: 'wall-corner' })
  }
  for (const item of world.furniture) {
    if (hidden.has(item.id)) continue
    for (const point of FURNITURE_POINT_KEYS) {
      targets.push({ ...furniturePoint(item, point), anchor: { kind: 'furniture', id: item.id, point },
        kind: point === 'center' ? 'furniture-center' : point.startsWith('c') ? 'furniture-corner' : 'furniture-mid' })
    }
  }
  return targets
}

const SNAP_PRIORITY: Record<MeasureSnapTarget['kind'], number> = { 'wall-corner': 0, 'furniture-corner': 1, 'furniture-mid': 2, 'furniture-center': 3 }

/** El objetivo más cercano dentro de la tolerancia (en metros); a igual distancia, esquinas antes que centros. */
export function nearestSnapTarget(point: PlanPoint, targets: readonly MeasureSnapTarget[], tolerance: number): MeasureSnapTarget | null {
  let best: MeasureSnapTarget | null = null, bestDistance = tolerance
  for (const target of targets) {
    const distance = Math.hypot(target.x - point.x, target.z - point.z)
    if (distance > bestDistance + 1e-9) continue
    if (!best || distance < bestDistance - 1e-9 || SNAP_PRIORITY[target.kind] < SNAP_PRIORITY[best.kind]) { best = target; bestDistance = distance }
  }
  return best
}

/** Proyecta un punto sobre la recta que pasa por `from` con la dirección dada (vector del suelo, no hace falta unitario). */
export function constrainToDirection(from: PlanPoint, point: PlanPoint, direction: PlanPoint): PlanPoint {
  const length = Math.hypot(direction.x, direction.z)
  if (length < 1e-9) return point
  const ux = direction.x / length, uz = direction.z / length
  const along = (point.x - from.x) * ux + (point.z - from.z) * uz
  return { x: from.x + ux * along, z: from.z + uz * along }
}

/** Extremo nuevo: redondeado a milímetro y, si coincide con un objetivo, anclado a él. */
export function makeMeasureEnd(point: PlanPoint, target?: MeasureSnapTarget | null): MeasureEnd {
  return target
    ? { x: roundCoordinate(target.x), z: roundCoordinate(target.z), anchor: target.anchor }
    : { x: roundCoordinate(point.x), z: roundCoordinate(point.z) }
}

// ── Contrato persistido ───────────────────────────────────────────────────────────────────────────

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MEASURE_COORDINATE_LIMIT
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

function parseAnchor(value: unknown): MeasureAnchor | undefined | null {
  if (value === undefined) return undefined
  if (!record(value) || typeof value.id !== 'string' || !value.id || value.id.length > 250) return null
  if (value.kind === 'furniture' && FURNITURE_POINT_KEYS.includes(value.point as FurniturePointKey) && Object.keys(value).length === 3) {
    return { kind: 'furniture', id: value.id, point: value.point as FurniturePointKey }
  }
  if (value.kind === 'wall' && (value.corner === 0 || value.corner === 1 || value.corner === 2 || value.corner === 3) && Object.keys(value).length === 3) {
    return { kind: 'wall', id: value.id, corner: value.corner }
  }
  return null
}

function parseEnd(value: unknown): MeasureEnd | null {
  if (!record(value) || !finite(value.x) || !finite(value.z)) return null
  const anchor = parseAnchor(value.anchor)
  if (anchor === null) return null
  const allowed = anchor ? 3 : 2
  if (Object.keys(value).length !== allowed) return null
  return { x: value.x, z: value.z, ...(anchor ? { anchor } : {}) }
}

/**
 * Lectura estricta de `measurements` de un diseño guardado o importado. Lanza un error legible ante
 * cualquier dato que no cumpla el contrato; nunca corrige en silencio.
 */
export function parseMeasures(value: unknown): PlanMeasure[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_MEASURES) throw new Error('Las cotas guardadas no son válidas.')
  const ids = new Set<string>()
  return value.map((entry) => {
    if (!record(entry) || typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 250 || ids.has(entry.id)) throw new Error('Hay una cota guardada no válida o duplicada.')
    ids.add(entry.id)
    const start = parseEnd(entry.start), end = parseEnd(entry.end)
    if (!start || !end) throw new Error('Una cota guardada tiene extremos no válidos.')
    if (entry.name !== undefined && (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > MEASURE_NAME_LIMIT || entry.name.trim() !== entry.name)) throw new Error('El nombre de una cota guardada no es válido.')
    if (entry.hidden !== undefined && typeof entry.hidden !== 'boolean') throw new Error('Una cota guardada tiene un estado de visibilidad no válido.')
    if (entry.stale !== undefined && typeof entry.stale !== 'boolean') throw new Error('Una cota guardada tiene un estado no válido.')
    const known = new Set(['id', 'name', 'start', 'end', 'hidden', 'stale'])
    if (Object.keys(entry).some((key) => !known.has(key))) throw new Error('Una cota guardada contiene campos desconocidos.')
    return { id: entry.id, ...(entry.name !== undefined ? { name: entry.name } : {}), start, end,
      ...(entry.hidden ? { hidden: true } : {}), ...(entry.stale ? { stale: true } : {}) }
  })
}

/**
 * Normalización al cargar: aplica el contrato y repara los anclajes cuyo referente ya no existe
 * (queda fija y marcada como obsoleta, igual que al borrar el referente). Un diseño anterior a v13
 * no puede traer cotas.
 */
export function normalizeMeasures(value: unknown, version: number, world: MeasureWorld): PlanMeasure[] {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return []
  if (version < 13) throw new Error('Las cotas guardadas requieren un diseño v13.')
  return [...syncMeasures(world, parseMeasures(value))]
}
