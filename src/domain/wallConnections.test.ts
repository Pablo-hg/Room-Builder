import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cloneRoom } from '../state/defaults'
import { createStructureSurface } from './structureRules'
import { aperturePolygon, anchorWallOpenings, connectedOpeningError, openingHasSupport, openingRunBounds, openingTranslationSupported, physicalWalls, wallDerivedOpenings, wallIntersectionIsCut, wallsConnected, worldOpenings, type WallWorld } from './wallConnections'
import { polygonArea, uncoveredPolygons, wallRectangle } from './connectedWallGeometry'
import type { StructurePack, WindowConfig } from './types'

export function connectedFixture(shape: WindowConfig['shape'] = 'rectangular'): WallWorld {
  const room = { ...cloneRoom(), windows: [] }
  const wall = (id: string, width: number): StructurePack => ({ id, name: id, x: 0, y: 0, z: 0,
    surfaces: [{ ...createStructureSurface(room, 'wall-north'), width, height: 3,
      y: (3 - room.height) / 2, z: -10 + room.depth / 2 }] })
  const short = wall('wall-object-short', 3), long = wall('wall-object-long', 8)
  short.windows = [{ id: 'connected-window', shape, wall: 'north', offset: 0, width: 1, height: 1, sill: 1, rotation: 0, color: '#abcdef' }]
  return anchorWallOpenings({ room, structurePacks: [short, long] })
}

const windowOpening = (world: WallWorld) => worldOpenings(world).find((opening) => opening.id === 'connected-window')!
function positioned(world: WallWorld, x: number, y = 1): WallWorld {
  const copy = structuredClone(world)
  const window = copy.structurePacks[0].windows![0]
  window.offset = x
  window.wallPosition = { ...window.wallPosition!, x, y }
  return copy
}

test('3 m + 8 m: un objeto y dos recortes, con recorrido por la pared larga', () => {
  const world = connectedFixture()
  assert.equal(worldOpenings(world).filter((opening) => opening.id === 'connected-window').length, 1)
  assert.equal(openingHasSupport(world, windowOpening(world)), true)
  assert.deepEqual(openingRunBounds(world, 'connected-window'), { min: -3.25, max: 3.25 })
  const walls = physicalWalls(world).filter((wall) => wall.packId)
  assert.deepEqual(walls.map((wall) => wallDerivedOpenings(world, wall).map((opening) => opening.id)), [['connected-window'], ['connected-window']])
  const exclusive = positioned(world, 3)
  assert.equal(connectedOpeningError(exclusive, new Set(['connected-window'])), null)
  assert.equal(openingHasSupport(positioned(world, 3.26), windowOpening(positioned(world, 3.26))), false)
})

test('recorte parcial en el extremo de la pared pequeña, sin bordes residuales', () => {
  const world = positioned(connectedFixture(), 1.5)
  const small = physicalWalls(world).find((wall) => wall.packId === 'wall-object-short')!
  const cut = wallDerivedOpenings(world, small)[0]
  const polygon = aperturePolygon(cut).map(([x, y]) => [x + cut.offset, y + cut.bottom] as [number, number])
  const solid = uncoveredPolygons(wallRectangle(-1.5, 1.5, 0, 3), [polygon])
  assert.ok(Math.abs(solid.reduce((sum, part) => sum + polygonArea(part), 0) - 8.5) < 1e-8)
  const exclusive = positioned(world, 3)
  assert.equal(wallDerivedOpenings(exclusive, physicalWalls(exclusive).find((wall) => wall.id === small.id)!).length, 0)
})

test('dos y tres tramos desplazados: unión mayor que cualquier pared individual', () => {
  const world = connectedFixture()
  world.structurePacks[1].x = 4
  const third = structuredClone(world.structurePacks[1]); third.id = 'wall-object-third'; third.x = 10; third.surfaces[0].width = 6
  world.structurePacks.push(third)
  assert.equal(openingHasSupport(world, windowOpening(world)), true)
  assert.equal(openingRunBounds(world, 'connected-window')!.max, 12.25)
  const far = positioned(world, 12)
  assert.equal(connectedOpeningError(far, new Set(['connected-window'])), null)
})

for (const height of [0.5, 1.5, 2.5]) test(`intersección vertical real, base de la pared larga ${height} m`, () => {
  const world = connectedFixture()
  world.structurePacks[1].y = height
  const exclusive = positioned(world, 3)
  assert.equal(openingHasSupport(exclusive, windowOpening(exclusive)), height <= 1)
  const raised = positioned(world, 3, height)
  assert.equal(openingHasSupport(raised, windowOpening(raised)), true)
  const long = physicalWalls(raised).find((wall) => wall.packId === 'wall-object-long')!
  assert.equal(wallDerivedOpenings(raised, long)[0].bottom, 0)
})

test('ventana circular girada: recortes derivados y comprobación de soporte', () => {
  const world = connectedFixture('circular')
  world.structurePacks[0].windows![0].rotation = Math.PI / 5
  const moved = positioned(world, 1.5)
  assert.equal(openingHasSupport(moved, windowOpening(moved)), true)
  assert.equal(aperturePolygon(windowOpening(moved)).length, 48)
  assert.equal(physicalWalls(moved).filter((wall) => wall.packId).every((wall) => wallDerivedOpenings(moved, wall).length === 1), true)
})

test('cuadros y espejos no perforan paredes, aunque compartan recorrido', () => {
  for (const shape of ['pictureMedium', 'mirrorCircular', 'wallShelf'] as const) {
    const world = connectedFixture(shape)
    assert.equal(physicalWalls(world).every((wall) => wallDerivedOpenings(world, wall).every((opening) => opening.id !== 'connected-window')), true)
  }
})

test('paredes cercanas con hueco físico, perpendiculares y en T no comparten recorrido', () => {
  for (const kind of ['gap', 'perpendicular', 'T'] as const) {
    const world = connectedFixture()
    if (kind === 'gap') world.structurePacks[1].z = 0.14
    else { world.structurePacks[1].surfaces[0].rotation = Math.PI / 2; if (kind === 'T') world.structurePacks[1].x = 1.5 }
    const [a, b] = physicalWalls(world).filter((wall) => wall.packId)
    assert.equal(wallsConnected(a, b), false)
    assert.equal(openingHasSupport(positioned(world, 3), windowOpening(positioned(world, 3))), false)
  }
})

test('dos caras en contacto por el grosor sí derivan el hueco', () => {
  const world = connectedFixture()
  world.structurePacks[1].z = world.structurePacks[0].surfaces[0].depth
  const [a, b] = physicalWalls(world).filter((wall) => wall.packId)
  assert.equal(wallsConnected(a, b), true)
  assert.equal(wallDerivedOpenings(world, b).length, 1)
})

test('continuidad vertical por una cara, sin unir paredes que solo tocan una esquina', () => {
  const world = connectedFixture()
  world.structurePacks[1].y = 3
  const [a, b] = physicalWalls(world).filter((wall) => wall.packId)
  assert.equal(wallsConnected(a, b), true)
  assert.equal(openingHasSupport(positioned(world, 0, 2.5), windowOpening(positioned(world, 0, 2.5))), true)
  assert.equal(wallsConnected(a, { ...a, x: 3, y: 3 }), false)
})

test('pared de raíz más pared independiente: mismo objeto, dos huecos y tramo exclusivo', () => {
  const original = connectedFixture()
  const window = { ...original.structurePacks[0].windows![0] }
  delete window.wallPosition
  const world = anchorWallOpenings({ room: { ...original.room, width: 3, windows: [window] },
    structurePacks: [{ ...original.structurePacks[1], surfaces: [{ ...original.structurePacks[1].surfaces[0], z: 0 }] }] })
  const origin = worldOpenings(world).find((opening) => opening.id === window.id)!
  assert.equal(openingHasSupport(world, origin), true)
  assert.equal(wallDerivedOpenings(world, physicalWalls(world).find((wall) => wall.id === 'room-wall:north')!).length, 1)
  assert.equal(wallDerivedOpenings(world, physicalWalls(world).find((wall) => wall.packId)!).length, 1)
  const moved = structuredClone(world)
  moved.room.windows[0].wallPosition!.x = 3
  moved.room.windows[0].offset = 3
  assert.equal(openingHasSupport(moved, worldOpenings(moved).find((opening) => opening.id === window.id)!), true)
})

test('una cadena en profundidad no propaga huecos a otro plano de pared', () => {
  const world = connectedFixture()
  const depth = world.structurePacks[0].surfaces[0].depth
  world.structurePacks[1].z = depth
  const third = structuredClone(world.structurePacks[1]); third.id = 'wall-object-third'; third.z = depth * 2
  world.structurePacks.push(third)
  const wall = physicalWalls(world).find((wall) => wall.packId === third.id)!
  assert.equal(wallDerivedOpenings(world, wall).length, 0)
})

test('un paso grande no puede saltar un hueco sin soporte a esa altura', () => {
  const world = connectedFixture()
  world.structurePacks[0].surfaces[0].width = 2
  world.structurePacks[1].x = 4; world.structurePacks[1].surfaces[0].width = 2
  const bridge = structuredClone(world.structurePacks[1]); bridge.id = 'wall-object-high'; bridge.x = 2; bridge.y = 2.5; bridge.surfaces[0].width = 3
  world.structurePacks.push(bridge)
  const target = positioned(world, 4)
  assert.equal(openingHasSupport(target, windowOpening(target)), true)
  assert.equal(openingTranslationSupported(target, windowOpening(world), windowOpening(target)), false)
})

test('girar todo el conjunto conserva conectividad y posición de los recortes', () => {
  const world = connectedFixture()
  for (const pack of world.structurePacks) pack.surfaces[0].rotation = Math.PI / 4
  world.structurePacks[0].windows![0].wallPosition!.yaw = Math.PI / 4
  assert.equal(openingHasSupport(world, windowOpening(world)), true)
  assert.equal(physicalWalls(world).filter((wall) => wall.packId).every((wall) => wallDerivedOpenings(world, wall).length === 1), true)
})

test('mueble contenido en el hueco real no colisiona con su pared independiente', () => {
  const world = connectedFixture()
  const wall = physicalWalls(world).find((wall) => wall.packId === 'wall-object-long')!
  assert.equal(wallIntersectionIsCut(world, wall.id, { x: 0, y: 1.5, z: -10, width: 0.5, height: 0.5, depth: 0.2, rotation: 0 }), true)
  assert.equal(wallIntersectionIsCut(world, wall.id, { x: 0.5, y: 1.5, z: -10, width: 0.5, height: 0.5, depth: 0.2, rotation: 0 }), false)
})

test('puerta con suelo elevado conserva Y y no atraviesa vacío por debajo del soporte', () => {
  const world = connectedFixture()
  world.structurePacks[0].windows = []
  world.structurePacks[0].doors = [{ id: 'connected-door', wall: 'north', offset: 0, width: 1, height: 2.1, rotation: 0 }]
  world.structurePacks[1].y = 0.4
  const anchored = anchorWallOpenings(world)
  const door = anchored.structurePacks[0].doors![0]
  door.offset = 3; door.wallPosition!.x = 3
  assert.match(connectedOpeningError(anchored, new Set([door.id]))!, /soporte/)
  assert.equal(door.wallPosition!.y, 0)
})
