import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { axisControlScale } from './axisSizing'

test('mantiene el tamaño del control al cambiar zoom o distancia y limita valores extremos', () => {
  const orthographic = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100)
  const point = new THREE.Vector3(0, 0, -2)
  const initial = axisControlScale(orthographic, 1000, point)
  orthographic.zoom = 2
  assert.ok(Math.abs(axisControlScale(orthographic, 1000, point) * 2 - initial) < 1e-9)
  orthographic.zoom = 1000
  assert.equal(axisControlScale(orthographic, 1000, point), 0.16)
  const perspective = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
  perspective.updateMatrixWorld()
  const near = axisControlScale(perspective, 1000, point)
  const far = axisControlScale(perspective, 1000, new THREE.Vector3(0, 0, -4))
  assert.ok(Math.abs(far - 2 * near) < 1e-9)
  assert.equal(axisControlScale(perspective, 1000, new THREE.Vector3(0, 0, -1000)), 3)
})
