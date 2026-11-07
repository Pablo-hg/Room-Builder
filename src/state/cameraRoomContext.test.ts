import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { focusedRoom, packRoomBox } from '../domain/roomEditing'
import { folderSelectionId, ROOT_ROOM_FOLDER } from '../domain/elementFolders'
import { persistedDesign } from '../domain/designV1'
import { normalizeDesign } from '../persistence/designMigrations'
import { serializeDesignFile, parseDesignFile } from '../persistence/designFile'
import { migrateDesignToProject, projectToPersistedDesignV1 } from '../persistence/projectMigration'
import { validateOpenings, openingsForWall, buildWallSegments, wallLength } from '../domain/geometry'

test('panel y edición usan la habitación de cámara aunque se seleccione otra carpeta', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const id = store.getState().activeRoomId!
  store.getState().selectElement(folderSelectionId(ROOT_ROOM_FOLDER))
  assert.equal(focusedRoom(store.getState()).packId, id)
  const rootWidth = store.getState().room.width
  store.getState().setFocusedRoomDimension('width', 7)
  assert.equal(store.getState().room.width, rootWidth)
  assert.equal(packRoomBox(store.getState().structurePacks[0], store.getState().room)?.width, 7)
  store.getState().setActiveRoomId(null)
  assert.equal(focusedRoom(store.getState()).name, 'Raíz')
  store.getState().setFocusedRoomDimension('width', 6)
  assert.equal(store.getState().room.width, 6)
  assert.equal(packRoomBox(store.getState().structurePacks[0], store.getState().room)?.width, 7)
})

test('una sola habitación es el contexto automático; las carpetas incompletas siguen protegidas', () => {
  const store = createRoomStore()
  assert.equal(focusedRoom(store.getState()).kind, 'root')
  assert.ok(focusedRoom(store.getState()).editable)
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  store.getState().removeStructureSurface(pack.id, 'wall-east')
  assert.equal(focusedRoom(store.getState()).packId, pack.id)
  assert.equal(focusedRoom(store.getState()).editable, null)
  const before = structuredClone(store.getState().structurePacks)
  store.getState().setFocusedRoomDimension('width', 7)
  assert.deepEqual(store.getState().structurePacks, before)
})

test('añadir puerta obedece a la cámara, no a la selección de objetos o carpetas', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().selectElement(folderSelectionId(ROOT_ROOM_FOLDER))
  store.getState().addStructureDoor()
  assert.equal(store.getState().structurePacks[0].doors?.length, 1)
  assert.equal(store.getState().room.extraDoors, undefined)
  store.getState().setActiveRoomId(null)
  store.getState().selectElement(store.getState().structurePacks[0].id)
  const primary = structuredClone(store.getState().room.door)
  store.getState().addStructureDoor()
  assert.equal(store.getState().room.extraDoors?.length, 1)
  assert.deepEqual(store.getState().room.door, primary)
  assert.equal(store.getState().structurePacks[0].doors?.length, 1)
  assert.equal(validateOpenings(store.getState().room), null)
})

test('puertas de raíz: huecos, JSON/R4, candados, borrado y deshacer sin perder referencias', () => {
  const store = createRoomStore()
  store.getState().addStructureDoor()
  const door = store.getState().room.extraDoors![0]
  const room = store.getState().room
  const segments = buildWallSegments(wallLength(room, door.wall), room.height, openingsForWall(room, door.wall))
  assert.ok(!segments.some((segment) => Math.abs(door.offset - segment.center[0]) < segment.size[0] / 2 && Math.abs(door.height / 2 - segment.center[1]) < segment.size[1] / 2))
  const data = persistedDesign(store.getState())
  assert.equal(data.version, 8)
  const saved = { id: 'extra-doors', name: 'Puertas', savedAt: '2026-11-07T12:00:00.000Z', data }
  assert.deepEqual(normalizeDesign(data).room.extraDoors, room.extraDoors)
  assert.deepEqual(parseDesignFile(serializeDesignFile(saved)).design.data.room.extraDoors, room.extraDoors)
  assert.deepEqual(projectToPersistedDesignV1(migrateDesignToProject(saved)).room.extraDoors, room.extraDoors)
  const axis = door.wall === 'north' || door.wall === 'south' ? 'x' : 'z'
  store.getState().setElementAxisLock(door.id, axis, true)
  store.getState().setStructureDoor(door.id, { offset: door.offset + 0.1 })
  assert.equal(store.getState().room.extraDoors![0].offset, door.offset)
  store.getState().removeStructureDoor(door.id)
  assert.equal(store.getState().room.extraDoors!.length, 0)
  assert.equal(store.getState().elementFolderAssignments[door.id], undefined)
  store.getState().undo()
  assert.equal(store.getState().room.extraDoors![0].id, door.id)
  assert.ok(store.getState().elementFolderAssignments[door.id])
})

test('barra y rueda comparten rangos; zoom de cada vista es transitorio e independiente', () => {
  const store = createRoomStore()
  store.getState().setCameraZoom(2)
  const count = store.getState().undoCount
  store.getState().setView('free')
  store.getState().setCameraZoom(10)
  assert.equal(store.getState().freeCameraZoom, 4)
  assert.equal(store.getState().cameraZoom, 2)
  store.getState().setCameraZoom(2)
  store.getState().adjustCameraZoom(-120)
  assert.ok(Math.abs(store.getState().freeCameraZoom - 2 * Math.exp(0.18)) < 1e-9)
  store.getState().setView('pov')
  store.getState().setCameraZoom(0)
  assert.equal(store.getState().povCameraZoom, 1)
  store.getState().setCameraZoom(NaN)
  assert.equal(store.getState().povCameraZoom, 1)
  store.getState().setView('top')
  store.getState().setCameraZoom(0)
  assert.equal(store.getState().cameraZoom, 0.25)
  assert.equal(store.getState().undoCount, count)
})
