import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from '../domain/constants'
import { FURNITURE_PRESETS } from '../domain/objectCatalog'
import type { FurnitureItem } from '../domain/types'
import { migrateLegacyDesign, migrateWallPictures } from './designMigrations'

test('la migración legacy es pura y conserva los datos y metadatos recibidos', () => {
  const data = { version: 1 as const, room: structuredClone(DEFAULT_ROOM), furniture: [], gridSnap: true }
  const before = structuredClone(data)
  const migrated = migrateLegacyDesign(data, 'design-old', '2026-10-28')
  assert.deepEqual(migrated, [{ id: 'design-old', name: 'Diseño guardado anteriormente', savedAt: '2026-10-28', data }])
  assert.equal(migrated[0].data, data)
  assert.deepEqual(data, before)
})

test('migra cuadros y espejo antiguos a paredes conservando IDs, colores y muebles restantes', () => {
  const room = { ...structuredClone(DEFAULT_ROOM), windows: [] }
  const furniture: FurnitureItem[] = (['pictureSmall', 'pictureMedium', 'pictureLarge', 'mirror'] as const).map((kind, index) => ({
    ...FURNITURE_PRESETS.pictureSmall, kind, id: `old:${index}`, x: -1 + index * 0.5, y: 0, z: -room.depth / 2, rotation: 0,
  } as FurnitureItem))
  const chair = { ...FURNITURE_PRESETS.chair, id: 'chair', x: 0, y: 0, z: 0, rotation: 0 }
  furniture.push(chair)
  const before = structuredClone({ room, furniture })
  const migrated = migrateWallPictures(room, furniture)
  assert.deepEqual(migrated.room.windows.map((window) => window.id), ['old:0', 'old:1', 'old:2', 'old:3'])
  assert.deepEqual(migrated.room.windows.map((window) => window.shape), ['pictureSmall', 'pictureMedium', 'pictureLarge', 'mirrorRectangular'])
  assert.ok(migrated.room.windows.every((window) => window.color === FURNITURE_PRESETS.pictureSmall.color))
  assert.equal(migrated.remainingFurniture[0], chair)
  assert.deepEqual(migrateWallPictures(migrated.room, migrated.remainingFurniture), migrated)
  assert.deepEqual({ room, furniture }, before)
})

test('si no hay pared válida la migración conserva el cuadro en mobiliario sin pérdida', () => {
  const room = { ...structuredClone(DEFAULT_ROOM), width: 0.1, depth: 0.1, height: 0.1 }
  const picture = { ...FURNITURE_PRESETS.pictureLarge, id: 'unplaced', x: 0, y: 0, z: 0, rotation: 0 }
  const migrated = migrateWallPictures(room, [picture])
  assert.deepEqual(migrated.room, room)
  assert.equal(migrated.remainingFurniture[0], picture)
})
