import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { validateOpenings } from './geometry'
import { createStructureSurface } from './structureRules'
import { structureDoorError } from './structureDoors'
import { structureWindowError } from './structureWindows'
import type { StructurePack } from './types'

test('solapamientos entre puerta y ventana se permiten en raíz y habitación adicional', () => {
  const room = { ...DEFAULT_ROOM, door: { ...DEFAULT_ROOM.door, wall: 'north' as const, offset: 0 },
    windows: [{ ...DEFAULT_ROOM.windows[0], wall: 'north' as const, offset: 0, sill: 1 }] }
  assert.equal(validateOpenings(room), null)
  const pack: StructurePack = { id: 'floor-pack-overlap', name: 'Habitación', x: 0, y: 0, z: 0,
    surfaces: [createStructureSurface(DEFAULT_ROOM, 'wall-north')],
    doors: [{ id: 'extra-door', wall: 'north', offset: 0, width: 1, height: 2.1, rotation: 0 }],
    windows: [{ ...DEFAULT_ROOM.windows[0], id: 'extra-window', wall: 'north', offset: 0 }] }
  assert.equal(structureDoorError(pack), null)
  assert.equal(structureWindowError(pack), null)
  pack.doors!.push({ ...pack.doors![0], id: 'second-door' })
  assert.equal(structureDoorError(pack), null)
})

test('el cambio no permite que las aperturas se salgan de la pared', () => {
  const room = { ...DEFAULT_ROOM, windows: [{ ...DEFAULT_ROOM.windows[0], offset: 100 }] }
  assert.match(validateOpenings(room) ?? '', /fuera/)
  const pack: StructurePack = { id: 'floor-pack-bounds', name: 'Habitación', x: 0, y: 0, z: 0,
    surfaces: [createStructureSurface(DEFAULT_ROOM, 'wall-north')],
    windows: [{ ...DEFAULT_ROOM.windows[0], wall: 'north', offset: 100 }] }
  assert.match(structureWindowError(pack) ?? '', /fuera/)
})
