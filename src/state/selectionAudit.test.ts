import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign } from '../domain/designV1'
import { createRoomStore } from './useRoomStore'

// F1-04: auditoría de bloqueo, ocultación y selección válida en operaciones por lotes.

function storeWithChairs(count = 3) {
  const store = createRoomStore()
  const ids: string[] = []
  for (let index = 0; index < count; index += 1) {
    store.getState().addFurniture('chair')
    ids.push(store.getState().selectedId!)
  }
  return { store, ids }
}

function selectMany(store: ReturnType<typeof createRoomStore>, ids: string[]) {
  const visible = ids
  store.getState().selectSceneListItem(ids[0], 'single', visible)
  for (const id of ids.slice(1)) store.getState().selectSceneListItem(id, 'toggle', visible)
}

test('un elemento bloqueado no se elimina con la tecla Suprimir', () => {
  const { store, ids } = storeWithChairs(1)
  store.getState().toggleElementLock(ids[0])
  store.getState().removeSelected()
  assert.equal(store.getState().furniture.some((item) => item.id === ids[0]), true)
})

test('eliminar una selección con un bloqueado no tiene efectos parciales', () => {
  const { store, ids } = storeWithChairs(3)
  store.getState().toggleElementLock(ids[1])
  selectMany(store, ids)
  const before = JSON.stringify(persistedDesign(store.getState()))
  store.getState().removeSceneItems(store.getState().selectedIds)
  assert.equal(JSON.stringify(persistedDesign(store.getState())), before)
})

test('eliminar una selección con la puerta principal no elimina el resto', () => {
  const { store, ids } = storeWithChairs(2)
  selectMany(store, [...ids, 'door'])
  const before = store.getState().furniture.length
  store.getState().removeSceneItems(store.getState().selectedIds)
  assert.equal(store.getState().furniture.length, before)
})

test('ocultar elementos de la selección los saca de la selección múltiple', () => {
  const { store, ids } = storeWithChairs(3)
  selectMany(store, ids)
  store.getState().toggleSceneItemsVisibility([ids[0]])
  assert.equal(store.getState().selectedIds.includes(ids[0]), false)
  assert.deepEqual(store.getState().selectedIds, [ids[1], ids[2]])
})

test('ocultar un elemento ajeno conserva la selección múltiple', () => {
  const { store, ids } = storeWithChairs(3)
  selectMany(store, [ids[0], ids[1]])
  store.getState().toggleElementVisibility(ids[2])
  assert.deepEqual(store.getState().selectedIds, [ids[0], ids[1]])
})

test('ocultar una carpeta saca su contenido de la selección múltiple', () => {
  const { store, ids } = storeWithChairs(3)
  store.getState().createElementFolder('Grupo')
  const folder = store.getState().elementFolders.find((entry) => entry.name === 'Grupo')!.id
  store.getState().moveElementToFolder(ids[0], folder)
  selectMany(store, ids)
  store.getState().toggleElementFolderVisibility(folder)
  assert.deepEqual(store.getState().selectedIds, [ids[1], ids[2]])
})

test('mover la selección no desplaza objetos ocultos', () => {
  const { store, ids } = storeWithChairs(3)
  selectMany(store, ids)
  store.setState({ hiddenElementIds: [ids[0]] })
  const hidden = { ...store.getState().furniture.find((item) => item.id === ids[0])! }
  store.getState().moveSelectedFurnitureGroupBy({ x: 0.5, y: 0, z: 0 })
  const after = store.getState().furniture.find((item) => item.id === ids[0])!
  assert.equal(after.x, hidden.x)
})

test('copiar y duplicar no incluyen objetos ocultos ni bloqueados al pegar', () => {
  const { store, ids } = storeWithChairs(2)
  selectMany(store, ids)
  store.setState({ hiddenElementIds: [ids[0]] })
  const before = store.getState().furniture.length
  if (store.getState().copySelected()) store.getState().pasteSelected()
  assert.ok(store.getState().furniture.length - before <= 1)
})

test('tras deshacer, rehacer y cargar la selección solo contiene ids existentes', () => {
  const { store, ids } = storeWithChairs(3)
  selectMany(store, ids)
  const existing = () => new Set([
    ...store.getState().furniture.map((item) => item.id),
    ...store.getState().room.windows.map((item) => item.id),
    'door',
  ])
  store.getState().removeSceneItems(store.getState().selectedIds)
  for (const step of ['undo', 'redo', 'undo'] as const) {
    store.getState()[step]()
    assert.ok(store.getState().selectedIds.every((id) => existing().has(id)), `selección inválida tras ${step}`)
    if (store.getState().selectedId) assert.ok(existing().has(store.getState().selectedId!))
  }
})

test('una carpeta no puede moverse dentro de sí misma ni de sus descendientes', () => {
  const store = createRoomStore()
  store.getState().createElementFolder('A')
  const a = store.getState().elementFolders.find((entry) => entry.name === 'A')!.id
  store.getState().createElementFolder('B', undefined, a)
  const b = store.getState().elementFolders.find((entry) => entry.name === 'B')!.id
  const before = JSON.stringify(store.getState().elementFolders)
  store.getState().moveElementFolder(a, b)
  store.getState().moveElementFolder(a, a)
  store.getState().moveSceneItems([`folder:${a}`], b)
  assert.equal(JSON.stringify(store.getState().elementFolders), before)
})

test('las jerarquías, ocultos y bloqueos sobreviven a la serialización', () => {
  const { store, ids } = storeWithChairs(2)
  store.getState().createElementFolder('A')
  const a = store.getState().elementFolders.find((entry) => entry.name === 'A')!.id
  store.getState().createElementFolder('B', undefined, a)
  const b = store.getState().elementFolders.find((entry) => entry.name === 'B')!.id
  store.getState().moveElementToFolder(ids[0], b)
  store.getState().toggleElementLock(ids[0])
  store.getState().toggleElementVisibility(ids[1])
  const design = JSON.parse(JSON.stringify(persistedDesign(store.getState())))
  const copy = createRoomStore()
  copy.setState({ ...design, structurePacks: design.structurePacks ?? [], selectedId: null, selectedIds: [] })
  assert.deepEqual(copy.getState().elementFolders, store.getState().elementFolders)
  assert.deepEqual(copy.getState().elementFolderAssignments, store.getState().elementFolderAssignments)
  assert.deepEqual(copy.getState().lockedElementIds, [ids[0]])
  assert.deepEqual(copy.getState().hiddenElementIds, [ids[1]])
})

test('pegar un mueble suelto conserva su carpeta, igual que al pegar varios', () => {
  const { store, ids } = storeWithChairs(2)
  store.getState().createElementFolder('Grupo')
  const folder = store.getState().elementFolders.find((entry) => entry.name === 'Grupo')!.id
  store.getState().moveElementToFolder(ids[0], folder)
  store.getState().selectElement(ids[0])
  store.getState().copySelected()
  store.getState().pasteSelected()
  const single = store.getState().selectedId!
  assert.equal(store.getState().elementFolderAssignments[single], folder)
  selectMany(store, [ids[0], ids[1]])
  store.getState().copySelected()
  store.getState().pasteSelected()
  const pasted = store.getState().selectedIds
  assert.equal(pasted.length, 2)
  assert.equal(store.getState().elementFolderAssignments[pasted[0]], folder)
})

test('pegar una ventana de la habitación conserva su carpeta', () => {
  const store = createRoomStore()
  store.getState().createElementFolder('Grupo')
  const folder = store.getState().elementFolders.find((entry) => entry.name === 'Grupo')!.id
  const window = store.getState().room.windows[0].id
  store.getState().moveElementToFolder(window, folder)
  store.getState().selectElement(window)
  store.getState().copySelected()
  store.getState().pasteSelected()
  assert.equal(store.getState().elementFolderAssignments[store.getState().selectedId!], folder)
})

test('pegar no copia el estado oculto o bloqueado del origen ni rompe la selección', () => {
  const { store, ids } = storeWithChairs(1)
  store.getState().toggleElementLock(ids[0])
  store.getState().selectElement(ids[0])
  store.getState().copySelected()
  store.getState().pasteSelected()
  const pasted = store.getState().selectedId!
  assert.notEqual(pasted, ids[0])
  assert.equal(store.getState().lockedElementIds.includes(pasted), false)
  assert.deepEqual(store.getState().selectedIds, [pasted])
})

test('seleccionar un elemento oculto desde la lista no permite moverlo en grupo', () => {
  const { store, ids } = storeWithChairs(2)
  store.setState({ hiddenElementIds: [ids[1]] })
  selectMany(store, ids)
  const before = JSON.stringify(store.getState().furniture)
  store.getState().moveSelectedFurnitureGroupBy({ x: 0.5, y: 0, z: 0 })
  const moved = store.getState().furniture
  assert.equal(moved.find((item) => item.id === ids[1])!.x, JSON.parse(before).find((item: { id: string }) => item.id === ids[1]).x)
})

test('los botones del inspector no eliminan elementos bloqueados', () => {
  const { store, ids } = storeWithChairs(1)
  store.getState().toggleElementLock(ids[0])
  store.getState().selectElement(ids[0])
  store.getState().removeFurniture()
  assert.equal(store.getState().furniture.length, 1, 'mueble')

  const window = store.getState().room.windows[0].id
  store.getState().toggleElementLock(window)
  store.getState().removeWindow(window)
  assert.equal(store.getState().room.windows.length, 1, 'ventana')

  store.getState().addStructureObject('wall')
  const pack = store.getState().structurePacks[0]
  const surface = pack.surfaces[0]
  store.getState().toggleElementLock(`structure-surface:${pack.id}:${surface.id}`)
  store.getState().removeStructureSurface(pack.id, surface.id)
  assert.equal(store.getState().structurePacks.length, 1, 'superficie')
  store.getState().toggleElementLock(pack.id)
  store.getState().removeStructurePack(pack.id)
  assert.equal(store.getState().structurePacks.length, 1, 'pack')
})

test('eliminar una puerta bloqueada se rechaza', () => {
  const store = createRoomStore()
  store.getState().addStructureDoor()
  const door = store.getState().room.extraDoors?.[0] ?? store.getState().structurePacks.flatMap((pack) => pack.doors ?? [])[0]
  assert.ok(door, 'se ha creado una puerta')
  store.getState().toggleElementLock(door.id)
  store.getState().removeStructureDoor(door.id)
  const remaining = [...(store.getState().room.extraDoors ?? []), ...store.getState().structurePacks.flatMap((pack) => pack.doors ?? [])]
  assert.equal(remaining.length, 1)
})

test('seleccionar todo y por área excluye ocultos y bloqueados', async () => {
  const { selectableItems } = await import('../domain/multiSelection')
  const { store, ids } = storeWithChairs(3)
  store.setState({ hiddenElementIds: [ids[0]], lockedElementIds: [ids[1]] })
  const found = selectableItems(store.getState()).map((item) => item.id)
  assert.ok(found.includes(ids[2]))
  assert.equal(found.includes(ids[0]), false)
  assert.equal(found.includes(ids[1]), false)
  store.getState().selectElements(found)
  assert.equal(store.getState().selectedIds.includes(ids[0]), false)
})

test('selectElements sustituye o añade y mantiene selectedId coherente', () => {
  const { store, ids } = storeWithChairs(3)
  store.getState().selectElements([ids[0]])
  assert.equal(store.getState().selectedId, ids[0])
  store.getState().selectElements([ids[1], ids[0]], true)
  assert.deepEqual(store.getState().selectedIds, [ids[0], ids[1]])
  assert.equal(store.getState().selectedId, null)
  store.getState().selectElements([])
  assert.deepEqual(store.getState().selectedIds, [])
})

test('pegar con una carpeta seleccionada coloca la copia dentro de esa carpeta', () => {
  const { store, ids } = storeWithChairs(1)
  store.getState().createElementFolder('Destino')
  const folder = store.getState().elementFolders.find((candidate) => candidate.name === 'Destino')!
  store.getState().selectElement(ids[0])
  assert.equal(store.getState().copySelected(), true)
  store.getState().selectElement(`folder:${folder.id}`)
  assert.equal(store.getState().pasteSelected(), true)
  const pasted = store.getState().selectedId!
  assert.notEqual(pasted, ids[0])
  assert.equal(store.getState().elementFolderAssignments[pasted], folder.id)
})

test('cortar elimina el original y pegar lo recoloca en la carpeta seleccionada en su posición', () => {
  const { store, ids } = storeWithChairs(1)
  store.getState().createElementFolder('Destino')
  const folder = store.getState().elementFolders.find((candidate) => candidate.name === 'Destino')!
  const original = store.getState().furniture.find((item) => item.id === ids[0])!
  store.getState().selectElement(ids[0])
  assert.equal(store.getState().cutSelected(), true)
  assert.equal(store.getState().furniture.length, 0)
  store.getState().selectElement(`folder:${folder.id}`)
  assert.equal(store.getState().pasteSelected(), true)
  const pasted = store.getState().furniture[0]
  assert.equal(store.getState().elementFolderAssignments[pasted.id], folder.id)
  assert.deepEqual([pasted.x, pasted.z], [original.x, original.z])
})

test('cortar una selección con un elemento bloqueado no tiene efectos parciales', () => {
  const { store, ids } = storeWithChairs(3)
  store.getState().toggleElementLock(ids[1])
  selectMany(store, ids)
  const before = JSON.stringify(persistedDesign(store.getState()))
  assert.equal(store.getState().cutSelected(), false)
  assert.equal(JSON.stringify(persistedDesign(store.getState())).includes('"notice"'), false)
  assert.equal(store.getState().furniture.length, 3)
  assert.equal(JSON.stringify(persistedDesign(store.getState())), before)
})
