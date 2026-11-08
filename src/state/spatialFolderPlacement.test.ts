import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { ROOT_ROOM_FOLDER } from '../domain/elementFolders'
import { spatialRoomFolder } from '../domain/spatialFolderPlacement'
import { structureSurfaceElementId } from '../domain/elementIds'

test('un mueble cambia automáticamente de carpeta al entrar en otro volumen', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const roomPack = store.getState().structurePacks.find((pack) => pack.id.startsWith('floor-pack-'))!
  const roomFolder = store.getState().elementFolderAssignments[roomPack.id]
  store.getState().setActiveRoomId(null)
  store.getState().addFurniture('chair')
  const chairId = store.getState().selectedId!
  assert.equal(store.getState().elementFolderAssignments[chairId], ROOT_ROOM_FOLDER)
  store.getState().moveFurniture(chairId, roomPack.x, roomPack.z)
  assert.equal(store.getState().elementFolderAssignments[chairId], roomFolder)
  store.getState().undo()
  assert.equal(store.getState().elementFolderAssignments[chairId], ROOT_ROOM_FOLDER)
  store.getState().redo()
  assert.equal(store.getState().elementFolderAssignments[chairId], roomFolder)
  store.getState().moveFurniture(chairId, 0, 0)
  assert.equal(store.getState().elementFolderAssignments[chairId], ROOT_ROOM_FOLDER)
})

test('una habitación sobre otra cambia carpeta según la posición vertical', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks.find((item) => item.id.startsWith('floor-pack-'))!
  const upperFolder = store.getState().elementFolderAssignments[pack.id]
  store.getState().setActiveRoomId(null)
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  store.getState().moveFurnitureVertically(id, pack.y + 0.25)
  assert.equal(store.getState().elementFolderAssignments[id], upperFolder)
})

test('fuera de las habitaciones no se cambia de carpeta ni se confunde una pared compartida', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const pack = store.getState().structurePacks.find((item) => item.id.startsWith('floor-pack-'))!
  const before = store.getState().elementFolderAssignments[pack.id]
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  store.getState().moveFurniture(id, 30, 30)
  assert.equal(store.getState().elementFolderAssignments[id], before)
  const state = store.getState()
  assert.equal(spatialRoomFolder(state, { x: state.room.width / 2, y: 1, z: 0 }), null)
})

test('mover manualmente un elemento a otra carpeta no cambia su posición ni se revierte solo', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  store.getState().setActiveRoomId(null)
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  store.getState().createElementFolder('Mis favoritos')
  const folder = store.getState().elementFolders.find((item) => item.name === 'Mis favoritos')!.id
  store.getState().moveElementToFolder(id, folder)
  assert.equal(store.getState().elementFolderAssignments[id], folder)
  store.getState().moveFurniture(id, 0.2, 0.2)
  assert.equal(store.getState().elementFolderAssignments[id], folder)
})

test('suelos y paredes independientes también se reasignan por su posición mundial', () => {
  for (const kind of ['floor', 'wall'] as const) {
    const store = createRoomStore()
    store.getState().addStructurePack('east')
    const roomPack = store.getState().structurePacks.find((pack) => pack.id.startsWith('floor-pack-'))!
    const targetFolder = store.getState().elementFolderAssignments[roomPack.id]
    store.getState().setActiveRoomId(null)
    store.getState().addStructureObject(kind)
    const pack = store.getState().structurePacks.find((item) => item.id.startsWith(kind + '-object-'))!
    const id = structureSurfaceElementId(pack.id, pack.surfaces[0].id)
    store.getState().moveStructureSurface(pack.id, pack.surfaces[0].id, 'x', roomPack.x)
    assert.equal(store.getState().elementFolderAssignments[id], targetFolder)
  }
})
