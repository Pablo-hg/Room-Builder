import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { cameraAwareShiftDrag } from './cameraAwareShiftDrag'

test('Shift en cámara frontal deja fijo el eje Z y permite mover X e Y', () => {
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100)
  camera.position.set(0, 4, 10)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const start = { clientX: 100, clientY: 100, position: { x: 1, y: 0, z: 2 } }
  const next = cameraAwareShiftDrag(camera, { width: 800, height: 800 }, start, { clientX: 180, clientY: 50 })
  assert.equal(next.axis, 'x')
  assert.ok(next.x > 1)
  assert.ok(next.y > 0)
  assert.equal(next.z, 2)
})

test('Shift elige Z en una cámara lateral y mantiene X bloqueado', () => {
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100)
  camera.position.set(10, 4, 0)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const start = { clientX: 100, clientY: 100, position: { x: 1, y: 0, z: 2 } }
  const next = cameraAwareShiftDrag(camera, { width: 800, height: 800 }, start, { clientX: 180, clientY: 50 })
  assert.equal(next.axis, 'z')
  assert.equal(next.x, 1)
  assert.ok(next.z !== 2)
  assert.ok(next.y > 0)
})
