import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ViewMode, WallSide } from '../domain/types'
import { wallVisibility } from './wallVisibility'

const base = { view: 'isometric' as ViewMode, orientation: 0, wallView: null, freeAzimuth: Math.PI / 4, exportMode: false }
const allWalls = ['north', 'east', 'south', 'west']

test('conserva las paredes ocultas, etiquetas y cuadrículas de las cuatro diagonales', () => {
  const cases = [
    { hidden: ['east', 'south'], visible: ['north', 'west'] },
    { hidden: ['south', 'west'], visible: ['north', 'east'] },
    { hidden: ['west', 'north'], visible: ['east', 'south'] },
    { hidden: ['north', 'east'], visible: ['south', 'west'] },
  ]
  cases.forEach(({ hidden, visible }, orientation) => {
    const expected = { hidden, labeledWalls: visible, gridWalls: visible }
    assert.deepEqual(wallVisibility({ ...base, orientation }), expected)
    assert.deepEqual(wallVisibility({ ...base, view: 'free', freeAzimuth: Math.PI / 4 + orientation * Math.PI / 2 }), expected)
  })
})

test('conserva las tres paredes frontales y oculta la opuesta en cada dirección', () => {
  const cases: [WallSide, WallSide, WallSide[]][] = [
    ['north', 'south', ['north', 'west', 'east']],
    ['east', 'west', ['east', 'north', 'south']],
    ['south', 'north', ['south', 'east', 'west']],
    ['west', 'east', ['west', 'south', 'north']],
  ]
  for (const [wallView, opposite, visible] of cases) {
    assert.deepEqual(wallVisibility({ ...base, view: 'front', wallView }), {
      hidden: [opposite], labeledWalls: visible, gridWalls: visible,
    })
  }
  assert.deepEqual(wallVisibility({ ...base, view: 'front' }), wallVisibility({ ...base, view: 'front', wallView: 'north' }))
})

test('mantiene las reglas diferentes de planta y POV', () => {
  assert.deepEqual(wallVisibility({ ...base, view: 'top' }), { hidden: allWalls, labeledWalls: allWalls, gridWalls: [] })
  assert.deepEqual(wallVisibility({ ...base, view: 'pov' }), { hidden: [], labeledWalls: allWalls, gridWalls: [] })
})

test('exporta todas las paredes sin etiquetas ni cuadrículas desde cualquiera de las cinco vistas', () => {
  for (const view of ['isometric', 'top', 'front', 'pov', 'free'] as const) {
    assert.deepEqual(wallVisibility({ ...base, view, exportMode: true }), { hidden: [], labeledWalls: [], gridWalls: [] })
  }
})
