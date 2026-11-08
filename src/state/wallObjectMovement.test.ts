import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { wallObjectPosition, wallObjects } from '../domain/wallObjectPlacement'
import { detectOutsideRoom } from '../domain/sceneCollisions'
import { openingsForWall } from '../domain/geometry'
import { structurePackOpenings } from '../domain/structureWindows'
import { persistedDesign } from '../domain/designV1'
import { ROOT_ROOM_FOLDER } from '../domain/elementFolders'
import { projectStructureFingerprint } from '../domain/projectV2'
import { normalizeDesign } from '../persistence/designMigrations'
import { parseDesignFile, serializeDesignFile } from '../persistence/designFile'
import { migrateDesignToProject, projectToPersistedDesignV1 } from '../persistence/projectMigration'
import type { WindowShape } from '../domain/types'

const object = (store: ReturnType<typeof createRoomStore>, id: string) => wallObjects(store.getState()).find((source) => source.window.id === id)!

for (const shape of ['rectangular', 'circular', 'wallShelf', 'pictureSmall', 'mirrorRectangular', 'wallSconce'] as WindowShape[]) {
  test(`${shape}: XYZ permite salir de la pared y el aviso se reserva al vacío`, () => {
    const store = createRoomStore()
    store.getState().addWindow(shape)
    const id = store.getState().selectedId!
    const before = object(store, id).window
    assert.ok(openingsForWall(store.getState().room, before.wall).some((opening) => opening.id === id))
    store.getState().detachWallObject(id)
    store.getState().moveWallObject(id, 'z', 0)
    store.getState().moveWallObject(id, 'x', 0)
    store.getState().moveWallObject(id, 'y', 0.3)
    const changed = object(store, id).window
    assert.deepEqual({ ...changed.freePosition, yaw: undefined }, { x: 0, y: 0.3, z: 0, yaw: undefined })
    assert.ok(!openingsForWall(store.getState().room, before.wall).some((opening) => opening.id === id))
    assert.ok(!detectOutsideRoom(store.getState()).some((issue) => issue.id === id))
    store.getState().moveWallObject(id, 'y', 30)
    assert.ok(detectOutsideRoom(store.getState()).some((issue) => issue.id === id))
    store.getState().undo()
    assert.equal(object(store, id).window.freePosition?.y, 0.3)
    store.getState().redo()
    assert.equal(object(store, id).window.freePosition?.y, 30)
  })
}

test('transferencia de raíz a pack y vuelta conserva identidad, selección, carpeta y undo', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const pack = store.getState().structurePacks[0]
  const id = store.getState().room.windows[0].id
  store.getState().selectElement(id)
  store.getState().detachWallObject(id)
  store.getState().moveWallObject(id, 'z', 0)
  store.getState().moveWallObject(id, 'x', pack.x)
  assert.equal(object(store, id).pack?.id, pack.id)
  assert.equal(store.getState().selectedId, id)
  assert.equal(store.getState().elementFolderAssignments[id], store.getState().elementFolderAssignments[pack.id])
  assert.ok(!detectOutsideRoom(store.getState()).some((issue) => issue.id === id))
  store.getState().undo()
  assert.equal(object(store, id).pack, undefined)
  store.getState().redo()
  assert.equal(object(store, id).pack?.id, pack.id)
  store.getState().moveWallObject(id, 'x', 0)
  assert.equal(object(store, id).pack, undefined)
  assert.equal(store.getState().elementFolderAssignments[id], ROOT_ROOM_FOLDER)
  store.getState().removeStructurePack(pack.id)
  assert.equal(object(store, id).window.id, id)
})

test('despegar una ventana de pack elimina su corte y permite reanclarla explícitamente', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().addWindow()
  const id = store.getState().selectedId!
  const source = object(store, id)
  const wall = source.pack!.surfaces.find((surface) => surface.wall === source.window.wall)!
  const position = wallObjectPosition(store.getState().room, source.window, source.pack)
  store.getState().detachWallObject(id)
  store.getState().moveWallObject(id, 'y', position.y + 0.2)
  const detached = object(store, id)
  assert.ok(!structurePackOpenings(detached.pack!, wall).some((opening) => opening.id === id))
  store.getState().updateWindow(id, { wall: source.window.wall })
  assert.equal(object(store, id).window.freePosition, undefined)
  assert.ok(structurePackOpenings(object(store, id).pack!, wall).some((opening) => opening.id === id))
})

test('candados XYZ y bloqueo total se respetan al despegar y al reanclar', () => {
  const store = createRoomStore()
  const id = store.getState().room.windows[0].id
  store.getState().setElementAxisLock(id, 'x', true)
  store.getState().moveWallObject(id, 'x', 2)
  assert.equal(object(store, id).window.freePosition, undefined)
  store.getState().detachWallObject(id)
  store.getState().moveWallObject(id, 'z', 0)
  store.getState().setElementAxisLock(id, 'z', true)
  store.getState().updateWindow(id, { wall: 'north' })
  assert.equal(object(store, id).window.freePosition?.z, 0)
  store.getState().toggleElementLock(id)
  const before = persistedDesign(store.getState())
  store.getState().moveWallObject(id, 'y', 4)
  assert.deepEqual(persistedDesign(store.getState()), before)
  store.getState().moveWallObject('door', 'y', 3)
  assert.deepEqual(persistedDesign(store.getState()), before)
})

test('mover un grupo conserva las coordenadas libres y reubica su habitación propietaria', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const pack = store.getState().structurePacks[0]
  store.getState().setActiveRoomId(null)
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  const id = store.getState().room.windows[0].id
  store.getState().detachWallObject(id)
  store.getState().moveWallObject(id, 'z', 0)
  store.setState({ selectedIds: [id, chair], selectedId: id })
  store.getState().moveSelectedFurnitureGroup('x', pack.x)
  assert.equal(object(store, id).pack?.id, pack.id)
  assert.equal(object(store, id).window.freePosition?.x, pack.x)
  assert.equal(store.getState().elementFolderAssignments[id], store.getState().elementFolderAssignments[pack.id])
})

test('duplicar, redimensionar y renombrar un elemento libre conserva su posición mundial', () => {
  const store = createRoomStore()
  const id = store.getState().room.windows[0].id
  store.getState().selectElement(id)
  store.getState().detachWallObject(id)
  store.getState().moveWallObject(id, 'z', 0)
  store.getState().renameElement(id, 'Ventana del estudio')
  store.getState().resizeWallObject(id, 'width', 2)
  assert.equal(object(store, id).window.width, 2)
  assert.equal(object(store, id).window.freePosition?.z, 0)
  assert.equal(store.getState().copySelected(), true)
  assert.equal(store.getState().pasteSelected(), true)
  const copy = object(store, store.getState().selectedId!).window
  assert.notEqual(copy.id, id)
  assert.equal(copy.name, 'Ventana del estudio')
  assert.equal(copy.freePosition?.x, 0.5)
  assert.equal(copy.freePosition?.z, 0.5)
})

test('v9 se conserva en JSON, normalización y ProjectV2; posiciones inválidas se rechazan', () => {
  const store = createRoomStore()
  const id = store.getState().room.windows[0].id
  store.getState().detachWallObject(id)
  store.getState().moveWallObject(id, 'z', 0)
  const data = persistedDesign(store.getState())
  assert.equal(data.version, 9)
  const saved = { id: 'free', name: 'Libre', savedAt: '2026-11-08T12:00:00Z', data }
  assert.deepEqual(parseDesignFile(serializeDesignFile(saved)).design.data.room.windows, normalizeDesign(data).room.windows)
  assert.deepEqual(projectToPersistedDesignV1(migrateDesignToProject(saved)).room.windows[0].freePosition, data.room.windows[0].freePosition)
  const bad = structuredClone(data)
  bad.room.windows[0].freePosition!.x = NaN
  assert.throws(() => normalizeDesign(bad), /Posición libre/)
  assert.throws(() => normalizeDesign({ ...data, version: 8 }), /v9/)
})

test('lectura histórica v1–v5 y v8 conserva anclajes y no modifica la fuente', () => {
  for (const fixture of ['persistence-v1/valid-complete', 'persisted-designs/valid-v2', 'persisted-designs/valid-v3', 'persisted-designs/valid-v4', 'persisted-designs/valid-v5']) {
    const source = JSON.parse(readFileSync(new URL(`../../tests/fixtures/${fixture}.json`, import.meta.url), 'utf8'))
    const before = structuredClone(source)
    assert.ok(normalizeDesign(source).room.windows.every((window) => !window.freePosition))
    assert.deepEqual(source, before)
  }
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().addWindow()
  const data = persistedDesign(store.getState())
  assert.equal(data.version, 8)
  assert.deepEqual(normalizeDesign(data).structurePacks, data.structurePacks)
  const v6 = createRoomStore()
  v6.getState().setElementAxisLock(v6.getState().room.windows[0].id, 'y', true)
  const old6 = persistedDesign(v6.getState())
  assert.equal(old6.version, 6)
  assert.deepEqual(normalizeDesign(old6).room.windows, old6.room.windows)
  const v7 = createRoomStore()
  v7.getState().addStructurePack('up')
  v7.getState().addStructureDoor()
  const old7 = persistedDesign(v7.getState())
  assert.equal(old7.version, 7)
  assert.deepEqual(normalizeDesign(old7).structurePacks, old7.structurePacks)
})

test('ventana libre de pack mantiene su posición en ProjectV2 y participa en su huella estructural', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().addWindow()
  const id = store.getState().selectedId!
  store.getState().detachWallObject(id)
  store.getState().moveWallObject(id, 'x', 0.2)
  const data = persistedDesign(store.getState())
  const project = migrateDesignToProject({ id: 'pack-free', name: 'Pack', savedAt: '2026-11-08T12:00:00Z', data })
  const roundTrip = projectToPersistedDesignV1(project)
  assert.deepEqual(roundTrip.structurePacks?.[0].windows?.[0].freePosition, data.structurePacks?.[0].windows?.[0].freePosition)
  const before = projectStructureFingerprint(project)
  project.legacyStructurePacks![0].windows![0].freePosition!.x += 0.1
  assert.notEqual(projectStructureFingerprint(project), before)
})
