import assert from 'node:assert/strict'
import { test } from 'node:test'
import { floorLevels } from './floorLevels'

test('las plantas se numeran como en un edificio: 0 la raíz, positivas arriba y negativas abajo', () => {
  assert.deepEqual(floorLevels([0, 2.77, -2.88, 5.53]).map((level) => [level.y, level.name]), [
    [-2.88, 'Planta -1'], [0, 'Planta 0'], [2.77, 'Planta 1'], [5.53, 'Planta 2'],
  ])
})

test('sin habitaciones adicionales solo existe la planta 0 y las alturas casi iguales se agrupan', () => {
  assert.deepEqual(floorLevels([]).map((level) => level.name), ['Planta 0'])
  assert.deepEqual(floorLevels([2.7701, 2.7704, -5.6, -2.8]).map((level) => level.name), ['Planta -2', 'Planta -1', 'Planta 0', 'Planta 1'])
})
