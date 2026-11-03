import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BASE_ROOM_SURFACE_IDS, ROOT_ROOM_FOLDER, folderSelectionId } from '../domain/elementFolders'
import { persistedDesign } from '../domain/designV1'
import { createRoomStore } from './useRoomStore'

test('un lienzo nuevo crea la raíz con las superficies y aperturas originales', () => {
  const store = createRoomStore()
  const state = store.getState()
  assert.equal(state.elementFolders.find((folder) => folder.id === ROOT_ROOM_FOLDER)?.name, 'Raíz')
  for (const id of [...BASE_ROOM_SURFACE_IDS, 'door', 'window-1']) assert.equal(state.elementFolderAssignments[id], ROOT_ROOM_FOLDER)
  assert.equal(state.structurePacks.length, 0)
  state.deleteElementFolder(ROOT_ROOM_FOLDER)
  state.deleteElementFolder(ROOT_ROOM_FOLDER, 'ungroup')
  state.removeSceneItems([folderSelectionId(ROOT_ROOM_FOLDER)])
  state.groupSceneItems([folderSelectionId(ROOT_ROOM_FOLDER), 'window-1'])
  assert.ok(store.getState().elementFolders.some((folder) => folder.id === ROOT_ROOM_FOLDER && !folder.parentId))
  assert.equal(store.getState().room.windows.length, 1)
})

test('la raíz se conserva al guardar y los diseños anteriores mantienen su organización', () => {
  const original = createRoomStore()
  const saved = JSON.parse(JSON.stringify(persistedDesign(original.getState())))
  const legacy = { ...saved, elementFolders: [], elementFolderAssignments: {} }
  const repository = { read: () => [{ id: 'new', name: 'Nuevo', savedAt: '', data: saved }, { id: 'old', name: 'Anterior', savedAt: '', data: legacy }], write: () => {} }
  const store = createRoomStore(repository)
  store.getState().initializeSavedDesigns()
  store.getState().loadDesign('old')
  assert.equal(store.getState().elementFolders.length, 0)
  store.getState().loadDesign('new')
  assert.equal(store.getState().elementFolderAssignments['door'], ROOT_ROOM_FOLDER)
  store.getState().createDesign('blank', 'Vacío')
  assert.equal(store.getState().elementFolderAssignments['window-1'], ROOT_ROOM_FOLDER)
})

test('la selección isométrica centra la altura de la habitación sin alterar el mundo', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  const before = JSON.stringify(persistedDesign(store.getState()))
  store.getState().setActiveRoomId(null)
  assert.equal(store.getState().isoCameraHeight, 0)
  store.getState().setActiveRoomId(pack.id)
  assert.equal(store.getState().isoCameraHeight, pack.y)
  assert.equal(JSON.stringify(persistedDesign(store.getState())), before)
})
