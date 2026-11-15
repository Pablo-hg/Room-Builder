import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  FURNITURE_CATALOG, FURNITURE_FAMILIES, OPENING_CATALOG, STANDALONE_OPENING_MENU, furnitureVisualYOffset,
  isWallPictureKind, isWindowShape, openingShapeForKind, type OpeningKind, type StandaloneOpeningKind,
} from './objectCatalog'
import type { FurnitureKind } from './types'
import { boxOutsideBuilding } from './buildingVolume'
import { cloneRoom } from '../state/defaults'

const furnitureKinds = Object.keys(FURNITURE_CATALOG) as FurnitureKind[]
const standaloneKinds = (Object.keys(OPENING_CATALOG) as OpeningKind[]).filter((kind): kind is StandaloneOpeningKind => !kind.startsWith('picture'))

test('catálogo: la clave coincide con base.kind y cada mueble tiene una familia existente', () => {
  const families = new Set(FURNITURE_FAMILIES.map((family) => family.id))
  for (const kind of furnitureKinds) {
    assert.equal(FURNITURE_CATALOG[kind].base.kind, kind)
    assert.ok(families.has(FURNITURE_CATALOG[kind].family), `Familia de ${kind}`)
  }
})

test('catálogo: los nombres visibles son únicos y no están vacíos', () => {
  const names = [...furnitureKinds.map((kind) => FURNITURE_CATALOG[kind].base.name), ...standaloneKinds.map((kind) => OPENING_CATALOG[kind].name)]
  names.forEach((name) => assert.ok(name.trim().length > 0))
  assert.equal(new Set(names).size, names.length, 'Hay nombres visibles duplicados')
})

test('catálogo: medidas por defecto positivas y dentro de los límites de redimensión', () => {
  for (const kind of furnitureKinds) {
    const { base, capabilities } = FURNITURE_CATALOG[kind]
    for (const dimension of ['width', 'depth', 'height'] as const) {
      assert.ok(base[dimension] > 0, `${kind}.${dimension} positivo`)
      const limits = capabilities.resize?.dimensions[dimension]
      if (limits) assert.ok(base[dimension] >= limits.min && base[dimension] <= limits.max, `${kind}.${dimension} dentro del rango`)
    }
  }
  for (const kind of standaloneKinds) {
    const { width, height, capabilities } = OPENING_CATALOG[kind]
    assert.ok(width > 0 && height > 0, kind)
    const limits = capabilities.resize?.dimensions
    if (limits?.width) assert.ok(width >= limits.width.min && width <= limits.width.max, `${kind}.width`)
    if (limits?.height) assert.ok(height >= limits.height.min && height <= limits.height.max, `${kind}.height`)
  }
})

test('catálogo: los cuadros comparten nombre y medidas entre mueble y apertura', () => {
  for (const kind of furnitureKinds.filter(isWallPictureKind)) {
    const furniture = FURNITURE_CATALOG[kind]
    const opening = OPENING_CATALOG[kind]
    assert.equal(furniture.capabilities.attachment, 'wall')
    assert.equal(opening.name, furniture.base.name)
    assert.equal(opening.width, furniture.base.width)
    assert.equal(opening.height, furniture.base.height)
    assert.ok(isWindowShape(kind))
  }
})

test('catálogo: cada apertura independiente aparece una vez en el menú, con grupo válido', () => {
  const menuKinds = STANDALONE_OPENING_MENU.map((entry) => entry.kind)
  assert.deepEqual([...menuKinds].sort(), [...standaloneKinds].sort())
  const groups = new Set<string>(['openings', ...FURNITURE_FAMILIES.map((family) => family.id)])
  STANDALONE_OPENING_MENU.forEach((entry) => assert.ok(groups.has(entry.group), entry.kind))
})

test('catálogo: las aperturas con forma de ventana se añaden con una forma válida', () => {
  for (const kind of standaloneKinds.filter((kind) => kind !== 'door')) {
    assert.ok(isWindowShape(openingShapeForKind(kind as Exclude<StandaloneOpeningKind, 'door'>)), kind)
  }
})

test('catálogo: anclaje coherente con el tipo', () => {
  for (const kind of furnitureKinds) {
    const attachment = FURNITURE_CATALOG[kind].capabilities.attachment
    if (isWallPictureKind(kind)) assert.equal(attachment, 'wall')
    else assert.notEqual(attachment, 'wall', `${kind} no debería anclarse a pared como mueble`)
  }
  for (const kind of standaloneKinds) assert.equal(OPENING_CATALOG[kind].capabilities.attachment, 'wall', kind)
})

test('una lámpara de techo antigua pegada al techo no aparece fuera de la vivienda', () => {
  const room = cloneRoom()
  const base = FURNITURE_CATALOG.ceilingLamp.base
  // Diseño antiguo: sin anclaje por tipo, colocada a ras de techo.
  const item = { ...base, id: 'lampara-antigua', x: 0, z: 0, y: room.height - base.height, rotation: 0 }
  const world = { room, structurePacks: [] }
  const offset = furnitureVisualYOffset(item, world)
  assert.equal(offset, 0)
  assert.equal(boxOutsideBuilding(world, { x: 0, y: item.y + offset + base.height / 2, z: 0, width: base.width, height: base.height, depth: base.depth, rotation: 0 }), false)
})
