import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ROOM_LIMITS } from '../domain/constants'
import { validateOpenings } from '../domain/geometry'
import { normalizeDesign } from '../persistence/designMigrations'
import { persistedDesign } from '../domain/designV1'
import { packRoomBox } from '../domain/roomEditing'
import { createRoomStore } from './useRoomStore'

test('todas las dimensiones de la habitación raíz admiten de 0,01 a 100 metros', () => {
  const store = createRoomStore()
  for (const dimension of ['width', 'depth', 'height'] as const) {
    store.getState().setDimension(dimension, 0.01)
    assert.equal(store.getState().room[dimension], 0.01)
  }
  assert.equal(validateOpenings(store.getState().room), null)
  const saved = persistedDesign(store.getState())
  assert.equal(normalizeDesign(saved).room.height, 0.01)
  for (const dimension of ['width', 'depth', 'height'] as const) {
    store.getState().setDimension(dimension, 100)
    assert.equal(store.getState().room[dimension], 100)
  }
  assert.equal(normalizeDesign(persistedDesign(store.getState())).room.width, 100)
})

test('no permite una dimensión nula y limita los valores fuera de rango', () => {
  const store = createRoomStore()
  store.getState().setDimension('width', 0)
  assert.equal(store.getState().room.width, ROOM_LIMITS.minWidth)
  store.getState().setDimension('depth', 1000)
  assert.equal(store.getState().room.depth, ROOM_LIMITS.maxDepth)
  store.getState().setDimension('height', -12)
  assert.equal(store.getState().room.height, ROOM_LIMITS.minHeight)
})

test('habitaciones adicionales mantienen sus superficies y pueden tener dimensiones pequeñas o grandes', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const id = store.getState().activeRoomId!
  for (const dimension of ['width', 'depth', 'height'] as const) {
    store.getState().setFocusedRoomDimension(dimension, 0.01)
    assert.equal(packRoomBox(store.getState().structurePacks.find((pack) => pack.id === id)!, store.getState().room)?.[dimension], 0.01)
  }
  const saved = persistedDesign(store.getState())
  assert.equal(normalizeDesign(saved).structurePacks?.length, 1)
  for (const dimension of ['width', 'depth', 'height'] as const) {
    store.getState().setFocusedRoomDimension(dimension, 100)
    assert.equal(packRoomBox(store.getState().structurePacks.find((pack) => pack.id === id)!, store.getState().room)?.[dimension], 100)
  }
})

test('las aperturas conservan la validación de límites en habitaciones normales', () => {
  const store = createRoomStore()
  const invalid = { ...store.getState().room, door: { ...store.getState().room.door, offset: 50 } }
  assert.match(validateOpenings(invalid) ?? '', /fuera/)
})
