import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { prioritizeTransformControls } from './interactionPriority'

test('prioriza las flechas o el aro de una superficie frente a elementos más cercanos', () => {
  const surface = new THREE.Mesh()
  const group = new THREE.Group()
  group.userData.structureSurfaceGizmo = 'surface'
  const handle = new THREE.Mesh()
  group.add(handle)
  const other = new THREE.Mesh()
  const hits = [surface, other, handle].map((object, index) => ({ object, distance: index + 1, point: new THREE.Vector3() })) as THREE.Intersection[]
  assert.deepEqual(prioritizeTransformControls(hits).map((hit) => hit.object), [handle, surface, other])
  assert.equal(hits[0].object, surface)
})
