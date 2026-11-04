import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DEFAULT_ROOM } from '../domain/constants'
import { FURNITURE_PRESETS } from '../domain/objectCatalog'
import type { FurnitureItem, FurnitureKind } from '../domain/types'
import { createRoomStore } from './useRoomStore'

const item = (kind: FurnitureKind, id: string, x = 0, z = 0): FurnitureItem => ({
  ...FURNITURE_PRESETS[kind], id, x, y: 0, z, rotation: 0,
})

test('R3: reduce la habitación aunque el ajuste solape los muebles; el borde rojo avisa', () => {
  const store = createRoomStore()
  const furniture = [item('sofa', 'left', -1.5), item('sofa', 'right', 1.5)]
  store.setState({ furniture })
  store.getState().setDimension('width', 3)
  assert.equal(store.getState().room.width, 3)
  assert.deepEqual(store.getState().furniture.map(({ x }) => x), [-0.5, 0.5])
  assert.equal(store.getState().notice, '')
})

test('el cambio de altura conserva las posiciones ya fuera de los límites anteriores', () => {
  const store = createRoomStore()
  store.setState({ furniture: [
    { ...item('ceilingLamp', 'ceiling', -1), y: 2.4 },
    { ...item('table', 'raised', 1), y: 2.3 },
  ] })
  store.getState().setDimension('height', 2.5)
  assert.equal(store.getState().room.height, 2.5)
  assert.equal(store.getState().furniture[0].y, 2.4)
  assert.equal(store.getState().furniture[1].y, 2.3)
  store.getState().undo()
  assert.equal(store.getState().room.height, DEFAULT_ROOM.height)
  assert.equal(store.getState().furniture[1].y, 2.3)
})

test('R3: rotación y movimiento permiten solapes, normalizan el giro y conservan historial', () => {
  const store = createRoomStore()
  const table = item('table', 'table')
  store.setState({ furniture: [table, item('chair', 'obstacle', 0, 0.75)], selectedId: table.id })
  store.getState().setFurnitureRotation(table.id, Math.PI / 2)
  assert.equal(store.getState().furniture[0].rotation, Math.PI / 2)
  assert.equal(store.getState().notice, '')
  store.getState().rotateFurniture()
  assert.equal(store.getState().furniture[0].rotation, Math.PI)
  assert.equal(store.getState().notice, '')
  store.setState({ furniture: [table] })
  store.getState().setFurnitureRotation(table.id, -Math.PI / 2)
  assert.equal(store.getState().furniture[0].rotation, Math.PI * 1.5)
  store.getState().moveFurniture(table.id, 100, -100)
  const moved = store.getState().furniture[0]
  assert.equal(moved.x, 100)
  assert.equal(moved.z, -100)
  store.getState().undo()
  assert.equal(store.getState().furniture[0].x, 0)
})

test('R5: acepta posiciones de puerta y ventana en centímetros y permite elevar con solape', () => {
  const store = createRoomStore()
  store.getState().setDoor({ offset: 0.38 })
  assert.equal(store.getState().room.door.offset, 0.38)
  store.getState().updateWindow('window-1', { offset: 0.38, sill: 0.63 })
  assert.equal(store.getState().room.windows[0].offset, 0.38)
  assert.equal(store.getState().room.windows[0].sill, 0.63)
  const furniture = [item('table', 'low'), { ...item('chair', 'high'), y: 1 }]
  store.setState({ furniture })
  store.getState().moveFurnitureVertically('low', 0.5)
  assert.equal(store.getState().furniture[0].y, 0.5)
  assert.equal(store.getState().furniture[1].y, 1)
})

test('R3: carga v1 mantiene normalización, campos opcionales y fallos de superficies', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../tests/fixtures/persistence-v1/valid-legacy-optional-fields.json', import.meta.url), 'utf8'))
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let raw = ''
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => raw,
    setItem: (_key: string, value: string) => { raw = value },
  } })
  const load = (data: unknown) => {
    raw = JSON.stringify([{ id: 'fixture', name: 'Prueba', savedAt: '2026-10-28', data }])
    const store = createRoomStore()
    store.getState().initializeSavedDesigns()
    store.getState().loadDesign('fixture')
    return store
  }
  try {
    fixture.room.windows[0].shape = 'old-unknown-shape'
    fixture.room.windows[0].offset = 0.38
    delete fixture.room.windows[0].color
    fixture.gridSnap = 'old-value'
    fixture.gridVisibility = { floor: false, north: 'old-value' }
    fixture.hiddenElementIds = ['door', 17, null, 'old:surface:id']
    const loaded = load(fixture).getState()
    assert.equal(loaded.notice, 'Diseño recuperado.')
    assert.equal(loaded.room.windows[0].shape, 'rectangular')
    assert.equal(loaded.room.windows[0].offset, 0.38)
    assert.equal(loaded.room.windows[0].color, '#c88f58')
    assert.equal(loaded.gridSnap, true)
    assert.deepEqual(loaded.gridVisibility, { floor: false, north: true, east: true, south: true, west: true })
    assert.deepEqual(loaded.hiddenElementIds, ['door', 'old:surface:id'])
    fixture.structurePacks = [{ id: 'old-pack', name: 'Pack', x: 0, y: 0, z: 0, surfaces: [{
      id: 'floor', kind: 'floor', name: 'Suelo', x: 0, y: 0, z: 0, color: '#abcdef', rotation: 0,
    }] }]
    for (const rotation of [0, -1]) {
      fixture.structurePacks[0].surfaces[0].rotation = rotation
      const store = load(fixture)
      assert.equal(store.getState().notice, 'Diseño recuperado.')
      assert.equal(store.getState().structurePacks[0].surfaces[0].rotation, rotation)
      assert.equal(store.getState().undoCount, 1)
    }
    fixture.structurePacks[0].surfaces[0].rotation = 0.5
    const surface = load(fixture).getState().structurePacks[0].surfaces[0]
    assert.equal(surface.width, DEFAULT_ROOM.width)
    assert.equal(surface.depth, DEFAULT_ROOM.depth)
    assert.equal(surface.rotation, 0.5)
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
