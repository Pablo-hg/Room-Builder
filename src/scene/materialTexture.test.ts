import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { clearSharedMaterialTextures, sharedMaterialTexture, sharedMaterialTextureCount } from './materialTexture'

/** Simula `document.createElement('canvas')` para comprobar la caché sin navegador. */
function withFakeCanvas<T>(run: () => T): T {
  const target = globalThis as { document?: unknown }
  const previous = target.document
  const noop = () => undefined
  const context = new Proxy({}, { get: (_target, name) => (name === 'createLinearGradient' || name === 'createRadialGradient' ? () => ({ addColorStop: noop }) : noop), set: () => true })
  target.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) }
  try { return run() } finally { target.document = previous }
}

afterEach(() => clearSharedMaterialTextures())

test('mismo acabado, escala y giro comparten una única textura', () => {
  withFakeCanvas(() => {
    const first = sharedMaterialTexture('oak', 1, 0)
    assert.ok(first)
    assert.equal(sharedMaterialTexture('oak', 1, 0), first)
    assert.equal(sharedMaterialTextureCount(), 1)
  })
})

test('otra escala, giro o acabado crea otra textura con su repetición y giro', () => {
  withFakeCanvas(() => {
    const base = sharedMaterialTexture('oak', 1, 0)!
    const scaled = sharedMaterialTexture('oak', 2, 90)!
    assert.notEqual(scaled, base)
    assert.ok(Math.abs(scaled.repeat.x - 0.5) < 1e-9)
    assert.ok(Math.abs(scaled.rotation - Math.PI / 2) < 1e-9)
    assert.notEqual(sharedMaterialTexture('pine', 1, 0), base)
    assert.equal(sharedMaterialTextureCount(), 3)
  })
})

test('la caché está acotada: al superar el límite se libera la más antigua', () => {
  withFakeCanvas(() => {
    const first = sharedMaterialTexture('oak', 0.5, 0)!
    for (let index = 1; index <= 70; index++) sharedMaterialTexture('oak', 0.5 + index * 0.01, 0)
    assert.ok(sharedMaterialTextureCount() <= 64)
    assert.notEqual(sharedMaterialTexture('oak', 0.5, 0), first, 'la más antigua ya no está y se recrea')
  })
})

test('sin canvas (SSR, pruebas) no falla y no crea textura', () => {
  assert.equal(sharedMaterialTexture('oak', 1, 0), null)
  assert.equal(sharedMaterialTextureCount(), 0)
})
