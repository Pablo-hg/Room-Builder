import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FURNITURE_CATALOG, isWallPictureKind } from '../domain/objectCatalog'
import type { FurnitureKind } from '../domain/types'
import { FurnitureIcon, furnitureModelIcon, MODEL_ICON_OPENINGS, OpeningIcon, openingModelIcon } from './iconCatalog'
import { ICON_PADDING, ICON_VIEWBOX, type IconPolygon } from './modelIcon'

// Muebles cuyo icono se genera desde el modelo 3D (todos salvo los cuadros de pared).
const modelKinds = (Object.keys(FURNITURE_CATALOG) as FurnitureKind[]).filter((kind) => !isWallPictureKind(kind))
const EPSILON = 0.05

// Todos los iconos generados: muebles (salvo cuadros) y objetos de pared independientes.
const generated = [
  ...modelKinds.map((kind) => ({ name: kind as string, icon: () => furnitureModelIcon(kind, FURNITURE_CATALOG[kind].base.color) })),
  ...MODEL_ICON_OPENINGS.map((kind) => ({ name: kind as string, icon: () => openingModelIcon(kind, '#c88f58') })),
]

function bounds(make: () => IconPolygon[]) {
  const polygons = make()
  const points = polygons.flatMap((polygon) => polygon.points.split(' ').map((pair) => pair.split(',').map(Number) as [number, number]))
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return { polygons, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

test('cada mueble y objeto de pared genera su icono desde el modelo 3D, sin errores y con caras visibles', () => {
  for (const { name: kind, icon } of generated) {
    const { polygons } = bounds(icon)
    assert.ok(polygons.length > 0, `${kind}: icono vacío`)
    polygons.forEach((polygon) => assert.match(polygon.fill, /^#[0-9a-f]{6}$/, `${kind}: color no válido`))
  }
})

test('el icono generado queda encuadrado: dentro del margen y llenando el marco', () => {
  const innerWidth = ICON_VIEWBOX.width - ICON_PADDING * 2
  const innerHeight = ICON_VIEWBOX.height - ICON_PADDING * 2
  for (const { name: kind, icon } of generated) {
    const { minX, maxX, minY, maxY } = bounds(icon)
    assert.ok(minX >= ICON_PADDING - EPSILON && maxX <= ICON_VIEWBOX.width - ICON_PADDING + EPSILON, `${kind}: se sale en horizontal`)
    assert.ok(minY >= ICON_PADDING - EPSILON && maxY <= ICON_VIEWBOX.height - ICON_PADDING + EPSILON, `${kind}: se sale en vertical`)
    const fillsWidth = maxX - minX >= innerWidth - EPSILON
    const fillsHeight = maxY - minY >= innerHeight - EPSILON
    assert.ok(fillsWidth || fillsHeight, `${kind}: no llena el marco`)
  }
})

test('los objetos de pared generan su icono desde el mismo modelo que dibuja la escena', () => {
  for (const kind of MODEL_ICON_OPENINGS) {
    const polygons = openingModelIcon(kind, '#c88f58')
    assert.ok(polygons.length > 0, kind)
    const markup = renderToStaticMarkup(createElement(OpeningIcon, { kind }))
    assert.match(markup, /object-icon--model/, `${kind}: debe usar el icono generado`)
  }
})

test('el paisaje de los iconos de cuadro no se sale del lienzo interior del marco', () => {
  for (const kind of ['pictureSmall', 'pictureMedium', 'pictureLarge'] as const) {
    const markup = renderToStaticMarkup(createElement(FurnitureIcon, { kind }))
    const rects = [...markup.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((match) => match.slice(1).map(Number))
    const [x, y, width, height] = rects[1]
    const path = markup.match(/<path d="([^"]+)"/)?.[1] ?? ''
    const numbers = [...path.matchAll(/-?[\d.]+/g)].map((match) => Number(match[0]))
    assert.ok(numbers.length >= 12, `${kind}: falta el paisaje`)
    for (let index = 0; index < numbers.length; index += 2) {
      assert.ok(numbers[index] >= x - 1e-6 && numbers[index] <= x + width + 1e-6, `${kind}: el paisaje se sale en horizontal`)
      assert.ok(numbers[index + 1] >= y - 1e-6 && numbers[index + 1] <= y + height + 1e-6, `${kind}: el paisaje se sale en vertical`)
    }
  }
})

test('el icono generado sigue el color del objeto', () => {
  const base = furnitureModelIcon('sofa', FURNITURE_CATALOG.sofa.base.color).map((polygon) => polygon.fill)
  const recolored = furnitureModelIcon('sofa', '#3366aa').map((polygon) => polygon.fill)
  assert.notDeepEqual(recolored, base)
  const markup = renderToStaticMarkup(createElement(FurnitureIcon, { kind: 'sofa', color: '#3366aa' }))
  assert.match(markup, /object-icon--model/)
  assert.match(markup, /--object-color:#3366aa/)
})
