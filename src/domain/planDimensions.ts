import { WALL_LABELS } from './constants'
import { snapMeasurement } from './measurements'
import { surfacePosition } from './roomEditing'
import type { RoomConfig, WallSide } from './types'
import { physicalWalls, type ConnectedWall, type WallWorld } from './wallConnections'

/** Punto del plano horizontal en metros (coordenadas del mundo X/Z). */
export interface PlanPoint {
  x: number
  z: number
}

/** Segmento de pared del que se deriva una cota. */
export interface PlanWallSegment {
  id: string
  /** Habitación a la que pertenece: `null` = habitación raíz. */
  roomId?: string | null
  wall: WallSide
  start: PlanPoint
  end: PlanPoint
  /** Grosor físico de la pared en metros. */
  thickness: number
}

/**
 * Cota orientativa de un segmento de pared en la vista Plano.
 * Solo es un dato derivado para dibujar: nunca se guarda ni altera el diseño.
 */
export interface PlanDimension {
  id: string
  /** Id de la pared física acotada (coincide con la selección y la ocultación). */
  wallId: string
  /** Habitación a la que pertenece: `null` = habitación raíz. */
  roomId: string | null
  wall: WallSide
  wallLabel: string
  start: PlanPoint
  end: PlanPoint
  /** Longitud del segmento redondeada a 0,01 m. */
  length: number
  /** Ángulo del segmento: el eje local X del grupo coincide con start → end. */
  yaw: number
  /** +1 o −1: signo del eje local Z que apunta hacia el exterior. */
  outwardSign: 1 | -1
  thickness: number
  label: string
  compactLabel: string
}

const NUMBER_FORMAT = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })

/** «4,00» — precisión de 0,01 m en español de España. */
export function formatPlanDimensionValue(length: number): string {
  return NUMBER_FORMAT.format(snapMeasurement(length))
}

/** «4,00 m» */
export function formatPlanDimension(length: number): string {
  return `${formatPlanDimensionValue(length)} m`
}

/**
 * Segmentos del perímetro de la habitación raíz, tomados del mismo modelo
 * de paredes físicas que usan la escena y las aperturas. Calcular desde
 * segmentos (y no desde ancho/fondo) prepara la evolución a contornos
 * poligonales (#35) sin implementarla todavía.
 */
export function roomPerimeterSegments(room: RoomConfig): PlanWallSegment[] {
  return physicalWalls({ room, structurePacks: [] })
    .filter((wall) => !wall.packId)
    .map(wallSegment)
}

function wallSegment(wall: ConnectedWall): PlanWallSegment {
  const dx = Math.cos(wall.yaw) * wall.width / 2
  const dz = -Math.sin(wall.yaw) * wall.width / 2
  return {
    id: wall.id,
    roomId: wall.packId ?? null,
    wall: wall.side,
    start: { x: wall.x - dx, z: wall.z - dz },
    end: { x: wall.x + dx, z: wall.z + dz },
    thickness: wall.depth,
  }
}

const isRoomPack = (packId?: string) => !packId || packId.startsWith('floor-pack-')

/**
 * Cotas de todas las habitaciones (raíz y habitaciones adicionales). Las
 * paredes independientes no son habitaciones y no se acotan.
 * `includeWall` permite limitarlas a las paredes visibles en el Plano.
 */
export function planRoomDimensions(world: WallWorld, includeWall: (wall: ConnectedWall) => boolean = () => true): PlanDimension[] {
  const groups = new Map<string | null, ConnectedWall[]>()
  for (const wall of physicalWalls(world)) {
    if (!isRoomPack(wall.packId) || !includeWall(wall)) continue
    const key = wall.packId ?? null
    groups.set(key, [...(groups.get(key) ?? []), wall])
  }
  return [...groups].flatMap(([roomId, walls]) => {
    // El exterior se decide respecto al centro del suelo de la habitación;
    // así sigue siendo correcto aunque falte o se oculte alguna pared.
    const pack = roomId ? world.structurePacks.find((candidate) => candidate.id === roomId) : undefined
    const floor = pack?.surfaces.find((surface) => surface.kind === 'floor')
    const centre = !roomId ? { x: 0, z: 0 } : pack && floor
      ? (() => { const [x, , z] = surfacePosition(world.room, floor); return { x: pack.x + x, z: pack.z + z } })()
      : undefined
    return planDimensionsForSegments(walls.map(wallSegment), centre)
  })
}

/** Cotas exteriores de un contorno cerrado de segmentos. */
export function planDimensionsForSegments(segments: readonly PlanWallSegment[], interior?: PlanPoint): PlanDimension[] {
  if (!segments.length) return []
  const points = segments.flatMap((segment) => [segment.start, segment.end])
  const centre = interior ?? {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  }
  return segments.flatMap((segment) => {
    const dx = segment.end.x - segment.start.x
    const dz = segment.end.z - segment.start.z
    const rawLength = Math.hypot(dx, dz)
    if (!Number.isFinite(rawLength) || rawLength < 1e-6) return []
    const yaw = Math.atan2(-dz, dx)
    // Eje local Z tras girar `yaw` alrededor de Y: (sin yaw, cos yaw).
    const middle = { x: (segment.start.x + segment.end.x) / 2, z: (segment.start.z + segment.end.z) / 2 }
    const towardsOutside = Math.sin(yaw) * (middle.x - centre.x) + Math.cos(yaw) * (middle.z - centre.z)
    const length = snapMeasurement(rawLength)
    return [{
      id: `plan-dimension:${segment.id}`,
      wallId: segment.id,
      roomId: segment.roomId ?? null,
      wall: segment.wall,
      wallLabel: WALL_LABELS[segment.wall],
      start: segment.start,
      end: segment.end,
      length,
      yaw,
      outwardSign: towardsOutside < 0 ? -1 : 1,
      thickness: segment.thickness,
      label: formatPlanDimension(length),
      compactLabel: formatPlanDimensionValue(length),
    }]
  })
}

export function roomPerimeterDimensions(room: RoomConfig): PlanDimension[] {
  return planDimensionsForSegments(roomPerimeterSegments(room))
}

/** Resumen textual para lectores de pantalla: «Pared A: 4,00 m; …». */
export function planDimensionsSummary(dimensions: readonly PlanDimension[]): string {
  return dimensions.map((dimension) => `Pared ${dimension.wallLabel}: ${dimension.label}`).join('; ')
}

/** Resumen por habitación: «Raíz — Pared A: 4,00 m; …. Habitación 2 — …». */
export function planRoomDimensionsSummary(dimensions: readonly PlanDimension[], roomName: (roomId: string | null) => string): string {
  const rooms = [...new Set(dimensions.map((dimension) => dimension.roomId))]
  return rooms.map((roomId) => `${roomName(roomId)} — ${planDimensionsSummary(dimensions.filter((dimension) => dimension.roomId === roomId))}`).join('. ')
}

export type PlanDimensionLabelMode = 'full' | 'compact' | 'hidden'

/**
 * Decide qué etiqueta cabe a lo largo de la cota en pantalla. Si no cabe la
 * completa se quita la unidad; si tampoco cabe se oculta el número y se
 * conserva solo la línea, para no tapar aperturas ni manipuladores.
 */
export function planDimensionLabelMode(segmentPixels: number, fullLabelPixels: number, compactLabelPixels: number, endMarginPixels = 24): PlanDimensionLabelMode {
  const available = segmentPixels - endMarginPixels * 2
  if (available >= fullLabelPixels) return 'full'
  if (available >= compactLabelPixels) return 'compact'
  return 'hidden'
}
