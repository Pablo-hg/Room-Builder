import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { isValidElement } from 'react'
import { FURNITURE_CATALOG } from '../domain/objectCatalog'
import type { FurnitureItem, FurnitureKind } from '../domain/types'
import { FURNITURE_MODELS, FurnitureModel } from './FurnitureModels'

// Firmas del árbol de primitivas anterior a R2.6: geometrías, materiales y posición.
const reference = JSON.parse(readFileSync(new URL('./fixtures/furniture-model-signatures.json', import.meta.url), 'utf8')) as Record<FurnitureKind, string[]>

function normalize(value: unknown): unknown {
  if (isValidElement(value)) return { type: value.type, key: value.key, props: normalize(value.props) }
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]))
  return value
}

test('el catálogo conserva los modelos base y escala cada dimensión de los modelos redimensionados', () => {
  const kinds = Object.keys(FURNITURE_CATALOG) as FurnitureKind[]
  assert.deepEqual(Object.keys(FURNITURE_MODELS).sort(), [...kinds].sort())
  assert.deepEqual(Object.keys(reference).sort(), [...kinds].sort())
  for (const kind of kinds) {
    const item: FurnitureItem = { ...FURNITURE_CATALOG[kind].base, id: 'test', x: 0, y: 0, z: 0, rotation: 0 }
    const variant = { ...item, width: item.width * 1.25, height: item.height * 1.1, depth: item.depth * 0.8, color: '#69a2b3' }
    const serialized = JSON.stringify(normalize(FurnitureModel({ item })))
    assert.equal(createHash('sha256').update(serialized).digest('hex'), reference[kind][0], `El modelo base ${kind} difiere de la referencia anterior`)
    const resized = normalize(FurnitureModel({ item: variant })) as { type: string; props: { scale: number[]; children: unknown } }
    assert.equal(resized.type, 'group')
    resized.props.scale.forEach((scale, index) => assert.ok(Math.abs(scale - [1.25, 1.1, 0.8][index]) < 1e-9))
    assert.ok(resized.props.children)
  }
})

test('un tipo no reconocido conserva el modelo genérico anterior', () => {
  const item: FurnitureItem = { ...FURNITURE_CATALOG.cabinet.base, id: 'test', x: 0, y: 0, z: 0, rotation: 0 }
  const expected = normalize(FurnitureModel({ item }))
  for (const kind of ['desconocido', 'toString', '__proto__']) {
    assert.deepEqual(normalize(FurnitureModel({ item: { ...item, kind: kind as FurnitureKind } })), expected)
  }
})
