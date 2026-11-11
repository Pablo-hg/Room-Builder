import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cameraFarPlane, MIN_CAMERA_FAR } from './cameraClipping'

test('las salas pequeñas conservan el plano lejano habitual', () => {
  assert.equal(cameraFarPlane([{ x: 12, y: 8, z: 12 }], [{ x: 0, y: 0, z: 0, width: 4, depth: 3, height: 2.7 }]), MIN_CAMERA_FAR)
})

test('una sala de 50 × 50 × 15 m queda entera dentro del plano lejano', () => {
  const box = { x: 0, y: 0, z: 0, width: 50, depth: 50, height: 15 }
  // Posición aproximada de la cámara frontal para esa sala: 3 × 50 + 10 m.
  const camera = { x: 0, y: 7.5, z: 160 }
  const far = cameraFarPlane([camera], [box])
  const farthestCorner = Math.hypot(25, 7.5, 185)
  assert.ok(far > farthestCorner, `${far} debe superar ${farthestCorner}`)
})

test('cubre el origen y el destino de una transición y todas las habitaciones', () => {
  const rooms = [{ x: 0, y: 0, z: 0, width: 4, depth: 4, height: 3 }, { x: 0, y: 3, z: 120, width: 4, depth: 4, height: 3 }]
  const far = cameraFarPlane([{ x: 0, y: 10, z: 0 }, { x: 0, y: 10, z: -30 }], rooms)
  assert.ok(far > Math.hypot(2, 10, 152))
})
