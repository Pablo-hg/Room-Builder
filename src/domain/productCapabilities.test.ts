import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capabilitiesForMode, PRODUCT_CAPABILITIES, supportsFeature, supportsRoomCount } from './productCapabilities'

test('separa las capacidades de la modalidad completa y la Mini', () => {
  const full = capabilitiesForMode('full')
  const mini = capabilitiesForMode('mini')

  assert.equal(full.mode, 'full')
  assert.equal(full.maxRooms, null)
  assert.equal(full.multiRoom, true)
  assert.equal(full.layoutVariants, true)
  assert.equal(full.editableJson, true)
  assert.equal(full.glbExport, true)
  assert.equal(full.catalog, 'full')
  assert.equal(full.contextualNavigation, false)

  assert.equal(mini.mode, 'mini')
  assert.equal(mini.maxRooms, 1)
  assert.equal(mini.multiRoom, false)
  assert.equal(mini.layoutVariants, false)
  assert.equal(mini.editableJson, false)
  assert.equal(mini.glbExport, false)
  assert.equal(mini.catalog, 'reduced')
  assert.equal(mini.contextualNavigation, true)
})

test('las capacidades son copias y no se pueden mutar desde fuera', () => {
  assert.equal(Object.isFrozen(PRODUCT_CAPABILITIES.full), true)
  assert.equal(Object.isFrozen(PRODUCT_CAPABILITIES.mini), true)
  const full = capabilitiesForMode('full')
  full.multiRoom = false
  assert.equal(PRODUCT_CAPABILITIES.full.multiRoom, true)
  assert.notEqual(full, PRODUCT_CAPABILITIES.full)
})

test('los límites y funciones se consultan sin mezclar modalidades', () => {
  const full = capabilitiesForMode('full')
  const mini = capabilitiesForMode('mini')
  assert.equal(supportsRoomCount(full, 1), true)
  assert.equal(supportsRoomCount(full, 12), true)
  assert.equal(supportsRoomCount(mini, 1), true)
  assert.equal(supportsRoomCount(mini, 2), false)
  assert.equal(supportsRoomCount(mini, 0), false)
  assert.equal(supportsFeature(full, 'multiRoom'), true)
  assert.equal(supportsFeature(mini, 'multiRoom'), false)
  assert.equal(supportsFeature(mini, 'contextualNavigation'), true)
})
