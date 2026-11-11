import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { formatPlanDimension, formatPlanDimensionValue, planDimensionLabelMode, planDimensionsForSegments, planDimensionsSummary, roomPerimeterDimensions, roomPerimeterSegments } from './planDimensions'
import type { RoomConfig } from './types'

const room = (width: number, depth: number): RoomConfig => ({ ...structuredClone(DEFAULT_ROOM), width, depth })
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`)

test('una habitación de 4,00 × 3,00 m acota 4,00 m en A/C y 3,00 m en B/D', () => {
  const dimensions = roomPerimeterDimensions(room(4, 3))
  assert.deepEqual(dimensions.map((item) => [item.wall, item.label]), [
    ['north', '4,00 m'], ['east', '3,00 m'], ['south', '4,00 m'], ['west', '3,00 m'],
  ])
  assert.equal(planDimensionsSummary(dimensions), 'Pared A: 4,00 m; Pared B: 3,00 m; Pared C: 4,00 m; Pared D: 3,00 m')
})

test('las cotas se derivan de los segmentos físicos y apuntan hacia el exterior', () => {
  const segments = roomPerimeterSegments(room(4, 3))
  const north = segments.find((segment) => segment.wall === 'north')!
  close(north.start.x, -2); close(north.end.x, 2); close(north.start.z, -1.5); close(north.end.z, -1.5)
  const east = segments.find((segment) => segment.wall === 'east')!
  close(east.start.x, 2); close(east.end.x, 2); close(Math.abs(east.end.z - east.start.z), 3)
  for (const dimension of roomPerimeterDimensions(room(4, 3))) {
    // Eje local Z del grupo girado `yaw`: (sin yaw, cos yaw).
    const outward = { x: Math.sin(dimension.yaw) * dimension.outwardSign, z: Math.cos(dimension.yaw) * dimension.outwardSign }
    const middle = { x: (dimension.start.x + dimension.end.x) / 2, z: (dimension.start.z + dimension.end.z) / 2 }
    assert.ok(outward.x * middle.x + outward.z * middle.z > 0, `${dimension.wall} debe acotar hacia fuera`)
    // El eje local X debe recorrer el segmento de inicio a fin.
    close(dimension.start.x + Math.cos(dimension.yaw) * dimension.length, dimension.end.x)
    close(dimension.start.z - Math.sin(dimension.yaw) * dimension.length, dimension.end.z)
  }
})

test('las medidas centimétricas se actualizan sin redondeos erróneos', () => {
  assert.deepEqual(roomPerimeterDimensions(room(4.37, 2.99)).map((item) => item.label), ['4,37 m', '2,99 m', '4,37 m', '2,99 m'])
  assert.equal(formatPlanDimension(0.1 + 0.2), '0,30 m')
  assert.equal(formatPlanDimension(3.999999999), '4,00 m')
  assert.equal(formatPlanDimension(12.05), '12,05 m')
  assert.equal(formatPlanDimensionValue(1234.5), '1234,50')
})

test('los segmentos generales (no alineados) también se acotan desde la geometría', () => {
  const dimensions = planDimensionsForSegments([
    { id: 'a', wall: 'north', start: { x: 0, z: 0 }, end: { x: 3, z: 4 }, thickness: 0.12 },
    { id: 'b', wall: 'east', start: { x: 3, z: 4 }, end: { x: 0, z: 4 }, thickness: 0.12 },
    { id: 'c', wall: 'south', start: { x: 0, z: 4 }, end: { x: 0, z: 0 }, thickness: 0.12 },
    { id: 'degenerado', wall: 'west', start: { x: 0, z: 0 }, end: { x: 0, z: 0 }, thickness: 0.12 },
  ])
  assert.deepEqual(dimensions.map((item) => item.label), ['5,00 m', '3,00 m', '4,00 m'])
})

test('la etiqueta se simplifica u oculta cuando falta espacio en pantalla', () => {
  assert.equal(planDimensionLabelMode(400, 60, 40), 'full')
  assert.equal(planDimensionLabelMode(100, 60, 40), 'compact')
  assert.equal(planDimensionLabelMode(70, 60, 40), 'hidden')
})
