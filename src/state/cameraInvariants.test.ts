import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign } from '../domain/designV1'
import { WALL_SIDES } from '../domain/constants'
import { hiddenWallsForView, orientationForAzimuth } from '../domain/geometry'
import { windowPlacementWalls } from '../domain/windowPlacement'
import type { ViewMode, WallSide } from '../domain/types'
import { wallVisibility } from '../scene/wallVisibility'
import { ISO_BASE_ANGLE, ISO_QUARTER_TURN, cameraZoomLimits } from './defaults'
import { createRoomStore } from './useRoomStore'

// F1-05 (#29): la cámara es estado de sesión. Ninguna operación de cámara toca el
// diseño, el historial ni la selección, y las cuatro diagonales ocultan parejas
// de paredes consistentes con la colocación de aperturas.

const VIEWS: ViewMode[] = ['isometric', 'top', 'front', 'pov', 'free']
const ADJACENT_PAIRS = [['east', 'south'], ['south', 'west'], ['west', 'north'], ['north', 'east']]

function sceneWithEverything() {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  store.getState().rotateFurniture()
  store.getState().addFurniture('desk')
  store.getState().addWindow()
  store.getState().addStructurePack('east')
  store.getState().selectElement(null)
  return store
}

const designOf = (store: ReturnType<typeof createRoomStore>) => JSON.stringify(persistedDesign(store.getState()))

test('ninguna acción de cámara cambia el diseño, el historial ni la selección', () => {
  const store = sceneWithEverything()
  const furniture = store.getState().furniture[0]
  store.getState().selectElement(furniture.id)
  const design = designOf(store)
  const undoCount = store.getState().undoCount
  const actions: [string, () => void][] = [
    ...VIEWS.map((view): [string, () => void] => [`setView ${view}`, () => store.getState().setView(view)]),
    ['lookFromIsoOrientation 1', () => store.getState().lookFromIsoOrientation(1)],
    ['lookFromIsoOrientation -1', () => store.getState().lookFromIsoOrientation(-1)],
    ['rotateIso', () => store.getState().rotateIso(1)],
    ['setIsoAngle', () => store.getState().setIsoAngle(2.3)],
    ['setIsoCameraHeight', () => store.getState().setIsoCameraHeight(1.5)],
    ['lookAtWall', () => store.getState().lookAtWall('south')],
    ['rotateFront', () => store.getState().rotateFront(1)],
    ['setFrontCameraHeight', () => store.getState().setFrontCameraHeight(1.7)],
    ['rotatePov', () => store.getState().rotatePov(1)],
    ['centerPov', () => store.getState().centerPov()],
    ['lookFromFreeOrbit', () => store.getState().lookFromFreeOrbit(1, 0.4)],
    ['setFreeOrbit', () => store.getState().setFreeOrbit(2, 0.2)],
    ['adjustCameraZoom', () => store.getState().adjustCameraZoom(-90)],
    ['setCameraZoom', () => store.getState().setCameraZoom(1.8)],
    ['setTopCameraPosition', () => store.getState().setTopCameraPosition(1.5, -2)],
    ['resetTopCamera', () => store.getState().resetTopCamera()],
  ]
  for (const [name, run] of actions) {
    run()
    assert.equal(designOf(store), design, `${name} modificó el diseño`)
    assert.equal(store.getState().undoCount, undoCount, `${name} añadió historial`)
    assert.equal(store.getState().selectedId, furniture.id, `${name} cambió la selección`)
  }
  const after = store.getState().furniture[0]
  assert.deepEqual([after.x, after.y, after.z, after.rotation], [furniture.x, furniture.y, furniture.z, furniture.rotation])
})

test('deshacer no recoloca la cámara ni la cámara añade pasos al historial', () => {
  const store = sceneWithEverything()
  store.getState().setView('isometric')
  store.getState().rotateIso(1)
  const angle = store.getState().isoAngle
  store.getState().addFurniture('chair')
  store.getState().undo()
  assert.equal(store.getState().isoAngle, angle)
  assert.equal(store.getState().view, 'isometric')
})

test('las cuatro diagonales isométricas ocultan dos paredes contiguas y muestran las otras dos', () => {
  const store = createRoomStore()
  for (let orientation = 0; orientation < 4; orientation += 1) {
    store.getState().lookFromIsoOrientation(orientation)
    const state = store.getState()
    assert.equal(state.view, 'isometric')
    assert.equal(state.wallView, null)
    const { hidden, labeledWalls, gridWalls } = wallVisibility({ view: state.view, orientation: state.isoOrientation, wallView: state.wallView, freeAzimuth: state.freeAzimuth, exportMode: false })
    assert.deepEqual(hidden, ADJACENT_PAIRS[orientation])
    const visible = WALL_SIDES.filter((wall) => !hidden.includes(wall))
    assert.equal(visible.length, 2)
    assert.deepEqual(labeledWalls, visible)
    assert.deepEqual(gridWalls, visible)
  }
})

test('las cuatro parejas ocultas son distintas y cada pared se oculta en dos diagonales', () => {
  const pairs = ADJACENT_PAIRS.map((_, orientation) => hiddenWallsForView('isometric', orientation, null, 0).join('+'))
  assert.equal(new Set(pairs).size, 4)
  for (const wall of WALL_SIDES) assert.equal(ADJACENT_PAIRS.filter((pair) => pair.includes(wall)).length, 2)
})

test('girar la isométrica cuatro cuartos vuelve a la diagonal inicial y mantiene la orientación coherente con el ángulo', () => {
  const store = createRoomStore()
  store.getState().setView('isometric')
  const start = store.getState().isoOrientation
  const seen = new Set<number>()
  for (let step = 0; step < 4; step += 1) {
    store.getState().rotateIso(1)
    const state = store.getState()
    seen.add(state.isoOrientation)
    assert.equal(state.isoOrientation, orientationForAzimuth(state.isoAngle))
  }
  assert.equal(seen.size, 4)
  assert.equal(store.getState().isoOrientation, start)
  for (let orientation = 0; orientation < 4; orientation += 1) {
    store.getState().setIsoAngle(ISO_BASE_ANGLE + orientation * ISO_QUARTER_TURN)
    assert.equal(store.getState().isoOrientation, orientation)
  }
})

test('girar en sentidos contrarios se compensa y un ángulo intermedio se redondea a la diagonal más cercana', () => {
  const store = createRoomStore()
  store.getState().setView('isometric')
  const angle = store.getState().isoAngle
  store.getState().rotateIso(1)
  store.getState().rotateIso(-1)
  assert.ok(Math.abs(store.getState().isoAngle - angle) < 1e-9)
  store.getState().setIsoAngle(ISO_BASE_ANGLE + ISO_QUARTER_TURN * 0.49)
  assert.equal(store.getState().isoOrientation, 0)
  store.getState().setIsoAngle(ISO_BASE_ANGLE + ISO_QUARTER_TURN * 0.51)
  assert.equal(store.getState().isoOrientation, 1)
})

test('la colocación de aperturas prioriza exactamente las paredes visibles de cada diagonal', () => {
  const store = createRoomStore()
  for (let orientation = 0; orientation < 4; orientation += 1) {
    store.getState().lookFromIsoOrientation(orientation)
    const walls = windowPlacementWalls(store.getState())
    const visible = walls.filter((item) => item.visible).map((item) => item.wall).sort()
    const expected = WALL_SIDES.filter((wall) => !ADJACENT_PAIRS[orientation].includes(wall)).sort()
    assert.deepEqual(visible, expected)
    // Las ocultas quedan solo como alternativa, detrás de las visibles.
    assert.deepEqual(walls.slice(0, 2).every((item) => item.visible), true)
    assert.equal(walls.length, 4)
  }
})

test('Libre usa las mismas parejas de paredes que Isométrica en las cuatro diagonales', () => {
  for (let orientation = 0; orientation < 4; orientation += 1) {
    const azimuth = ISO_BASE_ANGLE + orientation * ISO_QUARTER_TURN
    assert.deepEqual(hiddenWallsForView('free', 0, null, azimuth), hiddenWallsForView('isometric', orientation, null, 0))
  }
})

test('Frontal oculta la pared opuesta en las cuatro direcciones y rotar recorre las cuatro', () => {
  const store = createRoomStore()
  const opposite: Record<WallSide, WallSide> = { north: 'south', south: 'north', east: 'west', west: 'east' }
  for (const wall of WALL_SIDES) {
    store.getState().lookAtWall(wall)
    const state = store.getState()
    assert.equal(state.view, 'front')
    assert.deepEqual(hiddenWallsForView('front', 0, state.wallView, 0), [opposite[wall]])
  }
  store.getState().lookAtWall('north')
  const walls = new Set<WallSide | null>()
  for (let step = 0; step < 4; step += 1) { store.getState().rotateFront(1); walls.add(store.getState().wallView) }
  assert.equal(walls.size, 4)
  assert.equal(store.getState().wallView, 'north')
  store.getState().rotateFront(-1)
  assert.equal(store.getState().wallView, 'west')
})

test('Plano oculta todas las paredes altas, POV ninguna y la exportación jamás oculta nada', () => {
  assert.deepEqual(hiddenWallsForView('top', 0, null, 0), [...WALL_SIDES])
  assert.deepEqual(hiddenWallsForView('pov', 2, null, 0), [])
  for (const view of VIEWS) for (let orientation = 0; orientation < 4; orientation += 1) {
    assert.deepEqual(hiddenWallsForView(view, orientation, 'east', 1, true), [], `${view} ${orientation}`)
  }
})

test('POV gira en pasos de 15° con tope de ±55° sin salirse de la puerta', () => {
  const store = createRoomStore()
  store.getState().setView('pov')
  assert.equal(store.getState().povYaw, 0)
  store.getState().rotatePov(1)
  assert.equal(store.getState().povYaw, 15)
  for (let step = 0; step < 10; step += 1) store.getState().rotatePov(1)
  assert.equal(store.getState().povYaw, 55)
  for (let step = 0; step < 20; step += 1) store.getState().rotatePov(-1)
  assert.equal(store.getState().povYaw, -55)
})

test('el zoom de cada vista es independiente y respeta sus límites', () => {
  const store = createRoomStore()
  store.getState().setView('pov')
  store.getState().setCameraZoom(0.2)
  assert.equal(store.getState().povCameraZoom, cameraZoomLimits('pov').min)
  store.getState().setCameraZoom(1.6)
  assert.equal(store.getState().povCameraZoom, 1.6)
  const { cameraZoom, freeCameraZoom } = store.getState()
  assert.equal(cameraZoom, 1)
  assert.equal(freeCameraZoom, 1)
  store.getState().setView('free')
  store.getState().setCameraZoom(99)
  assert.equal(store.getState().freeCameraZoom, cameraZoomLimits('free').max)
  assert.equal(store.getState().povCameraZoom, 1.6)
  store.getState().setCameraZoom(Number.NaN)
  assert.equal(store.getState().freeCameraZoom, cameraZoomLimits('free').max)
})

test('Isométrica, Frontal y Libre conservan su orientación al pasar por cualquier otra vista', () => {
  const store = createRoomStore()
  store.getState().lookFromIsoOrientation(2)
  const angle = store.getState().isoAngle
  store.getState().lookFromFreeOrbit(1.1, 0.5)
  store.getState().lookAtWall('west')
  store.getState().setView('top')
  store.getState().setView('pov')
  store.getState().setView('isometric')
  assert.equal(store.getState().isoOrientation, 2)
  assert.equal(store.getState().isoAngle, angle)
  assert.equal(store.getState().wallView, null)
  store.getState().setView('free')
  assert.ok(Math.abs(store.getState().freeAzimuth - 1.1) < 1e-9)
  assert.equal(store.getState().freeElevation, 0.5)
})

test('cada vista fija o libera la pared de referencia que le corresponde', () => {
  const store = createRoomStore()
  store.getState().lookFromIsoOrientation(1)
  store.getState().setView('top')
  assert.notEqual(store.getState().wallView, null)
  store.getState().setView('front')
  assert.notEqual(store.getState().wallView, null)
  for (const view of ['isometric', 'pov', 'free'] as const) {
    store.getState().setView(view)
    assert.equal(store.getState().view, view)
    if (view !== 'pov') assert.equal(store.getState().wallView, null, view)
  }
})

test('la exportación de cada diagonal incluye las cuatro paredes aunque dos estén ocultas en pantalla', () => {
  for (let orientation = 0; orientation < 4; orientation += 1) {
    const onScreen = wallVisibility({ view: 'isometric', orientation, wallView: null, freeAzimuth: 0, exportMode: false })
    const exported = wallVisibility({ view: 'isometric', orientation, wallView: null, freeAzimuth: 0, exportMode: true })
    assert.equal(onScreen.hidden.length, 2)
    assert.deepEqual(exported, { hidden: [], labeledWalls: [], gridWalls: [] })
  }
})

test('centrar el POV vuelve a mirar al frente sin tocar zoom ni diseño', () => {
  const store = createRoomStore()
  store.getState().setView('pov')
  store.getState().rotatePov(1)
  store.getState().rotatePov(1)
  store.getState().setCameraZoom(1.4)
  const design = designOf(store)
  store.getState().centerPov()
  assert.equal(store.getState().povYaw, 0)
  assert.equal(store.getState().povCameraZoom, 1.4)
  assert.equal(store.getState().view, 'pov')
  assert.equal(designOf(store), design)
})
