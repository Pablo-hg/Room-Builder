import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_ROOM, ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from './constants'
import { FURNITURE_PRESETS, OBJECT_CATALOG, OPENING_CATALOG } from './objectCatalog'
import {
  buildWallSegments,
  canPlaceFurniture,
  clampFurniture,
  clampFurnitureElevation,
  findFreeFurniturePosition,
  furnitureHalfExtents,
  furnitureItemsOverlap,
  hasFurnitureCollisions,
  frontWallForOrientation,
  hiddenWallForCardinalTarget,
  hiddenWallsForOrientation,
  orientationForAzimuth,
  orientationForFrontWall,
  sideWallsForFrontView,
  shortestAngleDelta,
  snapFurnitureRotation,
  snapToPlacementGrid,
  snapToVisibleGrid,
  topViewWallForOrientation,
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

describe('camera walls for orientation', () => {
  it('aligns the top view with the visible corner for every orientation', () => {
    assert.deepEqual(
      [0, 1, 2, 3].map(topViewWallForOrientation),
      ['north', 'east', 'south', 'west'],
    )
  })

  it('selects the left wall for the front view and reverses that mapping', () => {
    assert.deepEqual(
      [0, 1, 2, 3].map(frontWallForOrientation),
      ['west', 'north', 'east', 'south'],
    )
    for (const wall of ['north', 'east', 'south', 'west'] as const) {
      assert.equal(frontWallForOrientation(orientationForFrontWall(wall)), wall)
    }
  })

  it('identifies the side walls from each front-facing direction', () => {
    assert.deepEqual(sideWallsForFrontView('north'), { left: 'west', right: 'east' })
    assert.deepEqual(sideWallsForFrontView('east'), { left: 'north', right: 'south' })
    assert.deepEqual(sideWallsForFrontView('south'), { left: 'east', right: 'west' })
    assert.deepEqual(sideWallsForFrontView('west'), { left: 'south', right: 'north' })
  })
})

describe('orientationForAzimuth', () => {
  it('elige las paredes próximas a la cámara para cada cuadrante', () => {
    assert.equal(orientationForAzimuth(Math.PI / 4), 0)
    assert.equal(orientationForAzimuth(3 * Math.PI / 4), 1)
    assert.equal(orientationForAzimuth(5 * Math.PI / 4), 2)
    assert.equal(orientationForAzimuth(7 * Math.PI / 4), 3)
    assert.equal(orientationForAzimuth(-Math.PI / 4), 3)
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
    const segments = buildWallSegments(5, 2.7, [{ id: 'door', kind: 'door', offset: 0, width: 0.9, bottom: 0, height: 2.1, rotation: 0, color: '#ac704b' }])
    const area = segments.reduce((total, segment) => total + segment.size[0] * segment.size[1], 0)
    assert.ok(Math.abs(area - (5 * 2.7 - 0.9 * 2.1)) < 1e-6)
  })

  it('crea geometría alrededor de una ventana elevada', () => {
    const segments = buildWallSegments(5, 2.7, [{ id: 'window', kind: 'window', offset: 0.5, width: 1.2, bottom: 0.9, height: 1.1, rotation: 0, color: '#c88f58' }])
    assert.equal(segments.some((segment) => segment.center[1] < 0.9), true)
    assert.equal(segments.some((segment) => segment.center[1] > 2), true)
  })

  it('no abre huecos para estanterías de pared, cuadros ni espejos', () => {
    for (const shape of ['wallShelf', 'pictureSmall', 'pictureMedium', 'pictureLarge', 'mirrorRectangular', 'mirrorCircular', 'wallSconce'] as const) {
      const segments = buildWallSegments(5, 2.7, [{
        id: shape,
        kind: 'window',
        shape,
        offset: 0,
        width: 1,
        bottom: 1,
        height: 0.75,
        rotation: 0,
        color: '#8c6448',
      }])
      const area = segments.reduce((total, segment) => total + segment.size[0] * segment.size[1], 0)
      assert.ok(Math.abs(area - 5 * 2.7) < 1e-6)
    }
  })
})

describe('validateOpenings', () => {
  for (const wall of WALL_SIDES) {
    it(`muestra la letra ${WALL_LABELS[wall]} al validar límites y conserva el ID ${wall}`, () => {
      const room: RoomConfig = { ...DEFAULT_ROOM, windows: [], door: { ...DEFAULT_ROOM.door, wall, offset: 20 } }
      assert.equal(validateOpenings(room), `La puerta queda fuera de la pared ${WALL_LABELS[wall]}.`)
      const overlapping: RoomConfig = { ...room, door: { ...room.door, offset: 0 }, windows: [{ ...DEFAULT_ROOM.windows[0], wall, offset: 0 }] }
      assert.equal(validateOpenings(overlapping), null)
      assert.equal(room.door.wall, wall)
    })
  }

  it('acepta la habitación inicial', () => {
    assert.equal(validateOpenings(DEFAULT_ROOM), null)
  })

  it('rechaza una apertura fuera de la pared', () => {
    const room: RoomConfig = { ...DEFAULT_ROOM, door: { ...DEFAULT_ROOM.door, offset: 10 } }
    assert.match(validateOpenings(room) ?? '', /fuera/)
  })

  it('permite aperturas superpuestas en la misma pared', () => {
    const room: RoomConfig = {
      ...DEFAULT_ROOM,
      door: { ...DEFAULT_ROOM.door, wall: 'north', offset: 0 },
      windows: [{ ...DEFAULT_ROOM.windows[0], wall: 'north', offset: 0, sill: 0.8 }],
    }
    assert.equal(validateOpenings(room), null)
  })

  it('permite desplazar una ventana en vertical sin salir de la pared', () => {
    const validRoom: RoomConfig = {
      ...DEFAULT_ROOM,
      windows: [{ ...DEFAULT_ROOM.windows[0], sill: 1.5 }],
    }
    assert.equal(validateOpenings(validRoom), null)

    const invalidRoom: RoomConfig = {
      ...DEFAULT_ROOM,
      windows: [{ ...DEFAULT_ROOM.windows[0], sill: 1.75 }],
    }
    assert.match(validateOpenings(invalidRoom) ?? '', /altura/)
  })
})

describe('clampFurniture', () => {
  const item: FurnitureItem = { id: 'x', kind: 'table', name: 'Mesa', x: 20, y: 0, z: -20, rotation: 0, width: 1.25, depth: 0.75, height: 0.7, color: '#fff' }

  it('permite llegar exactamente al borde sin salir del suelo', () => {
    const result = clampFurniture(item, DEFAULT_ROOM, true)
    assert.ok(Math.abs(result.x + item.width / 2 - DEFAULT_ROOM.width / 2) < 1e-8)
    assert.ok(Math.abs(result.z - item.depth / 2 + DEFAULT_ROOM.depth / 2) < 1e-8)
  })

  it('ajusta el movimiento a 5 cm manteniendo la cuadrícula visible de 25 cm', () => {
    const result = clampFurniture({ ...item, x: 0.63, z: -0.62 }, DEFAULT_ROOM, true)
    assert.ok(Math.abs(result.x - 0.65) < 1e-8)
    assert.ok(Math.abs(result.z + 0.6) < 1e-8)
    assert.equal(snapToPlacementGrid(0.19), 0.2)
    assert.equal(snapToPlacementGrid(0.91), 0.9)
    assert.equal(snapToVisibleGrid(0.91), 1)
    assert.ok(Math.abs(result.x / ROOM_LIMITS.placementStep - 13) < 1e-8)
    assert.ok(Math.abs(result.z / ROOM_LIMITS.placementStep + 12) < 1e-8)
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

  it('limita la elevación al espacio vertical disponible y la ajusta a la cuadrícula', () => {
    assert.equal(clampFurnitureElevation({ ...item, y: 0.63 }, DEFAULT_ROOM, true), 0.65)
    assert.equal(clampFurnitureElevation({ ...item, y: 20 }, DEFAULT_ROOM, false), DEFAULT_ROOM.height - item.height)
    assert.equal(clampFurnitureElevation({ ...item, y: -1 }, DEFAULT_ROOM, false), 0)
    assert.equal(clampFurnitureElevation({ ...item, kind: 'rug', attachmentPolicy: 'by-type', y: 1 }, DEFAULT_ROOM, false), 0)
    assert.equal(clampFurnitureElevation({ ...item, kind: 'circularRug', attachmentPolicy: 'by-type', y: 1 }, DEFAULT_ROOM, false), 0)
    assert.equal(clampFurnitureElevation({ ...item, kind: 'rug', y: 1 }, DEFAULT_ROOM, false), 1)
  })
})

describe('dimensiones del catálogo', () => {
  it('registra treinta y seis definiciones y alinea sus huellas con los cuadrados de 25 cm', () => {
    assert.equal(Object.keys(OBJECT_CATALOG.furniture).length + Object.keys(OBJECT_CATALOG.openings).length, 36)
    const dimensions = [
      DEFAULT_ROOM.door.width,
      DEFAULT_ROOM.windows[0].width,
      DEFAULT_ROOM.windows[0].height,
      DEFAULT_ROOM.windows[0].sill,
      OPENING_CATALOG.circularWindow.width,
      OPENING_CATALOG.circularWindow.height,
      OPENING_CATALOG.circularWindow.defaultBottom,
      OPENING_CATALOG.wallShelf.width,
      OPENING_CATALOG.wallShelf.height,
      OPENING_CATALOG.wallShelf.defaultBottom,
      OPENING_CATALOG.pictureSmall.width,
      OPENING_CATALOG.pictureSmall.height,
      OPENING_CATALOG.pictureSmall.defaultBottom,
      OPENING_CATALOG.pictureMedium.width,
      OPENING_CATALOG.pictureMedium.height,
      OPENING_CATALOG.pictureMedium.defaultBottom,
      OPENING_CATALOG.pictureLarge.width,
      OPENING_CATALOG.pictureLarge.height,
      OPENING_CATALOG.pictureLarge.defaultBottom,
      OPENING_CATALOG.mirrorRectangular.width,
      OPENING_CATALOG.mirrorRectangular.height,
      OPENING_CATALOG.mirrorRectangular.defaultBottom,
      OPENING_CATALOG.mirrorCircular.width,
      OPENING_CATALOG.mirrorCircular.height,
      OPENING_CATALOG.mirrorCircular.defaultBottom,
      OPENING_CATALOG.wallSconce.width,
      OPENING_CATALOG.wallSconce.height,
      OPENING_CATALOG.wallSconce.defaultBottom,
      ...Object.values(FURNITURE_PRESETS).flatMap((item) => [item.width, item.depth]),
    ]
    dimensions.forEach((dimension) => {
      assert.equal(dimension / ROOM_LIMITS.gridSize % 1, 0)
    })
  })

  it('declara en un único catálogo qué transformaciones admite cada apertura', () => {
    assert.deepEqual(OPENING_CATALOG.door.capabilities.translation, ['wall-horizontal'])
    assert.equal(OPENING_CATALOG.door.capabilities.rotation.enabled, false)
    assert.deepEqual(OPENING_CATALOG.window.capabilities.translation, ['wall-horizontal', 'wall-vertical'])
    assert.equal(OPENING_CATALOG.window.capabilities.rotation.axis, 'wall-normal')
    assert.deepEqual(OPENING_CATALOG.circularWindow.capabilities.resize?.diameter, ['width', 'height'])
    assert.deepEqual(OPENING_CATALOG.wallShelf.capabilities, OPENING_CATALOG.window.capabilities)
    assert.deepEqual(OPENING_CATALOG.pictureSmall.capabilities, OPENING_CATALOG.window.capabilities)
    assert.deepEqual(OPENING_CATALOG.pictureMedium.capabilities, OPENING_CATALOG.window.capabilities)
    assert.deepEqual(OPENING_CATALOG.pictureLarge.capabilities, OPENING_CATALOG.window.capabilities)
    assert.deepEqual(OPENING_CATALOG.mirrorRectangular.capabilities, OPENING_CATALOG.window.capabilities)
    assert.deepEqual(OPENING_CATALOG.mirrorCircular.capabilities.resize?.diameter, ['width', 'height'])
    assert.deepEqual(OPENING_CATALOG.wallSconce.capabilities, OPENING_CATALOG.window.capabilities)
  })
})

describe('snapFurnitureRotation', () => {
  it('ajusta el giro a pasos exactos de 15 grados', () => {
    assert.ok(Math.abs(snapFurnitureRotation(22 * Math.PI / 180) - Math.PI / 12) < 1e-8)
    assert.ok(Math.abs(snapFurnitureRotation(38 * Math.PI / 180) - Math.PI / 4) < 1e-8)
  })
})

describe('furniture collisions', () => {
  const table: FurnitureItem = { id: 'table', kind: 'table', name: 'Mesa', x: 0, y: 0, z: 0, rotation: 0, width: 1.2, depth: 0.8, height: 0.7, color: '#fff' }

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

  it('permite apilar muebles cuando sus volúmenes no se solapan', () => {
    const chair: FurnitureItem = { ...table, id: 'chair', kind: 'chair', width: 0.5, depth: 0.5, height: 0.85, y: table.height }
    assert.equal(furnitureItemsOverlap(table, chair), false)
    assert.equal(canPlaceFurniture(chair, [table]), true)
    assert.equal(hasFurnitureCollisions([table, chair]), false)
  })

  it('bloquea los muebles cuyos volúmenes todavía se cruzan en vertical', () => {
    const chair: FurnitureItem = { ...table, id: 'chair', kind: 'chair', width: 0.5, depth: 0.5, height: 0.85, y: table.height - 0.01 }
    assert.equal(furnitureItemsOverlap(table, chair), true)
    assert.equal(canPlaceFurniture(chair, [table]), false)
  })

  it('encuentra el hueco libre más próximo al añadir', () => {
    const position = findFreeFurniturePosition({ ...table, id: 'next' }, DEFAULT_ROOM, [table])
    assert.ok(position)
    assert.equal(canPlaceFurniture({ ...table, id: 'next', ...position }, [table]), true)
  })
})
