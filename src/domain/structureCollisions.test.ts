import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { FURNITURE_PRESETS } from './objectCatalog'
import { createStructureSurface } from './structureRules'
import { furnitureHasSpatialWarning, independentSurfaceHasSpatialWarning, surfaceIntersectsFurniture } from './structureCollisions'
import { structureSurfaceElementId } from './elementIds'
import type { FurnitureItem, StructurePack } from './types'

const chair: FurnitureItem = { ...FURNITURE_PRESETS.chair, id: 'chair', x: 0, y: 0, z: 0, rotation: 0 }
const pack: StructurePack = { id: 'floor-pack-test', name: 'Piso', x: 0, y: DEFAULT_ROOM.height, z: 0, surfaces: (['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west'] as const).map((id) => createStructureSurface(DEFAULT_ROOM, id)) }
const world = { room: DEFAULT_ROOM, furniture: [chair], structurePacks: [pack] }

test('avisa cuando un mueble atraviesa o queda fuera de la habitación', () => {
  assert.equal(furnitureHasSpatialWarning(world, chair), false)
  for (const item of [{ ...chair, x: DEFAULT_ROOM.width / 2 }, { ...chair, x: 10 }, { ...chair, y: -0.5 }, { ...chair, y: DEFAULT_ROOM.height - chair.height / 2 }]) {
    assert.equal(furnitureHasSpatialWarning(world, item), true)
  }
  assert.equal(furnitureHasSpatialWarning(world, { ...chair, x: DEFAULT_ROOM.width / 2 - chair.width / 2 }), false)
})

test('admite muebles apoyados en un piso superior y detecta cruces con sus superficies', () => {
  const upper = { ...chair, y: pack.y }
  assert.equal(furnitureHasSpatialWarning(world, upper), false)
  const crossing = { ...chair, y: pack.y - 0.2 }
  assert.equal(furnitureHasSpatialWarning(world, crossing), true)
  const updated = { ...world, furniture: [crossing] }
  assert.equal(surfaceIntersectsFurniture(updated, structureSurfaceElementId(pack.id, 'floor')), true)
  assert.equal(surfaceIntersectsFurniture({ ...world, furniture: [upper] }, structureSurfaceElementId(pack.id, 'floor')), false)
})

test('avisa por objetos solapados, sin confundir la proximidad con un cruce', () => {
  const overlapping = { ...chair, id: 'second', x: 0.1 }
  assert.equal(furnitureHasSpatialWarning({ ...world, furniture: [chair, overlapping] }, chair), true)
  const touching = { ...overlapping, x: chair.width }
  assert.equal(furnitureHasSpatialWarning({ ...world, furniture: [chair, touching] }, chair), false)
})

test('avisa si una superficie independiente se encuentra fuera, sin penalizar uniones de superficies', () => {
  const floor: StructurePack = { id: 'floor-object-test', name: 'Suelo', x: 0, y: 0, z: 0, surfaces: [{ ...createStructureSurface(DEFAULT_ROOM, 'floor'), y: 1.35 }] }
  const id = structureSurfaceElementId(floor.id, 'floor')
  const current = { room: DEFAULT_ROOM, furniture: [], structurePacks: [floor, pack] }
  assert.equal(independentSurfaceHasSpatialWarning(current, id), false)
  assert.equal(independentSurfaceHasSpatialWarning({ ...current, structurePacks: [{ ...floor, x: 1 }, pack] }, id), true)
})
