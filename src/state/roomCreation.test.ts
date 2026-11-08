import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { folderSelectionId, ROOT_ROOM_FOLDER } from '../domain/elementFolders'
import { planRoomCreation, type RoomCreationDirection } from '../domain/roomCreation'
import { persistedDesign } from '../domain/designV1'
import { packRoomBox, roomVerticalBounds, surfacePosition } from '../domain/roomEditing'
import { normalizeDesign } from '../persistence/designMigrations'
import { structureSurfaceElementId } from '../domain/elementIds'

const root = (store: ReturnType<typeof createRoomStore>) => {
  store.getState().selectElement(folderSelectionId(ROOT_ROOM_FOLDER))
  store.getState().setActiveRoomId(null)
}
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

for (const direction of ['up', 'down', 'north', 'east', 'south', 'west'] as RoomCreationDirection[]) {
  test(`impide duplicados en ${direction} sin alterar diseño, foco, carpetas ni undo`, () => {
    const store = createRoomStore()
    assert.equal(planRoomCreation(store.getState(), direction).occupied, false)
    store.getState().addStructurePack(direction)
    assert.equal(store.getState().structurePacks.length, 1)
    root(store)
    assert.equal(planRoomCreation(store.getState(), direction).occupied, true)
    const before = persistedDesign(store.getState())
    const count = store.getState().undoCount
    store.getState().addStructurePack(direction)
    assert.deepEqual(persistedDesign(store.getState()), before)
    assert.equal(store.getState().undoCount, count)
    assert.equal(store.getState().activeRoomId, null)
    assert.match(store.getState().notice, /ya ocupa ese espacio/)
    store.getState().undo()
    assert.equal(planRoomCreation(store.getState(), direction).occupied, false)
    store.getState().redo()
    assert.equal(planRoomCreation(store.getState(), direction).occupied, true)
    store.getState().removeStructurePack(store.getState().structurePacks[0].id)
    assert.equal(planRoomCreation(store.getState(), direction).occupied, false)
  })
}

test('comprueba intersecciones parciales y altura, sin confundir contacto o plantas distintas', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const original = store.getState().structurePacks[0]
  root(store)
  store.getState().moveStructurePack(original.id, 'z', original.z + 1)
  assert.equal(planRoomCreation(store.getState(), 'east').occupied, true)
  store.getState().moveStructurePack(original.id, 'y', 10)
  assert.equal(planRoomCreation(store.getState(), 'east').occupied, false)
  store.getState().moveStructurePack(original.id, 'y', 0)
  store.getState().moveStructurePack(original.id, 'z', store.getState().room.depth)
  assert.equal(planRoomCreation(store.getState(), 'east').occupied, false)
})

test('la raíz también reserva espacio y una habitación oculta sigue ocupando su destino', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const pack = store.getState().structurePacks[0]
  assert.equal(planRoomCreation(store.getState(), 'west').occupied, true)
  store.getState().toggleElementVisibility(pack.id)
  root(store)
  assert.equal(planRoomCreation(store.getState(), 'east').occupied, true)
  // Explicit root selection wins over the previous focused pack.
  store.getState().setActiveRoomId(pack.id)
  assert.equal(planRoomCreation(store.getState(), 'east').occupied, true)
})

test('habitaciones de altura personalizada bloquean solapes verticales parciales', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const pack = store.getState().structurePacks[0]
  store.getState().setSelectedRoomDimension('height', 5)
  store.getState().moveStructurePack(pack.id, 'x', 0)
  store.getState().moveStructurePack(pack.id, 'y', store.getState().room.height + 0.5)
  root(store)
  assert.equal(planRoomCreation(store.getState(), 'up').occupied, true)
})

test('crear debajo une paredes y techo al soporte incluso con suelo superior fino', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const upper = store.getState().structurePacks[0]
  store.getState().resizeStructureSurface(upper.id, 'floor', 'height', 0.01)
  store.getState().addStructurePack('down')
  const [reference, lower] = store.getState().structurePacks
  const room = store.getState().room
  const support = roomVerticalBounds(room, reference).bottom
  const ceiling = lower.surfaces.find((surface) => surface.kind === 'ceiling')!
  close(lower.y + surfacePosition(room, ceiling)[1] + ceiling.height / 2, support)
  for (const wall of lower.surfaces.filter((surface) => surface.kind === 'wall')) {
    close(lower.y + surfacePosition(room, wall)[1] + wall.height / 2, support)
  }
  assert.ok(packRoomBox(lower, room))
})

test('el techo interior conserva su cara superior al cambiar altura o grosor, y respeta Y bloqueada', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('down')
  const id = store.getState().structurePacks[0].id
  store.getState().setSelectedRoomDimension('height', 4)
  store.getState().resizeStructureSurface(id, 'ceiling', 'height', 0.4)
  let pack = store.getState().structurePacks[0]
  const ceiling = pack.surfaces.find((surface) => surface.kind === 'ceiling')!
  close(surfacePosition(store.getState().room, ceiling)[1] + ceiling.height / 2, 4)
  assert.equal(packRoomBox(pack, store.getState().room)?.height, 4)
  store.getState().setElementAxisLock(structureSurfaceElementId(id, ceiling.id), 'y', true)
  const before = structuredClone(store.getState().structurePacks)
  store.getState().resizeStructureSurface(id, 'ceiling', 'height', 0.5)
  assert.deepEqual(store.getState().structurePacks, before)
  // Loading existing centred ceilings still recognises the old enclosure unchanged.
  pack = { ...pack, surfaces: pack.surfaces.map((surface) => surface.kind === 'ceiling' ? { ...surface, y: 4 - store.getState().room.height } : surface) }
  const data = { ...persistedDesign(store.getState()), structurePacks: [pack] }
  const loaded = normalizeDesign(data)
  assert.deepEqual(loaded.structurePacks, [pack])
  assert.equal(packRoomBox(pack, store.getState().room)?.height, 4)
})
