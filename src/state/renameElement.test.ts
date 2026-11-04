import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign } from '../domain/designV1'
import { structureSurfaceElementId } from '../domain/elementIds'
import { createRoomStore } from './useRoomStore'

test('los nombres de muebles, packs y superficies se guardan y se deshacen', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const furnitureId = store.getState().selectedId!
  store.getState().renameElement(furnitureId, '  Mi silla  ')
  assert.equal(persistedDesign(store.getState()).furniture[0].name, 'Mi silla')
  store.getState().undo()
  assert.notEqual(store.getState().furniture[0].name, 'Mi silla')
  store.getState().redo()
  store.getState().renameElement(furnitureId, '  ')
  assert.equal(store.getState().furniture[0].name, 'Mi silla')
  store.getState().addStructureObject('wall')
  const pack = store.getState().structurePacks[0]
  store.getState().renameElement(pack.id, 'Tabique')
  store.getState().renameElement(structureSurfaceElementId(pack.id, pack.surfaces[0].id), 'Cara')
  assert.equal(persistedDesign(store.getState()).structurePacks![0].name, 'Tabique')
  assert.equal(persistedDesign(store.getState()).structurePacks![0].surfaces[0].name, 'Cara')
})

test('los nombres de aperturas se guardan y admiten deshacer/rehacer', () => {
  const store = createRoomStore()
  const legacy = persistedDesign(store.getState())
  assert.equal(legacy.version, 1)
  store.getState().renameElement('door', 'Entrada')
  store.getState().addWindow('rectangular')
  const id = store.getState().selectedId!
  store.getState().renameElement(id, 'Ventanal')
  const saved = persistedDesign(store.getState())
  assert.equal(saved.version, 2)
  assert.equal(saved.room.door.name, 'Entrada')
  assert.equal(saved.room.windows.find((window) => window.id === id)?.name, 'Ventanal')
  store.getState().undo()
  assert.equal(store.getState().room.windows.find((window) => window.id === id)?.name, undefined)
  store.getState().redo()
  assert.equal(store.getState().room.windows.find((window) => window.id === id)?.name, 'Ventanal')
})

test('recupera nombres de aperturas desde un diseño guardado v2', () => {
  const original = createRoomStore()
  original.getState().renameElement('door', 'Entrada')
  original.getState().addWindow('rectangular')
  const windowId = original.getState().selectedId!
  original.getState().renameElement(windowId, 'Ventanal')
  const data = { ...JSON.parse(JSON.stringify(persistedDesign(original.getState()))), version: 2 }
  const repository = { read: () => [{ id: 'guardado', name: 'Casa', savedAt: '', data }], write: () => {} }
  const restored = createRoomStore(repository)
  restored.getState().initializeSavedDesigns()
  restored.getState().loadDesign('guardado')
  assert.equal(restored.getState().room.door.name, 'Entrada')
  assert.equal(restored.getState().room.windows.find((window) => window.id === windowId)?.name, 'Ventanal')
})
