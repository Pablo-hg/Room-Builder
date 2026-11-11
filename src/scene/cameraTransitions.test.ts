import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { shouldOrbitFront, spatialCameraOrbit, spatialCameraPosition } from './cameraTransitions'

test('solo orbita en frontal al cambiar de pared, no al cambiar o mover una habitación', () => {
  const base = { view: 'front', wallView: 'north', activeRoomId: 'room', roomX: 0, roomY: 0, roomZ: 0 }
  assert.equal(shouldOrbitFront(base, { ...base, wallView: 'east' }), true)
  assert.equal(shouldOrbitFront(base, { ...base, activeRoomId: 'other', roomX: 5 }), false)
  assert.equal(shouldOrbitFront(base, { ...base, roomY: 3 }), false)
  assert.equal(shouldOrbitFront(base, { ...base }), false)
  assert.equal(shouldOrbitFront(base, { ...base, wallView: 'east', activeRoomId: 'other' }), false)
})

test('isométrica a Plano en una habitación desplazada y bajo la raíz llega al destino sin salto final', () => {
  const center = new THREE.Vector3(8, -3 + 1.35, 11)
  const from = new THREE.Vector3(16, 4, 19)
  const to = new THREE.Vector3(8, 9, 11)
  const orbit = spatialCameraOrbit(from, to, center, center)
  assert.ok(spatialCameraPosition(orbit, 0).distanceTo(from) < 1e-9)
  assert.ok(spatialCameraPosition(orbit, 1).distanceTo(to) < 1e-9)
  assert.ok(spatialCameraPosition(orbit, 0.9999).distanceTo(to) < 0.01)
})

test('el paneo de Plano y una transición interrumpida conservan ambos extremos reales', () => {
  for (const [from, to, a, b] of [
    [new THREE.Vector3(12, 4, 15), new THREE.Vector3(10, 9, 8), new THREE.Vector3(8, -1.65, 11), new THREE.Vector3(10, -1.65, 8)],
    [new THREE.Vector3(10.2, 8, 8.5), new THREE.Vector3(16, 4, 19), new THREE.Vector3(10, -1.65, 8), new THREE.Vector3(8, -1.65, 11)],
  ]) {
    const orbit = spatialCameraOrbit(from, to, a, b)
    assert.ok(spatialCameraPosition(orbit, 0).distanceTo(from) < 1e-9)
    assert.ok(spatialCameraPosition(orbit, 1).distanceTo(to) < 1e-9)
  }
})
