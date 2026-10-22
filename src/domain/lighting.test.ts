import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sunPosition } from './lighting'

describe('sunPosition', () => {
  it('sitúa el norte sobre el eje Z negativo', () => {
    const [x, y, z] = sunPosition(0, 45, 10)
    assert.ok(Math.abs(x) < 1e-8)
    assert.ok(Math.abs(y - Math.sqrt(50)) < 1e-8)
    assert.ok(Math.abs(z + Math.sqrt(50)) < 1e-8)
  })
})
