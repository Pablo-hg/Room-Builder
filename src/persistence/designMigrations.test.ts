import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { DEFAULT_ROOM } from '../domain/constants'
import { FURNITURE_PRESETS } from '../domain/objectCatalog'
import type { FurnitureItem } from '../domain/types'
import { migrateLegacyDesign, migrateWallPictures, normalizeDesign } from './designMigrations'
import { persistedDesignSignature } from '../domain/designV1'

test('normaliza fixtures v1–v4 de forma determinista sin perder preferencias ni modificar la fuente', () => {
  for (const path of ['persistence-v1/valid-complete', 'persistence-v1/valid-legacy-optional-fields', 'persistence-v1/valid-boundary', 'persisted-designs/valid-v2', 'persisted-designs/valid-v3', 'persisted-designs/valid-v4']) {
    const data = JSON.parse(readFileSync(new URL(`../../tests/fixtures/${path}.json`, import.meta.url), 'utf8'))
    const before = structuredClone(data)
    const normalized = normalizeDesign(data)
    assert.deepEqual(data, before)
    assert.deepEqual(normalizeDesign(data), normalized)
    assert.deepEqual(normalizeDesign(normalized), normalized)
    assert.deepEqual(normalized.furniture.map((item) => item.id), data.furniture.map((item: FurnitureItem) => item.id))
    if (data.version >= 3) assert.deepEqual(normalized.elementFolders, data.elementFolders)
    if (data.version >= 4) assert.deepEqual(normalized.sceneElementOrder, data.sceneElementOrder)
  }
})

test('aplana un v5 antiguo de variantes a su variante activa y lo guarda como v4', () => {
  const legacy = JSON.parse(readFileSync(new URL('../../tests/fixtures/persisted-designs/valid-v5.json', import.meta.url), 'utf8'))
  const before = structuredClone(legacy)
  const normalized = normalizeDesign(legacy)
  assert.equal(normalized.version, 4)
  assert.equal('layouts' in normalized, false)
  assert.equal('activeLayoutId' in normalized, false)
  assert.deepEqual(normalized.furniture.map((item) => item.id), legacy.furniture.map((item: FurnitureItem) => item.id))
  assert.deepEqual(normalized.sceneElementOrder, legacy.sceneElementOrder)
  assert.deepEqual(legacy, before)
})

test('rechaza un v5 cuyo espejo no coincide y no modifica los datos guardados', () => {
  const legacy = JSON.parse(readFileSync(new URL('../../tests/fixtures/persisted-designs/valid-v5.json', import.meta.url), 'utf8'))
  legacy.furniture[0].x += 0.25
  const before = structuredClone(legacy)
  assert.throws(() => normalizeDesign(legacy), /no coincide/)
  assert.deepEqual(legacy, before)
  legacy.activeLayoutId = 'inexistente'
  assert.throws(() => normalizeDesign(legacy), /variante activa/)
})

test('valida el mobiliario y la firma sigue el contenido del diseño', () => {
  const data = {
    version: 4 as const,
    room: structuredClone(DEFAULT_ROOM),
    furniture: [{ ...FURNITURE_PRESETS.chair, id: 'chair', x: 0, y: 0, z: 0, rotation: 0 }],
    gridSnap: true,
  }
  const originalSignature = persistedDesignSignature(data)
  const changed = structuredClone(data)
  changed.furniture[0].color = '#111111'
  assert.notEqual(persistedDesignSignature(changed), originalSignature)
  for (const change of [(item: FurnitureItem) => { item.id = 'door' }, (item: FurnitureItem) => { item.kind = 'unknown' as FurnitureItem['kind'] }]) {
    const invalid = structuredClone(data)
    change(invalid.furniture[0])
    assert.throws(() => normalizeDesign(invalid))
  }
  const duplicate = structuredClone(data)
  duplicate.furniture.push({ ...duplicate.furniture[0] })
  assert.throws(() => normalizeDesign(duplicate))
  assert.throws(() => normalizeDesign({ ...data, room: { ...data.room, height: NaN } }))
  const unknownPolicy = structuredClone(data) as unknown as { furniture: Array<Record<string, unknown>> }
  unknownPolicy.furniture[0].attachmentPolicy = 'unknown'
  assert.throws(() => normalizeDesign(unknownPolicy))
  const mismatchedAttachment = structuredClone(data) as unknown as { furniture: Array<Record<string, unknown>> }
  mismatchedAttachment.furniture[0] = { ...FURNITURE_PRESETS.rug, id: 'rug', x: 0, y: 1, z: 0, rotation: 0, attachmentPolicy: 'by-type' }
  assert.throws(() => normalizeDesign(mismatchedAttachment), /anclaje/)
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
