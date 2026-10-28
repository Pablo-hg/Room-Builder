import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign, persistedDesignSignature } from '../domain/designV1'
import { structureSurfaceElementId } from '../domain/elementIds'
import { createRoomStore } from './useRoomStore'

for (const kind of ['mueble', 'giro de mueble', 'puerta', 'ventana', 'superficie', 'giro de superficie'] as const) {
  test(`un gesto de ${kind} genera un solo undo/redo`, () => {
    const store = createRoomStore()
    let update: (step: number) => void
    if (kind === 'mueble' || kind === 'giro de mueble') {
      store.getState().addFurniture('chair')
      const id = store.getState().selectedId!
      update = kind === 'mueble'
        ? (step) => store.getState().moveFurniture(id, step * 0.25, 0)
        : (step) => store.getState().setFurnitureRotation(id, step * Math.PI / 12)
    } else if (kind === 'puerta' || kind === 'ventana') {
      const id = kind === 'puerta' ? 'door' : 'window-1'
      store.getState().selectElement(id)
      update = kind === 'puerta'
        ? (step) => store.getState().setDoor({ offset: step * 0.125 })
        : (step) => store.getState().updateWindow(id, { offset: step * 0.25 })
    } else {
      store.getState().addStructurePack()
      const packId = store.getState().structurePacks[0].id
      const surfaceId = kind === 'superficie' ? 'floor' : 'wall-north'
      store.getState().selectElement(structureSurfaceElementId(packId, surfaceId))
      update = kind === 'superficie'
        ? (step) => store.getState().moveStructureSurface(packId, 'floor', 'x', step * 0.25)
        : (step) => store.getState().setStructureSurfaceRotation(packId, surfaceId, step * 0.25)
    }
    const count = store.getState().undoCount
    const before = persistedDesignSignature(persistedDesign(store.getState()))
    const token = store.getState().beginHistoryGesture()
    update(1)
    update(2)
    const after = persistedDesignSignature(persistedDesign(store.getState()))
    assert.notEqual(after, before)
    assert.equal(store.getState().undoCount, count + 1)
    store.getState().commitHistoryGesture(token)
    assert.equal(store.getState().isHistoryGestureActive(token), false)
    store.getState().undo()
    assert.equal(persistedDesignSignature(persistedDesign(store.getState())), before)
    store.getState().redo()
    assert.equal(persistedDesignSignature(persistedDesign(store.getState())), after)
  })
}

test('cancelar conserva la última posición y separa el gesto de la siguiente edición', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  const token = store.getState().beginHistoryGesture()
  store.getState().moveFurniture(id, 0.5, 0)
  store.getState().moveFurniture(id, 1, 0)
  store.getState().cancelHistoryGesture(token)
  store.getState().cancelHistoryGesture(token)
  assert.equal(store.getState().furniture[0].x, 1)
  store.getState().moveFurniture(id, 1.5, 0)
  store.getState().undo()
  assert.equal(store.getState().furniture[0].x, 1)
  store.getState().undo()
  assert.equal(store.getState().furniture[0].x, 0)
})

test('los gestos sin cambios, bloqueados o solo de sesión no alteran undo ni redo', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  store.getState().moveFurniture(id, 0.5, 0)
  store.getState().undo()
  store.getState().selectElement(id)
  const before = [store.getState().undoCount, store.getState().redoCount]
  const token = store.getState().beginHistoryGesture()
  store.getState().moveFurniture(id, 0, 0)
  store.getState().setDoor({ offset: 100 })
  store.getState().clearNotice()
  store.getState().cancelHistoryGesture(token)
  assert.deepEqual([store.getState().undoCount, store.getState().redoCount], before)
  store.getState().redo()
  assert.equal(store.getState().furniture[0].x, 0.5)
})

test('la selección, vista, undo y redo cierran la transacción y los tokens antiguos no cierran otra', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  const old = store.getState().beginHistoryGesture()
  store.getState().moveFurniture(id, 0.5, 0)
  store.getState().selectElement('door')
  assert.equal(store.getState().isHistoryGestureActive(old), false)
  const next = store.getState().beginHistoryGesture()
  store.getState().setDoor({ offset: 0.125 })
  store.getState().cancelHistoryGesture(old)
  assert.equal(store.getState().isHistoryGestureActive(next), true)
  store.getState().setDoor({ offset: 0.25 })
  store.getState().setView('top')
  assert.equal(store.getState().isHistoryGestureActive(next), false)
  const pending = store.getState().beginHistoryGesture()
  store.getState().undo()
  assert.equal(store.getState().isHistoryGestureActive(pending), false)
  assert.equal(store.getState().room.door.offset, 0)
  assert.equal(store.getState().furniture[0].x, 0.5)
  const beforeRedo = store.getState().beginHistoryGesture()
  store.getState().redo()
  assert.equal(store.getState().isHistoryGestureActive(beforeRedo), false)
  assert.equal(store.getState().room.door.offset, 0.25)
})

test('los gestos independientes conservan el límite de historial y no se serializan ni comparten', () => {
  const store = createRoomStore()
  const other = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  for (let step = 0; step < 60; step++) store.getState().setFloorColor(step % 2 ? '#123456' : '#abcdef')
  const token = store.getState().beginHistoryGesture()
  store.getState().moveFurniture(id, 0.5, 0)
  store.getState().moveFurniture(id, 1, 0)
  other.getState().cancelHistoryGesture(token)
  assert.equal(store.getState().isHistoryGestureActive(token), true)
  assert.equal(store.getState().undoCount, 50)
  assert.equal(other.getState().undoCount, 0)
  assert.equal(JSON.stringify(persistedDesign(store.getState())).includes('history-gesture'), false)
  store.getState().commitHistoryGesture(token)
  store.getState().undo()
  assert.equal(store.getState().furniture[0].x, 0)
  store.getState().redo()
  assert.equal(store.getState().furniture[0].x, 1)
})

test('iniciar otro gesto sobre el mismo objeto cierra el anterior aunque falte su evento de fin', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  const first = store.getState().beginHistoryGesture()
  store.getState().moveFurniture(id, 0.5, 0)
  const second = store.getState().beginHistoryGesture()
  store.getState().moveFurniture(id, 1, 0)
  store.getState().commitHistoryGesture(first)
  assert.equal(store.getState().isHistoryGestureActive(second), true)
  store.getState().moveFurniture(id, 1.5, 0)
  store.getState().commitHistoryGesture(second)
  store.getState().undo()
  assert.equal(store.getState().furniture[0].x, 0.5)
  store.getState().undo()
  assert.equal(store.getState().furniture[0].x, 0)
})
