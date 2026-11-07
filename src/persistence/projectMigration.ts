import { ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from '../domain/constants'
import { isPersistedDesign, type PersistedDesign, type SavedDesign } from '../domain/designV1'
import { validateOpenings } from '../domain/geometry'
import { normalizeDesignPreferences, normalizeStructurePacks } from '../domain/normalizeDesignV1'
import { FURNITURE_PRESETS, isWindowShape } from '../domain/objectCatalog'
import { validateAxisLocks } from '../domain/axisLocks'
import {
  PROJECT_SCHEMA_VERSION,
  assertValidProject,
  projectStructureFingerprint,
  type EditorPreferencesV2,
  type FurnitureDefinitionV2,
  type FurnitureInstanceV2,
  type OpeningV2,
  type ProjectV2,
  type RoomV2,
  type WallV2,
} from '../domain/projectV2'
import type { DoorConfig, FurnitureItem, RoomConfig, WallSide, WindowConfig } from '../domain/types'
import { flattenLegacyV5 } from './designMigrations'

const DEFAULT_DOOR_COLOR = '#ac704b'
const DEFAULT_WINDOW_COLOR = '#c88f58'
const DEFAULT_WALL_THICKNESS = 0.125

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isPositive = (value: unknown): value is number => isFiniteNumber(value) && value > 0
const isWallSide = (value: unknown): value is WallSide => typeof value === 'string' && WALL_SIDES.includes(value as WallSide)

function assertMigratableDesign(data: PersistedDesign): void {
  if (!isPersistedDesign(data)) throw new Error('invalid design header')
  const room = data.room
  if (!room || !isPositive(room.width) || !isPositive(room.depth) || !isPositive(room.height)) throw new Error('invalid room dimensions')
  if (!room.door || !isWallSide(room.door.wall) || !isFiniteNumber(room.door.offset) || !isPositive(room.door.width) || !isPositive(room.door.height)) {
    throw new Error('invalid door')
  }
  if (!Array.isArray(room.windows)) throw new Error('invalid windows')
  for (const window of room.windows) {
    validateAxisLocks(window?.axisLocks)
    if (
      !window
      || typeof window.id !== 'string'
      || !window.id
      || !isWallSide(window.wall)
      || !isWindowShape(window.shape)
      || !isFiniteNumber(window.offset)
      || !isPositive(window.width)
      || !isPositive(window.height)
      || !isFiniteNumber(window.sill)
    ) throw new Error('invalid window')
  }
  validateAxisLocks(room.door.axisLocks)
  if (validateOpenings(room)) throw new Error('invalid openings')
  if (!Array.isArray(data.furniture)) throw new Error('invalid furniture')
  for (const item of data.furniture) {
    validateAxisLocks(item?.axisLocks)
    if (
      !item
      || typeof item.id !== 'string'
      || !item.id
      || !Object.prototype.hasOwnProperty.call(FURNITURE_PRESETS, item.kind)
      || !isFiniteNumber(item.x)
      || !isFiniteNumber(item.y)
      || !isFiniteNumber(item.z)
      || !isFiniteNumber(item.rotation)
      || !isPositive(item.width)
      || !isPositive(item.depth)
      || !isPositive(item.height)
    ) throw new Error('invalid furniture')
  }
  if (data.structurePacks !== undefined) normalizeStructurePacks(data.structurePacks, room)
}

function canonicalWalls(projectId: string, room: RoomConfig, roomId: string): WallV2[] {
  const halfWidth = room.width / 2
  const halfDepth = room.depth / 2
  const ends: Record<WallSide, { start: { x: number; z: number }; end: { x: number; z: number } }> = {
    north: { start: { x: -halfWidth, z: -halfDepth }, end: { x: halfWidth, z: -halfDepth } },
    east: { start: { x: halfWidth, z: -halfDepth }, end: { x: halfWidth, z: halfDepth } },
    south: { start: { x: halfWidth, z: halfDepth }, end: { x: -halfWidth, z: halfDepth } },
    west: { start: { x: -halfWidth, z: halfDepth }, end: { x: -halfWidth, z: -halfDepth } },
  }
  return WALL_SIDES.map((side) => ({
    id: `${projectId}:wall-${side}`,
    name: `Pared ${WALL_LABELS[side]}`,
    ...ends[side],
    height: room.height,
    thickness: DEFAULT_WALL_THICKNESS,
    ...(room.wallColors?.[side] ?? room.wallColor ? { color: room.wallColors?.[side] ?? room.wallColor } : {}),
    roomIds: [roomId],
  }))
}

function doorOpening(projectId: string, roomId: string, door: DoorConfig): OpeningV2 {
  return {
    ...(door.axisLocks ? { axisLocks: { ...door.axisLocks } } : {}),
    id: `${roomId}:door`,
    ...(door.name ? { name: door.name } : {}),
    wallId: `${projectId}:wall-${door.wall}`,
    kind: 'door',
    offset: door.offset,
    width: door.width,
    height: door.height,
    bottom: 0,
    color: door.color ?? DEFAULT_DOOR_COLOR,
    rotation: door.rotation,
  }
}

function windowOpening(projectId: string, window: WindowConfig): OpeningV2 {
  return {
    ...(window.axisLocks ? { axisLocks: { ...window.axisLocks } } : {}),
    id: window.id,
    ...(window.name ? { name: window.name } : {}),
    wallId: `${projectId}:wall-${window.wall}`,
    kind: 'window',
    shape: window.shape,
    offset: window.offset,
    width: window.width,
    height: window.height,
    bottom: window.sill,
    color: window.color ?? DEFAULT_WINDOW_COLOR,
    rotation: window.rotation,
  }
}

function furnitureDefinitions(furniture: FurnitureItem[]): FurnitureDefinitionV2[] {
  return [...new Set(furniture.map((item) => item.kind))].map((kind) => {
    const preset = FURNITURE_PRESETS[kind]
    if (!preset) throw new Error(`unknown furniture kind: ${kind}`)
    return {
      id: `furniture-definition:${kind}`,
      kind,
      name: preset.name,
      width: preset.width,
      depth: preset.depth,
      height: preset.height,
      color: preset.color,
    }
  })
}

function furnitureInstances(furniture: FurnitureItem[], roomId: string): FurnitureInstanceV2[] {
  return furniture.map((item) => ({
    ...item,
    roomId,
    definitionId: `furniture-definition:${item.kind}`,
  }))
}

export interface ProjectMigrationOptions {
  projectId?: string
  name?: string
  createdAt?: string
  updatedAt?: string
}

/** Traduce las referencias de editor junto con el ID de la entidad migrada. */
function remapPreferenceElementId(preferences: EditorPreferencesV2, sourceId: string, targetId: string): EditorPreferencesV2 {
  const remap = (id: string) => id === sourceId ? targetId : id
  return {
    ...preferences,
    hiddenElementIds: preferences.hiddenElementIds.map(remap),
    lockedElementIds: preferences.lockedElementIds.map(remap),
    elementFolderAssignments: Object.fromEntries(
      Object.entries(preferences.elementFolderAssignments).map(([id, folderId]) => [remap(id), folderId]),
    ),
    sceneElementOrder: preferences.sceneElementOrder.map(remap),
  }
}

/**
 * Migración pura v1–v5 → contrato candidato v2.
 *
 * Conserva IDs de muebles y aberturas, nombres, colores, preferencias y packs
 * constructivos. Los packs se guardan como legado explícito para no perderlos;
 * no se convierten en paredes canónicas. No escribe en localStorage.
 */
export function migrateDesignToProject(saved: SavedDesign, options: ProjectMigrationOptions = {}): ProjectV2 {
  assertMigratableDesign(saved.data)
  const data = flattenLegacyV5(saved.data)
  const projectId = options.projectId ?? saved.id
  if (!projectId) throw new Error('project id required')
  const roomId = `${projectId}:room-0`
  const floorId = `${projectId}:floor-0`
  const layoutId = `${projectId}:layout-original`
  const preferences = remapPreferenceElementId(normalizeDesignPreferences(data), 'door', `${roomId}:door`)
  const room: RoomV2 = {
    id: roomId,
    name: 'Habitación',
    floorId,
    boundary: { x: 0, z: 0, width: data.room.width, depth: data.room.depth },
    height: data.room.height,
    ...(data.room.wallColor ? { wallColor: data.room.wallColor } : {}),
    ...(data.room.wallColors ? { wallColors: { ...data.room.wallColors } } : {}),
    ...(data.room.floorColor ? { floorColor: data.room.floorColor } : {}),
  }
  const project: ProjectV2 = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: projectId,
    name: options.name ?? saved.name,
    units: 'meters',
    structureRevision: 0,
    floors: [{ id: floorId, name: 'Planta 0', elevation: 0, roomIds: [roomId] }],
    rooms: [room],
    walls: canonicalWalls(projectId, data.room, roomId),
    openings: [
      doorOpening(projectId, roomId, data.room.door),
      ...data.room.windows.map((window) => windowOpening(projectId, window)),
    ],
    furnitureDefinitions: furnitureDefinitions(data.furniture),
    layouts: [{
      id: layoutId,
      name: 'Original',
      kind: 'original',
      structureRevision: 0,
      furniture: furnitureInstances(data.furniture, roomId),
    }],
    activeLayoutId: layoutId,
    preferences,
    ...(data.structurePacks !== undefined ? { legacyStructurePacks: structuredClone(data.structurePacks) } : {}),
    metadata: {
      createdAt: options.createdAt ?? saved.savedAt,
      updatedAt: options.updatedAt ?? saved.savedAt,
      source: 'v1-design',
      migratedFromVersion: data.version,
    },
  }
  assertValidProject(project)
  return project
}

function wallSideFor(wall: WallV2, room: RoomV2): WallSide {
  const { x, z, width, depth } = room.boundary
  const minX = x - width / 2
  const maxX = x + width / 2
  const minZ = z - depth / 2
  const maxZ = z + depth / 2
  if (Math.abs(wall.start.z - minZ) < 1e-6 && Math.abs(wall.end.z - minZ) < 1e-6) return 'north'
  if (Math.abs(wall.start.z - maxZ) < 1e-6 && Math.abs(wall.end.z - maxZ) < 1e-6) return 'south'
  if (Math.abs(wall.start.x - maxX) < 1e-6 && Math.abs(wall.end.x - maxX) < 1e-6) return 'east'
  if (Math.abs(wall.start.x - minX) < 1e-6 && Math.abs(wall.end.x - minX) < 1e-6) return 'west'
  throw new Error('wall is not on the room boundary')
}

/**
 * Reconstruye el diseño v1 de una variante para probar el round-trip del
 * prototipo. No se expone como importación/exportación pública.
 */
export function projectToPersistedDesignV1(project: ProjectV2, layoutId = project.activeLayoutId): PersistedDesign {
  assertValidProject(project)
  if (project.rooms.length !== 1) throw new Error('only one-room projects can be projected back to v1')
  const room = project.rooms[0]
  const layout = project.layouts.find((candidate) => candidate.id === layoutId)
  if (!layout) throw new Error('layout not found')
  const walls = project.walls.filter((wall) => wall.roomIds.includes(room.id))
  const wallSides = new Map(walls.map((wall) => [wall.id, wallSideFor(wall, room)]))
  const openings = project.openings.filter((opening) => wallSides.has(opening.wallId))
  const doorOpenings = openings.filter((opening) => opening.kind === 'door')
  if (doorOpenings.length !== 1) throw new Error('one door is required to project back to v1')
  const door = doorOpenings[0]
  const preferences = remapPreferenceElementId(project.preferences, door.id, 'door')
  const doorConfig: DoorConfig = {
    ...(door.axisLocks ? { axisLocks: { ...door.axisLocks } } : {}),
    ...(door.name ? { name: door.name } : {}),
    wall: wallSides.get(door.wallId)!,
    offset: door.offset,
    width: door.width,
    height: door.height,
    rotation: door.rotation ?? 0,
    color: door.color,
  }
  const windows: WindowConfig[] = openings
    .filter((opening) => opening.kind === 'window')
    .map((opening) => ({
      ...(opening.axisLocks ? { axisLocks: { ...opening.axisLocks } } : {}),
      ...(opening.name ? { name: opening.name } : {}),
      id: opening.id,
      shape: opening.shape ?? 'rectangular',
      wall: wallSides.get(opening.wallId)!,
      offset: opening.offset,
      width: opening.width,
      height: opening.height,
      sill: opening.bottom,
      rotation: opening.rotation ?? 0,
      color: opening.color,
    }))
  const roomConfig: RoomConfig = {
    width: room.boundary.width,
    depth: room.boundary.depth,
    height: room.height,
    ...(room.wallColor ? { wallColor: room.wallColor } : {}),
    ...(room.wallColors ? { wallColors: { ...room.wallColors } } : {}),
    ...(room.floorColor ? { floorColor: room.floorColor } : {}),
    door: doorConfig,
    windows,
  }
  const furniture: FurnitureItem[] = layout.furniture.map((item) => ({
    ...(item.axisLocks ? { axisLocks: { ...item.axisLocks } } : {}),
    ...(item.attachmentPolicy ? { attachmentPolicy: item.attachmentPolicy } : {}),
    id: item.id,
    kind: item.kind,
    name: item.name,
    x: item.x,
    y: item.y,
    z: item.z,
    rotation: item.rotation,
    width: item.width,
    depth: item.depth,
    height: item.height,
    color: item.color,
  }))
  return {
    version: project.metadata.migratedFromVersion === 5 ? 4 : project.metadata.migratedFromVersion ?? 4,
    room: roomConfig,
    furniture,
    ...(project.legacyStructurePacks !== undefined ? { structurePacks: structuredClone(project.legacyStructurePacks) } : {}),
    gridSnap: preferences.gridSnap,
    gridVisibility: { ...preferences.gridVisibility },
    hiddenElementIds: [...preferences.hiddenElementIds],
    lockedElementIds: [...preferences.lockedElementIds],
    elementFolders: structuredClone(preferences.elementFolders),
    elementFolderAssignments: { ...preferences.elementFolderAssignments },
    sceneElementOrder: [...preferences.sceneElementOrder],
  }
}

/** Huella estructural del proyecto migrado; dos variantes deben compartirla. */
export function projectMigrationFingerprint(project: ProjectV2): string {
  return projectStructureFingerprint(project)
}
