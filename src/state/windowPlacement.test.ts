import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { windowPlacementWalls } from '../domain/windowPlacement'
import { wallObjectSelectionFrame } from '../domain/wallObjectPlacement'
import { structureWindowFrame } from '../domain/structureWindows'
import { structureSurfaceElementId } from '../domain/elementIds'
import { WALL_SIDES } from '../domain/constants'

for (const secondary of [false, true]) {
  test(`crear ventana prioriza pared visible B al girar la vista: ${secondary ? 'pack' : 'raíz'}`, () => {
    const store = createRoomStore()
    if (secondary) store.getState().addStructurePack('up')
    store.getState().lookFromIsoOrientation(2)
    store.getState().addWindow()
    const state = store.getState()
    const pack = state.structurePacks.find((pack) => pack.id === state.activeRoomId)
    const created = (pack?.windows ?? state.room.windows).find((window) => window.id === state.selectedId)!
    assert.equal(created.wall, 'east')
    assert.equal(created.freePosition, undefined)
    assert.ok(state.elementFolderAssignments[created.id])
    store.getState().undo()
    assert.ok(![...store.getState().room.windows, ...store.getState().structurePacks.flatMap((pack) => pack.windows ?? [])].some((window) => window.id === created.id))
  })
}

test('Frontal prefiere su pared principal; Libre sigue el azimut actual', () => {
  const store = createRoomStore()
  store.getState().lookAtWall('west')
  assert.equal(windowPlacementWalls(store.getState())[0].wall, 'west')
  store.getState().addWindow()
  assert.equal(store.getState().room.windows.at(-1)?.wall, 'west')
  store.getState().setView('free')
  store.getState().lookFromFreeOrbit(5 * Math.PI / 4, 0.5)
  assert.deepEqual(windowPlacementWalls(store.getState()).filter((item) => item.visible).map((item) => item.wall), ['east', 'south'])
})

test('ocultación manual y candados excluyen paredes; Plano conserva todos los lados disponibles', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  store.getState().lookFromIsoOrientation(2)
  store.getState().toggleElementVisibility(structureSurfaceElementId(pack.id, 'wall-east'))
  store.getState().toggleElementLock(structureSurfaceElementId(pack.id, 'wall-south'))
  assert.deepEqual(windowPlacementWalls(store.getState()).map((item) => item.wall), ['north', 'west'])
  store.getState().setView('top')
  assert.ok(windowPlacementWalls(store.getState()).every((item) => item.visible))
  store.getState().toggleElementVisibility(pack.id)
  const before = structuredClone(store.getState().structurePacks)
  store.getState().addWindow()
  assert.deepEqual(store.getState().structurePacks, before)
})

test('si ninguna pared visible admite la ventana, usa una oculta y avisa del motivo', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  store.getState().lookFromIsoOrientation(2)
  store.getState().resizeStructureSurface(pack.id, 'wall-east', 'height', 2)
  store.getState().resizeStructureSurface(pack.id, 'wall-south', 'height', 2)
  store.getState().addWindow()
  assert.equal(store.getState().structurePacks[0].windows?.[0].wall, 'north')
  assert.match(store.getState().notice, /pared oculta/)
})

for (const wall of WALL_SIDES) {
  test(`contorno y controles incluyen origen mundial y antepecho de un pack en ${wall}`, () => {
    const store = createRoomStore()
    store.getState().addStructurePack('east')
    store.getState().setSelectedRoomDimension('height', 4)
    const state = store.getState()
    const original = state.structurePacks[0]
    const pack = { ...original, x: 7, y: -3, z: 9, surfaces: original.surfaces.map((surface) => ({ ...surface, y: surface.y + 0.2 })) }
    const window = { ...state.room.windows[0], wall, offset: 0.6, sill: 1.2 }
    const wallFrame = structureWindowFrame(state.room, pack, wall)!
    const selection = wallObjectSelectionFrame(state.room, window, pack)
    assert.ok(Math.abs(selection.position.y - (pack.y + 0.2 + window.sill)) < 1e-9)
    assert.ok(Math.abs(selection.position.y + selection.localCenter[1] - (wallFrame.floorY + window.sill + window.height / 2)) < 1e-9)
    assert.equal(selection.handleBase.y, selection.position.y)
    assert.ok(Math.abs(selection.handleBase.x - selection.position.x - Math.sin(wallFrame.yaw) * selection.localCenter[2]) < 1e-9)
    assert.ok(Math.abs(selection.handleBase.z - selection.position.z - Math.cos(wallFrame.yaw) * selection.localCenter[2]) < 1e-9)
  })
}

test('una ventana libre conserva su posición frente al antiguo soporte y a los controles', () => {
  const store = createRoomStore()
  const window = { ...store.getState().room.windows[0], freePosition: { x: 8, y: 3.1, z: -4, yaw: Math.PI / 2 } }
  const frame = wallObjectSelectionFrame(store.getState().room, window)
  assert.deepEqual(frame.position, window.freePosition)
  assert.equal(frame.handleBase.y, 3.1)
  assert.equal(frame.position.y + frame.localCenter[1], 3.1 + window.height / 2)
})
