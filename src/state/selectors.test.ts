import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shallow } from 'zustand/shallow'
import { selectActiveDesignName, selectEditorHeader, selectEditorScene, selectEditorShortcuts } from './selectors'
import { createRoomStore } from './useRoomStore'

test('los selectores mantienen las referencias de la cabecera y los atajos durante movimientos sucesivos', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  const token = store.getState().beginHistoryGesture()
  store.getState().moveFurniture(id, 0.5, 0)
  const header = selectEditorHeader(store.getState())
  const shortcuts = selectEditorShortcuts(store.getState())
  const scene = selectEditorScene(store.getState())
  store.getState().moveFurniture(id, 1, 0)
  assert.equal(shallow(header, selectEditorHeader(store.getState())), true)
  assert.equal(shallow(shortcuts, selectEditorShortcuts(store.getState())), true)
  assert.equal(shallow(scene, selectEditorScene(store.getState())), false)
  store.getState().commitHistoryGesture(token)
  store.getState().undo()
  assert.equal(shallow(header, selectEditorHeader(store.getState())), false)
})

test('cámara, selección y avisos actualizan solo las suscripciones que los necesitan', () => {
  const store = createRoomStore()
  const header = selectEditorHeader(store.getState())
  const scene = selectEditorScene(store.getState())
  store.getState().selectElement('door')
  store.getState().clearNotice()
  assert.equal(shallow(scene, selectEditorScene(store.getState())), true)
  store.getState().setIsoAngle(Math.PI / 4 + 0.1)
  assert.equal(shallow(header, selectEditorHeader(store.getState())), true)
  assert.equal(shallow(scene, selectEditorScene(store.getState())), false)
  store.getState().setView('top')
  assert.equal(shallow(header, selectEditorHeader(store.getState())), false)
  store.setState({ savedDesigns: [{ id: 'named', name: 'Salón nuevo', savedAt: '', data: { version: 1, room: store.getState().room, furniture: [], gridSnap: true } }], selectedSavedDesignId: 'named' })
  assert.equal(selectActiveDesignName(store.getState()), 'Salón nuevo')
  store.setState({ selectedSavedDesignId: '' })
  assert.equal(selectActiveDesignName(store.getState()), 'Room Builder')
})
