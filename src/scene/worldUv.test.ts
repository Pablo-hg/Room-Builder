import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { applyWorldUv, applyWorldUvToTexturedMeshes } from './worldUv'

test('UV en metros: cada cara usa los ejes de su normal dominante', () => {
  const box = new THREE.BoxGeometry(2, 0.5, 3)
  applyWorldUv(box)
  const position = box.getAttribute('position'), normal = box.getAttribute('normal'), uv = box.getAttribute('uv')
  assert.equal(uv.count, position.count)
  for (let i = 0; i < position.count; i++) {
    if (normal.getY(i) > 0.5) {
      assert.ok(Math.abs(uv.getX(i) - position.getX(i)) < 1e-9, 'tapa superior: u = x')
      assert.ok(Math.abs(uv.getY(i) + position.getZ(i)) < 1e-9, 'tapa superior: v = -z')
    }
    if (normal.getZ(i) > 0.5) {
      assert.ok(Math.abs(uv.getX(i) - position.getX(i)) < 1e-9, 'frontal: u = x')
      assert.ok(Math.abs(uv.getY(i) - position.getY(i)) < 1e-9, 'frontal: v = y')
    }
  }
})

test('sin posición o normal no hace nada y no lanza', () => {
  const empty = new THREE.BufferGeometry()
  assert.equal(applyWorldUv(empty), empty)
  assert.equal(empty.getAttribute('uv'), undefined)
})

test('con la transformación de la pieza el patrón cubre más metros en vez de estirarse', () => {
  const box = new THREE.BoxGeometry(1, 1, 1)
  applyWorldUv(box, new THREE.Matrix4().makeScale(3, 1, 2))
  const position = box.getAttribute('position'), normal = box.getAttribute('normal'), uv = box.getAttribute('uv')
  for (let i = 0; i < position.count; i++) {
    if (normal.getY(i) > 0.5) {
      assert.ok(Math.abs(uv.getX(i) - position.getX(i) * 3) < 1e-9, 'tapa superior: u = x × escala')
      assert.ok(Math.abs(uv.getY(i) + position.getZ(i) * 2) < 1e-9, 'tapa superior: v = −z × escala')
    }
  }
})

test('solo recalcula las piezas con la textura y respeta el escalado del grupo', () => {
  const texture = new THREE.Texture()
  const root = new THREE.Group()
  const scaled = new THREE.Group()
  scaled.scale.set(2, 1, 1)
  root.add(scaled)
  const withMap = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: texture }))
  const plain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial())
  const before = Array.from(plain.geometry.getAttribute('uv').array)
  scaled.add(withMap, plain)
  applyWorldUvToTexturedMeshes(root, texture)
  const uv = withMap.geometry.getAttribute('uv'), position = withMap.geometry.getAttribute('position'), normal = withMap.geometry.getAttribute('normal')
  for (let i = 0; i < position.count; i++) {
    if (normal.getZ(i) > 0.5) assert.ok(Math.abs(uv.getX(i) - position.getX(i) * 2) < 1e-9, 'el escalado del grupo entra en el patrón')
  }
  assert.deepEqual(Array.from(plain.geometry.getAttribute('uv').array), before, 'sin textura no se toca')
})
