import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { DEFAULT_ROOM } from '../domain/constants'
import { FURNITURE_PRESETS } from '../domain/objectCatalog'
import type { FurnitureItem } from '../domain/types'
import { migrateDesignLayouts, migrateLegacyDesign, migrateWallPictures, normalizeDesignLayouts } from './designMigrations'
import { validateLayouts } from '../domain/designLayouts'
import { persistedDesignSignature } from '../domain/designV1'

test('normaliza fixtures v1–v5 de forma determinista sin perder preferencias ni modificar la fuente', () => {
  for (const path of ['persistence-v1/valid-complete', 'persistence-v1/valid-legacy-optional-fields', 'persistence-v1/valid-boundary', 'layout-variants/valid-v2', 'layout-variants/valid-v3', 'layout-variants/valid-v4', 'layout-variants/valid-v5']) {
    const data = JSON.parse(readFileSync(new URL(`../../tests/fixtures/${path}.json`, import.meta.url), 'utf8'))
    const before = structuredClone(data)
    const normalized = normalizeDesignLayouts(data)
    assert.deepEqual(data, before)
    assert.deepEqual(normalizeDesignLayouts(data), normalized)
    assert.deepEqual(normalizeDesignLayouts(normalized), normalized)
    assert.deepEqual(normalized.furniture.map((item) => item.id), data.furniture.map((item: FurnitureItem) => item.id))
    if (data.version >= 3) assert.deepEqual(normalized.elementFolders, data.elementFolders)
    if (data.version >= 4) assert.deepEqual(normalized.sceneElementOrder, data.sceneElementOrder)
    if (data.version === 5) assert.equal(normalized.activeLayoutId, 'alternative-a')
    else assert.equal(normalized.layouts.length, 1)
  }
})

test('valida también mobiliario inactivo y la firma incluye ambas variantes y la activa', () => {
  const data = JSON.parse(readFileSync(new URL('../../tests/fixtures/layout-variants/valid-v5.json', import.meta.url), 'utf8'))
  const originalSignature = persistedDesignSignature(data)
  const changed = structuredClone(data)
  changed.layouts[0].furniture[0].color = '#111111'
  assert.notEqual(persistedDesignSignature(changed), originalSignature)
  assert.notEqual(persistedDesignSignature({ ...data, activeLayoutId: 'original' }), originalSignature)
  for (const change of [(item: FurnitureItem) => { item.x = Infinity }, (item: FurnitureItem) => { item.width = 0 }, (item: FurnitureItem) => { item.id = 'door' }]) {
    const invalid = structuredClone(data)
    change(invalid.layouts[0].furniture[0])
    assert.throws(() => normalizeDesignLayouts(invalid))
  }
  const duplicate = structuredClone(data)
  duplicate.layouts[0].furniture.push({ ...duplicate.layouts[0].furniture[0] })
  assert.throws(() => normalizeDesignLayouts(duplicate))
  assert.throws(() => normalizeDesignLayouts({ ...data, room: { ...data.room, height: NaN } }))
})

test('convierte v1–v4 en Original en memoria sin mutar datos ni compartir muebles', () => {
  for (const version of [1, 2, 3, 4] as const) {
    const data = { version, room: structuredClone(DEFAULT_ROOM), furniture: [{ ...FURNITURE_PRESETS.chair, id: 'chair', x: 0, y: 0, z: 0, rotation: 0 }], gridSnap: true }
    const before = structuredClone(data)
    const result = migrateDesignLayouts(data)
    assert.equal(result.version, 5)
    assert.equal(result.activeLayoutId, 'original')
    assert.deepEqual(result.layouts[0].furniture, data.furniture)
    assert.notEqual(result.layouts[0].furniture, result.furniture)
    assert.deepEqual(validateLayouts(result), [])
    assert.deepEqual(migrateDesignLayouts(data), result)
    assert.deepEqual(data, before)
    result.layouts[0].furniture[0].x = 10
    assert.equal(data.furniture[0].x, 0)
    assert.equal(result.furniture[0].x, 0)
  }
})

test('valida v5 antes de clonarlo y rechaza un espejo discrepante', () => {
  const v5 = migrateDesignLayouts({ version: 1, room: structuredClone(DEFAULT_ROOM), furniture: [], gridSnap: true })
  assert.deepEqual(migrateDesignLayouts(v5), v5)
  assert.notEqual(migrateDesignLayouts(v5).layouts, v5.layouts)
  assert.throws(() => migrateDesignLayouts({ ...v5, furniture: [{ ...FURNITURE_PRESETS.chair, id: 'c', x: 0, y: 0, z: 0, rotation: 0 }] }), /no coincide/)
})

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
