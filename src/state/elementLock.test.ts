import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign } from '../domain/designV1'
import { normalizeDesignPreferences } from '../domain/normalizeDesignV1'
import { structureSurfaceElementId } from '../domain/elementIds'
import { createRoomStore } from './useRoomStore'

test('el candado impide mover y girar un mueble y se conserva al guardar', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  const before = store.getState().furniture[0]

  store.getState().toggleElementLock(id)
  assert.deepEqual(store.getState().lockedElementIds, [id])
  store.getState().moveFurniture(id, 1.5, 1)
  store.getState().moveFurnitureVertically(id, 0.5)
  store.getState().setFurnitureRotation(id, Math.PI / 2)
  store.getState().rotateFurniture()
  assert.deepEqual(store.getState().furniture[0], before)
  assert.deepEqual(persistedDesign(store.getState()).lockedElementIds, [id])

  store.getState().undo()
  assert.deepEqual(store.getState().lockedElementIds, [])
  store.getState().moveFurniture(id, 1.5, 1)
  assert.notDeepEqual(store.getState().furniture[0], before)
})

test('los candados de superficies y packs se guardan y bloquean sus movimientos', () => {
  const store = createRoomStore()
  store.getState().addStructureObject('floor')
  const pack = store.getState().structurePacks[0]
  const surface = pack.surfaces[0]
  const surfaceId = structureSurfaceElementId(pack.id, surface.id)

  store.getState().toggleElementLock(surfaceId)
  store.getState().moveStructureSurface(pack.id, surface.id, 'x', 1.5)
  store.getState().resizeStructureSurface(pack.id, surface.id, 'width', 4)
  assert.deepEqual(store.getState().structurePacks[0].surfaces[0], surface)
  assert.deepEqual(persistedDesign(store.getState()).lockedElementIds, [surfaceId])

  store.getState().toggleElementLock(pack.id)
  const before = store.getState().structurePacks[0]
  store.getState().moveStructurePack(pack.id, 'y', 1)
  assert.deepEqual(store.getState().structurePacks[0], before)
  assert.deepEqual(normalizeDesignPreferences(persistedDesign(store.getState())).lockedElementIds, [surfaceId, pack.id])
})

test('ocultar y bloquear usan estados independientes', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  store.getState().toggleElementLock(id)
  store.getState().toggleElementVisibility(id)
  assert.deepEqual(store.getState().hiddenElementIds, [id])
  assert.deepEqual(store.getState().lockedElementIds, [id])
  store.getState().toggleElementLock(id)
  assert.deepEqual(store.getState().hiddenElementIds, [id])
  assert.deepEqual(store.getState().lockedElementIds, [])
})
