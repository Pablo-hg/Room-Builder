import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign } from '../domain/designV1'
import { BASE_FLOOR_ID, baseWallId } from '../domain/elementFolders'
import { structureSurfaceElementId } from '../domain/elementIds'
import { createRoomStore } from './useRoomStore'

const wood = { id: 'wood' as const, color: '#aabbcc', scale: 2, rotation: 90 }
const wallpaper = { id: 'wallpaper' as const, color: '#eeeeee', scale: 1, rotation: 0 }

test('aplicar un material cambia solo la superficie y permite deshacer y rehacer', () => {
  const store = createRoomStore()
  const originalRoom = structuredClone(store.getState().room)
  store.getState().setMaterialFinish(BASE_FLOOR_ID, wood)
  assert.equal(persistedDesign(store.getState()).version, 15)
  assert.equal(store.getState().undoCount, 1)
  assert.deepEqual(store.getState().room, { ...originalRoom, floorMaterial: wood })
  store.getState().undo()
  assert.deepEqual(store.getState().room, originalRoom)
  store.getState().redo()
  assert.deepEqual(store.getState().room.floorMaterial, wood)
  store.getState().setMaterialFinish(baseWallId('north'), wallpaper)
  assert.deepEqual(store.getState().room.wallMaterials, { north: wallpaper })
  store.getState().setFloorColor('#112233')
  assert.equal(store.getState().room.floorMaterial?.color, '#112233')
  store.getState().setMaterialFinish(BASE_FLOOR_ID, null)
  assert.equal(store.getState().room.floorMaterial, undefined)
  assert.equal(store.getState().room.floorColor, '#112233')
  store.getState().undo()
  assert.equal(store.getState().room.floorMaterial?.color, '#112233')
})

test('rechaza un acabado inválido y respeta el bloqueo sin generar historial', () => {
  const store = createRoomStore()
  store.getState().setMaterialFinish(BASE_FLOOR_ID, { ...wallpaper, scale: 0 })
  assert.match(store.getState().notice, /no es válido/)
  assert.equal(store.getState().undoCount, 0)
  store.setState({ lockedElementIds: [BASE_FLOOR_ID] })
  store.getState().setMaterialFinish(BASE_FLOOR_ID, wood)
  assert.match(store.getState().notice, /Desbloquea/)
  assert.equal(store.getState().room.floorMaterial, undefined)
  assert.equal(store.getState().undoCount, 0)
})

test('se puede aplicar papel al suelo, madera a un techo y tejido a un marco sin mover el elemento', () => {
  const store = createRoomStore()
  const { setMaterialFinish, addStructurePack, room } = store.getState()
  setMaterialFinish('door', wallpaper)
  assert.deepEqual(store.getState().room.door, { ...room.door, material: wallpaper })
  assert.equal(persistedDesign(store.getState()).version, 15)
  setMaterialFinish(BASE_FLOOR_ID, wallpaper)
  assert.deepEqual(store.getState().room.floorMaterial, wallpaper)
  addStructurePack('east')
  const pack = store.getState().structurePacks[0]
  setMaterialFinish(structureSurfaceElementId(pack.id, 'ceiling'), wood)
  assert.deepEqual(store.getState().structurePacks[0].surfaces.find((surface) => surface.kind === 'ceiling'),
    { ...pack.surfaces.find((surface) => surface.kind === 'ceiling'), material: wood })
  const fabric = { ...wood, id: 'fabric' as const }
  setMaterialFinish(room.windows[0].id, fabric)
  assert.deepEqual(store.getState().room.windows[0], { ...room.windows[0], material: fabric })
  store.getState().undo()
  assert.deepEqual(store.getState().room.windows[0], room.windows[0])
})

test('aplicar a un mueble conserva posición, dimensiones y color anterior', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const original = structuredClone(store.getState().furniture[0])
  store.getState().setMaterialFinish(original.id, wood)
  assert.deepEqual(store.getState().furniture[0], { ...original, material: wood })
  store.getState().undo()
  assert.deepEqual(store.getState().furniture[0], original)
})
