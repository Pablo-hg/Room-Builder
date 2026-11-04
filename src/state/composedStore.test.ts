import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesignSignature, persistedDesign } from '../domain/designV1'
import { normalizeDesignRoom } from '../domain/normalizeDesignV1'
import { createLocalDesignRepository, SAVED_DESIGNS_KEY } from '../persistence/localDesignRepository'
import { createRoomStore } from './useRoomStore'

function setup() {
  const values = new Map<string, string>()
  const storage = {
    blocked: false,
    getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, value: string) {
      if (this.blocked) throw new Error('quota exceeded')
      values.set(key, value)
    },
  }
  const repository = createLocalDesignRepository(() => storage)
  return { values, storage, repository, store: createRoomStore(repository) }
}

test('las acciones retenidas leen el mundo actual y comparten un solo historial entre módulos', () => {
  const { store } = setup()
  store.getState().createDesign('blank', 'Original')
  const add = store.getState().addFurniture
  const move = store.getState().moveFurniture
  store.getState().setDimension('width', 7)
  add('table')
  const table = store.getState().furniture[0]
  move(table.id, 100, 0)
  assert.equal(store.getState().furniture[0].x, 100)
  const before = store.getState().undoCount
  store.getState().setView('top')
  store.getState().selectElement(table.id)
  assert.equal(store.getState().undoCount, before)
  store.getState().beginFurnitureMove()
  move(table.id, 1, 0)
  move(table.id, 0, 0)
  store.getState().endFurnitureMove()
  assert.equal(store.getState().undoCount, before + 1)
  store.getState().undo()
  assert.equal(store.getState().furniture[0].x, 100)
  assert.equal(store.getState().view, 'top')
  store.getState().redo()
  assert.equal(store.getState().furniture[0].x, 0)
  store.getState().toggleElementVisibility(table.id)
  assert.equal(store.getState().hasUnsavedChanges, true)
  store.getState().undo()
  assert.deepEqual(store.getState().hiddenElementIds, [])
})

test('portapapeles, carga y guardado coordinan los módulos sin capturar el diseño anterior', () => {
  const { store, repository } = setup()
  // Use canonical room defaults so this test measures module coordination rather than normalization.
  store.setState({ room: normalizeDesignRoom(persistedDesign(store.getState())) })
  store.getState().createDesign('copy', 'Primero')
  const firstId = store.getState().selectedSavedDesignId
  store.getState().addFurniture('chair')
  const chair = store.getState().furniture[0]
  assert.equal(store.getState().copySelected(), true)
  const save = store.getState().saveDesign
  save()
  store.getState().createDesign('blank', 'Segundo')
  const secondId = store.getState().selectedSavedDesignId
  assert.equal(store.getState().pasteSelected(), true)
  assert.notEqual(store.getState().furniture[0].id, chair.id)
  save()
  assert.equal(store.getState().hasUnsavedChanges, false)
  assert.equal(repository.read().find((design) => design.id === secondId)?.data.furniture.length, 1)
  store.getState().setView('free')
  store.getState().loadDesign(firstId)
  assert.equal(store.getState().furniture[0].id, chair.id)
  assert.equal(store.getState().view, 'free')
  assert.equal(store.getState().hasUnsavedChanges, false)
  store.getState().renameSavedDesign(firstId, 'Primero renombrado')
  store.getState().deleteSavedDesign(secondId)
  const reloaded = createRoomStore(repository)
  reloaded.getState().initializeSavedDesigns()
  assert.deepEqual(reloaded.getState().savedDesigns.map((design) => [design.id, design.name]), [[firstId, 'Primero renombrado']])
})

test('un fallo de almacenamiento no confirma acciones ni altera diseños, mundo o historial', () => {
  const { store, storage, values, repository } = setup()
  store.getState().createDesign('blank', 'Guardado')
  store.getState().setWallColor('#123456')
  const saved = store.getState().savedDesigns
  const active = store.getState().selectedSavedDesignId
  const signature = persistedDesignSignature(persistedDesign(store.getState()))
  const undoCount = store.getState().undoCount
  const stored = values.get(SAVED_DESIGNS_KEY)
  storage.blocked = true
  for (const action of [
    () => store.getState().renameSavedDesign(active, 'Cambio'),
    () => store.getState().deleteSavedDesign(active),
    () => store.getState().createDesign('copy', 'Copia'),
    () => store.getState().saveDesign(),
  ]) {
    action()
    assert.equal(store.getState().savedDesigns, saved)
    assert.equal(store.getState().selectedSavedDesignId, active)
    assert.equal(store.getState().hasUnsavedChanges, true)
    assert.equal(store.getState().undoCount, undoCount)
    assert.equal(persistedDesignSignature(persistedDesign(store.getState())), signature)
    assert.equal(values.get(SAVED_DESIGNS_KEY), stored)
    assert.match(store.getState().notice, /No se pudo/)
  }
  storage.blocked = false
  store.getState().saveDesign()
  assert.equal(store.getState().hasUnsavedChanges, false)
  assert.equal(repository.read()[0].data.room.wallColor, '#123456')
})

test('eliminar el diseño activo abre el primero de la lista y, si no queda ninguno, un lienzo en blanco', () => {
  const { store, repository } = setup()
  store.getState().createDesign('blank', 'Primero')
  const firstId = store.getState().selectedSavedDesignId
  store.getState().setWallColor('#111111')
  store.getState().saveDesign()
  store.getState().createDesign('blank', 'Segundo')
  const secondId = store.getState().selectedSavedDesignId
  store.getState().setWallColor('#222222')
  store.getState().saveDesign()

  store.getState().deleteSavedDesign(secondId)
  assert.equal(store.getState().selectedSavedDesignId, firstId)
  assert.equal(store.getState().room.wallColor, '#111111')
  assert.equal(store.getState().hasUnsavedChanges, false)
  assert.deepEqual(repository.read().map((design) => design.id), [firstId])

  store.getState().deleteSavedDesign(firstId)
  assert.equal(store.getState().selectedSavedDesignId, '')
  assert.equal(store.getState().savedDesigns.length, 0)
  assert.equal(store.getState().furniture.length, 0)
  assert.equal(store.getState().hasUnsavedChanges, false)
  assert.deepEqual(repository.read(), [])
})

test('el contexto mutable y el repositorio quedan aislados entre instancias del store', () => {
  const first = setup().store
  const second = setup().store
  first.getState().createDesign('blank', 'Solo primero')
  first.getState().addFurniture('chair')
  const chair = first.getState().furniture[0]
  first.getState().copySelected()
  const firstHistory = first.getState().undoCount
  first.getState().beginFurnitureMove()
  first.getState().moveFurniture(chair.id, 1, 0)
  second.getState().addFurniture('table')
  second.getState().setFloorColor('#abcdef')
  assert.equal(second.getState().pasteSelected(), false)
  assert.equal(second.getState().savedDesigns.length, 0)
  assert.equal(second.getState().undoCount, 2)
  second.getState().undo()
  first.getState().moveFurniture(chair.id, 2, 0)
  first.getState().endFurnitureMove()
  assert.equal(first.getState().undoCount, firstHistory + 1)
  first.getState().undo()
  assert.equal(first.getState().furniture[0].x, chair.x)
  assert.equal(second.getState().furniture.length, 1)
})

test('importar un ID duplicado crea copia independiente y respeta el límite y errores de almacenamiento', () => {
  const { store, storage, values } = setup()
  store.getState().createDesign('blank', 'Original')
  const existing = store.getState().savedDesigns[0]
  const selected = store.getState().selectedSavedDesignId
  assert.equal(store.getState().importDesign(existing), null)
  const imported = store.getState().savedDesigns[1]
  assert.notEqual(imported.id, existing.id)
  assert.deepEqual(imported.data, existing.data)
  assert.notEqual(imported.data, existing.data)
  assert.equal(store.getState().selectedSavedDesignId, selected)
  storage.blocked = true
  const before = values.get(SAVED_DESIGNS_KEY)
  assert.match(store.getState().importDesign(existing) ?? '', /no se pudo/i)
  assert.equal(values.get(SAVED_DESIGNS_KEY), before)
  assert.equal(store.getState().savedDesigns.length, 2)
  storage.blocked = false
  for (let i = 0; i < 3; i++) assert.equal(store.getState().importDesign(existing), null)
  assert.match(store.getState().importDesign(existing) ?? '', /5 diseños/)
  assert.equal(store.getState().savedDesigns.length, 5)
})
