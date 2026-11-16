import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cloneRoom } from '../state/defaults'
import { createRoomStore } from '../state/useRoomStore'
import { planRoomDimensions } from './planDimensions'
import { planFurnitureDistances, planFurnitureDistancesSummary, planOpeningDimensions, planOpeningDimensionsSummary } from './planDimensionDetails'
import type { FurnitureItem } from './types'

const close = (a: number, b: number, message = '') => assert.ok(Math.abs(a - b) < 1e-6, `${message} ${a} != ${b}`)
const world = (patch: Partial<ReturnType<typeof cloneRoom>> = {}) => ({ room: { ...cloneRoom(), ...patch }, structurePacks: [] })
const chair = (patch: Partial<FurnitureItem> = {}): FurnitureItem => ({
  id: 'chair-1', kind: 'chair', name: 'Silla', color: '#abcdef', x: 0, y: 0, z: 0, width: 0.4, depth: 0.4, height: 0.8, rotation: 0,
  axisLocks: { x: false, y: false, z: false }, ...patch,
})

test('la cadena de huecos de una pared suma exactamente su longitud y marca el hueco', () => {
  const w = world()
  const chain = planOpeningDimensions(w)
  const north = chain.filter((dimension) => dimension.wall === 'north')
  const perimeter = planRoomDimensions(w).find((dimension) => dimension.wall === 'north')!
  // La ventana (1,5 m) está centrada en la pared norte: tramo – hueco – tramo.
  assert.deepEqual(north.map((dimension) => dimension.kind), ['gap', 'opening', 'gap'])
  close(north.reduce((sum, dimension) => sum + dimension.length, 0), perimeter.length, 'los tramos cubren la pared')
  close(north[1].length, 1.5, 'ancho de la ventana')
  close(north[0].length, north[2].length, 'tramos simétricos')
  assert.ok(north.every((dimension) => dimension.tier === 1 && dimension.outwardSign === perimeter.outwardSign), 'por fuera, mismo lado que el perímetro')
  assert.ok(north[1].openingId)
})

test('la puerta también se acota y las paredes sin huecos no tienen cadena', () => {
  const chain = planOpeningDimensions(world())
  const south = chain.filter((dimension) => dimension.wall === 'south')
  assert.equal(south.filter((dimension) => dimension.kind === 'opening').length, 1)
  close(south.find((dimension) => dimension.kind === 'opening')!.length, 1, 'ancho de la puerta')
  assert.equal(chain.some((dimension) => dimension.wall === 'east' || dimension.wall === 'west'), false)
})

test('una ventana pegada al extremo no genera un tramo de longitud cero', () => {
  const base = cloneRoom()
  const w = world({ windows: [{ ...base.windows[0], offset: (base.width - base.windows[0].width) / 2 }] })
  const north = planOpeningDimensions(w).filter((dimension) => dimension.wall === 'north')
  assert.ok(north.every((dimension) => dimension.length > 0.005))
  assert.ok(north.length <= 3)
})

test('el filtro de paredes visibles se respeta y la cadena se recalcula al mover un hueco', () => {
  assert.equal(planOpeningDimensions(world(), () => false).length, 0)
  const base = cloneRoom()
  const moved = planOpeningDimensions(world({ windows: [{ ...base.windows[0], offset: 1 }] })).filter((dimension) => dimension.wall === 'north')
  assert.ok(Math.abs(moved[0].length - moved[2].length) > 1.5, 'tramos desiguales tras mover la ventana')
})

test('el resumen accesible describe la cadena', () => {
  const summary = planOpeningDimensionsSummary(planOpeningDimensions(world()))
  assert.match(summary, /Pared [A-D]: .*hueco 1,50 m/)
})

test('las distancias de un mueble llegan a la cara interior de cada pared', () => {
  const w = world()
  const distances = planFurnitureDistances(w, chair())
  assert.equal(distances.length, 4)
  const byId = Object.fromEntries(distances.map((distance) => [distance.id.split(':')[2], distance]))
  close(byId['x-'].length, w.room.width / 2 - 0.2, 'hasta la pared oeste')
  close(byId['x+'].length, w.room.width / 2 - 0.2)
  close(byId['z-'].length, w.room.depth / 2 - 0.2)
  close(byId['z+'].length, w.room.depth / 2 - 0.2)
  assert.match(planFurnitureDistancesSummary(distances), /oeste .*este .*norte .*sur /)
})

test('las distancias usan la huella girada y se acortan al acercar el mueble', () => {
  const w = world()
  const rotated = planFurnitureDistances(w, chair({ width: 1, depth: 0.2, rotation: Math.PI / 2 }))
  const west = rotated.find((distance) => distance.id.endsWith('x-'))!
  close(west.length, w.room.width / 2 - 0.1, 'girado 90°: su semiancho en X es 0,1')
  const near = planFurnitureDistances(w, chair({ x: -2 }))
  close(near.find((distance) => distance.id.endsWith('x-'))!.length, w.room.width / 2 - 2 - 0.2)
})

test('un mueble pegado a la pared no genera una cota de distancia cero', () => {
  const w = world()
  const flush = planFurnitureDistances(w, chair({ x: -(w.room.width / 2 - 0.2) }))
  assert.equal(flush.some((distance) => distance.id.endsWith('x-')), false)
})

test('los filtros de categorías son estado de sesión: no tocan diseño, historial ni selección', () => {
  const store = createRoomStore()
  const before = JSON.stringify(store.getState().room) + store.getState().undoCount
  assert.deepEqual(store.getState().planDetailCategories, { walls: true, openings: true, furniture: false, annotations: true })
  store.getState().setPlanDetailCategory('furniture', true)
  store.getState().setPlanDetailCategory('walls', false)
  assert.equal(store.getState().planDetailCategories.furniture, true)
  assert.equal(store.getState().planDetailCategories.walls, false)
  assert.equal(JSON.stringify(store.getState().room) + store.getState().undoCount, before)
  assert.equal(store.getState().hasUnsavedChanges, false)
})
