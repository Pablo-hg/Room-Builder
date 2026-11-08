import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { persistedDesign } from '../domain/designV1'
import { normalizeDesign } from '../persistence/designMigrations'
import { structureWindowError, structureWindowFrame, packWindowById } from '../domain/structureWindows'
import { deriveSelection } from '../domain/selection'
import { detectSceneCollisions } from '../domain/sceneCollisions'
import { orderedSceneIds } from '../domain/elementFolders'

for (const direction of ['up', 'east'] as const) {
  test(`una ventana se crea en su habitación enfocada (${direction}) y no en Raíz`, () => {
    const store = createRoomStore()
    const originalRootWindows = store.getState().room.windows.map((window) => window.id)
    store.getState().addStructurePack(direction)
    const pack = store.getState().structurePacks.find((item) => item.id === store.getState().activeRoomId)!
    store.getState().addWindow('rectangular')
    const state = store.getState()
    const selected = state.selectedId!
    const window = state.structurePacks.find((item) => item.id === pack.id)!.windows?.find((item) => item.id === selected)
    assert.ok(window)
    assert.deepEqual(state.room.windows.map((item) => item.id), originalRootWindows)
    assert.equal(state.elementFolderAssignments[selected], state.elementFolderAssignments[pack.id])
    assert.equal(structureWindowError(state.structurePacks.find((item) => item.id === pack.id)!), null)
    assert.ok(orderedSceneIds(state).includes(selected))
    assert.equal(deriveSelection(state, selected).selectedWindow?.id, selected)
    const frame = structureWindowFrame(state.room, pack, window.wall)
    assert.ok(frame)
    if (direction === 'up') assert.ok(frame.floorY > 0)
    else assert.ok(Math.abs(frame.x) > 0 || Math.abs(frame.z) > 0)
    const saved = persistedDesign(state)
    assert.equal(saved.version, 10)
    const loaded = normalizeDesign(saved)
    assert.equal(packWindowById(loaded.structurePacks!, selected)?.window.id, selected)
    assert.equal(loaded.elementFolderAssignments?.[selected], state.elementFolderAssignments[selected])
  })
}

test('editar ventana de una planta superior preserva ventanas de raíz y permite deshacer', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().addWindow('circular')
  const id = store.getState().selectedId!
  const original = store.getState().structurePacks[0].windows![0]
  store.getState().updateWindow(id, { offset: 0.75 })
  assert.equal(store.getState().structurePacks[0].windows![0].offset, 0.75)
  store.getState().undo()
  assert.equal(store.getState().structurePacks[0].windows![0].offset, original.offset)
  store.getState().redo()
  assert.equal(store.getState().structurePacks[0].windows![0].offset, 0.75)
  store.getState().updateWindow(id, { wall: 'west' })
  assert.equal(store.getState().structurePacks[0].windows![0].wall, 'west')
  store.getState().removeWindow(id)
  assert.equal(packWindowById(store.getState().structurePacks, id), null)
  assert.equal(store.getState().elementFolderAssignments[id], undefined)
})

test('la ventana puede copiarse y pegarse dentro de su mismo pack', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().addWindow('rectangular')
  const first = store.getState().selectedId!
  assert.equal(store.getState().copySelected(), true)
  assert.equal(store.getState().pasteSelected(), true)
  const selected = store.getState().selectedId!
  assert.notEqual(first, selected)
  assert.ok(packWindowById(store.getState().structurePacks, selected))
  assert.equal(store.getState().elementFolderAssignments[selected], store.getState().elementFolderAssignments[first])
})

test('borrar una habitación elimina las ventanas y su carpeta', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  store.getState().addWindow('rectangular')
  const id = store.getState().selectedId!
  store.getState().removeStructurePack(pack.id)
  assert.equal(store.getState().structurePacks.length, 0)
  assert.equal(store.getState().elementFolderAssignments[id], undefined)
  store.getState().undo()
  assert.ok(packWindowById(store.getState().structurePacks, id))
})

test('proyectos heredados sin ventanas de pack siguen cargándose sin migraciones artificiales', () => {
  const store = createRoomStore()
  store.getState().addWindow('rectangular')
  const rootId = store.getState().selectedId!
  const saved = persistedDesign(store.getState())
  const result = normalizeDesign(saved)
  assert.ok(result.room.windows.some((window) => window.id === rootId))
  assert.ok((result.structurePacks ?? []).every((pack) => pack.windows === undefined))
})

test('colisiones de la raíz y de plantas superiores usan sus posiciones mundiales', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().addWindow('rectangular')
  const id = store.getState().selectedId!
  const collisions = detectSceneCollisions(store.getState())
  assert.equal(collisions.some((pair) => pair.firstId === id || pair.secondId === id), false)
})
