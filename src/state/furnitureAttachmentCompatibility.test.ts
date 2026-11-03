import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from '../domain/constants'
import { persistedDesign, type PersistedDesign, type SavedDesign } from '../domain/designV1'
import { canElevateFurniture, FURNITURE_PRESETS } from '../domain/objectCatalog'
import { migrateDesignLayouts, normalizeDesignLayouts } from '../persistence/designMigrations'
import { migrateDesignToProject, projectToPersistedDesignV1 } from '../persistence/projectMigration'
import { createRoomStore } from './useRoomStore'

function legacyData(version: 1 | 2 | 3 | 4 | 5): PersistedDesign {
  const data = {
    version: version === 5 ? 4 as const : version,
    room: structuredClone(DEFAULT_ROOM), gridSnap: true,
    furniture: [
      { ...FURNITURE_PRESETS.rug, id: 'legacy-rug', x: -1.5, y: 0.73, z: 0, rotation: 0 },
      { ...FURNITURE_PRESETS.ceilingLamp, id: 'legacy-ceiling', x: 1.5, y: 1.03, z: 0, rotation: 0 },
    ],
  }
  return version === 5 ? migrateDesignLayouts(data) : data
}

test('v1–v5 sin marca conservan alturas y libertad; el diseño mixto conserva la distinción al recargar', () => {
  for (const version of [1, 2, 3, 4, 5] as const) {
    const data = legacyData(version)
    let writes = 0
    let saved: SavedDesign[] = [{ id: 'saved', name: 'Mixto', savedAt: '2026-11-03T10:00:00.000Z', data }]
    const before = structuredClone(saved)
    const repository = { read: () => structuredClone(saved), write: (entries: SavedDesign[]) => { writes++; saved = structuredClone(entries) } }
    const store = createRoomStore(repository)
    store.getState().initializeSavedDesigns()
    store.getState().loadDesign('saved')
    assert.equal(writes, 0)
    assert.deepEqual(saved, before)
    assert.deepEqual(store.getState().furniture.map((item) => item.y), [0.73, 1.03])
    assert.ok(store.getState().furniture.every(canElevateFurniture))
    store.getState().setWallColor('#abcdef')
    assert.deepEqual(store.getState().furniture.map((item) => item.y), [0.73, 1.03])
    store.getState().addFurniture('rug')
    const newRug = store.getState().selectedId!
    store.getState().addFurniture('ceilingLamp')
    const newCeiling = store.getState().selectedId!
    assert.equal(store.getState().furniture.find((item) => item.id === newRug)!.y, 0)
    assert.equal(store.getState().furniture.find((item) => item.id === newCeiling)!.y, DEFAULT_ROOM.height - FURNITURE_PRESETS.ceilingLamp.height)
    store.getState().duplicateActiveLayout()
    store.getState().saveDesign()
    const restored = createRoomStore(repository)
    restored.getState().initializeSavedDesigns()
    restored.getState().loadDesign('saved')
    assert.equal(restored.getState().layouts.length, 2)
    assert.deepEqual(persistedDesign(restored.getState()), persistedDesign(store.getState()))
    for (const item of restored.getState().furniture) {
      assert.equal(canElevateFurniture(item), item.id.startsWith('legacy-'))
      assert.equal(item.attachmentPolicy, item.id.startsWith('legacy-') ? undefined : 'by-type')
    }
    restored.getState().moveFurnitureVertically('legacy-rug', 1.25)
    assert.equal(restored.getState().furniture.find((item) => item.id === 'legacy-rug')!.y, 1.25)
    restored.getState().moveFurnitureVertically(newRug, 1)
    assert.equal(restored.getState().furniture.find((item) => item.id === newRug)!.y, 0)
    restored.getState().setDimension('height', 3.5)
    assert.equal(restored.getState().furniture.find((item) => item.id === 'legacy-ceiling')!.y, 1.03)
    assert.equal(restored.getState().furniture.find((item) => item.id === newCeiling)!.y, 3.5 - FURNITURE_PRESETS.ceilingLamp.height)
    const project = migrateDesignToProject(saved[0])
    for (const layout of project.layouts) assert.deepEqual(projectToPersistedDesignV1(project, layout.id).furniture, saved[0].data.version === 5 ? saved[0].data.layouts.find((candidate) => candidate.id === layout.id)!.furniture : [])
  }
})

test('pegar crea un objeto nuevo con anclaje; duplicar variante conserva los objetos antiguos', () => {
  const data = legacyData(5)
  const store = createRoomStore({ read: () => [{ id: 'saved', name: 'Antes', savedAt: '', data }], write: () => {} })
  store.getState().initializeSavedDesigns()
  store.getState().loadDesign('saved')
  store.getState().selectElement('legacy-rug')
  assert.equal(store.getState().copySelected(), true)
  store.getState().pasteSelected()
  const pasted = store.getState().furniture.find((item) => item.id === store.getState().selectedId)!
  assert.equal(pasted.attachmentPolicy, 'by-type')
  assert.equal(pasted.y, 0)
  assert.equal(store.getState().furniture.find((item) => item.id === 'legacy-rug')!.y, 0.73)
  store.getState().selectSceneListItem('legacy-rug', 'single', ['legacy-rug', 'legacy-ceiling'])
  store.getState().selectSceneListItem('legacy-ceiling', 'toggle', ['legacy-rug', 'legacy-ceiling'])
  store.getState().copySelected()
  store.getState().pasteSelected()
  const copies = store.getState().furniture.filter((item) => store.getState().selectedIds.includes(item.id))
  assert.equal(copies.length, 2)
  assert.ok(copies.every((item) => item.attachmentPolicy === 'by-type'))
})

test('v5 rechaza marcas desconocidas y anclajes incoherentes sin mutar la entrada', () => {
  const data = migrateDesignLayouts(legacyData(4))
  const invalid = structuredClone(data)
  const item = invalid.layouts[0].furniture[0]
  item.attachmentPolicy = 'by-type'
  invalid.furniture = structuredClone(invalid.layouts[0].furniture)
  const before = structuredClone(invalid)
  assert.throws(() => normalizeDesignLayouts(invalid), /anclaje/)
  assert.deepEqual(invalid, before)
  const malformed = JSON.parse(JSON.stringify(data))
  malformed.layouts[0].furniture[0].attachmentPolicy = 'unknown'
  malformed.furniture = structuredClone(malformed.layouts[0].furniture)
  assert.throws(() => normalizeDesignLayouts(malformed), /Mobiliario inválido/)
})
