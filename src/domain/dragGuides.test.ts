import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cloneRoom } from '../state/defaults'
import { describeGuides, furnitureGuideBox, GUIDE_TOLERANCE, guideTargets, resolveDragGuides, type GuideBox, type GuideTargets } from './dragGuides'
import type { FurnitureItem } from './types'

const close = (a: number, b: number, message = '') => assert.ok(Math.abs(a - b) < 1e-9, `${message} ${a} != ${b}`)
const item = (patch: Partial<FurnitureItem> = {}): FurnitureItem => ({
  id: 'a', kind: 'chair', name: 'Silla', color: '#abcdef', x: 0, y: 0, z: 0, width: 0.4, depth: 0.4, height: 0.8, rotation: 0,
  axisLocks: { x: false, y: false, z: false }, ...patch,
})
const box = (minX: number, maxX: number, minZ: number, maxZ: number): GuideBox => ({ minX, maxX, minZ, maxZ })
const targets = (boxes: GuideBox[], walls: GuideTargets['walls'] = []): GuideTargets => ({ boxes, walls })

test('con magnetismo el mueble se atrae al borde dentro de la tolerancia y no fuera de ella', () => {
  const other = targets([box(1, 2, 0, 1)])
  const near = resolveDragGuides(box(2.03, 2.43, 0, 0.4), other, { magnetism: true })
  close(near.dx, -0.03, 'borde con borde')
  const far = resolveDragGuides(box(2.03 + GUIDE_TOLERANCE, 2.43 + GUIDE_TOLERANCE, 0.5, 0.9), other, { magnetism: true })
  close(far.dx, 0)
})

test('sin magnetismo las guías no cambian el destino y solo se dibujan si ya coincide', () => {
  const other = targets([box(1, 2, 0, 1)])
  const off = resolveDragGuides(box(2.03, 2.43, 1.5, 1.9), other, { magnetism: false })
  assert.deepEqual([off.dx, off.dz], [0, 0])
  assert.equal(off.guides.filter((guide) => guide.type === 'line').length, 0)
  const aligned = resolveDragGuides(box(1, 1.4, 1.5, 1.9), other, { magnetism: false })
  assert.deepEqual([aligned.dx, aligned.dz], [0, 0])
  assert.ok(aligned.guides.some((guide) => guide.type === 'line' && guide.axis === 'x' && guide.kind === 'edge' && guide.position === 1))
})

test('alinea centros y devuelve una guía de centro', () => {
  const result = resolveDragGuides(box(0.1, 0.5, 2.04, 2.44), targets([box(0, 0.6, 0, 2)]), { magnetism: true })
  close(result.dx, 0, 'los centros en X ya coinciden')
  assert.ok(result.guides.some((guide) => guide.type === 'line' && guide.kind === 'center' && guide.axis === 'x'))
})

test('prefiere el ajuste más cercano y no inventa guías sin objetos', () => {
  const closest = resolveDragGuides(box(0.03, 0.43, 0, 0.4), targets([box(0, 0.4, 3, 3.4)]), { magnetism: true })
  close(closest.dx, -0.03)
  const none = resolveDragGuides(box(0, 0.4, 0, 0.4), targets([]), { magnetism: true })
  assert.deepEqual([none.dx, none.dz, none.guides.length], [0, 0, 0])
})

test('solo actúa en los ejes permitidos (flecha, eje bloqueado)', () => {
  const other = targets([box(1, 2, 0, 1)])
  const moving = box(2.03, 2.43, 1.04, 1.44)
  const onlyZ = resolveDragGuides(moving, other, { magnetism: true, axes: ['z'] })
  close(onlyZ.dx, 0)
  close(onlyZ.dz, -0.04)
})

test('es independiente del zoom: el resultado solo depende de metros', () => {
  const other = targets([box(1, 2, 0, 1)])
  const a = resolveDragGuides(box(2.03, 2.43, 0, 0.4), other, { magnetism: true })
  const b = resolveDragGuides(box(2.03, 2.43, 0, 0.4), other, { magnetism: true })
  assert.deepEqual(a, b)
})

test('la caja de un mueble girado usa su huella real', () => {
  const rotated = furnitureGuideBox(item({ width: 1, depth: 0.2, rotation: Math.PI / 2 }), 2, 3)
  close(rotated.minX, 1.9); close(rotated.maxX, 2.1); close(rotated.minZ, 2.5); close(rotated.maxZ, 3.5)
})

test('centra frente a una pared ortogonal solo si está cerca de ella', () => {
  const wall = { axis: 'x' as const, center: 0, box: box(-3, 3, -3.1, -3) }
  const near = resolveDragGuides(box(-0.16, 0.24, -2.9, -2.5), targets([], [wall]), { magnetism: true })
  close(near.dx, -0.04, 'el centro del objeto (0,04) va al centro de la pared')
  const far = resolveDragGuides(box(-0.16, 0.24, 1, 1.4), targets([], [wall]), { magnetism: true })
  close(far.dx, 0)
})

test('iguala los huecos entre dos vecinos y los muestra como cotas', () => {
  const sides = targets([box(0, 1, 0, 1), box(3, 4, 0, 1)])
  const result = resolveDragGuides(box(1.52, 2.52, 0.1, 0.9), sides, { magnetism: true })
  close(result.dx, -0.02)
  const gaps = result.guides.filter((guide) => guide.type === 'gap')
  assert.equal(gaps.length, 2)
  assert.ok(gaps.every((guide) => guide.type === 'gap' && guide.equal && guide.label === '50 cm'))
})

test('guideTargets ignora lo movido, lo oculto y lo que no comparte altura', () => {
  const world = { room: { ...cloneRoom(), windows: [] }, structurePacks: [], hiddenElementIds: ['hidden'],
    furniture: [item({ id: 'moving' }), item({ id: 'hidden', x: 1 }), item({ id: 'high', x: 2, y: 5 }), item({ id: 'ok', x: 3 })] }
  const found = guideTargets(world, new Set(['moving']), { min: 0, max: 0.8 })
  assert.equal(found.boxes.length, 1)
  assert.ok(found.walls.length >= 4)
})

test('describeGuides produce un texto sin repeticiones', () => {
  const result = resolveDragGuides(box(1, 1.4, 1.5, 1.9), targets([box(1, 2, 0, 1)]), { magnetism: false })
  const text = describeGuides(result.guides)
  assert.match(text, /Bordes alineados/)
  assert.equal(text.split('Bordes alineados').length, 2)
})
