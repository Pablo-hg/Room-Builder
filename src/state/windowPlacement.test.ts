import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { windowPlacementWalls } from '../domain/windowPlacement'
import { wallObjectSelectionFrame } from '../domain/wallObjectPlacement'
import { structureWindowFrame } from '../domain/structureWindows'
import { structureSurfaceElementId } from '../domain/elementIds'
import { WALL_SIDES } from '../domain/constants'
import { detectSceneCollisions } from '../domain/sceneCollisions'

for (const secondary of [false, true]) {
  test(`al llenar paredes visibles busca la siguiente y después permite solapar: ${secondary ? 'pack' : 'raíz'}`, () => {
    const store = createRoomStore()
    if (secondary) store.getState().addStructurePack('up')
    store.getState().lookFromIsoOrientation(2)
    const visible = windowPlacementWalls(store.getState()).filter((candidate) => candidate.visible).map((candidate) => candidate.wall)
    assert.deepEqual(visible, ['east', 'south'])
    let firstOnSecond = false
    let overlapOnVisible = false
    for (let index = 0; index < 20; index++) {
      store.getState().addWindow('pictureLarge')
      const state = store.getState()
      const pack = state.structurePacks.find((item) => item.id === state.activeRoomId)
      const created = (pack?.windows ?? state.room.windows).find((item) => item.id === state.selectedId)!
      assert.ok(created)
      assert.ok(visible.includes(created.wall), 'no usa una pared oculta mientras una visible admite solape')
      const overlaps = detectSceneCollisions(state).some((pair) => pair.firstId === created.id || pair.secondId === created.id)
      if (created.wall === visible[1] && !firstOnSecond) {
        firstOnSecond = true
        assert.equal(overlaps, false, 'la segunda pared se usa antes de solapar')
      }
      if (firstOnSecond && overlaps) { overlapOnVisible = true; break }
    }
    assert.ok(firstOnSecond, 'debe pasar a la segunda pared visible')
    assert.ok(overlapOnVisible, 'debe seguir creando cuando ambas están ocupadas')
  })
}

test('aprovecha la altura libre antes de cambiar de pared visible', () => {
  const store = createRoomStore()
  store.getState().lookFromIsoOrientation(2)
  store.setState((state) => ({ room: { ...state.room, windows: [...state.room.windows, {
    id: 'ocupacion-inferior', shape: 'pictureLarge', wall: 'east', offset: 0,
    width: 4, height: 1, sill: 0, rotation: 0, color: '#ffffff',
  }] } }))
  store.getState().addWindow('pictureLarge')
  const added = store.getState().room.windows.find((item) => item.id === store.getState().selectedId)!
  assert.equal(added.wall, 'east')
  assert.ok(added.sill >= 1)
})

test('las posiciones libres varían en anchura y altura sin cambiar de pared', () => {
  const store = createRoomStore()
  store.getState().lookFromIsoOrientation(2)
  const originalRandom = Math.random
  let seed = 12345
  try {
    Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let index = 0; index < 4; index++) store.getState().addWindow('pictureSmall')
  } finally { Math.random = originalRandom }
  const objects = store.getState().room.windows.filter((item) => item.shape === 'pictureSmall')
  assert.equal(objects.length, 4)
  assert.ok(objects.every((item) => item.wall === 'east'))
  assert.ok(new Set(objects.map((item) => item.offset)).size > 1)
  assert.ok(new Set(objects.map((item) => item.sill)).size > 1)
  const ids = new Set(objects.map((item) => item.id))
  assert.equal(detectSceneCollisions(store.getState()).some((pair) => ids.has(pair.firstId) && ids.has(pair.secondId)), false)
})

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
  store.getState().resizeStructureSurface(pack.id, 'wall-east', 'height', 0.5)
  store.getState().resizeStructureSurface(pack.id, 'wall-south', 'height', 0.5)
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
    // Una ventana del pack usa su marco local. La ventana de raíz de la
    // configuración inicial ya posee anclaje global v10 y no es un buen fixture.
    const window = { ...state.room.windows[0], wallPosition: undefined, wall, offset: 0.6, sill: 1.2 }
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

test('al crear, busca primero un hueco libre; al mover, permite superponer dos ventanas con aviso', () => {
  const store = createRoomStore()
  store.getState().lookAtWall('north')
  const original = store.getState().room.windows[0]
  store.getState().addWindow('rectangular')
  const added = store.getState().room.windows.find((window) => window.id === store.getState().selectedId)!
  assert.ok(added)
  assert.equal(added.wall, 'north')
  assert.equal(detectSceneCollisions(store.getState()).some(({ firstId, secondId }) => [firstId, secondId].includes(original.id) && [firstId, secondId].includes(added.id)), false)
  store.getState().updateWindow(added.id, { offset: original.offset, sill: original.sill })
  assert.equal(store.getState().room.windows.find((window) => window.id === added.id)?.offset, original.offset)
  const pairs = detectSceneCollisions(store.getState())
  assert.ok(pairs.some(({ firstId, secondId }) => [firstId, secondId].includes(original.id) && [firstId, secondId].includes(added.id)))
  store.getState().undo()
  const restored = store.getState().room.windows.find((window) => window.id === added.id)!
  assert.deepEqual({ offset: restored.offset, sill: restored.sill }, { offset: added.offset, sill: added.sill })
})
