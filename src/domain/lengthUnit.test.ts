import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  formatCoordinate, formatCoordinatePair, formatLength, formatLengthOtherUnit, formatLengthValue, formatPanelLength, getDisplayLengthUnit,
  lengthInputText, roundToCentimetre, setDisplayLengthUnit,
} from './lengthUnit'
import { formatPlanDimension } from './planDimensions'
import { parseMeasurement } from './measurements'

afterEach(() => setDisplayLengthUnit('m'))

test('nunca hay más precisión que un centímetro', () => {
  assert.equal(roundToCentimetre(1.954), 1.95)
  assert.equal(formatCoordinate(1.954), '1,95')
  assert.equal(formatCoordinate(8.651), '8,65')
  assert.equal(formatCoordinate(7.607, 'cm'), '761')
})

test('metros y centímetros: valor, medida con unidad y la equivalente en la otra unidad', () => {
  assert.equal(formatLengthValue(5.89), '5,89')
  assert.equal(formatLength(5.89), '5,89 m')
  assert.equal(formatLength(5.89, 'cm'), '589 cm')
  assert.equal(formatLengthOtherUnit(2.61, 'm'), '261 cm')
  assert.equal(formatLengthOtherUnit(2.61, 'cm'), '2,61 m')
})

test('los paneles conservan su formato en metros y pasan a enteros en centímetros', () => {
  assert.equal(formatPanelLength(2.61), '2.61 m')
  assert.equal(formatPanelLength(4.5, 1), '4.5 m')
  assert.equal(formatPanelLength(4.5, 1, 'cm'), '450 cm')
  assert.equal(lengthInputText(2.61, 'm'), '2.61')
  assert.equal(lengthInputText(2.61, 'cm'), '261')
})

test('el par de coordenadas lleva la unidad', () => {
  assert.equal(formatCoordinatePair(3.52, 8.25), '3,52 ; 8,25 m')
  assert.equal(formatCoordinatePair(3.52, 8.25, 'cm'), '352 ; 825 cm')
})

test('un número sin unidad se lee en la unidad de visualización; con unidad, la suya', () => {
  assert.equal(parseMeasurement('2,5'), 2.5)
  assert.equal(parseMeasurement('250', 'cm'), 2.5)
  assert.equal(parseMeasurement('2,5 m', 'cm'), 2.5)
  assert.equal(parseMeasurement('250 cm', 'm'), 2.5)
  assert.ok(Number.isNaN(parseMeasurement('abc', 'cm')))
})

test('las cotas del Plano siguen la unidad elegida', () => {
  assert.equal(formatPlanDimension(5.89), '5,89 m')
  setDisplayLengthUnit('cm')
  assert.equal(getDisplayLengthUnit(), 'cm')
  assert.equal(formatPlanDimension(5.89), '589 cm')
})
