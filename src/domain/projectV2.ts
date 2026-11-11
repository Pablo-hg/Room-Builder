import type { ElementFolder, FurnitureKind, GridSurface, StructurePack, WallSide, WindowShape } from './types'
import { validateAxisLocks } from './axisLocks'
import { validateFurnitureWallAttachment } from './furnitureWalls'
import { validateFreeWallPosition, validateWallPosition } from './freeWallPosition'

/**
 * Contrato candidato Project/Room/Layout (R4).
 *
 * No sustituye a PersistedDesign v1–v4 ni se guarda en localStorage.
 * Es un modelo puro: define tipos, relaciones e invariantes para preparar
 * variantes y una futura vivienda sin exponer UI multihabitación.
 */
export const PROJECT_SCHEMA_VERSION = 2 as const
export const PROJECT_UNITS = 'meters' as const

export interface ProjectPointV2 {
  x: number
  z: number
}

export interface ProjectBoundaryV2 {
  /** Centro del rectángulo en el plano del suelo. */
  x: number
  z: number
  width: number
  depth: number
}

export interface FloorV2 {
  id: string
  name: string
  elevation: number
  roomIds: string[]
}

export interface RoomV2 {
  id: string
  name: string
  floorId: string
  boundary: ProjectBoundaryV2
  height: number
  wallColor?: string
  wallColors?: Partial<Record<WallSide, string>>
  floorColor?: string
}

export interface WallV2 {
  id: string
  name: string
  start: ProjectPointV2
  end: ProjectPointV2
  height: number
  thickness: number
  color?: string
  /** Una habitación para pared exterior; dos para una pared compartida. */
  roomIds: string[]
}

export interface OpeningV2 {
  wallPosition?: import('./types').WindowConfig['wallPosition']
  freePosition?: import('./types').WindowConfig['freePosition']
  axisLocks?: import('./types').AxisLocks
  id: string
  name?: string
  wallId: string
  kind: 'door' | 'window'
  shape?: WindowShape
  /** Distancia al centro de la pared, en metros. */
  offset: number
  width: number
  height: number
  /** Altura del alféizar o del borde inferior respecto al suelo. */
  bottom: number
  color: string
  rotation?: number
}

export interface FurnitureDefinitionV2 {
  id: string
  kind: FurnitureKind
  name: string
  width: number
  depth: number
  height: number
  color: string
}

export interface FurnitureInstanceV2 {
  wallAttachment?: import('./furnitureWalls').FurnitureWallAttachment
  axisLocks?: import('./types').AxisLocks
  attachmentPolicy?: 'by-type'
  id: string
  roomId: string
  definitionId?: string
  kind: FurnitureKind
  name: string
  x: number
  y: number
  z: number
  rotation: number
  width: number
  depth: number
  height: number
  color: string
}

export interface LayoutV2 {
  id: string
  name: string
  kind: 'original' | 'alternative'
  basedOnLayoutId?: string
  /** Debe coincidir con ProjectV2.structureRevision para no quedar obsoleto. */
  structureRevision: number
  furniture: FurnitureInstanceV2[]
}

export interface EditorPreferencesV2 {
  gridSnap: boolean
  gridVisibility: Record<GridSurface, boolean>
  hiddenElementIds: string[]
  lockedElementIds: string[]
  elementFolders: ElementFolder[]
  elementFolderAssignments: Record<string, string>
  sceneElementOrder: string[]
}

export interface ProjectMetadataV2 {
  createdAt: string
  updatedAt: string
  source: 'v1-design' | 'new'
  migratedFromVersion?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
}

export interface ProjectV2 {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  id: string
  name: string
  units: typeof PROJECT_UNITS
  /** Se incrementa con cambios de forma, paredes o aberturas. */
  structureRevision: number
  floors: FloorV2[]
  rooms: RoomV2[]
  walls: WallV2[]
  openings: OpeningV2[]
  furnitureDefinitions: FurnitureDefinitionV2[]
  layouts: LayoutV2[]
  activeLayoutId: string
  preferences: EditorPreferencesV2
  /**
   * Transición explícita para no perder los packs constructivos v1.
   * No son paredes canónicas y no se mezclan con WallV2.
   */
  legacyStructurePacks?: StructurePack[]
  metadata: ProjectMetadataV2
}

export type ProjectValidationCode =
  | 'invalid-schema'
  | 'invalid-units'
  | 'invalid-id'
  | 'duplicate-id'
  | 'invalid-floor'
  | 'invalid-room'
  | 'invalid-wall'
  | 'invalid-opening'
  | 'invalid-definition'
  | 'invalid-layout'
  | 'invalid-furniture'
  | 'dangling-reference'
  | 'duplicate-shared-wall'
  | 'wall-not-on-room-boundary'
  | 'wall-not-along-room-side'
  | 'opening-outside-wall'
  | 'opening-overlap'
  | 'active-layout-missing'
  | 'missing-original-layout'
  | 'multiple-original-layouts'

export interface ProjectValidationIssue {
  code: ProjectValidationCode
  path: string
  message: string
}

const EPSILON = 1e-6
const WALL_SIDES: WallSide[] = ['north', 'east', 'south', 'west']

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isPositive = (value: unknown): value is number => isFiniteNumber(value) && value > 0
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isNonNegative = (value: unknown): value is number => isFiniteNumber(value) && value >= 0
const isWallSide = (value: unknown): value is WallSide => typeof value === 'string' && WALL_SIDES.includes(value as WallSide)
const round = (value: number) => Math.round(value * 1e6) / 1e6

export function wallLength(wall: Pick<WallV2, 'start' | 'end'>): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
}

function roomBounds(room: RoomV2) {
  const { x, z, width, depth } = room.boundary
  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  }
}

export function pointOnRoomBoundary(point: ProjectPointV2, room: RoomV2): boolean {
  if (!isFiniteNumber(point.x) || !isFiniteNumber(point.z)) return false
  const { minX, maxX, minZ, maxZ } = roomBounds(room)
  const onVertical = (Math.abs(point.x - minX) <= EPSILON || Math.abs(point.x - maxX) <= EPSILON)
    && point.z >= minZ - EPSILON && point.z <= maxZ + EPSILON
  const onHorizontal = (Math.abs(point.z - minZ) <= EPSILON || Math.abs(point.z - maxZ) <= EPSILON)
    && point.x >= minX - EPSILON && point.x <= maxX + EPSILON
  return onVertical || onHorizontal
}

export function wallSideForRoom(wall: WallV2, room: RoomV2): WallSide | null {
  const { minX, maxX, minZ, maxZ } = roomBounds(room)
  const bothOn = (value: (point: ProjectPointV2) => boolean) => value(wall.start) && value(wall.end)
  if (bothOn((point) => Math.abs(point.z - minZ) <= EPSILON)) return 'north'
  if (bothOn((point) => Math.abs(point.z - maxZ) <= EPSILON)) return 'south'
  if (bothOn((point) => Math.abs(point.x - maxX) <= EPSILON)) return 'east'
  if (bothOn((point) => Math.abs(point.x - minX) <= EPSILON)) return 'west'
  return null
}

/** Una pared compartida debe ser única para cada pareja de habitaciones. */
export function sharedWallBetween(project: ProjectV2, roomA: string, roomB: string): WallV2 | undefined {
  if (roomA === roomB) return undefined
  return project.walls.find((wall) => wall.roomIds.length === 2 && wall.roomIds.includes(roomA) && wall.roomIds.includes(roomB))
}

export function roomsShareWall(project: ProjectV2, roomA: string, roomB: string): boolean {
  return Boolean(sharedWallBetween(project, roomA, roomB))
}

export function adjacentRoomPairs(project: ProjectV2): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  const seen = new Set<string>()
  for (const wall of project.walls) {
    if (wall.roomIds.length !== 2) continue
    const [a, b] = wall.roomIds
    const key = [a, b].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push([a, b])
  }
  return pairs
}

function normalizedStructure(project: Pick<ProjectV2, 'floors' | 'rooms' | 'walls' | 'openings' | 'legacyStructurePacks'>) {
  const byId = <T extends { id: string }>(values: T[]) => [...values].sort((a, b) => a.id.localeCompare(b.id))
  return {
    floors: byId(project.floors).map((floor) => ({
      id: floor.id,
      name: floor.name,
      elevation: round(floor.elevation),
      roomIds: [...floor.roomIds].sort(),
    })),
    rooms: byId(project.rooms).map((room) => ({
      id: room.id,
      name: room.name,
      floorId: room.floorId,
      boundary: {
        x: round(room.boundary.x),
        z: round(room.boundary.z),
        width: round(room.boundary.width),
        depth: round(room.boundary.depth),
      },
      height: round(room.height),
      wallColor: room.wallColor ?? null,
      wallColors: room.wallColors
        ? Object.fromEntries(WALL_SIDES.flatMap((side) => room.wallColors?.[side] ? [[side, room.wallColors[side]]] : []))
        : null,
      floorColor: room.floorColor ?? null,
    })),
    walls: byId(project.walls).map((wall) => ({
      id: wall.id,
      name: wall.name,
      start: { x: round(wall.start.x), z: round(wall.start.z) },
      end: { x: round(wall.end.x), z: round(wall.end.z) },
      height: round(wall.height),
      thickness: round(wall.thickness),
      color: wall.color ?? null,
      roomIds: [...wall.roomIds].sort(),
    })),
    openings: byId(project.openings).map((opening) => ({
      id: opening.id,
      name: opening.name ?? null,
      wallId: opening.wallId,
      kind: opening.kind,
      shape: opening.shape ?? null,
      offset: round(opening.offset),
      width: round(opening.width),
      height: round(opening.height),
      bottom: round(opening.bottom),
      color: opening.color,
      rotation: round(opening.rotation ?? 0),
      ...(opening.freePosition ? { freePosition: { ...opening.freePosition } } : {}),
      ...(opening.wallPosition ? { wallPosition: { ...opening.wallPosition } } : {}),
    })),
    legacyStructurePacks: project.legacyStructurePacks
      ? byId(project.legacyStructurePacks).map((pack) => ({
        id: pack.id,
        name: pack.name,
        x: round(pack.x),
        y: round(pack.y),
        z: round(pack.z),
        surfaces: [...pack.surfaces].sort((a, b) => a.id.localeCompare(b.id)),
        ...(pack.doors ? { doors: byId(pack.doors) } : {}),
        ...(pack.windows ? { windows: byId(pack.windows) } : {}),
      }))
      : null,
  }
}

/**
 * Huella estable de la estructura compartida. Las variantes de mobiliario no la
 * modifican; cualquier cambio de habitación, pared, abertura o pack sí.
 */
export function projectStructureFingerprint(project: Pick<ProjectV2, 'floors' | 'rooms' | 'walls' | 'openings' | 'legacyStructurePacks'>): string {
  return JSON.stringify(normalizedStructure(project))
}

export function staleLayoutIds(project: ProjectV2): string[] {
  return project.layouts
    .filter((layout) => layout.structureRevision !== project.structureRevision)
    .map((layout) => layout.id)
}

/** IDs de mobiliario usados por el proyecto; pueden repetirse entre variantes. */
export function projectFurnitureIds(project: ProjectV2): Set<string> {
  return new Set(project.layouts.flatMap((layout) => layout.furniture.map((item) => item.id)))
}

export function validateProject(project: ProjectV2): ProjectValidationIssue[] {
  const issues: ProjectValidationIssue[] = []
  const add = (code: ProjectValidationCode, path: string, message: string) => issues.push({ code, path, message })

  if (project.schemaVersion !== PROJECT_SCHEMA_VERSION) add('invalid-schema', 'schemaVersion', 'Se esperaba el esquema 2.')
  if (project.units !== PROJECT_UNITS) add('invalid-units', 'units', 'Las unidades deben ser metros.')
  if (!isNonEmptyString(project.id)) add('invalid-id', 'id', 'Falta el identificador del proyecto.')
  if (!isNonEmptyString(project.name)) add('invalid-id', 'name', 'Falta el nombre del proyecto.')
  if (!Number.isInteger(project.structureRevision) || project.structureRevision < 0) {
    add('invalid-schema', 'structureRevision', 'La revisión estructural debe ser un entero no negativo.')
  }

  const floorIds = new Set<string>()
  for (const [index, floor] of project.floors.entries()) {
    const path = `floors[${index}]`
    if (!isNonEmptyString(floor.id)) add('invalid-floor', `${path}.id`, 'Identificador de planta vacío.')
    else if (floorIds.has(floor.id)) add('duplicate-id', `${path}.id`, `Planta duplicada: ${floor.id}.`)
    else floorIds.add(floor.id)
    if (!isNonEmptyString(floor.name)) add('invalid-floor', `${path}.name`, 'Nombre de planta vacío.')
    if (!isFiniteNumber(floor.elevation)) add('invalid-floor', `${path}.elevation`, 'Altura de planta no finita.')
    if (!Array.isArray(floor.roomIds) || floor.roomIds.some((id) => !isNonEmptyString(id))) {
      add('invalid-floor', `${path}.roomIds`, 'Lista de habitaciones inválida.')
    }
  }

  const roomIds = new Set<string>()
  for (const [index, room] of project.rooms.entries()) {
    const path = `rooms[${index}]`
    if (!isNonEmptyString(room.id)) add('invalid-room', `${path}.id`, 'Identificador de habitación vacío.')
    else if (roomIds.has(room.id)) add('duplicate-id', `${path}.id`, `Habitación duplicada: ${room.id}.`)
    else roomIds.add(room.id)
    if (!isNonEmptyString(room.name)) add('invalid-room', `${path}.name`, 'Nombre de habitación vacío.')
    if (!floorIds.has(room.floorId)) add('dangling-reference', `${path}.floorId`, `Planta inexistente: ${room.floorId}.`)
    const boundary = room.boundary
    if (!boundary || !isFiniteNumber(boundary.x) || !isFiniteNumber(boundary.z) || !isPositive(boundary.width) || !isPositive(boundary.depth)) {
      add('invalid-room', `${path}.boundary`, 'La habitación necesita un rectángulo válido.')
    }
    if (!isPositive(room.height)) add('invalid-room', `${path}.height`, 'Altura de habitación inválida.')
    if (room.wallColors && Object.entries(room.wallColors).some(([side, color]) => !isWallSide(side) || typeof color !== 'string')) {
      add('invalid-room', `${path}.wallColors`, 'Colores de pared inválidos.')
    }
  }

  for (const [index, floor] of project.floors.entries()) {
    for (const roomId of floor.roomIds) {
      if (!roomIds.has(roomId)) add('dangling-reference', `floors[${index}].roomIds`, `Habitación inexistente: ${roomId}.`)
      const room = project.rooms.find((candidate) => candidate.id === roomId)
      if (room && room.floorId !== floor.id) add('invalid-floor', `floors[${index}].roomIds`, `${roomId} pertenece a otra planta.`)
    }
  }
  for (const room of project.rooms) {
    const floor = project.floors.find((candidate) => candidate.id === room.floorId)
    if (floor && !floor.roomIds.includes(room.id)) add('invalid-room', `rooms.${room.id}`, 'La planta no incluye esta habitación.')
  }

  const wallIds = new Set<string>()
  const sharedPairs = new Set<string>()
  for (const [index, wall] of project.walls.entries()) {
    const path = `walls[${index}]`
    if (!isNonEmptyString(wall.id)) add('invalid-wall', `${path}.id`, 'Identificador de pared vacío.')
    else if (wallIds.has(wall.id)) add('duplicate-id', `${path}.id`, `Pared duplicada: ${wall.id}.`)
    else wallIds.add(wall.id)
    if (!isNonEmptyString(wall.name)) add('invalid-wall', `${path}.name`, 'Nombre de pared vacío.')
    if (!wall.start || !wall.end || !isFiniteNumber(wall.start.x) || !isFiniteNumber(wall.start.z) || !isFiniteNumber(wall.end.x) || !isFiniteNumber(wall.end.z)) {
      add('invalid-wall', `${path}`, 'Extremos de pared inválidos.')
    } else if (wallLength(wall) <= EPSILON) {
      add('invalid-wall', `${path}`, 'La pared no puede tener longitud cero.')
    }
    if (!isPositive(wall.height)) add('invalid-wall', `${path}.height`, 'Altura de pared inválida.')
    if (!isPositive(wall.thickness)) add('invalid-wall', `${path}.thickness`, 'Grosor de pared inválido.')
    if (wall.roomIds.length < 1 || wall.roomIds.length > 2) {
      add('invalid-wall', `${path}.roomIds`, 'Una pared debe pertenecer a una o dos habitaciones.')
    }
    if (new Set(wall.roomIds).size !== wall.roomIds.length) {
      add('invalid-wall', `${path}.roomIds`, 'Una pared no puede repetir la misma habitación.')
    }
    const wallFloorIds = new Set(wall.roomIds.flatMap((roomId) => {
      const room = project.rooms.find((candidate) => candidate.id === roomId)
      return room ? [room.floorId] : []
    }))
    if (wallFloorIds.size > 1) {
      add('invalid-wall', `${path}.roomIds`, 'Las habitaciones de una pared deben pertenecer a la misma planta.')
    }
    for (const roomId of wall.roomIds) {
      if (!roomIds.has(roomId)) add('dangling-reference', `${path}.roomIds`, `Habitación inexistente: ${roomId}.`)
      const room = project.rooms.find((candidate) => candidate.id === roomId)
      if (room && !pointOnRoomBoundary(wall.start, room)) add('wall-not-on-room-boundary', `${path}.start`, 'El extremo no está en el borde de la habitación.')
      if (room && !pointOnRoomBoundary(wall.end, room)) add('wall-not-on-room-boundary', `${path}.end`, 'El extremo no está en el borde de la habitación.')
      if (room && wallSideForRoom(wall, room) === null) add('wall-not-along-room-side', path, 'La pared no discurre por un único lado de la habitación.')
    }
    if (wall.roomIds.length === 2) {
      const key = [...wall.roomIds].sort().join('|')
      if (sharedPairs.has(key)) add('duplicate-shared-wall', path, 'Hay más de una pared para la misma pareja de habitaciones.')
      else sharedPairs.add(key)
    }
  }

  const openingIds = new Set<string>()
  for (const [index, opening] of project.openings.entries()) {
    try { validateAxisLocks(opening.axisLocks) }
    catch { add('invalid-schema', `openings[${index}].axisLocks`, 'Bloqueos de posición inválidos.') }
    const path = `openings[${index}]`
    if (!isNonEmptyString(opening.id)) add('invalid-opening', `${path}.id`, 'Identificador de abertura vacío.')
    else if (openingIds.has(opening.id)) add('duplicate-id', `${path}.id`, `Abertura duplicada: ${opening.id}.`)
    else openingIds.add(opening.id)
    const wall = project.walls.find((candidate) => candidate.id === opening.wallId)
    if (!wall) {
      add('dangling-reference', `${path}.wallId`, `Pared inexistente: ${opening.wallId}.`)
      continue
    }
    if (opening.kind !== 'door' && opening.kind !== 'window') add('invalid-opening', `${path}.kind`, 'Tipo de abertura inválido.')
    if (!isPositive(opening.width) || !isPositive(opening.height) || !isNonNegative(opening.bottom)) {
      add('invalid-opening', `${path}`, 'Medidas de abertura inválidas.')
    }
    if (!isFiniteNumber(opening.offset)) add('invalid-opening', `${path}.offset`, 'Posición de abertura inválida.')
    if (typeof opening.color !== 'string') add('invalid-opening', `${path}.color`, 'Color de abertura inválido.')
    if (opening.rotation !== undefined && !isFiniteNumber(opening.rotation)) add('invalid-opening', `${path}.rotation`, 'Rotación de abertura inválida.')
    if (opening.wallPosition !== undefined) {
      try { validateWallPosition(opening.wallPosition) } catch { add('invalid-opening', `${path}.wallPosition`, 'Anclaje a paredes conectadas inválido.') }
      if (opening.freePosition) add('invalid-opening', path, 'Anclaje de abertura ambiguo.')
      continue
    }
    if (opening.freePosition !== undefined) {
      try { validateFreeWallPosition(opening.freePosition) } catch { add('invalid-opening', `${path}.freePosition`, 'Posición mural libre inválida.') }
      if (opening.kind !== 'window') add('invalid-opening', `${path}.freePosition`, 'Una puerta debe permanecer en su pared.')
      continue
    }
    if (isFiniteNumber(opening.offset) && isPositive(opening.width)) {
      const halfLength = wallLength(wall) / 2
      if (Math.abs(opening.offset) + opening.width / 2 > halfLength + EPSILON) {
        add('opening-outside-wall', `${path}.offset`, 'La abertura sobresale de su pared.')
      }
    }
    if (isPositive(opening.height) && isNonNegative(opening.bottom) && opening.bottom + opening.height > wall.height + EPSILON) {
      add('opening-outside-wall', `${path}.height`, 'La abertura supera la altura de su pared.')
    }
  }

  // RB-026: dos aberturas no pueden solaparse en la misma pared; el solape se mide
  // en tramos a lo largo de la pared y franja de altura, así una decoración puede
  // convivir con otra a distinta altura o distinto tramo.
  const openingsByWall = new Map<string, OpeningV2[]>()
  for (const opening of project.openings) {
    if (opening.freePosition || opening.wallPosition) continue
    if (!openingIds.has(opening.id)) continue
    if (!isFiniteNumber(opening.offset) || !isPositive(opening.width) || !isPositive(opening.height) || !isNonNegative(opening.bottom)) continue
    const list = openingsByWall.get(opening.wallId)
    if (list) list.push(opening)
    else openingsByWall.set(opening.wallId, [opening])
  }
  for (const [wallId, list] of openingsByWall.entries()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!
        const b = list[j]!
        const overlapTramo = Math.min(a.offset + a.width / 2, b.offset + b.width / 2) - Math.max(a.offset - a.width / 2, b.offset - b.width / 2)
        const overlapAltura = Math.min(a.bottom + a.height, b.bottom + b.height) - Math.max(a.bottom, b.bottom)
        if (overlapTramo > EPSILON && overlapAltura > EPSILON) {
          add('opening-overlap', `openings`, `Las aberturas ${a.id} y ${b.id} se solapan en su pared.`)
        }
      }
    }
  }

  const definitionIds = new Set<string>()
  for (const [index, definition] of project.furnitureDefinitions.entries()) {
    const path = `furnitureDefinitions[${index}]`
    if (!isNonEmptyString(definition.id)) add('invalid-definition', `${path}.id`, 'Identificador de definición vacío.')
    else if (definitionIds.has(definition.id)) add('duplicate-id', `${path}.id`, `Definición duplicada: ${definition.id}.`)
    else definitionIds.add(definition.id)
    if (!isNonEmptyString(definition.kind) || !isNonEmptyString(definition.name)) add('invalid-definition', path, 'Definición de mobiliario incompleta.')
    if (!isPositive(definition.width) || !isPositive(definition.depth) || !isPositive(definition.height)) add('invalid-definition', path, 'Medidas de definición inválidas.')
    if (typeof definition.color !== 'string') add('invalid-definition', `${path}.color`, 'Color de definición inválido.')
  }

  const layoutIds = new Set(project.layouts.map((layout) => layout.id))
  let originalLayouts = 0
  for (const [index, layout] of project.layouts.entries()) {
    const path = `layouts[${index}]`
    if (!isNonEmptyString(layout.id)) add('invalid-layout', `${path}.id`, 'Identificador de variante vacío.')
    else if (project.layouts.filter((candidate) => candidate.id === layout.id).length > 1 && layoutIds.has(layout.id)) {
      add('duplicate-id', `${path}.id`, `Variante duplicada: ${layout.id}.`)
      layoutIds.delete(layout.id)
    }
    if (!isNonEmptyString(layout.name)) add('invalid-layout', `${path}.name`, 'Nombre de variante vacío.')
    if (layout.kind !== 'original' && layout.kind !== 'alternative') add('invalid-layout', `${path}.kind`, 'Tipo de variante inválido.')
    if (layout.kind === 'original') originalLayouts += 1
    if (layout.basedOnLayoutId !== undefined && (!layoutIds.has(layout.basedOnLayoutId) || layout.basedOnLayoutId === layout.id)) {
      add('dangling-reference', `${path}.basedOnLayoutId`, `Variante base inexistente: ${layout.basedOnLayoutId}.`)
    }
    if (!Number.isInteger(layout.structureRevision) || layout.structureRevision < 0) add('invalid-layout', `${path}.structureRevision`, 'Revisión estructural de variante inválida.')
    const furnitureIds = new Set<string>()
    for (const [furnitureIndex, item] of layout.furniture.entries()) {
      const itemPath = `${path}.furniture[${furnitureIndex}]`
      try { validateFurnitureWallAttachment(item.wallAttachment) }
      catch { add('invalid-furniture', `${itemPath}.wallAttachment`, 'Fijación de mueble inválida.') }
      try { validateAxisLocks(item.axisLocks) }
      catch { add('invalid-furniture', `${itemPath}.axisLocks`, 'Bloqueos de posición inválidos.') }
      if (!isNonEmptyString(item.id)) add('invalid-furniture', `${itemPath}.id`, 'Identificador de mueble vacío.')
      else if (furnitureIds.has(item.id)) add('duplicate-id', `${itemPath}.id`, `Mueble duplicado en la variante: ${item.id}.`)
      else furnitureIds.add(item.id)
      if (!isNonEmptyString(item.roomId) || !roomIds.has(item.roomId)) add('dangling-reference', `${itemPath}.roomId`, `Habitación inexistente: ${item.roomId}.`)
      if (item.definitionId !== undefined && !definitionIds.has(item.definitionId)) add('dangling-reference', `${itemPath}.definitionId`, `Definición inexistente: ${item.definitionId}.`)
      if (!isNonEmptyString(item.kind) || !isNonEmptyString(item.name)) add('invalid-furniture', itemPath, 'Mueble incompleto.')
      if (![item.x, item.y, item.z, item.rotation].every(isFiniteNumber)) add('invalid-furniture', itemPath, 'Posición o rotación inválida.')
      if (!isPositive(item.width) || !isPositive(item.depth) || !isPositive(item.height)) add('invalid-furniture', itemPath, 'Medidas de mueble inválidas.')
      if (typeof item.color !== 'string') add('invalid-furniture', `${itemPath}.color`, 'Color de mueble inválido.')
      if (item.attachmentPolicy !== undefined && item.attachmentPolicy !== 'by-type') add('invalid-furniture', `${itemPath}.attachmentPolicy`, 'Política de anclaje inválida.')
    }
  }
  if (originalLayouts === 0) add('missing-original-layout', 'layouts', 'Falta la distribución Original.')
  if (originalLayouts > 1) add('multiple-original-layouts', 'layouts', 'Solo puede existir una distribución Original.')
  if (!layoutIds.has(project.activeLayoutId)) add('active-layout-missing', 'activeLayoutId', `Variante activa inexistente: ${project.activeLayoutId}.`)

  if (!project.metadata || !isNonEmptyString(project.metadata.createdAt) || !isNonEmptyString(project.metadata.updatedAt)) {
    add('invalid-schema', 'metadata', 'Faltan las fechas del proyecto.')
  }
  if (project.metadata && project.metadata.source !== 'v1-design' && project.metadata.source !== 'new') {
    add('invalid-schema', 'metadata.source', 'Origen de proyecto inválido.')
  }

  return issues
}

export function assertValidProject(project: ProjectV2): void {
  const issues = validateProject(project)
  if (issues.length) throw new Error(`invalid project: ${issues.map((issue) => `${issue.code}@${issue.path}`).join(', ')}`)
}
