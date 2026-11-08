import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { WallOpening } from '../domain/types'
import { clipPolygonToWall, openingPolygon, polygonInterval, visibleLineIntervals } from './wallGeometry'

const opening: WallOpening = { id: 'window', kind: 'window', offset: 0, width: 2, bottom: 1, height: 1, rotation: 0, color: '#ffffff' }
const area = (points: [number, number][]) => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length]
  return sum + point[0] * next[1] - next[0] * point[1]
}, 0)) / 2

test('conserva el área y el centro de un hueco rectangular girado', () => {
  const polygon = openingPolygon({ ...opening, offset: 0.5, rotation: Math.PI / 4 })
  assert.ok(Math.abs(area(polygon) - 2) < 1e-10)
  assert.ok(Math.abs(polygon.reduce((sum, point) => sum + point[0], 0) / 4 - 0.5) < 1e-10)
  assert.ok(Math.abs(polygon.reduce((sum, point) => sum + point[1], 0) / 4 - 1.5) < 1e-10)
})

test('recorta los huecos en los bordes de la pared sin cambiar los interiores', () => {
  const polygon = openingPolygon(opening)
  assert.deepEqual(clipPolygonToWall(polygon, 4, 3), polygon)
  const clipped = clipPolygonToWall(openingPolygon({ ...opening, offset: 2 }), 4, 3)
  assert.ok(Math.abs(area(clipped) - 1) < 1e-10)
  for (const [x, y] of clipped) {
    assert.ok(x >= -2 && x <= 2)
    assert.ok(y >= 0 && y <= 3)
  }
  assert.deepEqual(clipPolygonToWall(openingPolygon({ ...opening, offset: 5 }), 4, 3), [])
})

test('conserva los 48 segmentos del hueco circular', () => {
  const polygon = openingPolygon({ ...opening, shape: 'circular', height: 2 })
  assert.equal(polygon.length, 48)
  assert.ok(Math.abs(area(polygon) - 24 * Math.sin(2 * Math.PI / 48)) < 1e-10)
})

test('interrumpe la cuadrícula donde atraviesa un hueco y conserva las líneas exteriores', () => {
  const polygon = openingPolygon(opening)
  assert.deepEqual(polygonInterval(polygon, 0, true), [1, 2])
  assert.deepEqual(polygonInterval(polygon, 1.5, false), [-1, 1])
  assert.equal(polygonInterval(polygon, 3, true), null)
  assert.deepEqual(visibleLineIntervals(0, 3, [[1, 2]]), [[0, 1], [2, 3]])
})

test('fusiona cortes solapados de cuadrícula y los limita al tramo de pared', () => {
  assert.deepEqual(visibleLineIntervals(0, 5, [[-2, 1], [0.5, 2], [3, 8]]), [[2, 3]])
  assert.deepEqual(visibleLineIntervals(0, 5, []), [[0, 5]])
  assert.deepEqual(visibleLineIntervals(0, 5, [[-1, 6]]), [])
})
