import test from 'node:test'
import assert from 'node:assert/strict'

test('store diagnostics describe accepted changes, rejection and cancellation without changing undo', async () => {
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })
  try {
    const { createRoomStore } = await import('../state/useRoomStore')
    const { diagnostics } = await import('./engine')
    const store = createRoomStore({ read: () => [], write: () => undefined })
    store.getState().addFurniture('chair')
    const id = store.getState().furniture[0].id
    const start = diagnostics.snapshot().length
    const token = store.getState().beginHistoryGesture(id)
    store.getState().moveFurniture(id, .5, .25)
    store.getState().cancelHistoryGesture(token)
    const events = diagnostics.snapshot().slice(start)
    assert.equal(events.filter((event) => event.phase === 'finished').length, 1)
    assert.equal(events.find((event) => event.result === 'cancelled')?.data.changesApplied, true)
    assert.equal(store.getState().furniture[0].x, .5)
    store.getState().undo()
    assert.equal(store.getState().furniture[0].x, 0)
    store.getState().setDimension('width', .1)
    diagnostics.flush()
    assert.ok(diagnostics.snapshot().some((event) => event.action === 'editor.setDimension'))
  } finally { Reflect.deleteProperty(globalThis, 'window') }
})

test('a gesture with no effective changes is not reported as completed', async () => {
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })
  try {
    const { createRoomStore } = await import('../state/useRoomStore')
    const { diagnostics } = await import('./engine')
    const store = createRoomStore({ read: () => [], write: () => undefined })
    store.getState().addFurniture('chair')
    const id = store.getState().furniture[0].id
    const before = diagnostics.snapshot().length
    const token = store.getState().beginHistoryGesture(id)
    store.getState().cancelHistoryGesture(token)
    diagnostics.flush()
    const events = diagnostics.snapshot().slice(before)
    assert.equal(events.filter((event) => event.action === 'editor.gesture' && event.result === 'completed').length, 0)
  } finally { Reflect.deleteProperty(globalThis, 'window') }
})
