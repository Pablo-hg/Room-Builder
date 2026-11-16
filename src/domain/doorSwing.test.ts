import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_DOOR_SWING, designHasDoorSwing, doorSwingGeometry, doorSwingOf, validateDesignDoorSwings, validateDoorSwing } from './doorSwing'
import { DOOR_SWING_VERSION, persistedDesign, WALLS_OUTSIDE_VERSION, type SavedDesign } from './designV1'
import { parseDesignFile, serializeDesignFile } from '../persistence/designFile'
import { normalizeDesign } from '../persistence/designMigrations'
import { createRoomStore } from '../state/useRoomStore'

const close = (a: number, b: number, message = '') => assert.ok(Math.abs(a - b) < 1e-9, `${message} ${a} != ${b}`)
const pt = (p: { x: number; z: number }) => [Math.round(p.x * 1e6) / 1e6, Math.round(p.z * 1e6) / 1e6]
const asFile = (store: ReturnType<typeof createRoomStore>): SavedDesign => ({ id: 'd', name: 'Puertas', savedAt: '2026-11-16T10:00:00.000Z', data: persistedDesign(store.getState()) })

test('la geometría del giro cubre las cuatro combinaciones de bisagra y lado', () => {
  const cases = [
    ['left', 'inside', [-0.5, 0], [0.5, 0], [-0.5, 1]],
    ['right', 'inside', [0.5, 0], [-0.5, 0], [0.5, 1]],
    ['left', 'outside', [-0.5, 0], [0.5, 0], [-0.5, -1]],
    ['right', 'outside', [0.5, 0], [-0.5, 0], [0.5, -1]],
  ] as const
  for (const [hinge, side, hingePoint, closedEnd, leafEnd] of cases) {
    const g = doorSwingGeometry(1, { hinge, side })
    assert.deepEqual(pt(g.hinge), hingePoint, `bisagra ${hinge}/${side}`)
    assert.deepEqual(pt(g.closedEnd), closedEnd, `jamba libre ${hinge}/${side}`)
    assert.deepEqual(pt(g.leafEnd), leafEnd, `hoja abierta ${hinge}/${side}`)
    assert.deepEqual(pt(g.arc[0]), closedEnd, 'el arco empieza en la hoja cerrada')
    assert.deepEqual(pt(g.arc[g.arc.length - 1]), leafEnd, 'y acaba en la hoja abierta')
    for (const point of g.arc) close(Math.hypot(point.x - g.hinge.x, point.z - g.hinge.z), 1, 'todo el arco a una hoja de la bisagra')
  }
})

test('el arco escala con el ancho de la puerta y su lado decide hacia dónde se abre', () => {
  const inside = doorSwingGeometry(0.9, { hinge: 'left', side: 'inside' })
  const outside = doorSwingGeometry(0.9, { hinge: 'left', side: 'outside' })
  close(inside.leafEnd.z, 0.9); close(outside.leafEnd.z, -0.9)
  assert.ok(inside.arc.every((point) => point.z >= -1e-9) && outside.arc.every((point) => point.z <= 1e-9))
})

test('una puerta sin giro se dibuja con el predeterminado', () => {
  assert.deepEqual(doorSwingOf({}), DEFAULT_DOOR_SWING)
  assert.deepEqual(doorSwingOf({ swing: { hinge: 'right', side: 'outside' } }), { hinge: 'right', side: 'outside' })
})

test('el contrato del giro es estricto', () => {
  validateDoorSwing(undefined)
  validateDoorSwing({ hinge: 'left', side: 'inside' })
  for (const bad of [null, 'left', [], {}, { hinge: 'left' }, { hinge: 'centro', side: 'inside' }, { hinge: 'left', side: 'arriba' }, { hinge: 'left', side: 'inside', extra: 1 }]) {
    assert.throws(() => validateDoorSwing(bad), /giro de una puerta/)
  }
})

test('cambiar el giro de la puerta principal es un paso de historial y no toca el resto', () => {
  const store = createRoomStore()
  const before = store.getState().room.door
  store.getState().setDoor({ swing: { hinge: 'right', side: 'outside' } })
  assert.deepEqual(store.getState().room.door.swing, { hinge: 'right', side: 'outside' })
  assert.deepEqual({ ...store.getState().room.door, swing: undefined }, { ...before, swing: undefined }, 'solo cambia el giro')
  assert.equal(store.getState().undoCount, 1)
  store.getState().undo()
  assert.equal(store.getState().room.door.swing, undefined)
  store.getState().redo()
  assert.equal(store.getState().room.door.swing?.hinge, 'right')
})

test('las puertas adicionales y las de otra habitación también guardan su giro', () => {
  const store = createRoomStore()
  store.getState().addStructureDoor()
  const id = store.getState().selectedId!
  store.getState().setStructureDoor(id, { swing: { hinge: 'right', side: 'inside' } })
  const extra = store.getState().room.extraDoors?.find((door) => door.id === id)
  assert.deepEqual(extra?.swing, { hinge: 'right', side: 'inside' })
  assert.equal(designHasDoorSwing(persistedDesign(store.getState())), true)
})

test('una puerta bloqueada no cambia de giro; al desbloquearla sí', () => {
  const store = createRoomStore()
  store.getState().toggleElementLock('door')
  store.getState().setDoor({ swing: { hinge: 'right', side: 'inside' } })
  assert.equal(store.getState().room.door.swing, undefined)
  store.getState().toggleElementLock('door')
  store.getState().setDoor({ swing: { hinge: 'right', side: 'inside' } })
  assert.equal(store.getState().room.door.swing?.hinge, 'right')
})

test('sin giros el diseño sigue siendo v12; con alguno es v14 y viaja en el JSON', () => {
  const store = createRoomStore()
  assert.equal(persistedDesign(store.getState()).version, WALLS_OUTSIDE_VERSION)
  store.getState().setDoor({ swing: { hinge: 'right', side: 'outside' } })
  assert.equal(persistedDesign(store.getState()).version, DOOR_SWING_VERSION)
  const imported = parseDesignFile(serializeDesignFile(asFile(store)))
  assert.deepEqual(imported.design.data.room.door.swing, { hinge: 'right', side: 'outside' })
  store.getState().undo()
  assert.equal(persistedDesign(store.getState()).version, WALLS_OUTSIDE_VERSION)
})

test('migración: un diseño anterior se abre sin giros; con giros exige v14 y se valida al importar', () => {
  const base = JSON.parse(JSON.stringify(persistedDesign(createRoomStore().getState())))
  assert.equal(normalizeDesign(base).room.door.swing, undefined)
  const withSwing = { ...base, room: { ...base.room, door: { ...base.room.door, swing: { hinge: 'left', side: 'outside' } } } }
  assert.throws(() => normalizeDesign({ ...withSwing, version: 12 }), /v14/)
  assert.deepEqual(normalizeDesign({ ...withSwing, version: 14 }).room.door.swing, { hinge: 'left', side: 'outside' })
  const store = createRoomStore()
  store.getState().setDoor({ swing: { hinge: 'right', side: 'inside' } })
  const file = JSON.parse(serializeDesignFile(asFile(store)))
  file.design.data.room.door.swing = { hinge: 'diagonal', side: 'inside' }
  assert.throws(() => parseDesignFile(JSON.stringify(file)), /giro de una puerta/)
  const old = JSON.parse(serializeDesignFile(asFile(store)))
  old.design.data.version = 12
  assert.throws(() => parseDesignFile(JSON.stringify(old)), /v14/)
})

test('validateDesignDoorSwings revisa todas las puertas del diseño', () => {
  const store = createRoomStore()
  store.getState().addStructureDoor()
  const design = JSON.parse(JSON.stringify(persistedDesign(store.getState())))
  design.room.extraDoors[0].swing = { hinge: 'x', side: 'inside' }
  assert.throws(() => validateDesignDoorSwings({ ...design, version: 14 }), /giro de una puerta/)
})
