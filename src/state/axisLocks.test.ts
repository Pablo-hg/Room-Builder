import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { persistedDesign, type SavedDesign } from '../domain/designV1'
import { furnitureAxisLocks } from '../domain/axisLocks'
import { furnitureVisualYOffset, hasUsefulFurnitureRotation } from '../domain/objectCatalog'
import { normalizeDesign } from '../persistence/designMigrations'
import { parseDesignFile, serializeDesignFile } from '../persistence/designFile'
import { migrateDesignToProject, projectToPersistedDesignV1 } from '../persistence/projectMigration'
import { structureSurfaceElementId } from '../domain/elementIds'

test('los candados congelan XYZ en acciones individuales, grupos y giro de grupo', () => {
  const store = createRoomStore()
  store.getState().addFurniture('table')
  const id = store.getState().selectedId!
  store.getState().setElementAxisLock(id, 'x', true)
  store.getState().setElementAxisLock(id, 'y', true)
  const before = structuredClone(store.getState().furniture[0])
  store.getState().moveFurniture(id, before.x + 1, before.z + 1)
  store.getState().moveFurnitureVertically(id, before.y + 1)
  assert.equal(store.getState().furniture[0].x, before.x)
  assert.equal(store.getState().furniture[0].y, before.y)
  assert.equal(store.getState().furniture[0].z, before.z + 1)
  store.getState().addFurniture('chair')
  const second = store.getState().selectedId!
  store.setState({ selectedIds: [id, second], selectedId: null })
  const group = structuredClone(store.getState().furniture)
  store.getState().moveSelectedFurnitureGroupBy({ x: 1, y: 0, z: 0 })
  store.getState().rotateSelectedFurnitureGroup()
  assert.deepEqual(store.getState().furniture, group)
})

test('desbloquear y bloquear Y conserva la base visible y participa en deshacer', () => {
  const store = createRoomStore()
  store.getState().addFurniture('rug')
  const id = store.getState().selectedId!
  assert.equal(store.getState().furniture[0].y, 0.04)
  store.getState().setElementAxisLock(id, 'y', false)
  store.getState().moveFurnitureVertically(id, 1.25)
  store.getState().setElementAxisLock(id, 'y', true)
  store.getState().moveFurnitureVertically(id, 2)
  assert.equal(store.getState().furniture[0].y, 1.25)
  store.getState().undo()
  assert.equal(furnitureAxisLocks(store.getState().furniture[0]).y, false)
  assert.equal(store.getState().furniture[0].y, 1.25)
  store.getState().redo()
  assert.equal(furnitureAxisLocks(store.getState().furniture[0]).y, true)
})

test('las alfombras antiguas conservan Y y corrigen su base en el nivel de su losa', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  const rug = { id: 'old', kind: 'rug' as const, name: 'Anterior', x: pack.x, y: pack.y, z: pack.z, width: 2, height: 0.05, depth: 1.5, color: '#123456', rotation: 0 }
  store.setState({ furniture: [rug] })
  const offset = furnitureVisualYOffset(rug, store.getState())
  assert.ok(Math.abs(offset - pack.surfaces.find((surface) => surface.kind === 'floor')!.height / 2) < 1e-9)
  const originalY = rug.y
  store.getState().setElementAxisLock(rug.id, 'x', true)
  assert.equal(store.getState().furniture[0].y, originalY + offset)
  assert.equal(furnitureVisualYOffset(store.getState().furniture[0], store.getState()), 0)
  assert.equal(rug.y, originalY)
})

test('alfombras y lámparas nuevas usan el nivel de la habitación activa', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks.at(-1)!
  store.getState().setActiveRoomId(pack.id)
  store.getState().addFurniture('circularRug')
  const rug = store.getState().furniture.at(-1)!
  assert.ok(Math.abs(rug.x - pack.x) < store.getState().room.width / 2)
  assert.equal(rug.y, pack.y + pack.surfaces.find((surface) => surface.kind === 'floor')!.height / 2)
  store.getState().addFurniture('ceilingLamp')
  const lamp = store.getState().furniture.at(-1)!
  const ceiling = pack.surfaces.find((surface) => surface.kind === 'ceiling')!
  assert.equal(lamp.y + lamp.height, pack.y + store.getState().room.height + ceiling.y - ceiling.height / 2)
})

test('candados de packs y superficies no se eluden con movimientos del pack o del grupo', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  const id = structureSurfaceElementId(pack.id, 'floor')
  store.getState().setElementAxisLock(id, 'y', true)
  store.getState().moveStructurePack(pack.id, 'y', pack.y + 1)
  store.getState().moveStructureSurface(pack.id, 'floor', 'y', 1)
  store.setState({ selectedId: null, selectedIds: [pack.id] })
  store.getState().moveSelectedFurnitureGroupBy({ x: 0, y: 1, z: 0 })
  assert.equal(store.getState().structurePacks[0].y, pack.y)
  assert.equal(store.getState().structurePacks[0].surfaces[0].y, pack.surfaces[0].y)
})

test('las aberturas permanecen en pared y respetan candados y dimensiones de habitación', () => {
  const store = createRoomStore()
  store.getState().addWindow()
  const window = store.getState().room.windows.at(-1)!
  const horizontal = window.wall === 'north' || window.wall === 'south' ? 'x' : 'z'
  store.getState().setElementAxisLock(window.id, horizontal, true)
  store.getState().setElementAxisLock(window.id, 'y', true)
  store.getState().updateWindow(window.id, { offset: window.offset + 0.1, sill: window.sill + 0.1 })
  assert.equal(store.getState().room.windows.at(-1)!.offset, window.offset)
  assert.equal(store.getState().room.windows.at(-1)!.sill, window.sill)
  store.getState().updateWindow(window.id, { wall: window.wall === 'north' ? 'south' : 'north' })
  assert.equal(store.getState().room.windows.at(-1)!.wall, window.wall)
})

test('guardar, JSON, recarga y proyección R4 conservan candados y altura explícita', () => {
  let saved: SavedDesign[] = []
  const repository = { read: () => saved, write: (entries: SavedDesign[]) => { saved = structuredClone(entries) } }
  const store = createRoomStore(repository)
  store.getState().addFurniture('ceilingLamp')
  const id = store.getState().selectedId!
  store.getState().setElementAxisLock(id, 'y', false)
  store.getState().moveFurnitureVertically(id, 1.25)
  store.getState().setElementAxisLock(id, 'x', true)
  store.getState().saveDesign()
  const reloaded = createRoomStore(repository)
  reloaded.getState().initializeSavedDesigns()
  reloaded.getState().loadDesign(saved[0].id)
  const data = persistedDesign(reloaded.getState())
  assert.equal(data.version, 10)
  assert.deepEqual(data.furniture, store.getState().furniture)
  assert.deepEqual(parseDesignFile(serializeDesignFile(saved[0])).design.data.furniture, data.furniture)
  const projected = projectToPersistedDesignV1(migrateDesignToProject(saved[0]))
  assert.equal(projected.version, 10)
  assert.deepEqual(projected.furniture, data.furniture)
  reloaded.getState().selectElement(id)
  reloaded.getState().copySelected()
  reloaded.getState().pasteSelected()
  const copy = reloaded.getState().furniture.find((item) => item.id === reloaded.getState().selectedId)!
  assert.equal(copy.y, 1.25)
  assert.deepEqual(copy.axisLocks, data.furniture[0].axisLocks)
})

test('rechaza candados mal formados sin reinterpretarlos como coordenadas libres', () => {
  const store = createRoomStore()
  store.getState().addFurniture('rug')
  for (const malformed of [null, [], { x: false }, { x: false, y: 'false', z: false }]) {
    const data = structuredClone(persistedDesign(store.getState()))
    Object.assign(data.furniture[0], { axisLocks: malformed })
    assert.throws(() => normalizeDesign(data), /Bloqueos/)
  }
})

test('la simetría conserva el giro de modelos asimétricos y elipses antiguas', () => {
  for (const kind of ['ceilingLamp', 'wastebasket', 'circularRug', 'lamp', 'tableLamp'] as const) {
    assert.equal(hasUsefulFurnitureRotation(kind, { width: 1, depth: 1 }), false)
    assert.equal(hasUsefulFurnitureRotation(kind, { width: 1, depth: 2 }), true)
  }
  for (const kind of ['rug', 'vase', 'plant', 'chair'] as const) assert.equal(hasUsefulFurnitureRotation(kind), true)
})
