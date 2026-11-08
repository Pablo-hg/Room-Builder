import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { boxOutsideBuilding, type SpatialBox } from './buildingVolume'
import { createStructureSurface } from './structureRules'
import type { StructurePack } from './types'

const pack = (id: string, x: number, y = 0, z = 0): StructurePack => ({ id: `floor-pack-${id}`, name: id, x, y, z,
  surfaces: (['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west'] as const).map((id) => createStructureSurface(DEFAULT_ROOM, id)) })
const box: SpatialBox = { x: 0, y: 1, z: 0, width: 1, height: 1, depth: 0.4, rotation: 0 }

test('un objeto que cruza dos habitaciones contiguas sigue dentro de la vivienda', () => {
  const world = { room: DEFAULT_ROOM, structurePacks: [pack('east', DEFAULT_ROOM.width)] }
  assert.equal(boxOutsideBuilding(world, { ...box, x: DEFAULT_ROOM.width / 2 }), false)
  assert.equal(boxOutsideBuilding(world, { ...box, x: DEFAULT_ROOM.width / 2, rotation: Math.PI / 4 }), false)
})

test('la unión no rellena huecos entre casas ni el patio de una vivienda en L', () => {
  const separated = { room: DEFAULT_ROOM, structurePacks: [pack('east', 8)] }
  // End corners are inside rooms; the middle of this long object is in real void.
  assert.equal(boxOutsideBuilding(separated, { ...box, x: 4, width: 5 }), true)
  const lShape = { room: DEFAULT_ROOM, structurePacks: [pack('east', DEFAULT_ROOM.width), pack('north', 0, 0, -DEFAULT_ROOM.depth)] }
  assert.equal(boxOutsideBuilding(lShape, { ...box, x: DEFAULT_ROOM.width, z: -DEFAULT_ROOM.depth }), true)
})

test('avisa por volumen parcial en vacío, pero no por contacto con un apoyo', () => {
  const world = { room: DEFAULT_ROOM, structurePacks: [] }
  assert.equal(boxOutsideBuilding(world, { ...box, x: DEFAULT_ROOM.width / 2 + 0.2 }), true)
  assert.equal(boxOutsideBuilding(world, { ...box, x: DEFAULT_ROOM.width / 2 - box.width / 2 }), false)
  assert.equal(boxOutsideBuilding(world, { ...box, y: 0, height: 0.05 }), false)
  assert.equal(boxOutsideBuilding(world, { ...box, x: 100_000, z: 100_000 }), true)
})

test('distingue volumen continuo entre plantas y un hueco vertical real', () => {
  const touching = { room: DEFAULT_ROOM, structurePacks: [pack('upper', 0, DEFAULT_ROOM.height + 0.065)] }
  assert.equal(boxOutsideBuilding(touching, { ...box, y: DEFAULT_ROOM.height, height: 1 }), false)
  const separated = { room: DEFAULT_ROOM, structurePacks: [pack('upper', 0, 10)] }
  assert.equal(boxOutsideBuilding(separated, { ...box, y: 6 }), true)
})

test('una superficie independiente no crea una habitación ficticia en el vacío', () => {
  const independent = { ...pack('free', 30), id: 'wall-object-free' }
  assert.equal(boxOutsideBuilding({ room: DEFAULT_ROOM, structurePacks: [independent] }, { ...box, x: 30 }), true)
})

test('mover una pared dentro de las otras mantiene la habitación cerrada, con cualquier grosor', () => {
  const inner = pack('east', DEFAULT_ROOM.width)
  const wall = inner.surfaces.find((surface) => surface.id === 'wall-east')!
  const world = { room: DEFAULT_ROOM, structurePacks: [inner] }
  const inside = { ...box, x: DEFAULT_ROOM.width, z: 0 }
  assert.equal(boxOutsideBuilding(world, inside), false)
  wall.x -= 0.35
  for (const thickness of [0.01, 0.13, 1.4]) {
    wall.depth = thickness
    assert.equal(boxOutsideBuilding({ ...world, structurePacks: [{ ...inner, surfaces: [...inner.surfaces] }] }, inside), false)
  }
})

test('si las paredes no llegan a tocarse, no se inventa una habitación cerrada', () => {
  const inner = pack('east', DEFAULT_ROOM.width)
  inner.surfaces.find((surface) => surface.id === 'wall-north')!.x = -3
  const world = { room: DEFAULT_ROOM, structurePacks: [inner] }
  assert.equal(boxOutsideBuilding(world, { ...box, x: DEFAULT_ROOM.width, z: 0 }), true)
})

test('una pared inclinada que cruza los dos muros adyacentes puede cerrar un polígono', () => {
  const inner = pack('east', DEFAULT_ROOM.width)
  const wall = inner.surfaces.find((surface) => surface.id === 'wall-east')!
  wall.x -= 0.5
  wall.rotation = 0.10
  const world = { room: DEFAULT_ROOM, structurePacks: [inner] }
  assert.equal(boxOutsideBuilding(world, { ...box, x: DEFAULT_ROOM.width, z: 0 }), false)
})
