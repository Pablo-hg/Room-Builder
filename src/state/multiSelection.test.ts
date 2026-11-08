import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign } from '../domain/designV1'
import { createRoomStore as createStore } from './useRoomStore'

// Los casos de organización existentes cubren también diseños anteriores sin carpeta raíz.
const createRoomStore = (...args: Parameters<typeof createStore>) => { const store = createStore(...args); store.setState({ elementFolders: [], elementFolderAssignments: {} }); return store }
import { multiSelectionBounds, multiSelectionItems } from '../domain/multiSelection'

test('selecciona, alterna e intervalos sin modificar el diseño', () => {
  const store = createRoomStore()
  const before = JSON.stringify(persistedDesign(store.getState()))
  const visible = ['door', 'window-1', 'folder:example', 'other']
  store.getState().selectSceneListItem('door', 'single', visible)
  store.getState().selectSceneListItem('other', 'toggle', visible)
  assert.deepEqual(store.getState().selectedIds, ['door', 'other'])
  assert.equal(store.getState().selectedId, null)
  store.getState().selectSceneListItem('window-1', 'range', visible)
  assert.deepEqual(store.getState().selectedIds, ['window-1', 'folder:example', 'other'])
  assert.equal(store.getState().selectionAnchor, 'other')
  store.getState().selectSceneListItem('other', 'toggle', visible)
  assert.deepEqual(store.getState().selectedIds, ['window-1', 'folder:example'])
  store.getState().selectElement('door')
  assert.deepEqual(store.getState().selectedIds, ['door'])
  store.getState().selectElement(null)
  assert.deepEqual(store.getState().selectedIds, [])
  assert.equal(JSON.stringify(persistedDesign(store.getState())), before)
})

test('un ancla que no está visible inicia un nuevo intervalo', () => {
  const store = createRoomStore()
  store.getState().selectSceneListItem('door', 'single', ['door', 'window-1'])
  store.getState().selectSceneListItem('window-1', 'range', ['window-1'])
  assert.deepEqual(store.getState().selectedIds, ['window-1'])
})

test('mueve y agrupa una selección como operaciones únicas, sin ciclos ni cambios 3D', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  store.getState().addFurniture('table')
  const table = store.getState().selectedId!
  const positions = structuredClone(store.getState().furniture)
  store.getState().createElementFolder('Destino')
  const folder = store.getState().elementFolders[0].id
  const undoBefore = store.getState().undoCount
  store.getState().moveSceneItems([chair, table], folder)
  assert.equal(store.getState().undoCount, undoBefore + 1)
  assert.equal(store.getState().elementFolderAssignments[chair], folder)
  assert.equal(store.getState().elementFolderAssignments[table], folder)
  assert.deepEqual(store.getState().furniture, positions)
  store.getState().moveSceneItems([chair, table], null, 'door', 'before')
  assert.equal(store.getState().elementFolderAssignments[chair], undefined)
  store.getState().undo()
  assert.equal(store.getState().elementFolderAssignments[chair], folder)
  store.getState().groupSceneItems([chair, table])
  const created = store.getState().elementFolders.at(-1)!
  assert.equal(created.parentId, folder)
  assert.equal(store.getState().elementFolderAssignments[chair], created.id)
  assert.equal(store.getState().elementFolderAssignments[table], created.id)
  store.getState().moveSceneItems([`folder:${folder}`], created.id)
  assert.equal(store.getState().elementFolders.find((item) => item.id === folder)?.parentId, undefined)
  store.getState().undo()
  assert.equal(store.getState().elementFolderAssignments[chair], folder)
})

test('copia, duplica y borra varios objetos sin aplicar operaciones parciales', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  store.getState().addFurniture('table')
  const table = store.getState().selectedId!
  const visible = [chair, table]
  store.getState().selectSceneListItem(chair, 'single', visible)
  store.getState().selectSceneListItem(table, 'toggle', visible)
  assert.equal(store.getState().copySelected(), true)
  const before = store.getState().undoCount
  store.getState().pasteSelected()
  assert.equal(store.getState().furniture.length, 4)
  assert.equal(store.getState().selectedIds.length, 2)
  assert.equal(store.getState().undoCount, before + 1)
  store.getState().undo()
  assert.equal(store.getState().furniture.length, 2)
  store.getState().removeSceneItems([chair, table, 'door'])
  assert.equal(store.getState().furniture.length, 2)
  store.getState().removeSceneItems([chair, table])
  assert.equal(store.getState().furniture.length, 0)
  store.getState().undo()
  assert.equal(store.getState().furniture.length, 2)
})

test('evita duplicar descendientes seleccionados y conserva la jerarquía al agrupar', () => {
  const store = createRoomStore()
  store.getState().createElementFolder('Padre')
  const parent = store.getState().elementFolders[0].id
  store.getState().createElementFolder('Hija', undefined, parent)
  const child = store.getState().elementFolders[1].id
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  store.getState().moveElementToFolder(chair, child)
  store.getState().groupSceneItems([`folder:${parent}`, `folder:${child}`, chair])
  const group = store.getState().elementFolders.at(-1)!
  assert.equal(store.getState().elementFolders.find((item) => item.id === parent)?.parentId, group.id)
  assert.equal(store.getState().elementFolders.find((item) => item.id === child)?.parentId, parent)
  assert.equal(store.getState().elementFolderAssignments[chair], child)
  store.getState().toggleSceneItemsLock([`folder:${parent}`, chair])
  assert.deepEqual(store.getState().lockedElementIds, [chair])
})

test('rechaza destinos inexistentes y evita duplicar parcialmente una selección incompatible', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  const before = store.getState().undoCount
  store.getState().moveSceneItems([chair], null, 'inexistente', 'before')
  assert.equal(store.getState().undoCount, before)
  store.getState().selectSceneListItem(chair, 'single', [chair, 'door'])
  store.getState().selectSceneListItem('door', 'toggle', [chair, 'door'])
  assert.equal(store.getState().copySelected(), false)
  assert.equal(store.getState().furniture.length, 1)
})

test('transforma muebles seleccionados conjuntamente y deshace cada operación', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const first = store.getState().selectedId!
  store.getState().addFurniture('chair')
  const second = store.getState().selectedId!
  store.getState().selectSceneListItem(first, 'single', [first, second])
  store.getState().selectSceneListItem(second, 'toggle', [first, second])
  const before = structuredClone(store.getState().furniture)
  store.getState().moveSelectedFurnitureGroup('x', 0.15)
  const moved = store.getState().furniture
  assert.ok(moved.every((item, index) => Math.abs(item.x - before[index].x - 0.15) < 1e-8))
  store.getState().colorSelectedFurnitureGroup('#123456')
  assert.ok(store.getState().furniture.every((item) => item.color === '#123456'))
  store.getState().undo()
  assert.deepEqual(store.getState().furniture, moved)
  store.getState().undo()
  assert.deepEqual(store.getState().furniture, before)
})

test('mueve todo el conjunto fuera de la habitación y respeta los bloqueos', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const first = store.getState().selectedId!
  store.getState().addFurniture('chair')
  const second = store.getState().selectedId!
  store.getState().selectSceneListItem(first, 'single', [first, second])
  store.getState().selectSceneListItem(second, 'toggle', [first, second])
  const before = structuredClone(store.getState().furniture)
  store.getState().moveSelectedFurnitureGroup('x', 100)
  assert.ok(store.getState().furniture.every((item, index) => item.x === before[index].x + 100))
  const moved = structuredClone(store.getState().furniture)
  store.getState().toggleSceneItemsLock([first])
  store.getState().moveSelectedFurnitureGroup('z', 0.15)
  assert.deepEqual(store.getState().furniture, moved)
})

test('mueve el conjunto en dos ejes como una única operación y rechaza movimientos parciales', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const first = store.getState().selectedId!
  store.getState().addFurniture('chair')
  const second = store.getState().selectedId!
  store.getState().selectSceneListItem(first, 'single', [first, second])
  store.getState().selectSceneListItem(second, 'toggle', [first, second])
  const before = structuredClone(store.getState().furniture)
  const undo = store.getState().undoCount
  store.getState().moveSelectedFurnitureGroupBy({ x: 0.15, y: 0, z: 0.15 })
  assert.ok(store.getState().furniture.every((item, index) => Math.abs(item.x - before[index].x - 0.15) < 1e-8 && Math.abs(item.z - before[index].z - 0.15) < 1e-8))
  assert.equal(store.getState().undoCount, undo + 1)
  store.getState().undo()
  assert.deepEqual(store.getState().furniture, before)
})

test('gira el conjunto alrededor de su centro y permite deshacerlo', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const first = store.getState().selectedId!
  store.getState().addFurniture('chair')
  const second = store.getState().selectedId!
  store.getState().selectSceneListItem(first, 'single', [first, second])
  store.getState().selectSceneListItem(second, 'toggle', [first, second])
  const before = structuredClone(store.getState().furniture)
  store.getState().rotateSelectedFurnitureGroup()
  const after = store.getState().furniture
  assert.ok(after.every((item) => Math.abs(item.rotation - Math.PI / 2) < 1e-8))
  assert.ok(Math.abs(Math.hypot(after[0].x - after[1].x, after[0].z - after[1].z) - Math.hypot(before[0].x - before[1].x, before[0].z - before[1].z)) < 1e-8)
  store.getState().undo()
  assert.deepEqual(store.getState().furniture, before)
})

test('mueve y colorea juntos una puerta y un mueble solo por el eje compatible', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  store.getState().selectSceneListItem('door', 'single', ['door', chair])
  store.getState().selectSceneListItem(chair, 'toggle', ['door', chair])
  const before = structuredClone(store.getState().furniture)
  const oldDoor = store.getState().room.door.offset
  const items = multiSelectionItems(store.getState())
  assert.equal(items.length, 2)
  assert.ok(multiSelectionBounds(items)!.max.z >= store.getState().room.depth / 2)
  store.getState().moveSelectedFurnitureGroup('z', 0.15)
  assert.deepEqual(store.getState().furniture, before)
  assert.equal(store.getState().room.door.offset, oldDoor)
  store.getState().moveSelectedFurnitureGroup('x', 0.15)
  assert.equal(store.getState().room.door.offset, oldDoor - 0.15)
  assert.equal(store.getState().furniture[0].x, before[0].x + 0.15)
  store.getState().colorSelectedFurnitureGroup('#123456')
  assert.equal(store.getState().room.door.color, '#123456')
  assert.equal(store.getState().furniture[0].color, '#123456')
  store.getState().undo()
  assert.equal(store.getState().room.door.offset, oldDoor - 0.15)
  store.getState().undo()
  assert.equal(store.getState().room.door.offset, oldDoor)
  assert.deepEqual(store.getState().furniture, before)
})

test('incluye los descendientes de carpetas y evita duplicar elementos seleccionados', () => {
  const store = createRoomStore()
  store.getState().createElementFolder('Grupo')
  const folder = store.getState().elementFolders.find((entry) => entry.name === 'Grupo')!.id
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  store.getState().moveElementToFolder(chair, folder)
  store.getState().addStructureObject('wall')
  const wall = store.getState().selectedId!
  store.getState().moveElementToFolder(wall, folder)
  store.getState().selectSceneListItem(`folder:${folder}`, 'single', [`folder:${folder}`, chair])
  store.getState().selectSceneListItem(chair, 'toggle', [`folder:${folder}`, chair])
  const items = multiSelectionItems(store.getState())
  assert.deepEqual(new Set(items.map((item) => item.id)), new Set([chair, wall]))
  const previous = structuredClone(store.getState().structurePacks)
  store.getState().moveSelectedFurnitureGroup('x', 0.15)
  // Si se seleccionan todas las superficies de un pack, se traslada el pack
  // entero para evitar dobles transformaciones; la coordenada local no cambia.
  const moved = store.getState().structurePacks[0]
  assert.equal(moved.x + moved.surfaces[0].x, previous[0].x + previous[0].surfaces[0].x + 0.15)
  assert.equal(moved.surfaces[0].x, previous[0].surfaces[0].x)
  store.getState().undo()
  assert.deepEqual(store.getState().structurePacks, previous)
})
