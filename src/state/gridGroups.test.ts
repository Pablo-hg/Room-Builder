import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ROOT_GRID_SURFACES, gridGroupStatus, gridGroupTargets } from '../domain/gridGroups'
import { structureGridElementId } from '../domain/elementIds'
import { createRoomStore } from './useRoomStore'

test('el check global de Raíz oculta todas las superficies, incluidos los muros no visibles desde la cámara', () => {
  const store = createRoomStore()
  store.getState().setGridGroupVisibility('focused', false)
  for (const side of ROOT_GRID_SURFACES) assert.equal(store.getState().gridVisibility[side], false)
  assert.equal(gridGroupStatus(store.getState(), 'focused').visible, false)
  store.getState().setGridGroupVisibility('focused', true)
  assert.equal(gridGroupStatus(store.getState(), 'focused').visible, true)
  store.getState().undo()
  assert.equal(gridGroupStatus(store.getState(), 'focused').visible, false)
})

test('el check de habitación enfocada conserva la cuadrícula de Raíz y las demás habitaciones', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const firstPack = store.getState().structurePacks.find((item) => item.id === store.getState().activeRoomId)!
  const firstGrid = structureGridElementId(firstPack.id, 'floor')
  store.getState().setGridGroupVisibility('focused', false)
  assert.ok(store.getState().hiddenElementIds.includes(firstGrid))
  assert.equal(store.getState().gridVisibility.floor, true)
  store.getState().addStructurePack('up')
  const second = store.getState().structurePacks.find((item) => item.id === store.getState().activeRoomId)!
  assert.notEqual(second.id, firstPack.id)
  assert.equal(gridGroupStatus(store.getState(), 'focused').visible, true)
  store.getState().setGridGroupVisibility('all', false)
  assert.ok(store.getState().hiddenElementIds.includes(structureGridElementId(second.id, 'floor')))
  assert.equal(store.getState().gridVisibility.floor, false)
  store.getState().setGridGroupVisibility('all', true)
  assert.equal(gridGroupStatus(store.getState(), 'all').visible, true)
})

test('las superficies independientes siguen la carpeta de su habitación, también en subcarpetas', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const roomId = store.getState().activeRoomId!
  store.getState().addStructureObject('wall')
  const wall = store.getState().structurePacks.find((pack) => pack.id.startsWith('wall-object-'))!
  const wallGrid = structureGridElementId(wall.id, wall.surfaces[0].id)
  const state = store.getState()
  assert.ok(gridGroupTargets(state, 'focused').ids.includes(wallGrid))
  store.getState().setGridGroupVisibility('focused', false)
  assert.ok(store.getState().hiddenElementIds.includes(wallGrid))
  store.getState().setActiveRoomId(null)
  assert.equal(gridGroupTargets(store.getState(), 'focused').ids.includes(wallGrid), false)
  store.getState().setActiveRoomId(roomId)
  store.getState().setGridGroupVisibility('focused', true)
  assert.ok(!store.getState().hiddenElementIds.includes(wallGrid))
})

test('la selección parcial del check global es visible y se puede corregir de una vez', () => {
  const store = createRoomStore()
  store.getState().toggleGridVisibility('north')
  assert.equal(gridGroupStatus(store.getState(), 'focused').partial, true)
  store.getState().setGridGroupVisibility('focused', true)
  assert.equal(gridGroupStatus(store.getState(), 'focused').visible, true)
})
