import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign } from '../domain/designV1'
import { topViewWallForOrientation } from '../domain/geometry'
import { createRoomStore } from './useRoomStore'

test('el Plano gira en sus cuatro lados, en ambos sentidos, y vuelve al punto de partida', () => {
  const store = createRoomStore()
  store.getState().setView('top')
  const walls: string[] = [topViewWallForOrientation(store.getState().topOrientation)]
  for (let step = 0; step < 4; step++) { store.getState().rotateTop(1); walls.push(topViewWallForOrientation(store.getState().topOrientation)) }
  assert.equal(new Set(walls.slice(0, 4)).size, 4, 'cuatro paredes distintas arriba')
  assert.equal(walls[4], walls[0], 'cuatro cuartos de vuelta = vuelta completa')
  store.getState().rotateTop(-1)
  assert.equal(topViewWallForOrientation(store.getState().topOrientation), walls[3], 'sentido contrario')
  assert.ok(store.getState().topOrientation >= 0 && store.getState().topOrientation <= 3)
})

test('girar el Plano es solo cámara de sesión: ni diseño, ni historial, ni selección, ni cotas', () => {
  const store = createRoomStore()
  store.getState().setView('top')
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId
  store.getState().addMeasure({ x: 0, z: 0 }, { x: 4, z: 3 })
  store.setState({ hasUnsavedChanges: false })
  const before = { design: JSON.stringify(persistedDesign(store.getState())), undo: store.getState().undoCount }
  store.getState().rotateTop(1)
  store.getState().rotateTop(1)
  assert.equal(JSON.stringify(persistedDesign(store.getState())), before.design)
  assert.equal(store.getState().undoCount, before.undo)
  assert.equal(store.getState().selectedId, id)
  assert.equal(store.getState().hasUnsavedChanges, false)
  assert.equal(store.getState().view, 'top')
})

test('fuera de Plano girar no hace nada y la orientación se conserva al volver', () => {
  const store = createRoomStore()
  store.getState().setView('top')
  store.getState().rotateTop(1)
  const orientation = store.getState().topOrientation
  store.getState().setView('isometric')
  store.getState().rotateTop(1)
  assert.equal(store.getState().topOrientation, orientation)
})
