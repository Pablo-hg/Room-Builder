import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { findAvailableOpeningOffset, validateOpenings, wallLength } from '../domain/geometry'
import { ROOM_LIMITS } from '../domain/constants'
import { structureDoorError } from '../domain/structureDoors'

test('buscar un hueco no relaja las distancias ni acepta paredes sin espacio', () => {
  assert.equal(findAvailableOpeningOffset(3, 2.7, 0, () => true), null)
  assert.equal(findAvailableOpeningOffset(4.5, 1.5, 2, (offset) => offset <= -0.5), -0.5)
  assert.equal(findAvailableOpeningOffset(4.5, 1.5, 2, () => false), null)
})

test('trasladar la puerta principal a una pared ocupada permite solapamientos con aviso visual', () => {
  const store = createRoomStore()
  store.getState().setDoor({ wall: 'north' })
  const room = store.getState().room
  assert.equal(room.door.wall, 'north')
  assert.equal(validateOpenings(room), null)
  assert.equal(room.door.offset, 0) // Solapar aperturas es válido: el panel de incidencias avisa.
})

test('una ventana fuera de rango en la nueva pared se recoloca sin modificar su anchura', () => {
  const store = createRoomStore()
  const id = store.getState().room.windows[0].id
  store.getState().updateWindow(id, { offset: 1.7 })
  assert.equal(store.getState().room.windows[0].offset, 1.7)
  store.getState().updateWindow(id, { wall: 'west' })
  const room = store.getState().room
  const window = room.windows.find((item) => item.id === id)!
  assert.equal(window.wall, 'west')
  assert.equal(window.width, store.getInitialState().room.windows[0].width)
  assert.ok(Math.abs(window.offset) <= wallLength(room, 'west') / 2 - window.width / 2 - ROOM_LIMITS.edgeMargin + 1e-8)
  assert.equal(validateOpenings(room), null)
  store.getState().undo()
  assert.equal(store.getState().room.windows[0].wall, 'north')
})

test('una puerta adicional de la raíz respeta el margen del destino', () => {
  const store = createRoomStore()
  const extraDoor = { id: 'extra-root', name: 'Puerta adicional', wall: 'north' as const, offset: 1.6, width: 1, height: 2.1, rotation: 0 }
  store.setState((state) => ({ room: { ...state.room, extraDoors: [extraDoor] } }))
  assert.equal(validateOpenings(store.getState().room), null)
  store.getState().setStructureDoor(extraDoor.id, { wall: 'west' })
  const room = store.getState().room
  const changed = room.extraDoors!.find((door) => door.id === extraDoor.id)!
  assert.equal(changed.wall, 'west')
  assert.equal(validateOpenings(room), null)
})

test('una puerta de habitación en planta superior encuentra hueco en una pared más corta', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  const extraDoor = { id: 'upper-door', name: 'Puerta alta', wall: 'north' as const, offset: 1.8, width: 1, height: 2.1, rotation: 0 }
  store.setState((state) => ({ structurePacks: state.structurePacks.map((candidate) => candidate.id === pack.id ? { ...candidate, doors: [extraDoor] } : candidate) }))
  store.getState().setStructureDoor(extraDoor.id, { wall: 'west' })
  const result = store.getState().structurePacks.find((candidate) => candidate.id === pack.id)!
  assert.equal(result.doors![0].wall, 'west')
  assert.equal(structureDoorError(result), null)
})
