import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { beginWallSurfaceDrag, moveWallSurfaceDrag } from './wallSurfaceDrag'

function rayAt(from: THREE.Vector3, to: THREE.Vector3) {
  return new THREE.Ray(from.clone(), to.clone().sub(from).normalize())
}
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)

test('una pared norte permite subir Y y mover X sin alterar la distancia a la pared', () => {
  const eye = new THREE.Vector3(5, 4, 6)
  const start = { x: 0, y: 0.5, z: -2 }
  const drag = beginWallSurfaceDrag(rayAt(eye, new THREE.Vector3(0, 0.5, -2)), 0, start)!
  assert.ok(drag)
  const moved = moveWallSurfaceDrag(rayAt(eye, new THREE.Vector3(0.6, 1.2, -2)), drag)!
  near(moved.x, 0.6)
  near(moved.y, 1.2)
  near(moved.z, -2)
})

test('respeta el punto de agarre y no provoca saltos al comenzar el arrastre', () => {
  const eye = new THREE.Vector3(5, 4, 6)
  const start = { x: 0, y: 0.5, z: -2 }
  const hit = new THREE.Vector3(0.25, 0.8, -2)
  const drag = beginWallSurfaceDrag(rayAt(eye, hit), 0, start)!
  const unchanged = moveWallSurfaceDrag(rayAt(eye, hit), drag)!
  near(unchanged.x, start.x)
  near(unchanged.y, start.y)
  near(unchanged.z, start.z)
  const elevated = moveWallSurfaceDrag(rayAt(eye, new THREE.Vector3(hit.x + 0.3, hit.y + 0.5, hit.z)), drag)!
  near(elevated.x, start.x + 0.3)
  near(elevated.y, start.y + 0.5)
})

test('una pared girada conserva su plano mientras permite altura y movimiento tangente', () => {
  const yaw = Math.PI / 4
  const eye = new THREE.Vector3(5, 5, 6)
  const start = { x: 1.4, y: 0.5, z: -1.4 }
  const tangent = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
  const begin = new THREE.Vector3(start.x, start.y, start.z)
  const drag = beginWallSurfaceDrag(rayAt(eye, begin), yaw, start)!
  const target = begin.clone().addScaledVector(tangent, 0.6).add(new THREE.Vector3(0, 0.4, 0))
  const moved = moveWallSurfaceDrag(rayAt(eye, target), drag)!
  near(moved.x, target.x)
  near(moved.y, target.y)
  near(moved.z, target.z)
  near(Math.sin(yaw) * (moved.x - start.x) + Math.cos(yaw) * (moved.z - start.z), 0)
})

test('no genera posiciones inválidas cuando el rayo es paralelo a la pared', () => {
  const parallel = new THREE.Ray(new THREE.Vector3(1, 1, -2), new THREE.Vector3(1, 0, 0))
  assert.equal(beginWallSurfaceDrag(parallel, 0, { x: 0, y: 1, z: -1 }), null)
})
