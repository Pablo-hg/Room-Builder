import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shouldOrbitFront } from './cameraTransitions'

test('solo orbita en frontal al cambiar de pared, no al cambiar o mover una habitación', () => {
  const base = { view: 'front', wallView: 'north', activeRoomId: 'room', roomX: 0, roomY: 0, roomZ: 0 }
  assert.equal(shouldOrbitFront(base, { ...base, wallView: 'east' }), true)
  assert.equal(shouldOrbitFront(base, { ...base, activeRoomId: 'other', roomX: 5 }), false)
  assert.equal(shouldOrbitFront(base, { ...base, roomY: 3 }), false)
  assert.equal(shouldOrbitFront(base, { ...base }), false)
  assert.equal(shouldOrbitFront(base, { ...base, wallView: 'east', activeRoomId: 'other' }), false)
})
