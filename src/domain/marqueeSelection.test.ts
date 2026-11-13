import assert from 'node:assert/strict'
import { test } from 'node:test'
import { marqueeHits, normalizedRect, type MarqueeBox } from './marqueeSelection'

const box = (id: string, x: number, z: number): MarqueeBox => ({ id, min: { x, y: 0, z }, max: { x: x + 1, y: 1, z: z + 1 } })
// Proyección cenital sencilla: 100 px por metro.
const top = (point: { x: number; z: number }) => ({ x: point.x * 100, y: point.z * 100 })

test('normaliza el rectángulo arrastrando en cualquier dirección', () => {
  assert.deepEqual(normalizedRect({ x: 50, y: 40 }, { x: 10, y: 90 }), { left: 10, top: 40, right: 50, bottom: 90 })
})

test('selecciona por contacto, no solo los objetos totalmente rodeados', () => {
  const boxes = [box('a', 0, 0), box('b', 3, 0), box('c', 0, 3)]
  assert.deepEqual(marqueeHits(boxes, top, { left: 50, top: 50, right: 120, bottom: 80 }), ['a'])
  assert.deepEqual(marqueeHits(boxes, top, { left: 50, top: 0, right: 350, bottom: 80 }), ['a', 'b'])
  assert.deepEqual(marqueeHits(boxes, top, { left: 1000, top: 1000, right: 1100, bottom: 1100 }), [])
})

test('ignora los elementos que quedan detrás de la cámara', () => {
  const hidden = (point: { x: number; z: number }) => point.x > 2 ? null : top(point)
  assert.deepEqual(marqueeHits([box('a', 0, 0), box('b', 3, 0)], hidden, { left: 0, top: 0, right: 1000, bottom: 1000 }), ['a'])
})
