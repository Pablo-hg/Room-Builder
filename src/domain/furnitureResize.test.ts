import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { resizedFurniture, resizedWallObject } from './furnitureResize'
import { FURNITURE_PRESETS } from './objectCatalog'

test('el redimensionado conserva el centro de la base y rechaza fracciones de centímetro sin mutar el original', () => {
  const item = { ...FURNITURE_PRESETS.chair, id: 'chair', x: 0.24, y: 0.13, z: -0.2, rotation: 0 }
  const original = structuredClone(item)
  const valid = resizedFurniture(item, DEFAULT_ROOM, 'height', 1.15)
  assert.ok(valid.value)
  assert.deepEqual([valid.value.x, valid.value.y, valid.value.z, valid.value.height], [0.24, 0.13, -0.2, 1.15])
  assert.ok(resizedFurniture(item, DEFAULT_ROOM, 'height', 1.154).error)
  assert.deepEqual(item, original)
})

test('los anclajes nuevos se conservan y los objetos antiguos mantienen su posición', () => {
  const lamp = { ...FURNITURE_PRESETS.ceilingLamp, id: 'lamp', x: 0, y: 1.03, z: 0, rotation: 0 }
  const legacy = resizedFurniture(lamp, DEFAULT_ROOM, 'height', 0.8)
  const attached = resizedFurniture({ ...lamp, attachmentPolicy: 'by-type' }, DEFAULT_ROOM, 'height', 0.8)
  assert.equal(legacy.value?.y, 1.03)
  assert.equal(attached.value?.y, DEFAULT_ROOM.height - 0.8)
  const rug = { ...FURNITURE_PRESETS.circularRug, id: 'rug', x: 0, y: 0, z: 0, rotation: 0, attachmentPolicy: 'by-type' as const }
  const round = resizedFurniture(rug, DEFAULT_ROOM, 'width', 1.15)
  assert.equal(round.value?.width, 1.15)
  assert.equal(round.value?.depth, 1.15)
  assert.equal(round.value?.y, 0)
})

test('las ventanas rechazan dimensiones inválidas y mantienen intacta la habitación original', () => {
  const room = structuredClone(DEFAULT_ROOM)
  const original = structuredClone(room)
  const opening = room.windows[0]
  assert.ok(opening)
  assert.ok(resizedWallObject(room, opening, 'width', 1.154).error)
  assert.ok(resizedWallObject(room, opening, 'width', 9).error)
  assert.deepEqual(room, original)
})
