import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isMeasurementStep, measurementCentimetres, moveFromOrigin, nextMeasurement, parseMeasurement, snapMeasurement, stepMeasurement } from './measurements'

test('las medidas editables admiten centímetros enteros y rechazan fracciones', () => {
  for (const value of [0, 0.13, 0.24, 1.15, 1.17, -1.15, 10, 0.1 + 0.2]) assert.equal(isMeasurementStep(value), true)
  for (const value of [1.154, 0.025, 0.125, NaN, Infinity]) assert.equal(isMeasurementStep(value), false)
  assert.equal(snapMeasurement(1.174), 1.17)
  assert.equal(measurementCentimetres(1.15), '115')
})

test('el movimiento usa incrementos relativos de 5 cm y conserva el origen antiguo sin desplazamiento', () => {
  assert.equal(moveFromOrigin(0.29, 0.24), 0.29)
  assert.equal(moveFromOrigin(0.125, 0.125), 0.125)
  assert.equal(moveFromOrigin(0.13, 0.125), 0.125)
  assert.equal(nextMeasurement(1.15, 1), 1.2)
  assert.equal(stepMeasurement(0.125, 1), 0.13)
  assert.equal(stepMeasurement(0.125, -1), 0.12)
})

test('acepta metros y centímetros explícitos sin redondear la entrada', () => {
  for (const value of ['1,15', '1.15 m', '115 cm', '115CM']) assert.equal(parseMeasurement(value), 1.15)
  assert.equal(parseMeasurement('-15 cm'), -0.15)
  assert.equal(parseMeasurement('15.5 cm'), 0.155)
  for (const value of ['', 'Infinity', 'abc', '1.15 m extra', '1e2']) assert.ok(Number.isNaN(parseMeasurement(value)))
})
