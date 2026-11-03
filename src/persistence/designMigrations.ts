import type { PersistedDesign, PersistedDesignV5, SavedDesign } from '../domain/designV1'
import { validateLayouts } from '../domain/designLayouts'
import { isPersistedDesign } from '../domain/designV1'
import { normalizeDesignPreferences, normalizeDesignRoom, normalizeStructurePacks } from '../domain/normalizeDesignV1'
import { arrangeFurniture } from '../domain/editingRules'
import type { FurnitureItem, RoomConfig, WallSide, WindowConfig } from '../domain/types'
import { clampFurnitureElevation, hasFurnitureCollisions, snapToVisibleGrid, validateOpenings } from '../domain/geometry'
import { furnitureAttachment, FURNITURE_PRESETS, isWallPictureKind, isWindowShape, OPENING_CATALOG } from '../domain/objectCatalog'

/** Lectura completa en memoria; la rama antigua conserva su normalización histórica. */
export function normalizeDesignLayouts(value: unknown): PersistedDesignV5 {
  if (!value || typeof value !== 'object') throw new Error('Diseño inválido.')
  if ((value as { version?: unknown }).version !== 5) {
    if (!isPersistedDesign(value)) throw new Error('Versión de diseño no admitida.')
    const room = normalizeDesignRoom(value)
    const structurePacks = normalizeStructurePacks(value.structurePacks, room)
    if (validateOpenings(room)) throw new Error('Aperturas inválidas.')
    const migrated = migrateWallPictures(room, value.furniture)
    const furniture = arrangeFurniture(migrated.remainingFurniture, migrated.room, true)
    if (!furniture) throw new Error('Mobiliario inválido.')
    return migrateDesignLayouts({ ...value, room: migrated.room, structurePacks, furniture, ...normalizeDesignPreferences(value) })
  }
  const errors = validateLayouts(value)
  if (errors.length) throw new Error(errors.join(' '))
  const data = structuredClone(value) as PersistedDesignV5
  const room = data.room
  const finite = (number: unknown): number is number => typeof number === 'number' && Number.isFinite(number)
  const positive = (number: unknown) => finite(number) && number > 0
  const wall = (side: unknown) => ['north', 'east', 'south', 'west'].includes(String(side))
  if (!room || ![room.width, room.depth, room.height].every(positive) || !room.door
    || !wall(room.door.wall) || !finite(room.door.offset) || !finite(room.door.rotation)
    || ![room.door.width, room.door.height].every(positive) || !Array.isArray(room.windows)) throw new Error('Habitación inválida.')
  const ids = new Set(['door'])
  for (const opening of room.windows) {
    if (!opening || typeof opening.id !== 'string' || !opening.id || ids.has(opening.id)
      || !wall(opening.wall) || !isWindowShape(opening.shape)
      || ![opening.offset, opening.sill, opening.rotation].every(finite)
      || ![opening.width, opening.height].every(positive)) throw new Error('Apertura inválida.')
    ids.add(opening.id)
  }
  if (validateOpenings(room)) throw new Error('Aperturas inválidas.')
  for (const layout of data.layouts) {
    const furnitureIds = new Set<string>()
    for (const item of layout.furniture) {
      if (!item || typeof item.id !== 'string' || !item.id || furnitureIds.has(item.id) || ids.has(item.id)
        || !Object.hasOwn(FURNITURE_PRESETS, item.kind) || typeof item.name !== 'string' || typeof item.color !== 'string'
        || (item.attachmentPolicy !== undefined && item.attachmentPolicy !== 'by-type')
        || ![item.x, item.y, item.z, item.rotation].every(finite)
        || ![item.width, item.depth, item.height].every(positive)) throw new Error(`Mobiliario inválido en «${layout.name}».`)
      furnitureIds.add(item.id)
      const attachment = furnitureAttachment(item)
      if ((attachment === 'floor' || attachment === 'ceiling') && Math.abs(item.y - clampFurnitureElevation(item, room, false)) > 1e-9) throw new Error(`Altura incompatible con el anclaje en «${layout.name}».`)
    }
    if (hasFurnitureCollisions(layout.furniture)) throw new Error(`Muebles solapados en «${layout.name}».`)
  }
  return { ...data, structurePacks: normalizeStructurePacks(data.structurePacks, room), ...normalizeDesignPreferences(data) }
}

/** Conversión aislada en memoria; no escribe en almacenamiento ni modifica la entrada. */
export function migrateDesignLayouts(data: PersistedDesign | PersistedDesignV5): PersistedDesignV5 {
  if (data.version === 5) {
    const errors = validateLayouts(data)
    if (errors.length) throw new Error(errors.join(' '))
    return structuredClone(data)
  }
  if (![1, 2, 3, 4].includes(data.version) || !Array.isArray(data.furniture)) throw new Error('Diseño inválido.')
  const copy = structuredClone(data)
  return {
    ...copy,
    version: 5,
    furniture: structuredClone(copy.furniture),
    layouts: [{ id: 'original', name: 'Original', kind: 'original', furniture: structuredClone(copy.furniture) }],
    activeLayoutId: 'original',
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

