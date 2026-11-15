// Estándares de los modelos 3D del catálogo (F1 · #30).
//
// Cualquier objeto nuevo del catálogo (por ejemplo, un portátil) entra automáticamente en
// estos tests: si su modelo no cumple el estilo del diorama, fallan. Las reglas escritas
// están en VISUAL_STYLE_GUIDE.md («Modelos 3D e iconos del catálogo»).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isValidElement, type ReactElement } from 'react'
import { MODEL_ICON_OPENINGS } from '../components/iconCatalog'
import { modelBounds, projectModelIcon, SUPPORTED_GEOMETRIES } from '../components/modelIcon'
import { FURNITURE_CATALOG, OPENING_CATALOG, STANDALONE_OPENING_MENU, isFloorBoundFurniture, isWallPictureKind } from '../domain/objectCatalog'
import type { FurnitureKind } from '../domain/types'
import { FurnitureModel } from './FurnitureModels'
import { pictureModel, standaloneOpeningModel } from './WallObjectModels'

/** Volumen del modelo frente a la medida del catálogo: ni mucho más grande ni casi vacío. */
const MAX_SIZE_RATIO = 1.15
const MIN_FOOTPRINT_RATIO = 0.6
const MIN_HEIGHT_RATIO = 0.85
/** Minimalismo: caras visibles en el icono generado. */
const MAX_VISIBLE_POLYGONS = 450
/** Apoyo: base a ras de suelo (o techo) y pivote centrado. */
const SUPPORT_TOLERANCE = 0.01
const CENTRE_TOLERANCE = 0.05
/** Únicos colores fijos permitidos; el resto debe derivar del color del objeto. */
const ALLOWED_FIXED_COLORS = new Set(['#59493c' /* tierra de la maceta */, '#dce7e4' /* cristal de espejo */, '#fffdf9' /* reflejo */])
const MATERIALS = new Set(['meshStandardMaterial', 'meshBasicMaterial'])

type Entry = { name: string; make: (color: string) => ReactElement; size: { width: number; height: number; depth?: number }; placement: 'floor' | 'ceiling' | 'flat' | 'wall' }

const furnitureEntries: Entry[] = (Object.keys(FURNITURE_CATALOG) as FurnitureKind[]).map((kind) => {
  const definition = FURNITURE_CATALOG[kind]
  const { width, height, depth } = definition.base
  // Los cuadros se dibujan como objetos de pared (mismo modelo que la escena).
  if (isWallPictureKind(kind)) return { name: kind, make: (color) => pictureModel({ width, height, color }), size: { width, height }, placement: 'wall' }
  return {
    name: kind,
    // Objeto nuevo: anclaje por tipo, como al añadirlo desde el catálogo.
    make: (color) => FurnitureModel({ item: { ...definition.base, color, id: 'estandar', x: 0, y: 0, z: 0, rotation: 0, attachmentPolicy: 'by-type' } }),
    size: { width, height, depth },
    placement: definition.capabilities.attachment === 'ceiling' ? 'ceiling' : isFloorBoundFurniture(kind) ? 'flat' : 'floor',
  }
})
const openingEntries: Entry[] = STANDALONE_OPENING_MENU.map(({ kind }) => ({
  name: kind, make: (color) => standaloneOpeningModel(kind, color), size: OPENING_CATALOG[kind], placement: 'wall',
}))
const entries = [...furnitureEntries, ...openingEntries]

function elements(node: unknown, visit: (element: ReactElement<Record<string, unknown>>) => void) {
  if (Array.isArray(node)) node.forEach((child) => elements(child, visit))
  else if (isValidElement<Record<string, unknown>>(node)) { visit(node); elements(node.props.children, visit) }
}

function materialColors(model: ReactElement): Set<string> {
  const colors = new Set<string>()
  elements(model, (element) => { if (MATERIALS.has(String(element.type)) && typeof element.props.color === 'string') colors.add(element.props.color.toLowerCase()) })
  return colors
}

test('estándar: todo el catálogo tiene modelo 3D, incluidos todos los objetos de pared', () => {
  assert.deepEqual([...MODEL_ICON_OPENINGS].sort(), STANDALONE_OPENING_MENU.map(({ kind }) => kind).sort())
  assert.equal(entries.length, Object.keys(FURNITURE_CATALOG).length + STANDALONE_OPENING_MENU.length)
})

test('estándar: solo piezas simples (grupos, mallas, geometrías conocidas y materiales), sin luces', () => {
  const allowed = new Set(['group', 'mesh', ...SUPPORTED_GEOMETRIES, ...MATERIALS])
  for (const entry of entries) {
    elements(entry.make('#8899aa'), (element) => {
      assert.equal(typeof element.type, 'string', `${entry.name}: usa un componente, no primitivas`)
      assert.ok(allowed.has(element.type as string), `${entry.name}: pieza no permitida «${String(element.type)}»`)
    })
  }
})

test('estándar: los colores derivan del color del objeto (salvo cristal, reflejo y tierra)', () => {
  for (const entry of entries) {
    const first = materialColors(entry.make('#3366aa'))
    const second = materialColors(entry.make('#aa6633'))
    for (const color of first) {
      if (second.has(color)) assert.ok(ALLOWED_FIXED_COLORS.has(color), `${entry.name}: color fijo ${color} no permitido`)
    }
  }
})

test('estándar: el volumen del modelo se ajusta a las medidas del catálogo', () => {
  for (const entry of entries) {
    const { min, max } = modelBounds(entry.make('#8899aa'))
    const [width, height, depth] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
    const check = (name: string, actual: number, expected: number, lower: number) => {
      const ratio = actual / expected
      assert.ok(ratio <= MAX_SIZE_RATIO, `${entry.name}: ${name} del modelo ${actual.toFixed(3)} m supera la medida ${expected} m`)
      assert.ok(ratio >= lower, `${entry.name}: ${name} del modelo ${actual.toFixed(3)} m muy por debajo de ${expected} m`)
    }
    check('ancho', width, entry.size.width, MIN_FOOTPRINT_RATIO)
    if (entry.placement !== 'flat') check('alto', height, entry.size.height, entry.placement === 'wall' ? MIN_FOOTPRINT_RATIO : MIN_HEIGHT_RATIO)
    if (entry.size.depth !== undefined) check('fondo', depth, entry.size.depth, MIN_FOOTPRINT_RATIO)
  }
})

test('estándar: apoyo y pivote — suelo a ras, techo a ras, objetos centrados', () => {
  for (const entry of entries) {
    const { min, max } = modelBounds(entry.make('#8899aa'))
    assert.ok(Math.abs((min[0] + max[0]) / 2) <= CENTRE_TOLERANCE, `${entry.name}: no está centrado en X`)
    if (entry.placement === 'floor' || entry.placement === 'flat') {
      assert.ok(Math.abs(min[1]) <= SUPPORT_TOLERANCE, `${entry.name}: no apoya en el suelo (base a ${min[1].toFixed(3)} m)`)
      assert.ok(Math.abs((min[2] + max[2]) / 2) <= CENTRE_TOLERANCE, `${entry.name}: no está centrado en Z`)
    } else if (entry.placement === 'ceiling') {
      assert.ok(Math.abs(max[1] - entry.size.height) <= SUPPORT_TOLERANCE, `${entry.name}: no toca el techo`)
    } else {
      // Objetos de pared: centrados en su hueco/medida y por delante de la pared.
      assert.ok(Math.abs((min[1] + max[1]) / 2) <= CENTRE_TOLERANCE, `${entry.name}: no está centrado en altura`)
      assert.ok(min[2] >= -0.05, `${entry.name}: se mete dentro de la pared`)
    }
  }
})

test('estándar: minimalismo — número de caras visibles limitado', () => {
  for (const entry of entries) {
    const polygons = projectModelIcon(entry.make('#8899aa')).length
    assert.ok(polygons <= MAX_VISIBLE_POLYGONS, `${entry.name}: ${polygons} caras visibles (máximo ${MAX_VISIBLE_POLYGONS})`)
  }
})
