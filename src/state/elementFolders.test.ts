import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign } from '../domain/designV1'
import { normalizeDesignPreferences } from '../domain/normalizeDesignV1'
import { createRoomStore as createStore } from './useRoomStore'

// Los casos de organización existentes cubren también diseños anteriores sin carpeta raíz.
const createRoomStore = (...args: Parameters<typeof createStore>) => { const store = createStore(...args); store.setState({ elementFolders: [], elementFolderAssignments: {} }); return store }

test('crea carpetas, asigna elementos y lo conserva al guardar', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!

  store.getState().createElementFolder('Asientos', id)
  const folder = store.getState().elementFolders[0]
  assert.equal(folder.name, 'Asientos')
  assert.equal(store.getState().elementFolderAssignments[id], folder.id)
  assert.deepEqual(normalizeDesignPreferences(persistedDesign(store.getState())).elementFolders, [folder])

  store.getState().renameElementFolder(folder.id, '  Zona de estar  ')
  assert.equal(store.getState().elementFolders[0].name, 'Zona de estar')

  store.getState().moveElementToFolder(id, null)
  assert.deepEqual(store.getState().elementFolderAssignments, {})

  store.getState().undo()
  assert.equal(store.getState().elementFolderAssignments[id], folder.id)
})

test('elimina carpetas sin eliminar sus elementos y limpia asignaciones huérfanas', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  store.getState().createElementFolder('Carpeta', id)
  const folderId = store.getState().elementFolders[0].id

  store.getState().deleteElementFolder(folderId)
  assert.deepEqual(store.getState().elementFolders, [])
  assert.deepEqual(store.getState().elementFolderAssignments, {})
  assert.equal(store.getState().furniture.length, 1)

  store.getState().createElementFolder('Otra', id)
  store.getState().removeFurniture()
  assert.deepEqual(store.getState().elementFolderAssignments, {})
  assert.equal(store.getState().elementFolders.length, 1)
})

test('la normalización descarta carpetas y asignaciones inválidas', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  const data = persistedDesign(store.getState())
  data.elementFolders = [
    { id: 'folder-ok', name: '  Válida  ' },
    { id: '', name: 'Sin id' },
    { id: 'folder-empty', name: '   ' },
  ]
  data.elementFolderAssignments = { [id]: 'folder-ok', otro: 'no-existe' }
  assert.deepEqual(normalizeDesignPreferences(data).elementFolders, [{ id: 'folder-ok', name: 'Válida' }])
  assert.deepEqual(normalizeDesignPreferences(data).elementFolderAssignments, { [id]: 'folder-ok' })
})

test('anida carpetas, conserva jerarquía v3 y aplica acciones a descendientes', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  store.getState().createElementFolder('Padre')
  const parent = store.getState().elementFolders[0]
  store.getState().createElementFolder('Hija', id, parent.id)
  const child = store.getState().elementFolders[1]
  const design = persistedDesign(store.getState())
  assert.equal(design.version, 5)
  assert.deepEqual(normalizeDesignPreferences(design).elementFolders, [parent, child])
  store.getState().toggleElementFolderVisibility(parent.id)
  store.getState().toggleElementFolderLock(parent.id)
  assert.ok(store.getState().hiddenElementIds.includes(id))
  assert.ok(store.getState().lockedElementIds.includes(id))
  store.getState().deleteElementFolder(parent.id)
  assert.equal(store.getState().elementFolders[0].parentId, undefined)
  assert.equal(store.getState().elementFolderAssignments[id], child.id)
  store.getState().undo()
  assert.equal(store.getState().elementFolders[1].parentId, parent.id)
})

test('rechaza ciclos y padres inexistentes al cargar carpetas', () => {
  const data = persistedDesign(createRoomStore().getState())
  data.version = 3
  data.elementFolders = [{ id: 'a', name: 'A', parentId: 'b' }, { id: 'b', name: 'B', parentId: 'a' }, { id: 'c', name: 'C', parentId: 'ausente' }]
  assert.deepEqual(normalizeDesignPreferences(data).elementFolders, [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }])
})

test('recupera una jerarquía guardada en un diseño v3', () => {
  const source = createRoomStore()
  source.getState().createElementFolder('Padre')
  const parent = source.getState().elementFolders[0]
  source.getState().createElementFolder('Hija', undefined, parent.id)
  const data = JSON.parse(JSON.stringify(persistedDesign(source.getState())))
  const repository = { read: () => [{ id: 'casa', name: 'Casa', savedAt: '', data }], write: () => {} }
  const restored = createRoomStore(repository)
  restored.getState().initializeSavedDesigns()
  restored.getState().loadDesign('casa')
  assert.deepEqual(restored.getState().elementFolders, source.getState().elementFolders)
})

test('mueve carpetas sin perder contenido y rechaza ciclos, con deshacer', () => {
  const store = createRoomStore()
  store.getState().createElementFolder('Primera')
  const first = store.getState().elementFolders[0].id
  store.getState().createElementFolder('Segunda')
  const second = store.getState().elementFolders[1].id
  store.getState().createElementFolder('Hija', undefined, first)
  const child = store.getState().elementFolders[2].id
  store.getState().moveElementFolder(first, child)
  assert.equal(store.getState().elementFolders[0].parentId, undefined)
  store.getState().moveElementFolder(first, first)
  assert.equal(store.getState().elementFolders[0].parentId, undefined)
  store.getState().moveElementFolder(first, second)
  assert.equal(store.getState().elementFolders[0].parentId, second)
  assert.equal(store.getState().elementFolders[2].parentId, first)
  store.getState().undo()
  assert.equal(store.getState().elementFolders[0].parentId, undefined)
  store.getState().redo()
  store.getState().moveElementFolder(first, null)
  assert.equal(store.getState().elementFolders[0].parentId, undefined)
})

test('desagrupar una carpeta anidada conserva objetos, subcarpetas y permite deshacer', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  const furniture = structuredClone(store.getState().furniture)
  store.getState().createElementFolder('Padre')
  const parent = store.getState().elementFolders[0].id
  store.getState().createElementFolder('Grupo', chair, parent)
  const group = store.getState().elementFolders[1].id
  store.getState().createElementFolder('Subcarpeta', undefined, group)
  const child = store.getState().elementFolders[2].id
  store.getState().deleteElementFolder(group, 'ungroup')
  assert.equal(store.getState().elementFolderAssignments[chair], parent)
  assert.equal(store.getState().elementFolders.find((folder) => folder.id === child)?.parentId, parent)
  assert.deepEqual(store.getState().furniture, furniture)
  assert.match(store.getState().notice, /desagrupada/)
  store.getState().undo()
  assert.equal(store.getState().elementFolderAssignments[chair], group)
  assert.equal(store.getState().elementFolders.find((folder) => folder.id === child)?.parentId, group)
})
