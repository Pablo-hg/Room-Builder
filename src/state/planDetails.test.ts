import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { persistedDesign } from '../domain/designV1'
import { planRoomDimensions, planRoomDimensionsSummary, roomPerimeterDimensions } from '../domain/planDimensions'
import { packRoomBox } from '../domain/roomEditing'
import { formatPlanDimension } from '../domain/planDimensions'

test('«Mostrar detalles» solo cambia la capa visual: ni diseño, ni historial, ni cámara, ni selección', () => {
  const store = createRoomStore()
  store.getState().setView('top')
  store.getState().addFurniture('chair')
  store.getState().setTopCameraPosition(1.5, -0.5)
  store.getState().setCameraZoom(1.4)
  const design = persistedDesign(store.getState())
  const pick = () => {
    const state = store.getState()
    return {
      view: state.view, topOrientation: state.topOrientation, topCameraX: state.topCameraX, topCameraZ: state.topCameraZ,
      cameraZoom: state.cameraZoom, selectedId: state.selectedId, selectedIds: state.selectedIds,
      undoCount: state.undoCount, redoCount: state.redoCount, hasUnsavedChanges: state.hasUnsavedChanges, gridSnap: state.gridSnap,
    }
  }
  const before = pick()
  assert.equal(store.getState().planDetailsVisible, false, 'el estado inicial conserva el Plano normal')
  store.getState().setPlanDetailsVisible(true)
  assert.equal(store.getState().planDetailsVisible, true)
  assert.deepEqual(pick(), before)
  assert.deepEqual(persistedDesign(store.getState()), design)
  assert.equal('planDetailsVisible' in persistedDesign(store.getState()), false, 'no se guarda en el diseño ni en el JSON')
  store.getState().setPlanDetailsVisible(false)
  assert.deepEqual(pick(), before)
  // Deshacer sigue afectando al último cambio real del diseño, no al conmutador.
  store.getState().setPlanDetailsVisible(true)
  store.getState().undo()
  assert.equal(store.getState().furniture.length, 0)
  assert.equal(store.getState().planDetailsVisible, true)
})

test('las cotas siguen al ancho y fondo editados sin recargar', () => {
  const store = createRoomStore()
  store.getState().setDimension('width', 4)
  store.getState().setDimension('depth', 3)
  assert.deepEqual(roomPerimeterDimensions(store.getState().room).map((item) => item.label), ['4,00 m', '3,00 m', '4,00 m', '3,00 m'])
  store.getState().setDimension('width', 4.37)
  store.getState().setDimension('depth', 3.05)
  assert.deepEqual(roomPerimeterDimensions(store.getState().room).map((item) => item.label), ['4,37 m', '3,05 m', '4,37 m', '3,05 m'])
  store.getState().undo()
  assert.deepEqual(roomPerimeterDimensions(store.getState().room).map((item) => item.label), ['4,37 m', '3,00 m', '4,37 m', '3,00 m'])
})

test('«Mostrar detalles» acota también las habitaciones adicionales, hacia su propio exterior', () => {
  const store = createRoomStore()
  store.getState().setDimension('width', 4)
  store.getState().setDimension('depth', 3)
  store.getState().addStructurePack('east')
  const state = store.getState()
  const pack = state.structurePacks.find((candidate) => candidate.id.startsWith('floor-pack-'))!
  const box = packRoomBox(pack, state.room)!
  const dimensions = planRoomDimensions(state)
  const root = dimensions.filter((item) => item.roomId === null)
  const extra = dimensions.filter((item) => item.roomId === pack.id)
  assert.equal(root.length, 4)
  assert.equal(extra.length, 4)
  const expected = (side: string) => formatPlanDimension(side === 'north' || side === 'south' ? box.width : box.depth)
  for (const item of extra) assert.equal(item.label, expected(item.wall))
  const centre = { x: pack.x + box.x, z: pack.z + box.z }
  for (const item of extra) {
    const outward = { x: Math.sin(item.yaw) * item.outwardSign, z: Math.cos(item.yaw) * item.outwardSign }
    const middle = { x: (item.start.x + item.end.x) / 2 - centre.x, z: (item.start.z + item.end.z) / 2 - centre.z }
    assert.ok(outward.x * middle.x + outward.z * middle.z > 0, `${item.wall} de la habitación adicional debe acotar hacia fuera`)
  }
  const summary = planRoomDimensionsSummary(dimensions, (id) => id ? 'Habitación 2' : 'Raíz')
  assert.match(summary, /^Raíz — Pared A: 4,00 m; Pared B: 3,00 m; Pared C: 4,00 m; Pared D: 3,00 m\. Habitación 2 — Pared A: /)
})

test('las paredes ocultas o independientes no generan cotas', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  store.getState().addStructureObject('wall')
  const state = store.getState()
  const all = planRoomDimensions(state)
  assert.ok(all.every((item) => item.roomId === null || item.roomId.startsWith('floor-pack-')))
  const visible = planRoomDimensions(state, (wall) => wall.id !== 'room-wall:north')
  assert.equal(visible.length, all.length - 1)
})
