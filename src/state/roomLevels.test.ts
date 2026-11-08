import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { persistedDesign } from '../domain/designV1'
import { packRoomBox, roomVerticalBounds, surfacePosition } from '../domain/roomEditing'
import { structureSurfaceName } from '../domain/selection'
import { WALL_LABELS, WALL_SIDES } from '../domain/constants'
import { createStructureSurface } from '../domain/structureRules'
import { parseDesignFile, serializeDesignFile } from '../persistence/designFile'
import { normalizeDesign } from '../persistence/designMigrations'

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} debe coincidir con ${b}`)
const faceGap = (upperBottom: number, lowerTop: number) => {
  close(upperBottom, lowerTop)
}

for (const direction of ['up', 'down'] as const) {
  test(`crear ${direction} alinea las caras exteriores con la raíz sin mover muebles`, () => {
    const store = createRoomStore()
    store.getState().addFurniture('chair')
    store.getState().addFurniture('ceilingLamp')
    const furniture = structuredClone(store.getState().furniture)
    const root = roomVerticalBounds(store.getState().room)
    store.getState().addStructurePack(direction)
    const state = store.getState()
    const bounds = roomVerticalBounds(state.room, state.structurePacks[0])
    if (direction === 'up') faceGap(bounds.bottom, root.top)
    else faceGap(root.bottom, bounds.top)
    assert.deepEqual(state.furniture, furniture)
    const pack = structuredClone(state.structurePacks[0])
    store.getState().undo()
    assert.equal(store.getState().structurePacks.length, 0)
    store.getState().redo()
    assert.deepEqual(store.getState().structurePacks[0], pack)
    assert.deepEqual(store.getState().furniture, furniture)
  })

  test(`crear ${direction} respeta altura personalizada, espesores y origen local de la referencia`, () => {
    const store = createRoomStore()
    store.getState().addStructurePack('east')
    store.getState().setSelectedRoomDimension('height', 4)
    let reference = store.getState().structurePacks[0]
    store.getState().resizeStructureSurface(reference.id, 'floor', 'height', 0.2)
    store.getState().resizeStructureSurface(reference.id, 'ceiling', 'height', 0.4)
    // An imported coherent room may have a local floor origin other than zero.
    reference = store.getState().structurePacks[0]
    reference = { ...reference, y: -6, surfaces: reference.surfaces.map((surface) => ({ ...surface, y: surface.y + 0.3 })) }
    store.setState({ structurePacks: [reference] })
    const before = structuredClone(reference)
    const bounds = roomVerticalBounds(store.getState().room, reference)
    store.getState().addStructurePack(direction)
    const state = store.getState()
    const added = state.structurePacks[1]
    const next = roomVerticalBounds(state.room, added)
    if (direction === 'up') faceGap(next.bottom, bounds.top)
    else faceGap(bounds.bottom, next.top)
    assert.equal(packRoomBox(added, state.room)?.height, 4)
    close(added.x, reference.x)
    assert.deepEqual(state.structurePacks[0], before)
    const data = persistedDesign(state)
    const saved = { id: 'levels', name: 'Niveles', savedAt: '2026-11-08T12:00:00Z', data }
    const loaded = normalizeDesign(parseDesignFile(serializeDesignFile(saved)).design.data)
    assert.deepEqual(loaded.structurePacks, data.structurePacks)
    assert.deepEqual(loaded.furniture, data.furniture)
  })
}

test('colocación automática usa el techo más alto real y no presupone la altura de la raíz', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().setSelectedRoomDimension('height', 5)
  const top = roomVerticalBounds(store.getState().room, store.getState().structurePacks[0]).top
  store.getState().addStructurePack()
  faceGap(roomVerticalBounds(store.getState().room, store.getState().structurePacks[1]).bottom, top)
})

test('nombres históricos se presentan con letras sin modificar nombres personalizados o datos', () => {
  const room = createRoomStore().getState().room
  for (const wall of WALL_SIDES) {
    const surface = createStructureSurface(room, `wall-${wall}`)
    assert.equal(surface.name, `Pared ${WALL_LABELS[wall]}`)
    const legacy = { ...surface, name: `Pared ${wall.toUpperCase()}` }
    assert.equal(structureSurfaceName(legacy), surface.name)
    assert.equal(legacy.name, `Pared ${wall.toUpperCase()}`)
    assert.equal(structureSurfaceName({ ...surface, name: 'Pared del estudio' }), 'Pared del estudio')
  }
})

test('abrir fixtures v1–v5 conserva sus coordenadas normalizadas; crear debajo no los recoloca', () => {
  for (const fixture of ['persistence-v1/valid-complete', 'persisted-designs/valid-v2', 'persisted-designs/valid-v3', 'persisted-designs/valid-v4', 'persisted-designs/valid-v5']) {
    const source = JSON.parse(readFileSync(new URL(`../../tests/fixtures/${fixture}.json`, import.meta.url), 'utf8'))
    const untouched = structuredClone(source)
    const data = normalizeDesign(source)
    const store = createRoomStore()
    store.setState({ savedDesigns: [{ id: fixture, name: fixture, savedAt: '2026-11-08T12:00:00Z', data: source }] })
    store.getState().loadDesign(fixture)
    assert.deepEqual(store.getState().furniture, data.furniture)
    assert.deepEqual(store.getState().structurePacks, data.structurePacks ?? [])
    const positions = store.getState().structurePacks.map((pack) => pack.surfaces.map((surface) => surfacePosition(store.getState().room, surface)))
    store.getState().addStructurePack('down')
    assert.deepEqual(store.getState().furniture, data.furniture)
    positions.forEach((surfaces, index) => assert.deepEqual(store.getState().structurePacks[index].surfaces.map((surface) => surfacePosition(store.getState().room, surface)), surfaces))
    assert.deepEqual(source, untouched)
  }
})
