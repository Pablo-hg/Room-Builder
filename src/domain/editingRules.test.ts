import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { applyFurnitureRotation, arrangeFurniture, clampRoomDimension, elevatedFurniture, movedFurniture, roomForDoorUpdate, roomForWindowUpdate, safeRoomUpdate } from './editingRules'
import { hasFurnitureCollisions } from './geometry'
import { FURNITURE_PRESETS } from './objectCatalog'
import { createStructureSurface } from './structureRules'
import type { FurnitureItem } from './types'

const table: FurnitureItem = { ...FURNITURE_PRESETS.table, id: 'old-table', x: 0, y: 0, z: 0, rotation: 0 }

test('las reglas de edición no mutan el mundo y conservan los IDs y elementos no afectados', () => {
  const other = { ...table, id: 'other', x: 2 }
  const state = { room: structuredClone(DEFAULT_ROOM), furniture: [table, other], gridSnap: true }
  const before = structuredClone(state)
  const moved = movedFurniture(state, table, -0.19, -0.19)
  assert.equal(moved?.x, -0.25)
  assert.equal(moved?.z, -0.25)
  assert.equal(moved?.id, table.id)
  assert.equal(elevatedFurniture(state, table, 0), null)
  assert.equal(elevatedFurniture(state, table, 0.63)?.y, 0.625)
  const rotated = applyFurnitureRotation(state, table, -Math.PI / 2, false)
  assert.equal(rotated.furniture?.[1], other)
  assert.equal(rotated.furniture?.[0].rotation, Math.PI * 1.5)
  assert.equal(safeRoomUpdate(state, { ...state.room, height: 3 }).room?.height, 3)
  roomForDoorUpdate(state.room, { offset: 0.38 })
  roomForWindowUpdate(state.room, state.room.windows[0], { sill: 50, offset: 0.38 })
  assert.deepEqual(state, before)
})

test('la validación de aperturas precede a los ajustes y colisiones de muebles', () => {
  const state = { room: structuredClone(DEFAULT_ROOM), furniture: [table, { ...table, id: 'collision' }], gridSnap: true }
  const invalidRoom = { ...state.room, door: { ...state.room.door, offset: 100 } }
  const update = safeRoomUpdate(state, invalidRoom)
  assert.equal(update.room, undefined)
  assert.equal(update.furniture, undefined)
  assert.ok(update.notice)
  assert.notEqual(update.notice, 'No se puede reducir la habitación porque los muebles quedarían solapados.')
  assert.deepEqual(applyFurnitureRotation(state, table, Math.PI / 2, false), {})
  assert.equal(movedFurniture(state, table, 0, 0), null)
})

test('recoloca muebles en orden conservando dimensiones del catálogo y sin mutar los originales', () => {
  const furniture = [
    { ...table, width: 9, depth: 9, height: 9, y: Number.NaN },
    { ...table, id: 'second' },
    { ...FURNITURE_PRESETS.ceilingLamp, id: 'ceiling', x: 1, y: 0, z: 1, rotation: 0 },
  ]
  const before = structuredClone(furniture)
  const arranged = arrangeFurniture(furniture, DEFAULT_ROOM, true)
  assert.ok(arranged)
  assert.equal(arranged[0].width, table.width)
  assert.equal(arranged[0].y, 0)
  assert.equal(arranged[1].id, 'second')
  assert.notDeepEqual([arranged[1].x, arranged[1].z], [0, 0])
  assert.equal(arranged[2].y, 0)
  assert.equal(hasFurnitureCollisions(arranged), false)
  assert.equal(arrangeFurniture([{ ...table, kind: 'removed-kind' } as unknown as FurnitureItem], DEFAULT_ROOM, true), null)
  const tooSmall = { ...DEFAULT_ROOM, width: table.width, depth: table.depth }
  assert.equal(arrangeFurniture([table, { ...table, id: 'second' }], tooSmall, true), null)
  assert.deepEqual(furniture, before)
})

test('conserva límites dimensionales y geometría por defecto de las seis superficies', () => {
  for (const dimension of ['width', 'depth', 'height'] as const) {
    assert.equal(clampRoomDimension(dimension, 100), 10)
    assert.equal(clampRoomDimension(dimension, 0), dimension === 'height' ? 2.5 : 3)
  }
  for (const side of ['north', 'east', 'south', 'west'] as const) {
    const wall = createStructureSurface(DEFAULT_ROOM, `wall-${side}`)
    assert.equal(wall.wall, side)
    assert.equal(wall.width, side === 'east' || side === 'west' ? DEFAULT_ROOM.depth : DEFAULT_ROOM.width)
    assert.equal(wall.rotation, 0)
  }
  assert.equal(createStructureSurface(DEFAULT_ROOM, 'floor').kind, 'floor')
  assert.equal(createStructureSurface(DEFAULT_ROOM, 'ceiling').kind, 'ceiling')
})
