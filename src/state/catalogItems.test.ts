import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign, persistedDesignSignature, type SavedDesign } from '../domain/designV1'
import { FURNITURE_CATALOG, STANDALONE_OPENING_MENU, isWallPictureKind, openingShapeForKind } from '../domain/objectCatalog'
import type { FurnitureKind } from '../domain/types'
import { parseDesignFile, serializeDesignFile } from '../persistence/designFile'
import { normalizeDesign } from '../persistence/designMigrations'
import { createRoomStore } from './useRoomStore'

const furnitureKinds = Object.keys(FURNITURE_CATALOG) as FurnitureKind[]

// Misma acción que ejecuta cada botón del menú Catálogo.
function addFromCatalog(store: ReturnType<typeof createRoomStore>, kind: FurnitureKind) {
  if (isWallPictureKind(kind)) store.getState().addWindow(kind)
  else store.getState().addFurniture(kind)
}

test('cada mueble del catálogo se puede añadir, deshacer y rehacer', () => {
  for (const kind of furnitureKinds) {
    const store = createRoomStore()
    const before = persistedDesignSignature(persistedDesign(store.getState()))
    addFromCatalog(store, kind)
    const after = persistedDesignSignature(persistedDesign(store.getState()))
    assert.notEqual(after, before, `${kind}: añadirlo no cambia el diseño`)
    assert.ok(store.getState().selectedId, `${kind}: queda seleccionado`)
    store.getState().undo()
    assert.equal(persistedDesignSignature(persistedDesign(store.getState())), before, `${kind}: deshacer`)
    store.getState().redo()
    assert.equal(persistedDesignSignature(persistedDesign(store.getState())), after, `${kind}: rehacer`)
  }
})

test('cada apertura independiente del menú se puede añadir y deshacer', () => {
  for (const { kind } of STANDALONE_OPENING_MENU) {
    const store = createRoomStore()
    const before = persistedDesignSignature(persistedDesign(store.getState()))
    if (kind === 'door') store.getState().addStructureDoor()
    else store.getState().addWindow(openingShapeForKind(kind))
    assert.notEqual(persistedDesignSignature(persistedDesign(store.getState())), before, `${kind}: añadirlo no cambia el diseño`)
    store.getState().undo()
    assert.equal(persistedDesignSignature(persistedDesign(store.getState())), before, `${kind}: deshacer`)
  }
})

test('un diseño con todo el catálogo sobrevive a exportar e importar', () => {
  const store = createRoomStore()
  for (const kind of furnitureKinds) addFromCatalog(store, kind)
  for (const { kind } of STANDALONE_OPENING_MENU) {
    if (kind === 'door') store.getState().addStructureDoor()
    else store.getState().addWindow(openingShapeForKind(kind))
  }
  const design: SavedDesign = { id: 'catalogo', name: 'Todo el catálogo', savedAt: '2026-11-14T10:00:00.000Z', data: persistedDesign(store.getState()) }
  const loaded = parseDesignFile(serializeDesignFile(design))
  assert.equal(persistedDesignSignature(loaded.design.data), persistedDesignSignature(normalizeDesign(design.data)))
})
