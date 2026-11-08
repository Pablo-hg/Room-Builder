import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM, DEFAULT_WALL_COLOR } from '../domain/constants'
import { createStructureSurface } from '../domain/structureRules'
import { planWallStrips } from './planWallLines'
import type { StructurePack } from '../domain/types'

test('en plano el trazo es más ancho que el grosor raíz y el color neutro se mantiene', () => {
  const wallId = 'room-wall:east'
  const strips = planWallStrips({ room: DEFAULT_ROOM, structurePacks: [] }, new Set([wallId]))
  assert.equal(strips.length, 1)
  assert.ok(strips[0].thickness > 0.12)
  assert.equal(strips[0].color, '#6e7d73')
})

test('un color propio de pared raíz se refleja directamente en su línea', () => {
  const room = { ...DEFAULT_ROOM, wallColors: { ...(DEFAULT_ROOM.wallColors ?? {}), east: '#1954a6' } }
  const strips = planWallStrips({ room, structurePacks: [] }, new Set(['room-wall:east']))
  assert.equal(strips[0].color, '#1954a6')
  assert.equal(planWallStrips({ room: { ...room, wallColors: { east: DEFAULT_WALL_COLOR } }, structurePacks: [] }, new Set(['room-wall:east']))[0].color, '#6e7d73')
})

test('los packs y paredes independientes conservan su color propio sin cambiar el objeto', () => {
  const wall = { ...createStructureSurface(DEFAULT_ROOM, 'wall-north'), color: '#bd502d' }
  const pack: StructurePack = { id: 'floor-pack-test-plan', name: 'Habitación 2', x: 7, y: 3, z: 0, surfaces: [wall] }
  const id = 'structure-surface:floor-pack-test-plan:wall-north'
  const strips = planWallStrips({ room: DEFAULT_ROOM, structurePacks: [pack] }, new Set([id]))
  assert.equal(strips.length, 1)
  assert.equal(strips[0].color, '#bd502d')
  assert.ok(strips[0].y > pack.y)
  assert.deepEqual(pack.surfaces[0], wall)
})

test('la línea no tapa el paso de una puerta ni una ventana a la altura del plano', () => {
  const root = { ...DEFAULT_ROOM, windows: [] }
  const wall = 'room-wall:south'
  const strips = planWallStrips({ room: root, structurePacks: [] }, new Set([wall]))
  assert.equal(strips.length, 2)
  assert.ok(strips.every((strip) => strip.length > 0))
  assert.ok(strips.every((strip) => strip.thickness >= 0.22))
})

test('las paredes ocultas no producen líneas, incluso si tienen color personalizado', () => {
  assert.deepEqual(planWallStrips({ room: DEFAULT_ROOM, structurePacks: [] }, new Set()), [])
})

test('una pared independiente coloreada se ve en Plano sin añadir otras líneas', () => {
  const surface = { ...createStructureSurface(DEFAULT_ROOM, 'wall-east'), color: '#ce3e64' }
  const pack: StructurePack = { id: 'wall-object-alone', name: 'Pared independiente', x: 2, y: 0, z: 1, surfaces: [surface] }
  const id = 'structure-surface:wall-object-alone:wall-east'
  const strips = planWallStrips({ room: DEFAULT_ROOM, structurePacks: [pack] }, new Set([id]))
  assert.equal(strips.length, 1)
  assert.equal(strips[0].color, '#ce3e64')
  assert.ok(strips[0].x !== 0)
  assert.ok(strips[0].thickness > 0.13)
})
