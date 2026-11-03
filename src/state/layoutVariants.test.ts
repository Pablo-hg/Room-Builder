import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ensureOriginalLayout } from '../domain/designLayouts'
import { persistedDesign, type SavedDesign } from '../domain/designV1'
import { FURNITURE_PRESETS } from '../domain/objectCatalog'
import { createRoomStore } from './useRoomStore'

function memoryRepository(initial: SavedDesign[] = []) {
  let saved = structuredClone(initial)
  let writes = 0
  return { read: () => structuredClone(saved), write: (designs: SavedDesign[]) => { writes++; saved = structuredClone(designs) }, writes: () => writes }
}

test('variantes aíslan ediciones y el historial restaura ambas y la activa', () => {
  const store = createRoomStore(memoryRepository())
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  const before = store.getState().undoCount
  store.getState().duplicateActiveLayout()
  const alternative = store.getState().activeLayoutId
  store.getState().setFurnitureColor(id, '#abcdef')
  store.getState().activateLayout('original')
  assert.notEqual(store.getState().furniture[0].color, '#abcdef')
  assert.equal(store.getState().undoCount, before + 3)
  store.getState().undo()
  assert.equal(store.getState().activeLayoutId, alternative)
  assert.equal(store.getState().furniture[0].color, '#abcdef')
  store.getState().undo()
  assert.notEqual(store.getState().furniture[0].color, '#abcdef')
  store.getState().redo()
  assert.equal(store.getState().furniture[0].color, '#abcdef')
  store.getState().duplicateActiveLayout()
  assert.equal(store.getState().layouts.length, 2)
  for (let index = 0; index < 60; index++) store.getState().activateLayout(index % 2 ? alternative : 'original')
  assert.equal(store.getState().undoCount, 50)
})

test('alternar filtra selección y ancla, conserva cámara y portapapeles, pegar genera otro ID', () => {
  const store = createRoomStore(memoryRepository())
  store.getState().addFurniture('chair')
  const sharedId = store.getState().selectedId!
  store.getState().duplicateActiveLayout()
  store.getState().addFurniture('table')
  const newId = store.getState().selectedId!
  assert.equal(store.getState().copySelected(), true)
  store.getState().selectSceneListItem(sharedId, 'toggle', [sharedId, newId])
  store.getState().setView('top')
  store.getState().setTopCameraPosition(1, 2)
  const camera = [store.getState().view, store.getState().topCameraX, store.getState().topCameraZ]
  store.getState().activateLayout('original')
  assert.deepEqual(store.getState().selectedIds, [sharedId])
  assert.equal(store.getState().selectionAnchor, sharedId)
  assert.deepEqual([store.getState().view, store.getState().topCameraX, store.getState().topCameraZ], camera)
  assert.equal(store.getState().pasteSelected(), true)
  assert.notEqual(store.getState().selectedId, newId)
  const alternative = store.getState().layouts.find((layout) => layout.kind === 'alternative')!
  store.getState().activateLayout(alternative.id)
  assert.deepEqual(store.getState().selectedIds, [])
  assert.equal(store.getState().selectionAnchor, null)
})

test('preferencias compartidas sobreviven a borrado parcial; eliminar alternativa limpia solo huérfanas', () => {
  const store = createRoomStore(memoryRepository())
  store.getState().addFurniture('chair')
  const sharedId = store.getState().selectedId!
  store.getState().toggleElementVisibility(sharedId)
  store.getState().createElementFolder('Muebles', sharedId)
  store.getState().duplicateActiveLayout()
  const alternative = store.getState().activeLayoutId
  store.getState().selectElement(sharedId)
  store.getState().removeSelected()
  assert.ok(store.getState().hiddenElementIds.includes(sharedId))
  assert.ok(store.getState().elementFolderAssignments[sharedId])
  store.getState().addFurniture('table')
  const unique = store.getState().selectedId!
  store.getState().toggleElementVisibility(unique)
  store.getState().toggleElementLock(unique)
  store.getState().toggleElementVisibility('door')
  store.getState().deleteAlternativeLayout(alternative)
  assert.equal(store.getState().activeLayoutId, 'original')
  assert.ok(store.getState().hiddenElementIds.includes(sharedId))
  assert.ok(store.getState().hiddenElementIds.includes('door'))
  assert.ok(!store.getState().hiddenElementIds.includes(unique))
  assert.ok(!store.getState().lockedElementIds.includes(unique))
  store.getState().undo()
  assert.equal(store.getState().layouts.length, 2)
  assert.ok(store.getState().hiddenElementIds.includes(unique))
})

test('redimensionar estructura comprueba también la variante inactiva y es atómico', () => {
  const store = createRoomStore(memoryRepository())
  const furniture = [-2, -1, 0, 1, 2].map((x, index) => ({ ...FURNITURE_PRESETS.chair, id: `chair-${index}`, x, y: 0, z: 0, rotation: 0 }))
  store.setState(ensureOriginalLayout(furniture))
  store.getState().duplicateActiveLayout()
  store.setState({ furniture: [store.getState().furniture[0]] })
  const width = store.getState().room.width
  const history = store.getState().undoCount
  store.getState().setDimension('width', 2)
  assert.equal(store.getState().room.width, width)
  assert.equal(store.getState().undoCount, history)
  assert.match(store.getState().notice, /Original/)
  store.getState().setWallColor('#abcdef')
  store.getState().activateLayout('original')
  assert.equal(store.getState().room.wallColor, '#abcdef')
})

test('fixtures v1–v5 se leen sin escribir y guardan v5 con variantes, preferencias y activa', () => {
  for (const path of ['persistence-v1/valid-complete', 'layout-variants/valid-v2', 'layout-variants/valid-v3', 'layout-variants/valid-v4', 'layout-variants/valid-v5']) {
    const data = JSON.parse(readFileSync(new URL(`../../tests/fixtures/${path}.json`, import.meta.url), 'utf8'))
    const repository = memoryRepository([{ id: 'saved', name: 'Prueba', savedAt: '', data }])
    const store = createRoomStore(repository)
    store.getState().initializeSavedDesigns()
    store.getState().loadDesign('saved')
    assert.equal(repository.writes(), 0)
    assert.equal(store.getState().hasUnsavedChanges, false)
    const expected = persistedDesign(store.getState())
    store.getState().saveDesign()
    assert.equal(repository.read()[0].data.version, 5)
    const restored = createRoomStore(repository)
    restored.getState().initializeSavedDesigns()
    restored.getState().loadDesign('saved')
    assert.deepEqual(persistedDesign(restored.getState()), expected)
  }
})

test('diseño en blanco y copia conservan el contrato y los fallos de guardado no pierden variantes', () => {
  const repository = memoryRepository()
  const store = createRoomStore(repository)
  store.getState().addFurniture('chair')
  store.getState().duplicateActiveLayout()
  store.getState().createDesign('copy', 'Copia')
  assert.equal(store.getState().layouts.length, 2)
  assert.equal(repository.read()[0].data.version, 5)
  const saved = persistedDesign(store.getState())
  repository.write = () => { throw new Error('quota') }
  store.getState().renameLayout(store.getState().activeLayoutId, 'Alternativa modificada')
  store.getState().saveDesign()
  assert.equal(store.getState().hasUnsavedChanges, true)
  assert.deepEqual(repository.read()[0].data, saved)
  assert.equal(store.getState().layouts.length, 2)
  const blankStore = createRoomStore(memoryRepository())
  blankStore.getState().createDesign('blank', 'Vacío')
  assert.equal(blankStore.getState().layouts.length, 1)
  assert.equal(blankStore.getState().furniture.length, 0)
})

test('reordenar la lista activa conserva referencias al mobiliario inactivo', () => {
  const store = createRoomStore(memoryRepository())
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  store.getState().duplicateActiveLayout()
  store.getState().addFurniture('table')
  const table = store.getState().selectedId!
  store.getState().reorderSceneElement(table, chair, 'before')
  store.getState().activateLayout('original')
  store.getState().reorderSceneElement(chair, 'door', 'before')
  assert.ok(store.getState().sceneElementOrder.includes(table))
  store.getState().activateLayout(store.getState().layouts[1].id)
  assert.ok(store.getState().sceneElementOrder.includes(table))
})

test('cargar mobiliario inactivo inválido no modifica escena ni biblioteca', () => {
  const data = JSON.parse(readFileSync(new URL('../../tests/fixtures/layout-variants/valid-v5.json', import.meta.url), 'utf8'))
  data.layouts[0].furniture[0].width = -1
  const saved: SavedDesign[] = [{ id: 'invalid', name: 'Inválido', savedAt: '', data }]
  const repository = memoryRepository(saved)
  const store = createRoomStore(repository)
  store.getState().addFurniture('chair')
  const before = persistedDesign(store.getState())
  store.getState().initializeSavedDesigns()
  store.getState().loadDesign('invalid')
  assert.deepEqual(persistedDesign(store.getState()), before)
  assert.deepEqual(repository.read(), saved)
  assert.equal(repository.writes(), 0)
  assert.match(store.getState().notice, /no es válido/)
})

test('la equivalencia del espejo no depende del orden de propiedades y no marca cambios al cargar', () => {
  const data = JSON.parse(readFileSync(new URL('../../tests/fixtures/layout-variants/valid-v5.json', import.meta.url), 'utf8'))
  data.furniture = data.furniture.map((item: object) => Object.fromEntries(Object.entries(item).reverse()))
  const store = createRoomStore(memoryRepository([{ id: 'reordered', name: 'Propiedades', savedAt: '', data }]))
  store.getState().initializeSavedDesigns()
  store.getState().loadDesign('reordered')
  assert.equal(store.getState().layouts.length, 2)
  assert.equal(store.getState().hasUnsavedChanges, false)
})
