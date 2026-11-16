import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cloneRoom } from '../state/defaults'
import {
  constrainToDirection, describeMeasure, furniturePoint, makeMeasureEnd, measureGeometry, measureSnapTargets, nearestSnapTarget,
  normalizeMeasures, parseMeasures, resolveAnchor, syncMeasures, visiblePlanMeasures, wallCorner, type PlanMeasure,
} from './planMeasures'
import { physicalWalls } from './wallConnections'
import type { FurnitureItem } from './types'

const close = (a: number, b: number, message = '') => assert.ok(Math.abs(a - b) < 1e-9, `${message} ${a} != ${b}`)
const chair = (patch: Partial<FurnitureItem> = {}): FurnitureItem => ({
  id: 'chair-1', kind: 'chair', name: 'Silla', color: '#abcdef', x: 1, y: 0, z: 2, width: 0.4, depth: 0.6, height: 0.8, rotation: 0,
  axisLocks: { x: false, y: false, z: false }, ...patch,
})
const world = (furniture: FurnitureItem[] = [chair()]) => ({ room: { ...cloneRoom(), windows: [] }, structurePacks: [], furniture })
const measure = (patch: Partial<PlanMeasure> = {}): PlanMeasure => ({ id: 'm1', start: { x: 0, z: 0 }, end: { x: 4, z: 3 }, ...patch })

test('la diagonal 4 × 3 mide 5 m, con redondeo claro de dos decimales', () => {
  const { length, dx, dz } = measureGeometry({ x: 0, z: 0 }, { x: 4, z: 3 })
  close(length, 5); close(dx, 4); close(dz, 3)
  const described = describeMeasure({ x: 0, z: 0 }, { x: 4, z: 3 })
  assert.equal(described.label, '5,00 m')
  assert.equal(described.detail, '4,00 m × 3,00 m')
  assert.equal(describeMeasure({ x: 0, z: 0 }, { x: 2.5, z: 0 }).detail, '', 'horizontal: sin componentes')
  assert.equal(describeMeasure({ x: 0, z: 0 }, { x: 1, z: 1 }).label, '1,41 m')
})

test('los puntos de un mueble giran con él', () => {
  close(furniturePoint(chair(), 'c0').x, 0.8); close(furniturePoint(chair(), 'c0').z, 1.7)
  const rotated = furniturePoint(chair({ x: 0, z: 0, width: 1, depth: 0.2, rotation: Math.PI / 2 }), 'm1')
  close(rotated.x, 0, 'el punto medio del lado ancho queda sobre el eje Z'); close(Math.abs(rotated.z), 0.5)
  assert.deepEqual(furniturePoint(chair(), 'center'), { x: 1, z: 2 })
})

test('las esquinas de pared salen de la geometría física', () => {
  const wall = physicalWalls(world()).find((candidate) => candidate.id === 'room-wall:north')!
  const corner = wallCorner(wall, 0), opposite = wallCorner(wall, 2)
  close(Math.hypot(corner.x - opposite.x, corner.z - opposite.z), Math.hypot(wall.width, wall.depth), 'diagonal del sólido')
})

test('resolveAnchor devuelve null si el referente ya no existe', () => {
  assert.deepEqual(resolveAnchor(world(), { kind: 'furniture', id: 'chair-1', point: 'center' }), { x: 1, z: 2 })
  assert.equal(resolveAnchor(world([]), { kind: 'furniture', id: 'chair-1', point: 'center' }), null)
  assert.equal(resolveAnchor(world(), { kind: 'wall', id: 'wall-inexistente', corner: 0 }), null)
})

test('al mover el referente la cota anclada se recalcula; sin cambios devuelve el mismo array', () => {
  const anchored = [measure({ start: { x: 1, z: 2, anchor: { kind: 'furniture', id: 'chair-1', point: 'center' } }, end: { x: 4, z: 6 } })]
  assert.equal(syncMeasures(world(), anchored), anchored)
  const moved = syncMeasures(world([chair({ x: 3, z: 5 })]), anchored)
  assert.notEqual(moved, anchored)
  assert.deepEqual([moved[0].start.x, moved[0].start.z], [3, 5])
  assert.deepEqual(moved[0].end, { x: 4, z: 6 }, 'el extremo libre no cambia')
  assert.equal(moved[0].stale, undefined)
})

test('al borrar el referente la cota queda fija y avisa (obsoleta), sin mentir', () => {
  const anchored = [measure({ start: { x: 1, z: 2, anchor: { kind: 'furniture', id: 'chair-1', point: 'center' } } })]
  const result = syncMeasures(world([]), anchored)
  assert.equal(result[0].stale, true)
  assert.equal(result[0].start.anchor, undefined)
  assert.deepEqual([result[0].start.x, result[0].start.z], [1, 2], 'conserva la última posición')
})

test('el imán elige el objetivo más cercano dentro de la tolerancia y prefiere esquinas de pared', () => {
  const targets = measureSnapTargets(world())
  const near = nearestSnapTarget({ x: 0.83, z: 1.72 }, targets, 0.1)
  assert.equal(near?.anchor.kind, 'furniture')
  assert.deepEqual([near?.x, near?.z], [0.8, 1.7])
  assert.equal(nearestSnapTarget({ x: 50, z: 50 }, targets, 0.1), null)
  assert.equal(nearestSnapTarget({ x: 0.83, z: 1.72 }, [], 0.1), null)
  assert.equal(measureSnapTargets(world(), ['chair-1']).some((target) => target.anchor.kind === 'furniture'), false, 'ignora lo oculto')
})

test('fijar horizontal o vertical proyecta sobre la dirección de pantalla', () => {
  const projected = constrainToDirection({ x: 1, z: 1 }, { x: 4, z: 1.4 }, { x: 1, z: 0 })
  close(projected.x, 4); close(projected.z, 1)
  const vertical = constrainToDirection({ x: 1, z: 1 }, { x: 1.3, z: 5 }, { x: 0, z: -1 })
  close(vertical.x, 1); close(vertical.z, 5)
  assert.deepEqual(constrainToDirection({ x: 0, z: 0 }, { x: 2, z: 3 }, { x: 0, z: 0 }), { x: 2, z: 3 })
})

test('un extremo nuevo se redondea a milímetro y solo se ancla si hay objetivo', () => {
  assert.deepEqual(makeMeasureEnd({ x: 1.23456, z: -0.0004 }), { x: 1.235, z: -0 })
  const target = nearestSnapTarget({ x: 1, z: 2 }, measureSnapTargets(world()), 0.05)!
  assert.deepEqual(makeMeasureEnd({ x: 1.01, z: 2.01 }, target).anchor, target.anchor)
})

test('parseMeasures acepta el contrato y rechaza datos inválidos', () => {
  const valid = [measure({ name: 'Pasillo', hidden: true, stale: true, start: { x: 1, z: 2, anchor: { kind: 'wall', id: 'room-wall:north', corner: 1 } } })]
  assert.deepEqual(parseMeasures(JSON.parse(JSON.stringify(valid))), valid)
  assert.deepEqual(parseMeasures(undefined), [])
  for (const bad of [
    'texto', [{ id: '' , start: { x: 0, z: 0 }, end: { x: 1, z: 1 } }], [measure(), measure()],
    [{ ...measure(), end: { x: Infinity, z: 0 } }], [{ ...measure(), end: { x: 99999, z: 0 } }], [{ ...measure(), name: ' ' }],
    [{ ...measure(), name: 'x'.repeat(81) }], [{ ...measure(), hidden: 'sí' }], [{ ...measure(), extra: 1 }],
    [{ ...measure(), start: { x: 0, z: 0, anchor: { kind: 'otro', id: 'a' } } }],
    [{ ...measure(), start: { x: 0, z: 0, anchor: { kind: 'furniture', id: 'a', point: 'c9' } } }],
    [{ ...measure(), start: { x: 0, z: 0, anchor: { kind: 'wall', id: 'a', corner: 7 } } }],
    Array.from({ length: 201 }, (_, index) => measure({ id: `m${index}` })),
  ]) assert.throws(() => parseMeasures(bad), /cota|Las cotas/)
})

test('normalizeMeasures exige v13 y repara anclajes cuyo referente falta', () => {
  assert.deepEqual(normalizeMeasures(undefined, 12, world()), [])
  assert.deepEqual(normalizeMeasures([], 12, world()), [])
  assert.throws(() => normalizeMeasures([measure()], 12, world()), /v13/)
  const repaired = normalizeMeasures([measure({ end: { x: 4, z: 6, anchor: { kind: 'furniture', id: 'borrada', point: 'center' } } })], 13, world())
  assert.equal(repaired[0].stale, true)
  assert.equal(repaired[0].end.anchor, undefined)
})

test('las cotas guardadas solo se dibujan en Plano detallado y mientras no estén ocultas', () => {
  const list = [measure({ id: 'a' }), measure({ id: 'b', hidden: true })]
  assert.deepEqual(visiblePlanMeasures(list, { detailsVisible: true, view: 'top' }).map((item) => item.id), ['a'])
  assert.deepEqual(visiblePlanMeasures(list, { detailsVisible: false, view: 'top' }), [], 'Plano normal: nada')
  assert.deepEqual(visiblePlanMeasures(list, { detailsVisible: true, view: 'isometric' }), [], 'otras vistas: nada')
  assert.equal(list.length, 2, 'ocultar no borra datos')
})
