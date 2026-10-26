import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FURNITURE_CATALOG } from '../domain/objectCatalog'
import { FurnitureIcon, ICON_CATALOG, OpeningIcon } from './iconCatalog'

const openingKinds = ['door', 'window', 'circularWindow', 'wallShelf', 'mirrorRectangular', 'mirrorCircular', 'wallSconce'] as const

test('the SVG icon catalog covers all furniture and standalone openings', () => {
  const expectedKinds = [...Object.keys(FURNITURE_CATALOG), ...openingKinds].sort()
  assert.deepEqual(Object.keys(ICON_CATALOG).sort(), expectedKinds)

  for (const definition of Object.values(ICON_CATALOG)) {
    for (const part of definition.parts) {
      if (part.type === 'rect') {
        assert.ok(part.x >= 0 && part.y >= 0)
        assert.ok(part.x + part.width <= 48 && part.y + part.height <= 42)
      } else if (part.type === 'circle') {
        assert.ok(part.cx - part.r >= 0 && part.cx + part.r <= 48)
        assert.ok(part.cy - part.r >= 0 && part.cy + part.r <= 42)
      } else if (part.type === 'line') {
        assert.ok([part.x1, part.x2].every((x) => x >= 0 && x <= 48))
        assert.ok([part.y1, part.y2].every((y) => y >= 0 && y <= 42))
      }
    }
  }
})

test('every furniture and opening icon renders a shared, decorative SVG canvas', () => {
  for (const kind of Object.keys(FURNITURE_CATALOG) as (keyof typeof FURNITURE_CATALOG)[]) {
    const markup = renderToStaticMarkup(createElement(FurnitureIcon, { kind }))
    assert.match(markup, /<svg[^>]*viewBox="0 0 48 42"/)
    assert.match(markup, /aria-hidden="true"/)
    assert.doesNotMatch(markup, /<span|furniture-swatch/)
  }

  for (const kind of openingKinds) {
    const markup = renderToStaticMarkup(createElement(OpeningIcon, { kind }))
    assert.match(markup, /<svg[^>]*viewBox="0 0 48 42"/)
    assert.match(markup, /aria-hidden="true"/)
  }
})
