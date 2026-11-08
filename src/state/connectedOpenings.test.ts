import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { createStructureSurface } from '../domain/structureRules'
import { anchorWallOpenings, openingHasSupport, physicalWalls, wallDerivedOpenings, worldOpenings } from '../domain/wallConnections'
import { persistedDesign } from '../domain/designV1'
import { normalizeDesign } from '../persistence/designMigrations'
import { parseDesignFile, serializeDesignFile } from '../persistence/designFile'
import { migrateDesignToProject, projectToPersistedDesignV1 } from '../persistence/projectMigration'
import { detectSceneCollisions, detectUnsupportedOpenings } from '../domain/sceneCollisions'
import type { StructurePack } from '../domain/types'

function fixture(kind: 'door' | 'window' = 'window') {
  const store = createRoomStore()
  const room = { ...store.getState().room, windows: [] }
  const pack = (id: string, width: number): StructurePack => ({ id, name: id, x: 0, y: 0, z: 0,
    surfaces: [{ ...createStructureSurface(room, 'wall-north'), width, height: 3, y: (3 - room.height) / 2, z: -10 + room.depth / 2 }] })
  const small = pack('wall-object-short', 3), large = pack('wall-object-long', 8)
  if (kind === 'window') small.windows = [{ id: 'connected', name: 'Ventana compartida', shape: 'rectangular', wall: 'north', offset: 0, width: 1, height: 1, sill: 1, rotation: 0, color: '#abcdef' }]
  else small.doors = [{ id: 'connected', name: 'Puerta compartida', wall: 'north', offset: 0, width: 1, height: 2.1, rotation: 0, color: '#abcdef' }]
  store.setState({ ...anchorWallOpenings({ room, structurePacks: [small, large] }),
    elementFolderAssignments: { ...store.getState().elementFolderAssignments, connected: 'room-root' } })
  return store
}
const opening = (store: ReturnType<typeof fixture>) => worldOpenings(store.getState()).find((item) => item.id === 'connected')!

for (const kind of ['door', 'window'] as const) {
  test(`${kind}: arrastre/inspector recorre 8 m, actualiza huecos y deshace sin duplicados`, () => {
    const store = fixture(kind)
    store.getState().selectElement('connected')
    store.getState().moveWallObject('connected', 'x', 3)
    assert.equal(opening(store).position.x, 3)
    assert.equal(store.getState().selectedId, 'connected')
    assert.equal(worldOpenings(store.getState()).filter((item) => item.id === 'connected').length, 1)
    const walls = physicalWalls(store.getState()).filter((wall) => wall.packId)
    assert.deepEqual(walls.map((wall) => wallDerivedOpenings(store.getState(), wall).map((cut) => cut.id)), [[], ['connected']])
    store.getState().moveWallObject('connected', 'x', 1.5)
    assert.equal(walls.every((wall) => wallDerivedOpenings(store.getState(), wall).length === 1), true)
    store.getState().undo()
    assert.equal(opening(store).position.x, 3)
    store.getState().redo()
    assert.equal(opening(store).position.x, 1.5)
    const count = store.getState().undoCount
    store.getState().moveWallObject('connected', 'x', 4)
    assert.equal(opening(store).position.x, 1.5)
    assert.equal(store.getState().undoCount, count)
    assert.equal(store.getState().notice, '')
  })

  test(`${kind}: borrar la pared propietaria conserva ID, posición, color y hueco restante`, () => {
    const store = fixture(kind)
    store.getState().moveWallObject('connected', 'x', 3)
    const before = structuredClone(opening(store))
    store.getState().removeStructurePack('wall-object-short')
    assert.deepEqual(opening(store).position, before.position)
    assert.equal(opening(store).object.color, before.object.color)
    assert.equal(opening(store).object.name, before.object.name)
    assert.equal(openingHasSupport(store.getState(), opening(store)), true)
    assert.equal(store.getState().elementFolderAssignments.connected, 'room-root')
    assert.equal(worldOpenings(store.getState()).filter((item) => item.id === 'connected').length, 1)
    store.getState().moveWallObject('connected', 'x', 2.5)
    assert.equal(opening(store).position.x, 2.5)
    store.getState().undo()
    store.getState().undo()
    assert.equal(store.getState().structurePacks.length, 2)
    assert.equal(opening(store).position.x, 3)
  })

  test(`${kind}: bloqueos de eje y altura fija de puertas siguen vigentes`, () => {
    const store = fixture(kind)
    store.getState().setElementAxisLock('connected', 'x', true)
    const count = store.getState().undoCount
    store.getState().moveWallObject('connected', 'x', 3)
    assert.equal(opening(store).position.x, 0)
    assert.equal(store.getState().undoCount, count)
    if (kind === 'door') {
      store.getState().moveWallObject('connected', 'y', 1)
      assert.equal(opening(store).position.y, 0)
    }
  })

  test(`${kind}: JSON/ProjectV2 conserva posición fuera de la pared original en v10`, () => {
    const store = fixture(kind)
    store.getState().moveWallObject('connected', 'x', 3)
    const data = persistedDesign(store.getState())
    assert.equal(data.version, 10)
    const saved = { id: 'connected-design', name: 'Conectadas', savedAt: '2026-11-08T12:00:00Z', data }
    const parsed = parseDesignFile(serializeDesignFile(saved)).design.data
    assert.deepEqual(parsed.structurePacks, data.structurePacks)
    assert.deepEqual(projectToPersistedDesignV1(migrateDesignToProject(saved)).structurePacks, data.structurePacks)
    assert.throws(() => normalizeDesign({ ...data, version: 9 }), /v10/)
    const invalid = structuredClone(data)
    const object = kind === 'door' ? invalid.structurePacks![0].doors![0] : invalid.structurePacks![0].windows![0]
    object.wallPosition!.x = NaN
    assert.throws(() => normalizeDesign(invalid), /[Pp]osición|[Aa]nclaje/)
  })
}

test('separar o acortar una pared produce una incidencia de soporte recuperable', () => {
  const store = fixture()
  store.getState().moveWallObject('connected', 'x', 3)
  store.getState().moveStructurePack('wall-object-long', 'z', 1)
  assert.equal(detectUnsupportedOpenings(store.getState()).some((item) => item.id === 'connected'), true)
  assert.equal(opening(store).position.x, 3)
  store.getState().undo()
  assert.equal(detectUnsupportedOpenings(store.getState()).some((item) => item.id === 'connected'), false)
  store.getState().resizeStructureSurface('wall-object-long', 'wall-north', 'width', 2)
  assert.equal(detectUnsupportedOpenings(store.getState()).some((item) => item.id === 'connected'), true)
  store.getState().undo()
  assert.equal(openingHasSupport(store.getState(), opening(store)), true)
})

test('dos aperturas en propietarios distintos se superponen y generan aviso, sin bloqueo', () => {
  const store = fixture()
  const second = { ...store.getState().structurePacks[0].windows![0], id: 'other', offset: 2.5,
    wallPosition: { ...opening(store).position, x: 2.5, supportId: 'structure-surface:wall-object-long:wall-north' } }
  store.setState((state) => ({ structurePacks: state.structurePacks.map((pack) => pack.id === 'wall-object-long' ? { ...pack, windows: [second] } : pack) }))
  const count = store.getState().undoCount
  store.getState().moveWallObject('connected', 'x', 2.5)
  assert.equal(opening(store).position.x, 2.5)
  assert.equal(store.getState().notice, '')
  assert.ok(store.getState().undoCount >= count)
  const collisions = detectSceneCollisions(store.getState())
  assert.ok(collisions.some(({ firstId, secondId }) => [firstId, secondId].includes('connected') && [firstId, secondId].includes('other')))
  assert.equal(collisions.some((collision) => collision.firstId === 'connected' && collision.secondId.startsWith('structure-surface:')), false)
  store.getState().undo()
  assert.equal(opening(store).position.x, 0)
})

test('las paredes conservan propiedades; borrar la apertura cierra todos sus huecos', () => {
  const store = fixture()
  const before = structuredClone(store.getState().structurePacks.map((pack) => pack.surfaces))
  store.getState().moveWallObject('connected', 'x', 1.5)
  store.getState().resizeWallObject('connected', 'width', 1.2)
  store.getState().updateWindow('connected', { rotation: Math.PI / 6, color: '#aabbcc' })
  assert.deepEqual(store.getState().structurePacks.map((pack) => pack.surfaces), before)
  store.getState().removeWindow('connected')
  assert.equal(physicalWalls(store.getState()).filter((wall) => wall.packId).every((wall) => wallDerivedOpenings(store.getState(), wall).length === 0), true)
  store.getState().undo()
  assert.equal(worldOpenings(store.getState()).some((item) => item.id === 'connected'), true)
})

test('creación sobre pared independiente seleccionada sin cambiar la habitación enfocada', () => {
  const store = fixture()
  store.getState().removeWindow('connected')
  store.getState().selectElement('structure-surface:wall-object-short:wall-north')
  store.getState().addWindow('circular')
  const id = store.getState().selectedId!
  assert.ok(store.getState().structurePacks[0].windows!.some((window) => window.id === id))
  assert.equal(worldOpenings(store.getState()).filter((opening) => opening.id === id).length, 1)
})
