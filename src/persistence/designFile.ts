import { BASE_ROOM_SURFACE_IDS, folderSelectionId } from '../domain/elementFolders'
import { structureGridElementId, structureSurfaceElementId } from '../domain/elementIds'
import { furnitureAttachment, FURNITURE_PRESETS, isWindowShape, OPENING_CATALOG } from '../domain/objectCatalog'
import { clampFurnitureElevation, validateOpenings } from '../domain/geometry'
import type { PersistedDesign, SavedDesign } from '../domain/designV1'
import { normalizeDesign } from './designMigrations'

export const DESIGN_FILE_MAX_BYTES = 2 * 1024 * 1024
const FORMAT = 'room-builder-design'
const SCHEMA_VERSION = 5

type RecordValue = Record<string, unknown>
export interface DesignFilePreview { design: SavedDesign; sourceVersion: number; removedVariants: number }

/** Omite únicamente referencias a elementos que ya no existen; no modifica el diseño abierto. */
export function cleanExportReferences(input: PersistedDesign): { data: PersistedDesign; omitted: number } {
  const data = structuredClone(input)
  const valid = new Set<string>(['door', ...BASE_ROOM_SURFACE_IDS, ...data.furniture.map((item) => item.id), ...data.room.windows.map((item) => item.id)])
  for (const pack of data.structurePacks ?? []) {
    valid.add(pack.id)
    for (const surface of pack.surfaces) {
      valid.add(structureSurfaceElementId(pack.id, surface.id))
      valid.add(structureGridElementId(pack.id, surface.id))
    }
  }
  const folders = new Set((data.elementFolders ?? []).map((folder) => folder.id))
  folders.forEach((id) => valid.add(folderSelectionId(id)))
  let omitted = 0
  for (const field of ['hiddenElementIds', 'lockedElementIds', 'sceneElementOrder'] as const) {
    const values = data[field]
    if (!values) continue
    const seen = new Set<string>()
    data[field] = values.filter((id) => {
      if (!valid.has(id) || seen.has(id)) { omitted++; return false }
      seen.add(id)
      return true
    })
  }
  if (data.elementFolderAssignments) {
    data.elementFolderAssignments = Object.fromEntries(Object.entries(data.elementFolderAssignments).filter(([id, folder]) => {
      if (!valid.has(id) || !folders.has(folder)) { omitted++; return false }
      return true
    }))
  }
  return { data, omitted }
}
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
// Limita geometrías extremas que podrían saturar la escena al abrir el archivo.
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10_000
const positive = (value: unknown) => finite(value) && value > 0 && value <= 100
const wall = (value: unknown) => typeof value === 'string' && ['north', 'east', 'south', 'west'].includes(value)
const optionalString = (value: unknown) => value === undefined || typeof value === 'string'
const optionalName = (value: unknown, limit: number) => value === undefined || (typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= limit)
const invalid = (message: string): never => { throw new Error(message) }

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => object(entry)
    ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
    : entry)
}

function validateSafeTree(value: unknown) {
  const pending = [{ value, depth: 0 }]
  let count = 0
  while (pending.length) {
    const current = pending.pop()!
    if (++count > 100_000 || current.depth > 32) invalid('El archivo es demasiado complejo.')
    if (typeof current.value === 'number' && !Number.isFinite(current.value)) invalid('El archivo contiene números no válidos.')
    if (!current.value || typeof current.value !== 'object') continue
    for (const [key, child] of Object.entries(current.value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) invalid('El archivo contiene una propiedad no admitida.')
      pending.push({ value: child, depth: current.depth + 1 })
    }
  }
}

function validateFurniture(value: unknown, room: RecordValue, occupied: Set<string>): void {
  if (!Array.isArray(value)) invalid('La lista de muebles no es válida.')
  const ids = new Set(occupied)
  for (const item of value as unknown[]) {
    if (!object(item) || !text(item.id) || ids.has(item.id) || !text(item.kind)
      || !Object.hasOwn(FURNITURE_PRESETS, item.kind) || !text(item.name) || typeof item.color !== 'string'
      || ![item.x, item.y, item.z, item.rotation].every(finite)
      || ![item.width, item.height, item.depth].every(positive)
      || (item.attachmentPolicy !== undefined && item.attachmentPolicy !== 'by-type')) invalid('Hay un mueble con datos o identificador no válidos.')
    ids.add((item as RecordValue).id as string)
    const furniture = item as unknown as PersistedDesign['furniture'][number]
    const attachment = furnitureAttachment(furniture)
    if ((attachment === 'floor' || attachment === 'ceiling') && Math.abs(furniture.y - clampFurnitureElevation(furniture, room as unknown as PersistedDesign['room'], false)) > 1e-9) invalid('Un mueble no respeta su anclaje.')
  }
}

function validateData(value: unknown): { data: PersistedDesign; sourceVersion: number; removedVariants: number } {
  if (!object(value) || ![1, 2, 3, 4, 5].includes(Number(value.version)) || typeof value.version !== 'number') invalid('La versión del diseño no es compatible.')
  const source = value as RecordValue
  if (!object(source.room)) invalid('Falta la habitación.')
  const room = source.room as RecordValue
  if (![room.width, room.depth, room.height].every(positive) || !object(room.door) || !Array.isArray(room.windows)) invalid('La habitación tiene medidas o aperturas no válidas.')
  if (!optionalString(room.wallColor) || !optionalString(room.floorColor)
    || (room.wallColors !== undefined && (!object(room.wallColors) || Object.entries(room.wallColors).some(([key, value]) => !wall(key) || typeof value !== 'string')))) invalid('Los colores de la habitación no son válidos.')
  const door = room.door as RecordValue
  if (!wall(door.wall) || ![door.offset, door.rotation].every(finite) || ![door.width, door.height].every(positive)
    || !optionalString(door.color) || !optionalName(door.name, 80)
    || door.width !== OPENING_CATALOG.door.width || door.height !== OPENING_CATALOG.door.height || door.rotation !== 0) invalid('La puerta contiene medidas o datos que no se pueden conservar.')
  const occupied = new Set<string>(['door', ...BASE_ROOM_SURFACE_IDS])
  for (const opening of room.windows as unknown[]) {
    if (!object(opening) || !text(opening.id) || occupied.has(opening.id) || !wall(opening.wall)
      || !isWindowShape(opening.shape) || ![opening.offset, opening.sill, opening.rotation].every(finite)
      || ![opening.width, opening.height].every(positive) || !optionalString(opening.color) || !optionalName(opening.name, 80)) invalid('Hay una ventana o elemento mural no válido.')
    if (object(opening) && (opening.shape === 'circular' || opening.shape === 'mirrorCircular') && opening.width !== opening.height) invalid('Una apertura circular tiene medidas incompatibles.')
    occupied.add((opening as RecordValue).id as string)
  }
  const packs = source.structurePacks === undefined ? [] : source.structurePacks
  if (!Array.isArray(packs)) invalid('La estructura no es válida.')
  for (const pack of packs as unknown[]) {
    if (!object(pack) || !text(pack.id) || occupied.has(pack.id) || !text(pack.name)
      || ![pack.x, pack.y, pack.z].every(finite) || !Array.isArray(pack.surfaces)) invalid('Hay una estructura no válida.')
    const p = pack as RecordValue
    occupied.add(p.id as string)
    const surfaceIds = new Set<string>()
    for (const surface of p.surfaces as unknown[]) {
      if (!object(surface) || !text(surface.id) || surfaceIds.has(surface.id) || !text(surface.name) || typeof surface.color !== 'string'
        || ![surface.x, surface.y, surface.z, surface.rotation].every(finite)
        || ![surface.width, surface.height, surface.depth].every(positive)) invalid('Hay una superficie no válida.')
      surfaceIds.add((surface as RecordValue).id as string)
      const surfaceId = structureSurfaceElementId(p.id as string, (surface as RecordValue).id as string)
      const gridId = structureGridElementId(p.id as string, (surface as RecordValue).id as string)
      if (occupied.has(surfaceId) || occupied.has(gridId)) invalid('Hay identificadores de estructura duplicados.')
      occupied.add(surfaceId)
      occupied.add(gridId)
    }
  }
  const structureIds = new Set(occupied)
  validateFurniture(source.furniture, room, structureIds)
  const furniture = source.furniture as Array<RecordValue>
  furniture.forEach((item) => occupied.add(item.id as string))
  let removedVariants = 0
  if (source.version === 5) {
    if (!Array.isArray(source.layouts) || !text(source.activeLayoutId) || !source.layouts.length) invalid('Las variantes antiguas no son válidas.')
    const layouts = source.layouts as Array<RecordValue>
    const ids = new Set<string>()
    let originalCount = 0
    for (const layout of layouts) {
      if (!object(layout) || !text(layout.id) || ids.has(layout.id) || !text(layout.name) || !['original', 'alternative'].includes(String(layout.kind))) invalid('Hay una variante antigua no válida.')
      ids.add(layout.id as string)
      if (layout.kind === 'original') originalCount++
      validateFurniture(layout.furniture, room, structureIds)
    }
    const active = layouts.find((layout) => layout.id === source.activeLayoutId)
    if (originalCount !== 1 || !active || canonical(active.furniture) !== canonical(source.furniture)) invalid('La variante activa no coincide con el mobiliario del diseño.')
    removedVariants = layouts.length - 1
  }
  if (typeof source.gridSnap !== 'boolean') invalid('La configuración de cuadrícula no es válida.')
  if (source.gridVisibility !== undefined && (!object(source.gridVisibility) || Object.entries(source.gridVisibility).some(([key, v]) => !['floor', 'north', 'east', 'south', 'west'].includes(key) || typeof v !== 'boolean'))) invalid('La visibilidad de cuadrícula no es válida.')
  const folders = source.elementFolders === undefined ? [] : source.elementFolders
  if (!Array.isArray(folders)) invalid('Las carpetas no son válidas.')
  const folderIds = new Set<string>()
  for (const folder of folders as unknown[]) {
    if (!object(folder) || !text(folder.id) || !optionalName(folder.name, 48) || folder.name === undefined || folderIds.has(folder.id) || (folder.parentId !== undefined && !text(folder.parentId))) invalid('Hay una carpeta no válida.')
    folderIds.add((folder as RecordValue).id as string)
  }
  const foldersById = new Map((folders as Array<RecordValue>).map((folder) => [folder.id as string, folder]))
  const checkedFolders = new Set<string>()
  for (const folder of folders as Array<RecordValue>) {
    const visited = new Set([folder.id as string])
    let parent = folder.parentId
    while (parent !== undefined && !checkedFolders.has(parent as string)) {
      if (typeof parent !== 'string' || !folderIds.has(parent) || visited.has(parent)) invalid('La jerarquía de carpetas no es válida.')
      visited.add(parent as string)
      parent = foldersById.get(parent as string)?.parentId
    }
    visited.forEach((id) => checkedFolders.add(id))
    const selectionId = folderSelectionId(folder.id as string)
    if (occupied.has(selectionId)) invalid('Hay identificadores de carpeta duplicados.')
    occupied.add(selectionId)
  }
  const assignments = source.elementFolderAssignments
  if (assignments !== undefined && (!object(assignments) || Object.entries(assignments).some(([id, folder]) => !occupied.has(id) || typeof folder !== 'string' || !folderIds.has(folder)))) invalid('Las asignaciones de carpetas no son válidas.')
  for (const field of ['hiddenElementIds', 'lockedElementIds', 'sceneElementOrder']) {
    const list = source[field]
    if (list !== undefined && (!Array.isArray(list) || list.some((id) => typeof id !== 'string' || !occupied.has(id)) || new Set(list).size !== list.length)) invalid('Hay referencias de elementos no válidas.')
  }
  let data: PersistedDesign
  try { data = normalizeDesign(source) } catch { return invalid('El diseño contiene geometría o datos no válidos.') }
  if (validateOpenings(data.room)) invalid('Las aperturas no son válidas.')
  return { data, sourceVersion: source.version as number, removedVariants }
}

export function parseDesignFile(contents: string): DesignFilePreview {
  if (new TextEncoder().encode(contents).length > DESIGN_FILE_MAX_BYTES) invalid('El archivo supera el límite de 2 MB.')
  let parsed: unknown
  try { parsed = JSON.parse(contents) } catch { return invalid('El archivo no contiene JSON válido.') }
  validateSafeTree(parsed)
  if (!object(parsed) || parsed.format !== FORMAT || parsed.schemaVersion !== SCHEMA_VERSION || !text(parsed.exportedAt) || !object(parsed.design)) invalid('El archivo no tiene un formato compatible de Room Builder.')
  const design = (parsed as RecordValue).design as RecordValue
  if (!text(design.id) || !text(design.name) || !text(design.savedAt)) invalid('Los datos del diseño no son válidos.')
  const { data, sourceVersion, removedVariants } = validateData(design.data)
  return { design: { id: design.id as string, name: design.name as string, savedAt: design.savedAt as string, data }, sourceVersion, removedVariants }
}

export function serializeDesignFile(design: SavedDesign): string {
  return JSON.stringify({ format: FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), design }, null, 2)
}
