import assert from 'node:assert/strict'
import { test } from 'node:test'
import { glintHalfExtent, mirrorGlint, shelfBooks, wallShelfFrame } from './wallObjectDetails'

const sizes = [[0.75, 1.5], [0.4, 0.4], [1.2, 0.6], [0.3, 2], [2, 2]] as const

test('el reflejo del espejo rectangular no sobresale del cristal en ningún tamaño', () => {
  for (const [width, height] of sizes) {
    const frame = Math.min(0.065, width * 0.12, height * 0.12)
    const glassWidth = width - frame * 2
    const glassHeight = height - frame * 2
    const stripe = frame * 0.65
    const glint = mirrorGlint(glassWidth, glassHeight, stripe)
    assert.ok(glint, `${width}×${height}: sin reflejo`)
    const extent = glintHalfExtent(glint, stripe)
    assert.ok(Math.abs(glint.x) + extent.x <= glassWidth / 2 + 1e-9, `${width}×${height}: sobresale en horizontal`)
    assert.ok(Math.abs(glint.y) + extent.y <= glassHeight / 2 + 1e-9, `${width}×${height}: sobresale en vertical`)
  }
})

test('los libros de la estantería de pared se apoyan en las baldas sin atravesarlas', () => {
  for (const [width, height] of [[1.25, 0.75], [0.6, 0.5], [2, 1.2]] as const) {
    const frame = wallShelfFrame(width, height)
    const lowerTop = -frame.shelfY + frame.shelfThickness / 2
    const upperBottom = frame.shelfY - frame.shelfThickness / 2
    const upperTop = frame.shelfY + frame.shelfThickness / 2
    const inner = frame.sideX - frame.sideWidth / 2
    const books = shelfBooks(width, height, 0.25)
    assert.ok(books.length > 0)
    for (const { key, position: [x, y, z], size: [w, h, d] } of books) {
      const bottom = y - h / 2
      const top = y + h / 2
      const onLower = Math.abs(bottom - lowerTop) < 1e-9 && top <= upperBottom + 1e-9
      const onUpper = Math.abs(bottom - upperTop) < 1e-9 && top <= height / 2 + 1e-9
      assert.ok(onLower || onUpper, `${key} (${width}×${height}): no se apoya en una balda o la atraviesa`)
      assert.ok(x - w / 2 >= -inner - 1e-9 && x + w / 2 <= inner + 1e-9, `${key}: se sale por los laterales`)
      assert.ok(z - d / 2 >= frame.backFront && z + d / 2 <= 0.25, `${key}: se sale por el fondo o el borde`)
    }
  }
})
