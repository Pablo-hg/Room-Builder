import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { detectSceneCollisions, collisionElementIds } from './sceneCollisions'
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
