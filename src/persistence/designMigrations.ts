import type { PersistedDesign, SavedDesign } from '../domain/designV1'
import { isPersistedDesign } from '../domain/designV1'
import { normalizeDesignPreferences, normalizeDesignRoom, normalizeStructurePacks } from '../domain/normalizeDesignV1'
import type { FurnitureItem, RoomConfig, WallSide, WindowConfig } from '../domain/types'
import { clampFurnitureElevation, snapToVisibleGrid, validateOpenings } from '../domain/geometry'
import { furnitureAttachment, FURNITURE_PRESETS, isWallPictureKind, isWindowShape, OPENING_CATALOG } from '../domain/objectCatalog'
import { validateAxisLocks } from '../domain/axisLocks'
import { structureDoorsWorldError } from '../domain/structureDoors'
import { structureGridElementId, structureSurfaceElementId } from '../domain/elementIds'
import { BASE_ROOM_SURFACE_IDS, folderSelectionId } from '../domain/elementFolders'

/**
 * Aplana un v5 local de la etapa de variantes a su variante activa.
 * Solo evita perder diseños guardados durante R5.1; la aplicación ya no crea v5.
 */
export function legacyV5ToV4(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 5) return value
  if (!Array.isArray(value.layouts) || typeof value.activeLayoutId !== 'string') throw new Error('Las variantes del diseño no son válidas.')
  const layouts = value.layouts as unknown[]
  const active = layouts.find((layout) => layout && typeof layout === 'object' && !Array.isArray(layout) && (layout as Record<string, unknown>).id === value.activeLayoutId) as Record<string, unknown> | undefined
  if (!active || !Array.isArray(active.furniture) || !Array.isArray(value.furniture)) throw new Error('La variante activa del diseño no es válida.')
  const signature = (data: unknown) => JSON.stringify(data, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item)
  if (signature(active.furniture) !== signature(value.furniture)) throw new Error('El mobiliario no coincide con la variante activa.')
  const furniture = active.furniture
  const { layouts: _layouts, activeLayoutId: _activeLayoutId, ...rest } = value
  return { ...rest, version: 4, furniture }
}

/** Aplana un v5 local de la etapa de variantes a su variante activa. */
export function flattenLegacyV5(data: PersistedDesign): PersistedDesign {
  return legacyV5ToV4(data as unknown as Record<string, unknown>) as unknown as PersistedDesign
}

/** Lectura completa en memoria; no escribe en almacenamiento ni modifica la entrada. */
export function normalizeDesign(value: unknown): PersistedDesign {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Diseño inválido.')
  const source = legacyV5ToV4(value as Record<string, unknown>)
  if (!isPersistedDesign(source)) throw new Error('Versión de diseño no admitida.')
  const room = normalizeDesignRoom(source)
  if (![room.width, room.depth, room.height].every((value) => Number.isFinite(value) && value > 0)) throw new Error('Las dimensiones de la habitación no son válidas.')
  const structurePacks = normalizeStructurePacks(source.structurePacks, room)
  const doorError = structureDoorsWorldError(room, structurePacks)
  if (doorError) throw new Error(doorError)
  const usedIds = new Set(['door', ...BASE_ROOM_SURFACE_IDS, ...room.windows.map((window) => window.id), ...source.furniture.map((item) => item?.id),
    ...(source.elementFolders ?? []).map((folder) => folderSelectionId(folder.id)),
    ...structurePacks.flatMap((pack) => [pack.id, ...pack.surfaces.flatMap((surface) => [structureSurfaceElementId(pack.id, surface.id), structureGridElementId(pack.id, surface.id)])])])
  for (const opening of [...(room.extraDoors ?? []), ...structurePacks.flatMap((pack) => [...(pack.doors ?? []), ...(pack.windows ?? [])])]) {
    if (usedIds.has(opening.id)) throw new Error('Identificador de apertura duplicado.')
    usedIds.add(opening.id)
  }
  if (validateOpenings(room)) throw new Error('Aperturas inválidas.')
  const migrated = migrateWallPictures(room, source.furniture)
  validateAttachment(migrated.remainingFurniture, migrated.room)
  const furniture = migrated.remainingFurniture.map((item) => {
    const preset = FURNITURE_PRESETS[item.kind]
    return { ...item, width: item.width ?? preset?.width, depth: item.depth ?? preset?.depth, height: item.height ?? preset?.height, y: item.y ?? 0 }
  })
  validateFurniture(furniture, migrated.room)
  return { ...source, room: migrated.room, structurePacks, furniture, ...normalizeDesignPreferences(source) }
}

/** Un objeto marcado por tipo no puede guardarse con una altura incompatible con su anclaje. */
function validateAttachment(furniture: FurnitureItem[], room: RoomConfig) {
  for (const item of furniture) {
    if (!item || typeof item !== 'object' || !Object.hasOwn(FURNITURE_PRESETS, item.kind)) throw new Error('Mobiliario inválido.')
    if (item.attachmentPolicy !== undefined && item.attachmentPolicy !== 'by-type') throw new Error('Mobiliario inválido.')
    validateAxisLocks(item.axisLocks)
    const attachment = furnitureAttachment(item)
    if ((attachment === 'floor' || attachment === 'ceiling')
      && typeof item.y === 'number' && Math.abs(item.y - clampFurnitureElevation(item, room, false)) > 1e-9) {
      throw new Error('Altura incompatible con el anclaje.')
    }
  }
}

function validateFurniture(furniture: FurnitureItem[], room: RoomConfig) {
  const usedIds = new Set<string>(['door', ...room.windows.map((window) => window.id)])
  for (const item of furniture) {
    const finite = (number: unknown): number is number => typeof number === 'number' && Number.isFinite(number)
    if (!item || typeof item.id !== 'string' || !item.id || usedIds.has(item.id)
      || !Object.hasOwn(FURNITURE_PRESETS, item.kind) || typeof item.name !== 'string' || typeof item.color !== 'string'
      || (item.attachmentPolicy !== undefined && item.attachmentPolicy !== 'by-type')
      || ![item.x, item.y, item.z, item.rotation].every(finite)
      || ![item.width, item.depth, item.height].every((number) => finite(number) && number > 0)) throw new Error('Mobiliario inválido.')
    usedIds.add(item.id)
  }
}

export function migrateLegacyDesign(data: PersistedDesign, id: string, savedAt: string): SavedDesign[] {
  return [{ id, name: 'Diseño guardado anteriormente', savedAt, data }]
}

export function migrateWallPictures(room: RoomConfig, furniture: FurnitureItem[]) {
  const windows = [...room.windows]
  const remainingFurniture: FurnitureItem[] = []
  const preferredWallFor = (item: FurnitureItem): { wall: WallSide; offset: number } => {
    const distances: { wall: WallSide; distance: number; offset: number }[] = [
      { wall: 'north', distance: Math.abs(item.z + room.depth / 2), offset: item.x },
      { wall: 'east', distance: Math.abs(item.x - room.width / 2), offset: item.z },
      { wall: 'south', distance: Math.abs(item.z - room.depth / 2), offset: -item.x },
      { wall: 'west', distance: Math.abs(item.x + room.width / 2), offset: -item.z },
    ]
    const preferred = distances.sort((a, b) => a.distance - b.distance)[0]
    return { wall: preferred.wall, offset: snapToVisibleGrid(preferred.offset) }
  }
  const offsets = [0, -0.5, 0.5, -1, 1, -1.5, 1.5, -2, 2]

  furniture.forEach((item) => {
    validateAxisLocks(item?.axisLocks)
    const legacyMirror = String(item.kind) === 'mirror'
    if (!isWallPictureKind(item.kind) && !legacyMirror) {
      remainingFurniture.push(item)
      return
    }
    const preferred = preferredWallFor(item)
    const shape = isWallPictureKind(item.kind) ? item.kind : 'mirrorRectangular'
    const definition = OPENING_CATALOG[shape]
    const walls = [preferred.wall, ...(['north', 'east', 'south', 'west'] as WallSide[]).filter((wall) => wall !== preferred.wall)]
    let placed = false

    for (const wall of walls) {
      const candidates = [preferred.offset, ...offsets.filter((offset) => offset !== preferred.offset)]
      for (const offset of candidates) {
        const picture: WindowConfig = {
          ...(item.axisLocks ? { axisLocks: { ...item.axisLocks } } : {}),
          id: item.id,
          shape,
          wall,
          offset,
          width: definition.width,
          height: definition.height,
          sill: definition.defaultBottom,
          rotation: 0,
          color: item.color,
        }
        const candidateRoom = { ...room, windows: [...windows, picture] }
        if (validateOpenings(candidateRoom)) continue
        windows.push(picture)
        placed = true
        break
      }
      if (placed) break
    }

    if (!placed) remainingFurniture.push(item)
  })

  return { room: { ...room, windows }, remainingFurniture }
}
