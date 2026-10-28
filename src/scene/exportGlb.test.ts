import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { createGlbExportRoot } from './exportGlb'

test('prepara una copia GLB sin helpers ni hit areas y conserva la escena original', () => {
  const root = new THREE.Group()
  root.visible = false
  root.position.set(1, 2, 3)
  const visible = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
  visible.name = 'visible'
  const hidden = visible.clone()
  hidden.name = 'hidden'
  hidden.visible = false
  const helpers = [
    new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()),
    new THREE.Sprite(), new THREE.PerspectiveCamera(), new THREE.AmbientLight(),
    new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ colorWrite: false })),
    new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial({ colorWrite: false })]),
  ]
  root.add(visible, hidden, ...helpers)
  const exported = createGlbExportRoot(root)
  assert.notEqual(exported, root)
  assert.equal(exported.visible, true)
  assert.equal(root.visible, false)
  assert.deepEqual(exported.position.toArray(), [1, 2, 3])
  assert.deepEqual(exported.children.map((object) => object.name), ['visible', 'hidden'])
  assert.equal(exported.children[1].visible, false) // onlyVisible del exportador lo excluye al serializar.
  assert.equal(root.children.length, 8)
  assert.ok(helpers.every((object) => object.parent === root))
  assert.notEqual(exported.children[0], visible)
})
