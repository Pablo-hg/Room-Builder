import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PHOTO_MAX_PIXELS, validatePhotoResolution } from './photoResolution'

test('acepta tamaños y proporciones habituales y respeta el límite del dispositivo', () => {
  assert.deepEqual(validatePhotoResolution(1920, 1080, 4096), { width: 1920, height: 1080 })
  assert.deepEqual(validatePhotoResolution(1080, 1920, 4096), { width: 1080, height: 1920 })
  assert.deepEqual(validatePhotoResolution(1024, 1024, 1024), { width: 1024, height: 1024 })
  assert.throws(() => validatePhotoResolution(1025, 1024, 1024), /demasiado grande/)
})

test('rechaza dimensiones inválidas y asignaciones excesivas', () => {
  for (const width of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validatePhotoResolution(width, 100, 4096), /enteros positivos/)
  }
  assert.throws(() => validatePhotoResolution(100, 100, 0), /dispositivo/)
  assert.throws(() => validatePhotoResolution(4097, 1, 8192), /demasiado grande/)
  assert.ok(4096 * 4096 > PHOTO_MAX_PIXELS)
  assert.throws(() => validatePhotoResolution(4096, 4096, 8192), /demasiado grande/)
})
