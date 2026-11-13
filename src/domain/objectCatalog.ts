import type { FurnitureItem, FurnitureKind, WindowShape } from './types'
import { furnitureResizeCapability, openingResizeCapability, type ResizeCapability } from './resizeCapabilities'
import { furnitureAxisLocks } from './axisLocks'
import { supportingFloorTop, type PlacementWorld } from './furniturePlacement'

export const DEFAULT_ROTATION_STEP = Math.PI / 12

export type TranslationCapability = 'floor-x' | 'floor-z' | 'wall-horizontal' | 'wall-vertical'
export type RotationAxis = 'floor-y' | 'wall-normal'

export interface ObjectCapabilities {
  resize?: ResizeCapability
  attachment: 'free' | 'floor' | 'wall' | 'ceiling'
  translation: readonly TranslationCapability[]
  rotation: {
    enabled: boolean
    axis: RotationAxis | null
    step: number | null
    freeWithShift: boolean
  }
  canChangeWall: boolean
  removable: boolean
}

const FLOOR_CAPABILITIES: ObjectCapabilities = {
  attachment: 'free',
  translation: ['floor-x', 'floor-z'],
  rotation: { enabled: true, axis: 'floor-y', step: DEFAULT_ROTATION_STEP, freeWithShift: true },
  canChangeWall: false,
  removable: true,
}

const WALL_OPENING_CAPABILITIES: ObjectCapabilities = {
  attachment: 'wall',
  translation: ['wall-horizontal', 'wall-vertical'],
  rotation: { enabled: true, axis: 'wall-normal', step: DEFAULT_ROTATION_STEP, freeWithShift: true },
  canChangeWall: true,
  removable: true,
}

const FLOOR_BOUND_CAPABILITIES: ObjectCapabilities = { ...FLOOR_CAPABILITIES, attachment: 'floor' }
const CEILING_CAPABILITIES: ObjectCapabilities = { ...FLOOR_CAPABILITIES, attachment: 'ceiling' }

export interface FurnitureDefinition {
  base: Omit<FurnitureItem, 'id' | 'x' | 'y' | 'z' | 'rotation'>
  family: FurnitureFamily
  capabilities: ObjectCapabilities
}

export type FurnitureFamily = 'seating' | 'tables' | 'sleep' | 'storage' | 'lighting' | 'accessories' | 'wallDecor'

export const FURNITURE_FAMILIES: { id: FurnitureFamily; label: string }[] = [
  { id: 'seating', label: 'Asientos' },
  { id: 'tables', label: 'Mesas y auxiliares' },
  { id: 'sleep', label: 'Descanso' },
  { id: 'storage', label: 'Almacenaje' },
  { id: 'lighting', label: 'Iluminación' },
  { id: 'accessories', label: 'Accesorios' },
  { id: 'wallDecor', label: 'Pared y decoración' },
]

const FURNITURE_DEFINITIONS: Record<FurnitureKind, FurnitureDefinition> = {
  armchair: { base: { kind: 'armchair', name: 'Sillón', width: 1, depth: 1, height: 0.85, color: '#d07a63' }, family: 'seating', capabilities: FLOOR_CAPABILITIES },
  sofa: { base: { kind: 'sofa', name: 'Sofá', width: 2, depth: 0.75, height: 0.85, color: '#b86f5e' }, family: 'seating', capabilities: FLOOR_CAPABILITIES },
  chair: { base: { kind: 'chair', name: 'Silla', width: 0.5, depth: 0.5, height: 0.85, color: '#bd8b5f' }, family: 'seating', capabilities: FLOOR_CAPABILITIES },
  table: { base: { kind: 'table', name: 'Mesa', width: 1.25, depth: 0.75, height: 0.74, color: '#c69765' }, family: 'tables', capabilities: FLOOR_CAPABILITIES },
  bedsideTable: { base: { kind: 'bedsideTable', name: 'Mesita de noche', width: 0.5, depth: 0.5, height: 0.55, color: '#b8875e' }, family: 'tables', capabilities: FLOOR_CAPABILITIES },
  bed: { base: { kind: 'bed', name: 'Cama doble', width: 1.5, depth: 2, height: 0.55, color: '#8ba5a1' }, family: 'sleep', capabilities: FLOOR_CAPABILITIES },
  singleBed: { base: { kind: 'singleBed', name: 'Cama individual', width: 1, depth: 2, height: 0.55, color: '#91aaa6' }, family: 'sleep', capabilities: FLOOR_CAPABILITIES },
  cabinet: { base: { kind: 'cabinet', name: 'Aparador', width: 1.5, depth: 0.5, height: 0.9, color: '#748d84' }, family: 'storage', capabilities: FLOOR_CAPABILITIES },
  bookshelf: { base: { kind: 'bookshelf', name: 'Estantería', width: 1, depth: 0.25, height: 1.8, color: '#9b7354' }, family: 'storage', capabilities: FLOOR_CAPABILITIES },
  wardrobe: { base: { kind: 'wardrobe', name: 'Armario de ropa', width: 1.5, depth: 0.5, height: 2, color: '#87988d' }, family: 'storage', capabilities: FLOOR_CAPABILITIES },
  lamp: { base: { kind: 'lamp', name: 'Lámpara', width: 0.5, depth: 0.5, height: 1.65, color: '#d3a755' }, family: 'lighting', capabilities: FLOOR_CAPABILITIES },
  wastebasket: { base: { kind: 'wastebasket', name: 'Papelera', width: 0.5, depth: 0.5, height: 0.5, color: '#738980' }, family: 'accessories', capabilities: FLOOR_CAPABILITIES },
  vase: { base: { kind: 'vase', name: 'Jarrón', width: 0.5, depth: 0.5, height: 0.5, color: '#b97862' }, family: 'accessories', capabilities: FLOOR_CAPABILITIES },
  tableLamp: { base: { kind: 'tableLamp', name: 'Lámpara de mesa', width: 0.5, depth: 0.5, height: 0.6, color: '#d3a755' }, family: 'lighting', capabilities: FLOOR_CAPABILITIES },
  ceilingLamp: { base: { kind: 'ceilingLamp', name: 'Lámpara de techo', width: 0.75, depth: 0.75, height: 0.6, color: '#d3a755' }, family: 'lighting', capabilities: CEILING_CAPABILITIES },
  coffeeTable: { base: { kind: 'coffeeTable', name: 'Mesa de centro', width: 1, depth: 0.75, height: 0.4, color: '#bd9164' }, family: 'tables', capabilities: FLOOR_CAPABILITIES },
  desk: { base: { kind: 'desk', name: 'Escritorio', width: 1.25, depth: 0.75, height: 0.75, color: '#a77b58' }, family: 'tables', capabilities: FLOOR_CAPABILITIES },
  deskChair: { base: { kind: 'deskChair', name: 'Silla de escritorio', width: 0.5, depth: 0.5, height: 0.85, color: '#758a80' }, family: 'seating', capabilities: FLOOR_CAPABILITIES },
  tvStand: { base: { kind: 'tvStand', name: 'Mueble de TV', width: 1.5, depth: 0.5, height: 0.5, color: '#8b7059' }, family: 'storage', capabilities: FLOOR_CAPABILITIES },
  television: { base: { kind: 'television', name: 'Televisor', width: 1.25, depth: 0.25, height: 0.75, color: '#52645f' }, family: 'accessories', capabilities: FLOOR_CAPABILITIES },
  rug: { base: { kind: 'rug', name: 'Alfombra', width: 2, depth: 1.5, height: 0.05, color: '#b97862' }, family: 'accessories', capabilities: FLOOR_BOUND_CAPABILITIES },
  circularRug: { base: { kind: 'circularRug', name: 'Alfombra circular', width: 1.5, depth: 1.5, height: 0.05, color: '#b97862' }, family: 'accessories', capabilities: FLOOR_BOUND_CAPABILITIES },
  plant: { base: { kind: 'plant', name: 'Planta', width: 0.5, depth: 0.5, height: 1.25, color: '#71886d' }, family: 'accessories', capabilities: FLOOR_CAPABILITIES },
  pictureSmall: { base: { kind: 'pictureSmall', name: 'Cuadro pequeño', width: 0.5, depth: 0.25, height: 0.5, color: '#d49a72' }, family: 'wallDecor', capabilities: WALL_OPENING_CAPABILITIES },
  pictureMedium: { base: { kind: 'pictureMedium', name: 'Cuadro mediano', width: 1, depth: 0.25, height: 0.75, color: '#7c9d91' }, family: 'wallDecor', capabilities: WALL_OPENING_CAPABILITIES },
  pictureLarge: { base: { kind: 'pictureLarge', name: 'Cuadro grande', width: 1.5, depth: 0.25, height: 1, color: '#bd8067' }, family: 'wallDecor', capabilities: WALL_OPENING_CAPABILITIES },
}

export const FURNITURE_CATALOG = Object.fromEntries(Object.entries(FURNITURE_DEFINITIONS).map(([kind, definition]) => [kind, {
  ...definition, capabilities: { ...definition.capabilities, resize: furnitureResizeCapability(kind as FurnitureKind), rotation: { ...definition.capabilities.rotation, enabled: hasUsefulFurnitureRotation(kind as FurnitureKind) } },
}])) as Record<FurnitureKind, FurnitureDefinition>

export function isFloorBoundFurniture(kind: FurnitureKind): kind is 'rug' | 'circularRug' {
  return kind === 'rug' || kind === 'circularRug'
}

export function isCeilingMountedFurniture(kind: FurnitureKind): kind is 'ceilingLamp' {
  return kind === 'ceilingLamp'
}

export function furnitureAttachment(item: Pick<FurnitureItem, 'kind' | 'attachmentPolicy' | 'axisLocks'>): ObjectCapabilities['attachment'] {
  if (item.axisLocks && !isWallPictureKind(item.kind)) return 'free'
  if (item.attachmentPolicy === 'by-type' || isWallPictureKind(item.kind)) return FURNITURE_CATALOG[item.kind].capabilities.attachment
  return 'free'
}

export function canElevateFurniture(item: Pick<FurnitureItem, 'kind' | 'attachmentPolicy' | 'axisLocks' | 'wallAttachment'>): boolean {
  // Fijar a una pared libera siempre la altura, incluso en diseños antiguos
  // donde la fijación no añadía axisLocks de forma explícita.
  if (item.wallAttachment) return true
  return !furnitureAxisLocks(item).y && furnitureAttachment(item) === 'free'
}

/** Desplazamiento visual heredado solo para objetos sin fijación al suelo o techo. */
export function furnitureVisualYOffset(item: Pick<FurnitureItem, 'kind' | 'attachmentPolicy' | 'axisLocks'> & Partial<Pick<FurnitureItem, 'x' | 'y' | 'z'>>, world?: PlacementWorld): number {
  if (item.axisLocks) return 0
  const attachment = furnitureAttachment(item)
  const legacyOffset = attachment === 'floor' || attachment === 'ceiling' ? 0 : 0.02
  if (isFloorBoundFurniture(item.kind)) {
    const top = world && item.x !== undefined && item.y !== undefined && item.z !== undefined
      ? supportingFloorTop({ x: item.x, y: item.y, z: item.z }, world) : 0.04
    if (top !== null) return Math.max(legacyOffset, top - (item.y ?? 0))
  }
  return legacyOffset
}

/** Only models with concentric geometry and decoration qualify. Saved angles are retained. */
export function hasUsefulFurnitureRotation(kind: FurnitureKind, dimensions?: Pick<FurnitureItem, 'width' | 'depth'>): boolean {
  if (dimensions && Math.abs(dimensions.width - dimensions.depth) > 1e-9) return true
  return !['ceilingLamp', 'wastebasket', 'circularRug', 'lamp', 'tableLamp'].includes(kind)
}

export type OpeningKind = 'door' | 'window' | 'circularWindow' | 'wallShelf' | 'pictureSmall' | 'pictureMedium' | 'pictureLarge' | 'mirrorRectangular' | 'mirrorCircular' | 'wallSconce'

export interface OpeningDefinition {
  name: string
  width: number
  height: number
  defaultBottom: number
  capabilities: ObjectCapabilities
}

const OPENING_DEFINITIONS: Record<OpeningKind, OpeningDefinition> = {
  door: {
    name: 'Puerta',
    width: 1,
    height: 2.1,
    defaultBottom: 0,
    capabilities: {
      attachment: 'wall',
      translation: ['wall-horizontal'],
      rotation: { enabled: false, axis: null, step: null, freeWithShift: false },
      canChangeWall: true,
      removable: false,
    },
  },
  window: {
    name: 'Ventana',
    width: 1.5,
    height: 1,
    defaultBottom: 1,
    capabilities: WALL_OPENING_CAPABILITIES,
  },
  circularWindow: {
    name: 'Ventana circular',
    width: 1,
    height: 1,
    defaultBottom: 1,
    capabilities: WALL_OPENING_CAPABILITIES,
  },
  wallShelf: {
    name: 'Estantería de pared',
    width: 1.25,
    height: 0.75,
    defaultBottom: 1.25,
    capabilities: WALL_OPENING_CAPABILITIES,
  },
  pictureSmall: {
    name: FURNITURE_CATALOG.pictureSmall.base.name,
    width: FURNITURE_CATALOG.pictureSmall.base.width,
    height: FURNITURE_CATALOG.pictureSmall.base.height,
    defaultBottom: 1.25,
    capabilities: WALL_OPENING_CAPABILITIES,
  },
  pictureMedium: {
    name: FURNITURE_CATALOG.pictureMedium.base.name,
    width: FURNITURE_CATALOG.pictureMedium.base.width,
    height: FURNITURE_CATALOG.pictureMedium.base.height,
    defaultBottom: 1.25,
    capabilities: WALL_OPENING_CAPABILITIES,
  },
  pictureLarge: {
    name: FURNITURE_CATALOG.pictureLarge.base.name,
    width: FURNITURE_CATALOG.pictureLarge.base.width,
    height: FURNITURE_CATALOG.pictureLarge.base.height,
    defaultBottom: 1,
    capabilities: WALL_OPENING_CAPABILITIES,
  },
  mirrorRectangular: {
    name: 'Espejo rectangular',
    width: 0.75,
    height: 1.5,
    defaultBottom: 0.75,
    capabilities: WALL_OPENING_CAPABILITIES,
  },
  mirrorCircular: {
    name: 'Espejo circular',
    width: 0.75,
    height: 0.75,
    defaultBottom: 1.25,
    capabilities: WALL_OPENING_CAPABILITIES,
  },
  wallSconce: {
    name: 'Aplique de pared',
    width: 0.5,
    height: 0.5,
    defaultBottom: 1.75,
    capabilities: WALL_OPENING_CAPABILITIES,
  },
}

export const OPENING_CATALOG = Object.fromEntries(Object.entries(OPENING_DEFINITIONS).map(([kind, definition]) => [kind, {
  ...definition, capabilities: { ...definition.capabilities, resize: kind === 'door' ? undefined : openingResizeCapability(kind === 'window' ? 'rectangular' : kind === 'circularWindow' ? 'circular' : kind as WindowShape) },
}])) as Record<OpeningKind, OpeningDefinition>

export function openingKindForShape(shape: WindowShape): Exclude<OpeningKind, 'door'> {
  if (shape === 'rectangular') return 'window'
  if (shape === 'circular') return 'circularWindow'
  return shape
}

export function isWindowShape(value: unknown): value is WindowShape {
  return value === 'rectangular'
    || value === 'circular'
    || value === 'wallShelf'
    || value === 'pictureSmall'
    || value === 'pictureMedium'
    || value === 'pictureLarge'
    || value === 'mirrorRectangular'
    || value === 'mirrorCircular'
    || value === 'wallSconce'
}

export function isWallPictureShape(shape: WindowShape): shape is 'pictureSmall' | 'pictureMedium' | 'pictureLarge' {
  return shape === 'pictureSmall' || shape === 'pictureMedium' || shape === 'pictureLarge'
}

export function isWallPictureKind(kind: FurnitureKind): kind is 'pictureSmall' | 'pictureMedium' | 'pictureLarge' {
  return kind === 'pictureSmall' || kind === 'pictureMedium' || kind === 'pictureLarge'
}

export function isWallMirrorShape(shape: WindowShape): shape is 'mirrorRectangular' | 'mirrorCircular' {
  return shape === 'mirrorRectangular' || shape === 'mirrorCircular'
}

export const OBJECT_CATALOG = {
  furniture: FURNITURE_CATALOG,
  openings: OPENING_CATALOG,
} as const

export const FURNITURE_PRESETS = Object.fromEntries(
  Object.entries(FURNITURE_CATALOG).map(([kind, definition]) => [kind, definition.base]),
) as Record<FurnitureKind, FurnitureDefinition['base']>

export function openingCapabilities(kind: 'door' | 'window') {
  return OPENING_CATALOG[kind].capabilities
}
