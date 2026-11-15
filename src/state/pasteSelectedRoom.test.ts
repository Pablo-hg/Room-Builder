import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { folderSelectionId, ROOT_ROOM_FOLDER } from '../domain/elementFolders'
import { focusedCreationTarget, packRoomBox } from '../domain/roomEditing'
import { packWindowById } from '../domain/structureWindows'
import { persistedDesign } from '../domain/designV1'
import { normalizeDesign } from '../persistence/designMigrations'

for (const cut of [false, true]) for (const direction of ['east', 'up'] as const) {
  test(`${cut ? 'cortar' : 'copiar'} mueble a habitación seleccionada ${direction}, sin cambiar cámara`, () => {
    const store = createRoomStore()
    store.getState().addFurniture('chair')
    const id = store.getState().selectedId!
    const original = structuredClone(store.getState().furniture.find((item) => item.id === id)!)
    store.getState().addStructurePack(direction)
    const pack = store.getState().structurePacks.find((item) => item.id === store.getState().activeRoomId)!
    const target = focusedCreationTarget(store.getState())
    store.getState().setActiveRoomId(null)
    store.getState().selectElement(id)
    assert.equal(cut ? store.getState().cutSelected() : store.getState().copySelected(), true)
    store.getState().selectElement(folderSelectionId(target.folderId!))
    assert.equal(store.getState().pasteSelected(), true)
    const pasted = store.getState().furniture.find((item) => item.id === store.getState().selectedId)!
    assert.ok(pasted)
    assert.equal(store.getState().activeRoomId, null)
    assert.equal(store.getState().elementFolderAssignments[pasted.id], target.folderId)
    assert.ok(Math.abs(pasted.x - (original.x + target.center.x)) < 0.011)
    assert.ok(Math.abs(pasted.z - (original.z + target.center.z)) < 0.011)
    assert.ok(Math.abs(pasted.y - (original.y + target.center.y)) < 0.011)
    assert.equal(pasted.id === id, cut)
    assert.ok(packRoomBox(pack, store.getState().room))
    store.getState().undo()
    assert.equal(store.getState().furniture.some((item) => item.id === pasted.id && item.x === pasted.x && item.y === pasted.y && item.z === pasted.z), false)
    store.getState().redo()
    assert.ok(store.getState().furniture.some((item) => item.id === pasted.id))
  })
}

test('cortar un objeto mural a otra habitación conserva su identidad y lo ancla allí', () => {
  const store = createRoomStore()
  store.getState().addWindow('pictureSmall')
  const id = store.getState().selectedId!
  const original = structuredClone(store.getState().room.windows.find((item) => item.id === id)!)
  store.getState().addStructurePack('east')
  const pack = store.getState().structurePacks.find((item) => item.id === store.getState().activeRoomId)!
  const folder = store.getState().elementFolderAssignments[pack.id]
  store.getState().setActiveRoomId(null)
  store.getState().selectElement(id)
  assert.equal(store.getState().cutSelected(), true)
  store.getState().selectElement(folderSelectionId(folder))
  assert.equal(store.getState().pasteSelected(), true)
  const pasted = packWindowById(store.getState().structurePacks, id)
  assert.equal(pasted?.pack.id, pack.id)
  assert.equal(pasted?.window.wall, original.wall)
  assert.equal(store.getState().elementFolderAssignments[id], folder)
  assert.equal(store.getState().activeRoomId, null)
  assert.equal(store.getState().room.windows.some((item) => item.id === id), false)
})

test('pegar en Raíz usa Raíz aunque la cámara enfoque otra habitación', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  assert.equal(store.getState().copySelected(), true)
  const camera = store.getState().activeRoomId
  store.getState().selectElement(folderSelectionId(ROOT_ROOM_FOLDER))
  assert.equal(store.getState().pasteSelected(), true)
  const pasted = store.getState().furniture.find((item) => item.id === store.getState().selectedId)!
  assert.equal(store.getState().activeRoomId, camera)
  assert.equal(store.getState().elementFolderAssignments[pasted.id], ROOT_ROOM_FOLDER)
  assert.ok(Math.abs(pasted.x) < store.getState().room.width / 2)
})

test('una selección múltiple cortada se pega junta y se puede deshacer', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const first = store.getState().selectedId!
  store.getState().addFurniture('chair')
  const second = store.getState().selectedId!
  store.getState().addStructurePack('east')
  const destination = focusedCreationTarget(store.getState())
  store.getState().setActiveRoomId(null)
  store.getState().selectElements([first, second])
  assert.equal(store.getState().cutSelected(), true)
  store.getState().selectElement(folderSelectionId(destination.folderId!))
  assert.equal(store.getState().pasteSelected(), true)
  for (const id of [first, second]) {
    assert.equal(store.getState().elementFolderAssignments[id], destination.folderId)
    const item = store.getState().furniture.find((entry) => entry.id === id)!
    assert.ok(Math.abs(item.x - destination.center.x) < destination.size.width / 2)
  }
  store.getState().undo()
  assert.ok(!store.getState().furniture.some((item) => [first, second].includes(item.id)))
  store.getState().undo()
  assert.ok([first, second].every((id) => store.getState().furniture.some((item) => item.id === id)))
})

test('si el destino no admite el objeto cortado, el portapapeles sigue disponible', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  store.getState().addStructurePack('east')
  const target = focusedCreationTarget(store.getState())
  store.getState().setActiveRoomId(null)
  store.getState().selectElement(id)
  assert.equal(store.getState().cutSelected(), true)
  store.getState().selectElement(folderSelectionId(target.folderId!))
  store.getState().toggleElementLock(store.getState().structurePacks[0].id)
  assert.equal(store.getState().pasteSelected(), false)
  assert.equal(store.getState().furniture.some((item) => item.id === id), false)
  store.getState().toggleElementLock(store.getState().structurePacks[0].id)
  assert.equal(store.getState().pasteSelected(), true)
  assert.equal(store.getState().furniture.some((item) => item.id === id), true)
})

test('un objeto mural cortado desde otra habitación puede pegarse y guardarse en Raíz', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  store.getState().addWindow('pictureSmall')
  const id = store.getState().selectedId!
  assert.ok(packWindowById(store.getState().structurePacks, id))
  assert.equal(store.getState().cutSelected(), true)
  store.getState().selectElement(folderSelectionId(ROOT_ROOM_FOLDER))
  assert.equal(store.getState().pasteSelected(), true)
  assert.ok(store.getState().room.windows.some((item) => item.id === id))
  assert.equal(packWindowById(store.getState().structurePacks, id), null)
  const loaded = normalizeDesign(persistedDesign(store.getState()))
  assert.ok(loaded.room.windows.some((item) => item.id === id))
  assert.equal(loaded.elementFolderAssignments?.[id], ROOT_ROOM_FOLDER)
})
