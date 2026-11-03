import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign } from '../domain/designV1'
import { orderedSceneIds } from '../domain/elementFolders'
import { createRoomStore as createStore } from './useRoomStore'

// Los casos de organización existentes cubren también diseños anteriores sin carpeta raíz.
const createRoomStore = (...args: Parameters<typeof createStore>) => { const store = createStore(...args); store.setState({ elementFolders: [], elementFolderAssignments: {} }); return store }

test('ordenar solo cambia el orden visual, admite historial y guarda v5', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  const originalFurniture = structuredClone(store.getState().furniture)
  store.getState().reorderSceneElement(id, 'door', 'before')
  assert.equal(orderedSceneIds(store.getState())[0], id)
  assert.deepEqual(store.getState().furniture, originalFurniture)
  assert.equal(persistedDesign(store.getState()).version, 5)
  store.getState().undo()
  assert.notEqual(orderedSceneIds(store.getState())[0], id)
  store.getState().redo()
  assert.equal(orderedSceneIds(store.getState())[0], id)
  const data = JSON.parse(JSON.stringify(persistedDesign(store.getState())))
  const repository = { read: () => [{ id: 'casa', name: 'Casa', savedAt: '', data }], write: () => {} }
  const loaded = createRoomStore(repository)
  loaded.getState().initializeSavedDesigns()
  loaded.getState().loadDesign('casa')
  assert.equal(orderedSceneIds(loaded.getState())[0], id)
})

test('no reordena entre carpetas distintas y conserva elementos nuevos', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  store.getState().createElementFolder('Carpeta', id)
  store.getState().reorderSceneElement(id, 'door', 'before')
  assert.deepEqual(store.getState().sceneElementOrder, [])
  store.getState().moveElementToFolder(id, null)
  store.getState().reorderSceneElement(id, 'door', 'before')
  store.getState().addFurniture('table')
  const added = store.getState().selectedId!
  assert.equal(orderedSceneIds(store.getState()).at(-1), added)
})

test('intercala carpetas y objetos hermanos y conserva su posición al guardar', () => {
  const store = createRoomStore()
  store.getState().createElementFolder('Padre')
  const parent = store.getState().elementFolders[0].id
  store.getState().createElementFolder('Una', undefined, parent)
  const first = store.getState().elementFolders[1].id
  store.getState().createElementFolder('Otra', undefined, parent)
  const second = store.getState().elementFolders[2].id
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  store.getState().moveElementToFolder(chair, parent)
  const firstId = `folder:${first}`
  const secondId = `folder:${second}`
  store.getState().reorderSceneElement(chair, firstId, 'before')
  store.getState().reorderSceneElement(secondId, chair, 'before')
  const order = orderedSceneIds(store.getState())
  assert.ok(order.indexOf(secondId) < order.indexOf(chair))
  assert.ok(order.indexOf(chair) < order.indexOf(firstId))
  const data = JSON.parse(JSON.stringify(persistedDesign(store.getState())))
  const repository = { read: () => [{ id: 'casa', name: 'Casa', savedAt: '', data }], write: () => {} }
  const loaded = createRoomStore(repository)
  loaded.getState().initializeSavedDesigns()
  loaded.getState().loadDesign('casa')
  assert.deepEqual(orderedSceneIds(loaded.getState()), order)
  store.getState().undo()
  assert.ok(orderedSceneIds(store.getState()).indexOf(secondId) > orderedSceneIds(store.getState()).indexOf(chair))
})
