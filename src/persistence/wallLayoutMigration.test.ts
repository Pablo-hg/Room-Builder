import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ROOM_WALL_THICKNESS } from '../domain/constants'
import { persistedDesign, WALLS_OUTSIDE_VERSION, type PersistedDesign } from '../domain/designV1'
import { createRoomStore } from '../state/useRoomStore'
import { normalizeDesign } from './designMigrations'
import { migrateWallLayout } from './wallLayoutMigration'

const half = ROOM_WALL_THICKNESS / 2
const close = (actual: number, expected: number, message?: string) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} ≠ ${expected}`)

function legacy(edit: (design: PersistedDesign) => void, version: PersistedDesign['version'] = 11): PersistedDesign {
  const design = structuredClone(persistedDesign(createRoomStore().getState()))
  edit(design)
  design.version = version
  return design
}

test('un mueble fijado a la pared de un diseño v11 sigue apoyado en su cara y el diseño carga', () => {
  const chair = { id: 'silla-fija', kind: 'chair' as const, name: 'Silla', color: '#bd8b5f', x: 0, y: 0, z: 0, width: 0.5, depth: 0.5, height: 0.85, rotation: 0 }
  const design = legacy((data) => {
    // Geometría antigua: la cara interior de la pared norte estaba 6 cm dentro del suelo.
    data.furniture = [{ ...chair, z: -data.room.depth / 2 + half + chair.depth / 2, wallAttachment: { wallId: 'room-wall:north', side: 1, lockLateral: false } }]
  })
  const loaded = normalizeDesign(design)
  assert.equal(loaded.version, WALLS_OUTSIDE_VERSION)
  close(loaded.furniture[0].z, -design.room.depth / 2 + chair.depth / 2, 'z del mueble fijado')
  close(loaded.furniture[0].x, 0)
})

test('las puertas y ventanas ancladas (wallPosition) se desplazan medio grosor hacia fuera', () => {
  const design = legacy((data) => {
    data.room.windows = [{ id: 'ventana-anclada', shape: 'rectangular', wall: 'north', offset: 0, width: 1.5, height: 1, sill: 1, rotation: 0,
      wallPosition: { x: 0.4, y: 1, z: -data.room.depth / 2, yaw: 0, supportId: 'room-wall:north', depth: 0.12 } }]
    data.room.door = { ...data.room.door, wallPosition: { x: data.room.width / 2, y: 0, z: 0.3, yaw: -Math.PI / 2, supportId: 'room-wall:east', depth: 0.12 } }
  }, 10)
  const migrated = migrateWallLayout(design)
  const window = migrated.room.windows[0].wallPosition!
  close(window.z, -design.room.depth / 2 - half, 'ventana norte')
  close(window.x, 0.4)
  const door = migrated.room.door.wallPosition!
  close(door.x, design.room.width / 2 + half, 'puerta este')
  close(door.z, 0.3)
})

test('las habitaciones contiguas antiguas se separan un grosor con todo su contenido', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const created = persistedDesign(store.getState())
  const design = structuredClone(created)
  const pack = design.structurePacks![0]
  // Antes de v12 la habitación contigua estaba justo a una anchura de distancia.
  pack.x -= ROOM_WALL_THICKNESS
  const inside = { id: 'mesa-este', kind: 'table' as const, name: 'Mesa', color: '#c69765', x: pack.x, y: 0, z: 0.5, width: 1.25, depth: 0.75, height: 0.74, rotation: 0 }
  const inRoot = { ...inside, id: 'mesa-raiz', x: -1 }
  design.furniture = [inside, inRoot]
  design.version = 8
  const migrated = migrateWallLayout(design)
  close(migrated.structurePacks![0].x, created.structurePacks![0].x, 'habitación contigua')
  close(migrated.furniture.find((item) => item.id === 'mesa-este')!.x, inside.x + ROOM_WALL_THICKNESS, 'mueble dentro')
  close(migrated.furniture.find((item) => item.id === 'mesa-raiz')!.x, -1, 'mueble de la principal')
})

test('una fila de tres habitaciones acumula un grosor por cada frontera', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const design = structuredClone(persistedDesign(store.getState()))
  const width = design.room.width
  const first = design.structurePacks![0]
  first.x = width
  design.structurePacks!.push({ ...structuredClone(first), id: `${first.id}-b`, x: width * 2, surfaces: first.surfaces.map((surface) => ({ ...surface })) })
  design.version = 4
  const migrated = migrateWallLayout(design)
  close(migrated.structurePacks![0].x, width + ROOM_WALL_THICKNESS)
  close(migrated.structurePacks![1].x, width * 2 + ROOM_WALL_THICKNESS * 2)
})

test('las habitaciones separadas no se mueven y la migración no se repite', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const design = structuredClone(persistedDesign(store.getState()))
  design.structurePacks![0].x = 20
  design.version = 11
  const migrated = migrateWallLayout(design)
  close(migrated.structurePacks![0].x, 20)
  assert.equal(migrated.version, WALLS_OUTSIDE_VERSION)
  assert.deepEqual(migrateWallLayout(migrated), migrated)
  assert.deepEqual(normalizeDesign(normalizeDesign(design)), normalizeDesign(design))
})

test('no muta el diseño de entrada', () => {
  const design = legacy(() => undefined, 3)
  const before = structuredClone(design)
  migrateWallLayout(design)
  assert.deepEqual(design, before)
})
