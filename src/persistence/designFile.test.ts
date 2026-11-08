import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { persistedDesign, persistedDesignSignature, type SavedDesign } from '../domain/designV1'
import { createRoomStore } from '../state/useRoomStore'
import { cleanExportReferences, DESIGN_FILE_MAX_BYTES, parseDesignFile, serializeDesignFile } from './designFile'
import { normalizeDesign } from './designMigrations'

const makeDesign = (): SavedDesign => ({ id: 'design-1', name: 'Mi habitación', savedAt: '2026-11-04T10:00:00.000Z', data: persistedDesign(createRoomStore().getState()) })
const file = (data: unknown) => JSON.stringify({ format: 'room-builder-design', schemaVersion: 5, exportedAt: '2026-11-04T10:00:00.000Z', design: { id: 'old', name: 'Diseño', savedAt: '2026-11-04T10:00:00.000Z', data } })

test('exportar e importar conserva el diseño editable sin modificar el original', () => {
  const design = makeDesign()
  const original = structuredClone(design)
  const result = parseDesignFile(serializeDesignFile(design))
  assert.equal(persistedDesignSignature(result.design.data), persistedDesignSignature(normalizeDesign(design.data)))
  assert.equal(result.design.name, design.name)
  assert.deepEqual(design, original)
})

test('un diseño con ventana de pack conserva las referencias y se puede importar', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().addWindow('rectangular')
  const id = store.getState().selectedId!
  assert.ok(store.getState().structurePacks[0].windows?.some((window) => window.id === id))
  const design: SavedDesign = { ...makeDesign(), data: persistedDesign(store.getState()) }
  const cleaned = cleanExportReferences(design.data)
  assert.equal(cleaned.omitted, 0)
  assert.equal(cleaned.data.elementFolderAssignments?.[id], design.data.elementFolderAssignments?.[id])
  const loaded = parseDesignFile(serializeDesignFile({ ...design, data: cleaned.data }))
  assert.ok(loaded.design.data.structurePacks?.[0].windows?.some((window) => window.id === id))
})

test('admite diseños históricos v1–v5 y conserva la variante activa de v5', () => {
  for (const path of ['persistence-v1/valid-complete', 'persisted-designs/valid-v2', 'persisted-designs/valid-v3', 'persisted-designs/valid-v4', 'persisted-designs/valid-v5']) {
    const data = JSON.parse(readFileSync(new URL(`../../tests/fixtures/${path}.json`, import.meta.url), 'utf8'))
    const result = parseDesignFile(file(data))
    assert.equal(result.sourceVersion, data.version, path)
    assert.deepEqual(result.design.data.furniture.map((item) => item.id), data.furniture.map((item: { id: string }) => item.id), path)
    if (data.version === 5) assert.equal(result.removedVariants, data.layouts.length - 1)
  }
})

test('rechaza JSON malformado, versiones desconocidas, tamaños excesivos y propiedades peligrosas', () => {
  assert.throws(() => parseDesignFile('{'), /JSON/)
  assert.throws(() => parseDesignFile(' '.repeat(DESIGN_FILE_MAX_BYTES + 1)), /2 MB/)
  const data = makeDesign()
  const payload = JSON.parse(serializeDesignFile(data))
  payload.schemaVersion = 999
  assert.throws(() => parseDesignFile(JSON.stringify(payload)), /formato/)
  assert.throws(() => parseDesignFile('{"__proto__":{"polluted":true}}'), /propiedad/)
  assert.equal(({} as { polluted?: boolean }).polluted, undefined)
})

test('rechaza IDs repetidos, referencias huérfanas y discrepancias de v5 sin escritura', () => {
  const design = makeDesign()
  const duplicate = structuredClone(design)
  duplicate.data.room.windows.push({ ...duplicate.data.room.windows[0] })
  assert.throws(() => parseDesignFile(serializeDesignFile(duplicate)), /identificador|ventana/)
  const orphan = structuredClone(design)
  orphan.data.lockedElementIds = ['no-existe']
  assert.throws(() => parseDesignFile(serializeDesignFile(orphan)), /referencias/)
  const legacy = JSON.parse(readFileSync(new URL('../../tests/fixtures/persisted-designs/valid-v5.json', import.meta.url), 'utf8'))
  legacy.furniture[0].x += 0.1
  assert.throws(() => parseDesignFile(file(legacy)), /no coincide/)
})

test('la copia para exportar elimina referencias obsoletas sin modificar el diseño', () => {
  const design = makeDesign()
  design.data.sceneElementOrder = ['no-existe']
  const result = cleanExportReferences(design.data)
  assert.equal(result.omitted, 1)
  assert.deepEqual(result.data.sceneElementOrder, [])
  assert.deepEqual(design.data.sceneElementOrder, ['no-existe'])
})
