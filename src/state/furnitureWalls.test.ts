import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { persistedDesign, type SavedDesign } from '../domain/designV1'
import { normalizeDesign } from '../persistence/designMigrations'
import { parseDesignFile, serializeDesignFile } from '../persistence/designFile'
import { migrateDesignToProject, projectToPersistedDesignV1 } from '../persistence/projectMigration'

function fixture() {
  const store = createRoomStore({ read: () => [], write: () => {} })
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  const state = store.getState(), chair = state.furniture.find((item) => item.id === id)!
  store.getState().moveFurniture(id, 1, -state.room.depth / 2 + 0.06 + chair.depth / 2 + 0.03)
  return { store, id, current: () => store.getState().furniture.find((item) => item.id === id)! }
}
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)

test('contacto, fijación manual, movimiento lateral, altura y liberación pasan por las acciones reales', () => {
  const { store, id, current } = fixture()
  assert.equal(current().wallAttachment, undefined)
  const z = current().z
  assert.ok(z > -store.getState().room.depth / 2)
  store.getState().setFurnitureWallAttachment(id, true)
  assert.equal(current().wallAttachment?.wallId, 'room-wall:north')
  store.getState().moveFurniture(id, 1.2, z)
  close(current().x, 1.2)
  close(current().z, z)
  store.getState().setFurnitureWallLateralLock(id, true)
  store.getState().moveFurniture(id, 1.5, z)
  close(current().x, 1.5)
  store.getState().setElementAxisLock(id, 'y', true)
  const y = current().y
  store.getState().moveFurnitureVertically(id, y + 0.5)
  close(current().y, y + 0.5) // un mueble fijado conserva siempre la altura editable
  store.getState().setFurnitureWallAttachment(id, false)
  store.getState().moveFurniture(id, 1.2, 0)
  close(current().z, 0)
})

test('undo/redo conserva el contacto y la fijación; pegar genera un objeto libre', () => {
  const { store, id, current } = fixture()
  store.getState().setFurnitureWallAttachment(id, true)
  store.getState().undo()
  assert.equal(current().wallAttachment, undefined)
  store.getState().redo()
  assert.ok(current().wallAttachment)
  store.setState({ selectedId: id, selectedIds: [id] })
  assert.equal(store.getState().copySelected(), true)
  assert.equal(store.getState().pasteSelected(), true)
  const pasted = store.getState().furniture.find((item) => item.id !== id)!
  assert.ok(pasted)
  assert.equal(pasted.wallAttachment, undefined)
  assert.ok(current().wallAttachment)
})

test('v11 hace round-trip local, JSON y ProjectV2 sin perder fijación ni bloqueos', () => {
  const { store, id } = fixture()
  store.getState().setFurnitureWallAttachment(id, true)
  store.getState().setFurnitureWallLateralLock(id, true)
  store.getState().setElementAxisLock(id, 'y', true)
  const data = persistedDesign(store.getState()), before = structuredClone(data)
  assert.equal(data.version, 11)
  const saved: SavedDesign = { id: 'saved', name: 'Fijación', savedAt: '2026-11-11T12:00:00.000Z', data }
  assert.deepEqual(normalizeDesign(data).furniture, data.furniture)
  assert.deepEqual(parseDesignFile(serializeDesignFile(saved)).design.data.furniture, data.furniture)
  assert.deepEqual(projectToPersistedDesignV1(migrateDesignToProject(saved)).furniture, data.furniture)
  assert.deepEqual(data, before)
  assert.throws(() => normalizeDesign({ ...data, version: 10 }))
})

test('cargar un diseño sin fijación no cambia posiciones ni añade el nuevo campo', () => {
  const { store } = fixture()
  const legacy = persistedDesign(store.getState())
  assert.notEqual(legacy.version, 11)
  assert.deepEqual(normalizeDesign(legacy).furniture, legacy.furniture)
})

test('un objeto fijado no se despega al empujar en perpendicular; se libera desmarcando la casilla', () => {
  const { store, id, current } = fixture()
  store.getState().setFurnitureWallAttachment(id, true)
  const contact = current().z
  for (let step = 0; step < 90; step++) {
    store.getState().moveFurniture(id, current().x, current().z - 0.01)
  }
  assert.ok(current().wallAttachment)
  close(current().z, contact)
  store.getState().setFurnitureWallAttachment(id, false)
  assert.equal(current().wallAttachment, undefined)
  store.getState().moveFurniture(id, current().x, contact - 0.9)
  close(current().z, contact - 0.9)
})
