import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { detectOutsideRoom, detectSceneCollisions, collisionElementIds } from './sceneCollisions'
import { FURNITURE_PRESETS } from './objectCatalog'
import { createStructureSurface } from './structureRules'
import type { FurnitureItem, RoomConfig, StructurePack } from './types'

const chair = (id: string, x: number, z: number, y = 0): FurnitureItem => ({
  ...FURNITURE_PRESETS.chair,
  id, name: id, x, y, z, rotation: 0,
})

test('detecta todas las parejas del grupo de tres muebles sin duplicados', () => {
  const world = { room: DEFAULT_ROOM, furniture: [chair('Silla 1', 0, 0), chair('Silla 2', 0.1, 0), chair('Silla 3', -0.1, 0)], structurePacks: [] }
  const pairs = detectSceneCollisions(world)
  assert.equal(pairs.length, 3)
  assert.deepEqual(collisionElementIds(pairs), new Set(['Silla 1', 'Silla 2', 'Silla 3']))
})

test('ignora objetos que solo se tocan, alturas diferentes y elementos ocultos', () => {
  const first = chair('Primera', 0, 0)
  const second = chair('Segunda', first.width, 0)
  const world = { room: DEFAULT_ROOM, furniture: [first, second], structurePacks: [] }
  assert.equal(detectSceneCollisions(world).length, 0)
  assert.equal(detectSceneCollisions({ ...world, furniture: [first, { ...second, x: 0, y: 3 }] }).length, 0)
  assert.equal(detectSceneCollisions({ ...world, furniture: [first, { ...second, x: 0 }], hiddenElementIds: ['Segunda'] }).length, 0)
})

test('informa de ventana frente a puerta en la misma pared y respeta alturas', () => {
  const room: RoomConfig = {
    ...DEFAULT_ROOM,
    door: { ...DEFAULT_ROOM.door, wall: 'north', offset: 0 },
    windows: [{ ...DEFAULT_ROOM.windows[0], wall: 'north', offset: 0, sill: 0.8 }],
  }
  const collisions = detectSceneCollisions({ room, furniture: [], structurePacks: [] })
  assert.equal(collisions.length, 1)
  assert.deepEqual(collisionElementIds(collisions), new Set(['door', room.windows[0].id]))
  assert.equal(detectSceneCollisions({ room, furniture: [], structurePacks: [], hiddenElementIds: ['door'] }).length, 0)
  assert.equal(detectSceneCollisions({ room: { ...room, windows: [{ ...room.windows[0], sill: 2.2, height: 0.4 }] }, furniture: [], structurePacks: [] }).length, 0)
})

test('muebles pueden intersectar con una puerta si realmente penetran su marco', () => {
  const entry = chair('Silla frente a puerta', 0, DEFAULT_ROOM.depth / 2 - 0.06)
  const room = { ...DEFAULT_ROOM, door: { ...DEFAULT_ROOM.door, wall: 'south' as const, offset: 0 } }
  const pairs = detectSceneCollisions({ room, furniture: [entry], structurePacks: [] })
  assert.ok(pairs.some(({ firstId, secondId }) => firstId === entry.id && secondId === 'door'))
})

test('las puertas de otra planta no colisionan con las de la planta inferior', () => {
  const pack: StructurePack = { id: 'floor-pack-upper', name: 'Habitación superior', x: 0, y: DEFAULT_ROOM.height, z: 0,
    surfaces: (['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west'] as const).map((kind) => createStructureSurface(DEFAULT_ROOM, kind)),
    doors: [{ id: 'upper-door', name: 'Puerta superior', wall: 'south', offset: 0, width: 1, height: 2.1, rotation: 0 }],
  }
  assert.equal(detectSceneCollisions({ room: DEFAULT_ROOM, furniture: [], structurePacks: [pack] }).length, 0)
})

test('avisa de un objeto que sale de una habitación aunque no choque con otros', () => {
  const inside = chair('Interior', 0, 0)
  const outside = chair('Fuera', DEFAULT_ROOM.width + 1, 0)
  const world = { room: DEFAULT_ROOM, furniture: [inside, outside], structurePacks: [] }
  assert.deepEqual(detectOutsideRoom(world), [{ id: 'Fuera', name: 'Fuera' }])
  assert.equal(detectSceneCollisions(world).length, 0)
  assert.deepEqual(detectOutsideRoom({ ...world, hiddenElementIds: ['Fuera'] }), [])
})

test('muestra superficies independientes fuera de la habitación y respeta su nombre', () => {
  const floor = createStructureSurface(DEFAULT_ROOM, 'floor')
  const pack: StructurePack = { id: 'floor-object-test', name: 'Suelo personalizado', x: 10, y: 0, z: 0, surfaces: [{ ...floor, name: 'Tarima nueva', width: 1, depth: 1, y: 1 }] }
  const world = { room: DEFAULT_ROOM, furniture: [], structurePacks: [pack] }
  assert.deepEqual(detectOutsideRoom(world), [{ id: 'structure-surface:floor-object-test:floor', name: 'Tarima nueva' }])
  assert.deepEqual(detectOutsideRoom({ ...world, hiddenElementIds: [pack.id] }), [])
})

test('los suelos y paredes independientes también producen incidencias al atravesarse', () => {
  const floor = createStructureSurface(DEFAULT_ROOM, 'floor')
  const wall = createStructureSurface(DEFAULT_ROOM, 'wall-north')
  const floorPack: StructurePack = { id: 'floor-object-one', name: 'Suelo', x: 0, y: 0, z: 0,
    surfaces: [{ ...floor, width: 1, depth: 1, y: DEFAULT_ROOM.height / 2 }] }
  const wallPack: StructurePack = { id: 'wall-object-one', name: 'Pared', x: 0, y: 0, z: 0,
    surfaces: [{ ...wall, width: 1, height: 1, z: DEFAULT_ROOM.depth / 2, y: 0 }] }
  const collisions = detectSceneCollisions({ room: DEFAULT_ROOM, furniture: [], structurePacks: [floorPack, wallPack] })
  assert.equal(collisions.length, 1)
  assert.deepEqual(collisionElementIds(collisions), new Set([
    'structure-surface:floor-object-one:floor', 'structure-surface:wall-object-one:wall-north',
  ]))
})
