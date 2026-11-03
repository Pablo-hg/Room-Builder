import assert from 'node:assert/strict'
import { test } from 'node:test'
import { duplicateLayout, ensureOriginalLayout, removeLayout, renameLayout, switchLayout, syncActiveLayout, validateLayouts } from './designLayouts'
import { FURNITURE_PRESETS } from './objectCatalog'

const original = { id: 'original', name: 'Original', kind: 'original', furniture: [{ id: 'chair', x: 1, color: 'blue' }] }
const alternative = { id: 'a', name: 'Alternativa A', kind: 'alternative', furniture: [{ id: 'chair', x: 2, color: 'blue' }] }
const design = () => ({ layouts: [structuredClone(original), structuredClone(alternative)], activeLayoutId: 'original', furniture: structuredClone(original.furniture) })

test('valida Original, IDs y mobiliario espejo sin modificar la entrada', () => {
  const data = design()
  const before = structuredClone(data)
  assert.deepEqual(validateLayouts(data), [])
  assert.deepEqual(data, before)
  assert.deepEqual(validateLayouts({ ...data, furniture: [{ color: 'blue', x: 1, id: 'chair' }] }), [])
  assert.deepEqual(validateLayouts({ ...data, activeLayoutId: 'a', furniture: alternative.furniture }), [])
  for (const invalid of [null, {}, { ...data, layouts: [] }, { ...data, activeLayoutId: 'missing' },
    { ...data, layouts: [original, { ...alternative, id: original.id }] },
    { ...data, layouts: [alternative] }, { ...data, layouts: [original, { ...alternative, kind: 'original' }] },
    { ...data, layouts: [original, { ...alternative, kind: 'unknown' }] }, { ...data, furniture: null }]) {
    assert.notDeepEqual(validateLayouts(invalid), [])
  }
})

test('rechaza discrepancias del espejo en cualquiera de las dos variantes', () => {
  const data = design()
  assert.match(validateLayouts({ ...data, furniture: alternative.furniture }).join(' '), /no coincide/)
  assert.match(validateLayouts({ ...data, activeLayoutId: 'a', furniture: original.furniture }).join(' '), /no coincide/)
})

test('duplicar, editar y alternar mantiene IDs lógicos y copias independientes', () => {
  const furniture = [{ ...FURNITURE_PRESETS.chair, id: 'chair', x: 0, y: 0, z: 0, rotation: 0 }]
  const state = ensureOriginalLayout(furniture)
  const before = structuredClone(state)
  const copied = duplicateLayout(state, 'a')
  copied.furniture[0].x = 1
  const originalState = switchLayout(copied, 'original')
  assert.equal(originalState.furniture[0].x, 0)
  assert.equal(originalState.layouts[1].furniture[0].x, 1)
  const alternativeState = switchLayout(originalState, 'a')
  assert.equal(alternativeState.furniture[0].x, 1)
  assert.equal(alternativeState.furniture[0].id, furniture[0].id)
  alternativeState.furniture.push({ ...furniture[0], id: 'new-chair', x: 3 })
  const synced = syncActiveLayout(alternativeState)
  assert.equal(synced.layouts[0].furniture.length, 1)
  assert.equal(synced.layouts[1].furniture.length, 2)
  assert.deepEqual(state, before)
  assert.equal(furniture[0].x, 0)
})

test('renombrar y eliminar son puros, Original permanece y vuelve a estar activa', () => {
  const state = duplicateLayout(ensureOriginalLayout([]), 'a')
  const renamed = renameLayout(state, 'a', '  Prueba  ')
  assert.equal(renamed.layouts[1].name, 'Prueba')
  assert.equal(state.layouts[1].name, 'Alternativa A')
  const removed = removeLayout(renamed, 'a')
  assert.equal(removed.activeLayoutId, 'original')
  assert.equal(removed.layouts.length, 1)
  for (const operation of [() => removeLayout(state, 'original'), () => switchLayout(state, 'unknown'),
    () => duplicateLayout(state, 'a'), () => duplicateLayout(state, ' '), () => renameLayout(state, 'a', ' '), () => renameLayout(state, 'unknown', 'Name')]) assert.throws(operation)
})
