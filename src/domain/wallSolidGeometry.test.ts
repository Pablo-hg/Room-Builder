import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { cloneRoom } from '../state/defaults'
import { createStructureSurface } from './structureRules'
import { anchorWallOpenings, physicalWalls, type WallWorld } from './wallConnections'
import { wallUnionFaces, type WallFace } from './wallSolidGeometry'
import type { StructurePack } from './types'

function fixture(hole = false): WallWorld {
  const room = cloneRoom()
  const make = (id: string, width: number): StructurePack => ({ id, name: id, x: 0, y: 0, z: 0,
    surfaces: [{ ...createStructureSurface(room, 'wall-north'), width, height: 3, depth: 0.2, y: (3 - room.height) / 2, z: -10 + room.depth / 2 }] })
  const small = make('wall-object-short', 3), large = make('wall-object-long', 8)
  if (hole) small.windows = [{ id: 'one-window', shape: 'rectangular', wall: 'north', offset: 0, width: 1, height: 1, sill: 1, rotation: 0 }]
  return anchorWallOpenings({ room, structurePacks: [small, large] })
}
const skins = (world: WallWorld, ids = physicalWalls(world).filter((wall) => wall.packId).map((wall) => wall.id)) =>
  [...wallUnionFaces(world, new Set(ids)).values()].flat()
function surfaceArea(faces: WallFace[]): number {
  let area = 0
  for (const face of faces) for (let i = 1; i + 1 < face.points.length; i++) {
    const a = new THREE.Vector3(...face.points[i]).sub(new THREE.Vector3(...face.points[0]))
    const b = new THREE.Vector3(...face.points[i + 1]).sub(new THREE.Vector3(...face.points[0]))
    area += a.cross(b).length() / 2
  }
  return area
}
function rayHits(faces: WallFace[], x: number, y: number): number {
  const ray = new THREE.Ray(new THREE.Vector3(x, y, -20), new THREE.Vector3(0, 0, 1))
  let hits = 0
  for (const face of faces) for (let i = 1; i + 1 < face.points.length; i++) {
    if (ray.intersectTriangle(new THREE.Vector3(...face.points[0]), new THREE.Vector3(...face.points[i]), new THREE.Vector3(...face.points[i + 1]), false, new THREE.Vector3())) hits++
  }
  return hits
}

test('3 m sobre 8 m: superficie exterior única, sin caras interiores o coplanarias duplicadas', () => {
  const world = fixture()
  assert.ok(Math.abs(surfaceArea(skins(world)) - 52.4) < 1e-6)
  assert.equal(world.structurePacks.length, 2)
  assert.equal(world.structurePacks[0].surfaces[0].width, 3)
  assert.equal(world.structurePacks[1].surfaces[0].width, 8)
})

test('hueco compartido: área, jambas y rayos atraviesan ambas paredes', () => {
  const faces = skins(fixture(true))
  assert.ok(Math.abs(surfaceArea(faces) - 51.2) < 1e-6)
  assert.equal(rayHits(faces, 0, 1.5), 0)
  assert.ok(rayHits(faces, 1, 1.5) >= 2)
  for (const face of faces) {
    assert.ok(Math.abs(Math.hypot(...face.normal) - 1) < 1e-8)
    assert.equal(face.points.flat().every(Number.isFinite), true)
  }
})

for (const x of [1.5, 3]) test(`hueco parcial/exclusivo en X=${x}: no queda la pared original tapándolo`, () => {
  const world = fixture(true)
  world.structurePacks[0].windows![0].wallPosition!.x = x
  world.structurePacks[0].windows![0].offset = x
  const faces = skins(world)
  assert.equal(rayHits(faces, x - 0.2, 1.5), 0)
  assert.equal(rayHits(faces, x + 0.2, 1.5), 0)
})

test('ventana circular compartida respeta la circunferencia, no recorta una caja', () => {
  const world = fixture(true)
  world.structurePacks[0].windows![0].shape = 'circular'
  const faces = skins(world)
  assert.equal(rayHits(faces, 0.3, 1.8), 0)
  assert.ok(rayHits(faces, 0.45, 1.95) >= 2)
})

test('ocultar/eliminar un soporte recupera la piel del soporte restante', () => {
  const world = fixture()
  const small = physicalWalls(world).find((wall) => wall.packId === 'wall-object-short')!
  assert.ok(Math.abs(surfaceArea(skins(world, [small.id])) - 20.4) < 1e-6)
  const remaining = { ...world, structurePacks: world.structurePacks.slice(1) }
  assert.ok(Math.abs(surfaceArea(skins(remaining)) - 52.4) < 1e-6)
  assert.ok(Math.abs(surfaceArea(skins(world)) - 52.4) < 1e-6)
})

test('alturas diferentes recortan solo el volumen realmente compartido', () => {
  const world = fixture()
  world.structurePacks[1].y = 1.2
  assert.ok(Math.abs(surfaceArea(skins(world)) - 60.08) < 1e-6)
})

test('caras en contacto por el grosor: unión sólida y hueco por las dos capas', () => {
  const world = fixture(true)
  world.structurePacks[1].z = 0.2
  const faces = skins(world)
  assert.ok(Math.abs(surfaceArea(faces) - 54.4) < 1e-6)
  assert.equal(rayHits(faces, 0, 1.5), 0)
})

test('dos paredes iguales de caras opuestas conservan una sola piel en ambos lados', () => {
  const world = fixture()
  world.structurePacks[1].surfaces[0].width = 3
  world.structurePacks[1].surfaces[0].rotation = Math.PI
  assert.ok(Math.abs(surfaceArea(skins(world)) - 20.4) < 1e-6)
})

test('dos ventanas superpuestas abren un solo volumen de hueco sin duplicar caras', () => {
  const world = fixture(true)
  const window = world.structurePacks[0].windows![0]
  world.structurePacks[1].windows = [{ ...window, id: 'another-window', wallPosition: { ...window.wallPosition! } }]
  const faces = skins(world)
  assert.equal(rayHits(faces, 0, 1.5), 0)
  assert.ok(rayHits(faces, 1, 1.5) >= 2)
  assert.ok(Math.abs(surfaceArea(faces) - 51.2) < 1e-6)
  assert.ok(faces.every((face) => face.points.flat().every(Number.isFinite)))
})
