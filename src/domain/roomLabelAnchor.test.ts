import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasRoomAbove, roomLabelAnchor, roomLabelHeight, type RoomLabelBox } from './roomLabelAnchor'

const ground: RoomLabelBox = { x: 0, y: 0, z: 0, width: 4, depth: 3, height: 2.5 }

test('una habitación sola ancla su etiqueta arriba, como siempre', () => {
  assert.equal(roomLabelAnchor(ground, [ground]), 'top')
  assert.equal(roomLabelHeight(ground, [ground]), 2.5 + 0.35)
})

test('con otra habitación justo encima, la etiqueta baja a su propio suelo', () => {
  const above = { ...ground, y: 2.5 }
  assert.equal(hasRoomAbove(ground, [ground, above]), true)
  assert.equal(roomLabelAnchor(ground, [ground, above]), 'floor')
  assert.equal(roomLabelHeight(ground, [ground, above]), 0.35)
  assert.equal(roomLabelAnchor(above, [ground, above]), 'top', 'la de arriba no tiene nada encima')
})

test('el forjado entre plantas no impide detectarla', () => {
  assert.equal(hasRoomAbove(ground, [{ ...ground, y: 2.5 + 0.13 }]), true)
})

test('la habitación de arriba solo cuenta si comparte parte de la huella', () => {
  assert.equal(hasRoomAbove(ground, [{ ...ground, y: 2.5, x: 2 }]), true, 'solape parcial')
  assert.equal(hasRoomAbove(ground, [{ ...ground, y: 2.5, x: 4 }]), false, 'solo se tocan en el borde')
  assert.equal(hasRoomAbove(ground, [{ ...ground, y: 2.5, z: 10 }]), false, 'lejos en planta')
})

test('una habitación contigua a la misma altura o por debajo no cuenta', () => {
  assert.equal(hasRoomAbove(ground, [{ ...ground, x: 2 }]), false)
  assert.equal(hasRoomAbove(ground, [{ ...ground, y: -2.5 }]), false)
})

test('con varias plantas, cada una compara con lo que tiene encima', () => {
  const first = ground, second = { ...ground, y: 2.5 }, third = { ...ground, y: 5 }
  const all = [first, second, third]
  assert.deepEqual(all.map((box) => roomLabelAnchor(box, all)), ['floor', 'floor', 'top'])
})
