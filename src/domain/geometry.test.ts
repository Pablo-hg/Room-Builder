import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { buildWallSegments, clampFurniture, hiddenWallsForOrientation, validateOpenings } from './geometry'
import type { FurnitureItem, RoomConfig } from './types'

describe('hiddenWallsForOrientation', () => {
  const cases = [
    [0, ['east', 'south']],
    [1, ['south', 'west']],
    [2, ['west', 'north']],
    [3, ['north', 'east']],
  ] as const
  cases.forEach(([orientation, expected]) => it(`oculta las paredes próximas en la orientación ${orientation}`, () => {
    assert.deepEqual(hiddenWallsForOrientation(orientation), expected)
  }))

  it('normaliza rotaciones en ambos sentidos', () => {
    assert.deepEqual(hiddenWallsForOrientation(4), hiddenWallsForOrientation(0))
    assert.deepEqual(hiddenWallsForOrientation(-1), hiddenWallsForOrientation(3))
  })
})

describe('buildWallSegments', () => {
  it('conserva la superficie de pared salvo el hueco de puerta', () => {
    const segments = buildWallSegments(5, 2.7, [{ id: 'door', kind: 'door', offset: 0, width: 0.9, bottom: 0, height: 2.1 }])
    const area = segments.reduce((total, segment) => total + segment.size[0] * segment.size[1], 0)
    assert.ok(Math.abs(area - (5 * 2.7 - 0.9 * 2.1)) < 1e-6)
  })

  it('crea geometría alrededor de una ventana elevada', () => {
    const segments = buildWallSegments(5, 2.7, [{ id: 'window', kind: 'window', offset: 0.5, width: 1.2, bottom: 0.9, height: 1.1 }])
    assert.equal(segments.some((segment) => segment.center[1] < 0.9), true)
    assert.equal(segments.some((segment) => segment.center[1] > 2), true)
  })
})

describe('validateOpenings', () => {
  it('acepta la habitación inicial', () => {
    assert.equal(validateOpenings(DEFAULT_ROOM), null)
  })

  it('rechaza una apertura fuera de la pared', () => {
    const room: RoomConfig = { ...DEFAULT_ROOM, door: { ...DEFAULT_ROOM.door, offset: 10 } }
    assert.match(validateOpenings(room) ?? '', /fuera/)
  })

  it('rechaza aperturas solapadas en la misma pared', () => {
    const room: RoomConfig = {
      ...DEFAULT_ROOM,
      door: { ...DEFAULT_ROOM.door, wall: 'north', offset: 0 },
      windows: [{ ...DEFAULT_ROOM.windows[0], wall: 'north', offset: 0, sill: 0.8 }],
    }
    assert.match(validateOpenings(room) ?? '', /solapan/)
  })
})

describe('clampFurniture', () => {
  const item: FurnitureItem = { id: 'x', kind: 'table', name: 'Mesa', x: 20, z: -20, rotation: 0, width: 1.2, depth: 0.8, height: 0.7, color: '#fff' }

  it('mantiene el objeto dentro del suelo y lo ajusta a 25 cm', () => {
    const result = clampFurniture(item, DEFAULT_ROOM, true)
    assert.ok(result.x < DEFAULT_ROOM.width / 2)
    assert.ok(result.z > -DEFAULT_ROOM.depth / 2)
    assert.equal(Math.abs(result.x % 0.25), 0)
    assert.equal(Math.abs(result.z % 0.25), 0)
  })

  it('intercambia la huella al girar un cuarto de vuelta', () => {
    const normal = clampFurniture({ ...item, x: 20, z: 0 }, DEFAULT_ROOM, false)
    const rotated = clampFurniture({ ...item, x: 20, z: 0, rotation: Math.PI / 2 }, DEFAULT_ROOM, false)
    assert.ok(rotated.x > normal.x)
  })
})
