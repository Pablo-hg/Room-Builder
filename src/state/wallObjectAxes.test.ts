import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { wallObjectAvailableAxes, wallObjectPosition, wallObjects } from '../domain/wallObjectPlacement'
import { WALL_SIDES } from '../domain/constants'
import { persistedDesign } from '../domain/designV1'
import { openingsForWall } from '../domain/geometry'
import { structurePackOpenings } from '../domain/structureWindows'

const source = (store: ReturnType<typeof createRoomStore>, id: string) => wallObjects(store.getState()).find((entry) => entry.window.id === id)!

for (const secondary of [false, true]) for (const wall of WALL_SIDES) {
  test(`fijado a ${wall}, ${secondary ? 'pack' : 'raíz'}: bloquea normal, desliza, despega y reancla`, () => {
    const store = createRoomStore()
    if (secondary) { store.getState().addStructurePack('up'); store.getState().addWindow() }
    const id = secondary ? store.getState().selectedId! : store.getState().room.windows[0].id
    store.getState().updateWindow(id, { wall, offset: !secondary && wall === 'south' ? 1.6 : 0 })
    let object = source(store, id)
    assert.equal(object.window.wall, wall)
    const normal = wall === 'north' || wall === 'south' ? 'z' : 'x'
    const tangent = normal === 'x' ? 'z' : 'x'
    const axes = wallObjectAvailableAxes(store.getState().room, object.window, object.pack)
    assert.equal(axes[normal], false)
    assert.equal(axes[tangent], true)
    assert.equal(axes.y, true)
    let position = wallObjectPosition(store.getState().room, object.window, object.pack)
    const before = persistedDesign(store.getState()), count = store.getState().undoCount
    store.getState().moveWallObject(id, normal, position[normal] + 1)
    assert.deepEqual(persistedDesign(store.getState()), before)
    assert.equal(store.getState().undoCount, count)
    store.getState().moveWallObject(id, tangent, position[tangent] + 0.1)
    object = source(store, id)
    assert.equal(object.window.freePosition, undefined)
    position = wallObjectPosition(store.getState().room, object.window, object.pack)
    store.getState().moveWallObject(id, 'y', position.y + 0.105)
    object = source(store, id)
    assert.equal(object.window.freePosition, undefined)
    const room = store.getState().room
    const openings = object.pack ? structurePackOpenings(object.pack, object.pack.surfaces.find((surface) => surface.wall === wall)!) : openingsForWall(room, wall)
    assert.ok(openings.some((opening) => opening.id === id))
    position = wallObjectPosition(room, object.window, object.pack)
    store.getState().detachWallObject(id)
    object = source(store, id)
    assert.deepEqual(object.window.freePosition, { x: position.x, y: position.y, z: position.z, yaw: position.yaw })
    assert.deepEqual(wallObjectAvailableAxes(room, object.window, object.pack), { x: true, y: true, z: true })
    store.getState().moveWallObject(id, normal, position[normal] + 0.1)
    assert.ok(source(store, id).window.freePosition)
    store.getState().updateWindow(id, { wall })
    object = source(store, id)
    assert.equal(object.window.freePosition, undefined)
    assert.equal(wallObjectAvailableAxes(room, object.window, object.pack)[normal], false)
  })
}

test('cambiar de pared alterna X/Z sin escribir bloqueos automáticos en el diseño', () => {
  const store = createRoomStore()
  const id = store.getState().room.windows[0].id
  assert.deepEqual(wallObjectAvailableAxes(store.getState().room, source(store, id).window), { x: true, y: true, z: false })
  store.getState().updateWindow(id, { wall: 'east', offset: 0 })
  assert.deepEqual(wallObjectAvailableAxes(store.getState().room, source(store, id).window), { x: false, y: true, z: true })
  assert.equal(source(store, id).window.axisLocks, undefined)
})

test('despegar mantiene los candados explícitos y se puede deshacer sin desplazar', () => {
  const store = createRoomStore()
  const id = store.getState().room.windows[0].id
  store.getState().setElementAxisLock(id, 'z', true)
  const before = persistedDesign(store.getState())
  store.getState().detachWallObject(id)
  const position = source(store, id).window.freePosition!
  assert.equal(source(store, id).window.axisLocks?.z, true)
  store.getState().moveWallObject(id, 'z', position.z + 1)
  assert.equal(source(store, id).window.freePosition?.z, position.z)
  store.getState().undo()
  assert.deepEqual(persistedDesign(store.getState()), before)
})

for (const angle of [Math.PI / 2, Math.PI / 4]) {
  test(`pared de pack rotada ${angle}: los ejes usan su plano real`, () => {
    const store = createRoomStore()
    store.getState().addStructurePack('up')
    store.getState().addWindow()
    const id = store.getState().selectedId!
    const pack = source(store, id).pack!
    store.getState().setStructureSurfaceRotation(pack.id, 'wall-north', angle)
    const object = source(store, id)
    const axes = wallObjectAvailableAxes(store.getState().room, object.window, object.pack)
    assert.equal(axes.x, false)
    assert.equal(axes.z, angle === Math.PI / 2)
    assert.equal(axes.y, true)
    store.getState().updateWindow(id, { offset: 0.1 })
    assert.equal(source(store, id).window.offset, 0.1)
    assert.equal(source(store, id).window.freePosition, undefined)
  })
}

test('un grupo no puede saltarse el eje normal y deslizarlo no despega sus ventanas', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!, window = store.getState().room.windows[0].id
  store.setState({ selectedIds: [chair, window], selectedId: window })
  const before = persistedDesign(store.getState())
  store.getState().moveSelectedFurnitureGroup('z', 0.1)
  assert.deepEqual(persistedDesign(store.getState()), before)
  store.getState().moveSelectedFurnitureGroup('x', 0.1)
  assert.equal(source(store, window).window.freePosition, undefined)
  assert.equal(source(store, window).window.offset, 0.1)
})
