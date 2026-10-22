import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_ROOM, FURNITURE_PRESETS, ROOM_LIMITS } from './constants'
import {
  buildWallSegments,
  canPlaceFurniture,
  clampFurniture,
  findFreeFurniturePosition,
  furnitureHalfExtents,
  furnitureItemsOverlap,
  hiddenWallForCardinalTarget,
  hiddenWallsForOrientation,
  shortestAngleDelta,
  snapFurnitureRotation,
  snapToPlacementGrid,
  validateOpenings,
  visibleWallsForOrientation,
} from './geometry'
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

describe('visibleWallsForOrientation', () => {
  it('devuelve las dos paredes que permanecen visibles', () => {
    assert.deepEqual(visibleWallsForOrientation(1), ['north', 'east'])
  })
})

describe('hiddenWallForCardinalTarget', () => {
  it('oculta únicamente la pared situada entre la cámara y la habitación', () => {
    assert.equal(hiddenWallForCardinalTarget('north'), 'south')
    assert.equal(hiddenWallForCardinalTarget('east'), 'west')
    assert.equal(hiddenWallForCardinalTarget('south'), 'north')
    assert.equal(hiddenWallForCardinalTarget('west'), 'east')
  })
})

describe('shortestAngleDelta', () => {
  it('mantiene el giro en el arco corto alrededor del centro', () => {
    assert.ok(Math.abs(shortestAngleDelta(3 * Math.PI / 4, -3 * Math.PI / 4) - Math.PI / 2) < 1e-8)
    assert.ok(Math.abs(shortestAngleDelta(-3 * Math.PI / 4, 3 * Math.PI / 4) + Math.PI / 2) < 1e-8)
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
  const item: FurnitureItem = { id: 'x', kind: 'table', name: 'Mesa', x: 20, z: -20, rotation: 0, width: 1.25, depth: 0.75, height: 0.7, color: '#fff' }

  it('permite llegar exactamente al borde sin salir del suelo', () => {
    const result = clampFurniture(item, DEFAULT_ROOM, true)
    assert.ok(Math.abs(result.x + item.width / 2 - DEFAULT_ROOM.width / 2) < 1e-8)
    assert.ok(Math.abs(result.z - item.depth / 2 + DEFAULT_ROOM.depth / 2) < 1e-8)
  })

  it('divide cada cuadrado visible en cuatro secciones de 12,5 cm', () => {
    const result = clampFurniture({ ...item, x: 0.63, z: -0.62 }, DEFAULT_ROOM, true)
    assert.equal(result.x, 0.625)
    assert.equal(result.z, -0.625)
    assert.equal(snapToPlacementGrid(0.19), 0.25)
    assert.ok(Math.abs((result.x - item.width / 2) / ROOM_LIMITS.placementStep % 1) < 1e-8)
    assert.ok(Math.abs((result.z - item.depth / 2) / ROOM_LIMITS.placementStep % 1) < 1e-8)
  })

  it('intercambia la huella al girar un cuarto de vuelta', () => {
    const normal = clampFurniture({ ...item, x: 20, z: 0 }, DEFAULT_ROOM, false)
    const rotated = clampFurniture({ ...item, x: 20, z: 0, rotation: Math.PI / 2 }, DEFAULT_ROOM, false)
    assert.ok(rotated.x > normal.x)
  })

  it('calcula la huella exterior durante una rotación libre', () => {
    const extents = furnitureHalfExtents({ ...item, rotation: Math.PI / 4 })
    const expected = (item.width + item.depth) / (2 * Math.sqrt(2))
    assert.ok(Math.abs(extents.halfWidth - expected) < 1e-8)
    assert.ok(Math.abs(extents.halfDepth - expected) < 1e-8)
  })
})

describe('dimensiones del catálogo', () => {
  it('ofrece diez tipos de elemento y alinea sus huellas con los cuadrados de 25 cm', () => {
    assert.equal(Object.keys(FURNITURE_PRESETS).length + 2, 10)
    const dimensions = [
      DEFAULT_ROOM.door.width,
      DEFAULT_ROOM.windows[0].width,
      ...Object.values(FURNITURE_PRESETS).flatMap((item) => [item.width, item.depth]),
    ]
    dimensions.forEach((dimension) => {
      assert.equal(dimension / ROOM_LIMITS.gridSize % 1, 0)
    })
  })
})

describe('snapFurnitureRotation', () => {
  it('ajusta el giro a pasos exactos de 15 grados', () => {
    assert.ok(Math.abs(snapFurnitureRotation(22 * Math.PI / 180) - Math.PI / 12) < 1e-8)
    assert.ok(Math.abs(snapFurnitureRotation(38 * Math.PI / 180) - Math.PI / 4) < 1e-8)
  })
})

describe('furniture collisions', () => {
  const table: FurnitureItem = { id: 'table', kind: 'table', name: 'Mesa', x: 0, z: 0, rotation: 0, width: 1.2, depth: 0.8, height: 0.7, color: '#fff' }

  it('detecta dos huellas que se solapan', () => {
    const chair: FurnitureItem = { ...table, id: 'chair', kind: 'armchair', x: 0.5 }
    assert.equal(furnitureItemsOverlap(table, chair), true)
    assert.equal(canPlaceFurniture(chair, [table]), false)
  })

  it('permite colocar objetos separados', () => {
    const chair: FurnitureItem = { ...table, id: 'chair', kind: 'armchair', x: 1.5 }
    assert.equal(furnitureItemsOverlap(table, chair), false)
    assert.equal(canPlaceFurniture(chair, [table]), true)
  })

  it('permite colocar dos objetos exactamente juntos', () => {
    const adjacent: FurnitureItem = { ...table, id: 'adjacent', x: table.width }
    assert.equal(furnitureItemsOverlap(table, adjacent), false)
    assert.equal(canPlaceFurniture(adjacent, [table]), true)
    assert.equal(furnitureItemsOverlap(table, { ...adjacent, x: table.width - 0.001 }), true)
  })

  it('tiene en cuenta el giro al calcular la huella', () => {
    const cabinet: FurnitureItem = { ...table, id: 'cabinet', kind: 'cabinet', x: 1.25, width: 0.8, depth: 1.8 }
    assert.equal(furnitureItemsOverlap(table, cabinet), false)
    assert.equal(furnitureItemsOverlap(table, { ...cabinet, rotation: Math.PI / 2 }), true)
  })

  it('encuentra el hueco libre más próximo al añadir', () => {
    const position = findFreeFurniturePosition({ ...table, id: 'next' }, DEFAULT_ROOM, [table])
    assert.ok(position)
    assert.equal(canPlaceFurniture({ ...table, id: 'next', ...position }, [table]), true)
  })
})
