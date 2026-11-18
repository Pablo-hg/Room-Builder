import assert from 'node:assert/strict'
import { test } from 'node:test'
import { finishFromLegacyColor, MATERIAL_CATALOG, parseMaterialFinish, validateDesignMaterials } from './materials'

test('el catálogo cubre los acabados aprobados con identificadores únicos', () => {
  assert.deepEqual(MATERIAL_CATALOG.map((entry) => entry.id), [
    'paint', 'wood', 'tile', 'stone', 'wallpaper', 'fabric',
    'stucco', 'herringbone', 'hydraulic-tile', 'terrazzo', 'botanical', 'corduroy',
    'pine', 'oak', 'popcorn', 'brick', 'glazed-ceramic',
  ])
  assert.equal(new Set(MATERIAL_CATALOG.map((entry) => entry.id)).size, MATERIAL_CATALOG.length)
})

test('un color anterior se interpreta como pintura sin alterar su valor', () => {
  assert.deepEqual(finishFromLegacyColor('#A1b2C3'), { id: 'paint', color: '#A1b2C3', scale: 1, rotation: 0 })
  assert.deepEqual(finishFromLegacyColor('#aBc'), { id: 'paint', color: '#aaBBcc', scale: 1, rotation: 0 })
  assert.equal(finishFromLegacyColor('red'), null)
})

test('al copiar un acabado se conservan solo sus parámetros, sin geometría', () => {
  const source = { id: 'wallpaper' as const, color: '#123456', scale: 2, rotation: 90, x: 99 }
  assert.deepEqual(parseMaterialFinish(source), { id: 'wallpaper', color: '#123456', scale: 2, rotation: 90 })
})

test('la validación rechaza identificadores, colores y parámetros inválidos', () => {
  const valid = { id: 'wood', color: '#abcdef', scale: 1, rotation: 0 }
  for (const patch of [{ id: 'unknown' }, { color: '#fff' }, { scale: 0 }, { scale: Infinity }, { rotation: NaN }, { rotation: 360 }]) {
    assert.equal(parseMaterialFinish({ ...valid, ...patch }), null)
  }
  assert.deepEqual(parseMaterialFinish(valid), valid)
})

test('la validación versionada admite acabados en cualquier elemento y rechaza campos inválidos', () => {
  const wood = { id: 'wood', color: '#abcdef', scale: 1, rotation: 90 }
  const wallpaper = { ...wood, id: 'wallpaper' }
  assert.doesNotThrow(() => validateDesignMaterials({ version: 14, room: {}, furniture: [] }))
  assert.throws(() => validateDesignMaterials({ version: 14, room: { floorMaterial: wood }, furniture: [] }), /v15/)
  assert.doesNotThrow(() => validateDesignMaterials({ version: 15, room: { floorMaterial: wood, wallMaterials: { north: wallpaper } }, furniture: [{ material: wood }] }))
  assert.doesNotThrow(() => validateDesignMaterials({ version: 15, room: { floorMaterial: wallpaper }, furniture: [] }))
  assert.throws(() => validateDesignMaterials({ version: 15, room: { wallMaterials: { techo: wood } }, furniture: [] }), /pared/)
  assert.doesNotThrow(() => validateDesignMaterials({ version: 15, room: { door: { material: wallpaper } }, furniture: [], structurePacks: [{ surfaces: [{ material: wood }] }] }))
  assert.throws(() => validateDesignMaterials({ version: 14, room: { door: { material: wallpaper } }, furniture: [] }), /v15/)
  assert.throws(() => validateDesignMaterials({ version: 15, room: {}, furniture: [{ material: { ...wood, x: 1 } }] }), /acabado/)
})
