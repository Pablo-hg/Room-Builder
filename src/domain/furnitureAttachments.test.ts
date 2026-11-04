import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { canElevateFurniture, FURNITURE_CATALOG, FURNITURE_PRESETS, OPENING_CATALOG } from './objectCatalog'
import { elevatedFurniture } from './editingRules'
import { createRoomStore } from '../state/useRoomStore'
import { multiSelectionItems } from './multiSelection'

test('el anclaje depende del tipo: suelo, techo, pared o libre', () => {
  for (const kind of ['rug', 'circularRug'] as const) {
    assert.equal(FURNITURE_CATALOG[kind].capabilities.attachment, 'floor')
    assert.equal(canElevateFurniture({ kind, attachmentPolicy: 'by-type' }), false)
  }
  assert.equal(FURNITURE_CATALOG.ceilingLamp.capabilities.attachment, 'ceiling')
  assert.equal(canElevateFurniture({ kind: 'ceilingLamp', attachmentPolicy: 'by-type' }), false)
  for (const kind of ['lamp', 'tableLamp', 'bookshelf'] as const) {
    assert.equal(FURNITURE_CATALOG[kind].capabilities.attachment, 'free')
    assert.equal(canElevateFurniture({ kind, attachmentPolicy: 'by-type' }), true)
  }
  for (const kind of ['window', 'circularWindow', 'wallShelf', 'wallSconce', 'door'] as const) {
    assert.equal(OPENING_CATALOG[kind].capabilities.attachment, 'wall')
  }
})

test('las reglas y acciones rechazan Y en elementos fijados y permiten elevar lámparas libres', () => {
  for (const kind of ['rug', 'circularRug', 'ceilingLamp', 'lamp', 'tableLamp'] as const) {
    const store = createRoomStore({ read: () => [], write: () => {} })
    store.getState().addFurniture(kind)
    const item = store.getState().furniture[0]
    const before = structuredClone(item)
    const history = store.getState().undoCount
    store.getState().moveFurnitureVertically(item.id, 1)
    if (canElevateFurniture(item)) {
      assert.equal(store.getState().furniture[0].y, 1)
      store.getState().undo()
      assert.deepEqual(store.getState().furniture[0], before)
    } else {
      assert.deepEqual(store.getState().furniture[0], before)
      assert.equal(store.getState().undoCount, history)
      assert.equal(elevatedFurniture({ room: DEFAULT_ROOM, furniture: [item], gridSnap: true }, item, 1), null)
    }
  }
})

test('una selección mixta con un objeto fijado conserva sus posiciones relativas y rechaza Y', () => {
  const store = createRoomStore({ read: () => [], write: () => {} })
  const furniture = [
    { ...FURNITURE_PRESETS.rug, id: 'rug', attachmentPolicy: 'by-type' as const, x: -1.5, y: 0, z: 0, rotation: 0 },
    { ...FURNITURE_PRESETS.tableLamp, id: 'lamp', x: 1.5, y: 0, z: 0, rotation: 0 },
  ]
  store.setState({ furniture, selectedIds: ['rug', 'lamp'], selectedId: null })
  const items = multiSelectionItems(store.getState())
  assert.deepEqual(items.find((item) => item.id === 'rug')!.axes, ['x', 'z'])
  const history = store.getState().undoCount
  store.getState().moveSelectedFurnitureGroup('y', 1)
  assert.deepEqual(store.getState().furniture, furniture)
  assert.equal(store.getState().undoCount, history)
  store.getState().moveSelectedFurnitureGroup('z', 0.5)
  assert.equal(store.getState().furniture[0].z, 0.5)
  assert.equal(store.getState().furniture[1].z, 0.5)
  assert.equal(store.getState().furniture[0].y, 0)
})
