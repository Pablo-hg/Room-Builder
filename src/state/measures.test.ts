import assert from 'node:assert/strict'
import { test } from 'node:test'
import { persistedDesign, persistedDesignSignature, WALLS_OUTSIDE_VERSION, MEASUREMENTS_VERSION, type SavedDesign } from '../domain/designV1'
import type { MeasureEnd } from '../domain/planMeasures'
import { parseDesignFile, serializeDesignFile } from '../persistence/designFile'
import { normalizeDesign } from '../persistence/designMigrations'
import { createLocalDesignRepository } from '../persistence/localDesignRepository'
import { createRoomStore } from './useRoomStore'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const free = (x: number, z: number): MeasureEnd => ({ x, z })
const asFile = (store: ReturnType<typeof createRoomStore>): SavedDesign => ({ id: 'd', name: 'Prueba', savedAt: '2026-11-16T10:00:00.000Z', data: persistedDesign(store.getState()) })
const withChair = () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  return { store, id }
}

test('guardar una cota es un paso de historial, se deshace y se rehace', () => {
  const store = createRoomStore()
  const id = store.getState().addMeasure(free(0, 0), free(4, 3), 'Diagonal')
  assert.ok(id)
  assert.equal(store.getState().measurements.length, 1)
  assert.equal(store.getState().undoCount, 1)
  store.getState().undo()
  assert.deepEqual(store.getState().measurements, [])
  store.getState().redo()
  assert.equal(store.getState().measurements[0].name, 'Diagonal')
})

test('editar, ocultar y eliminar conservan los datos y son pasos de historial', () => {
  const store = createRoomStore()
  const id = store.getState().addMeasure(free(0, 0), free(4, 3))!
  store.getState().updateMeasure(id, { name: '  Salón  ' })
  assert.equal(store.getState().measurements[0].name, 'Salón')
  store.getState().updateMeasure(id, { hidden: true })
  assert.equal(store.getState().measurements[0].hidden, true)
  assert.deepEqual(store.getState().measurements[0].end, free(4, 3), 'ocultar conserva los datos')
  store.getState().updateMeasure(id, { hidden: false })
  assert.equal('hidden' in store.getState().measurements[0], false)
  store.getState().updateMeasure(id, { end: { x: 6, z: 8 } })
  assert.deepEqual(store.getState().measurements[0].end, free(6, 8))
  const before = store.getState().undoCount
  store.getState().updateMeasure(id, { name: 'Salón' })
  assert.equal(store.getState().undoCount, before, 'sin cambios no hay paso nuevo')
  store.getState().removeMeasure(id)
  assert.deepEqual(store.getState().measurements, [])
})

test('se rechazan cotas con puntos iguales o coordenadas no válidas', () => {
  const store = createRoomStore()
  assert.equal(store.getState().addMeasure(free(1, 1), free(1, 1)), null)
  assert.equal(store.getState().addMeasure(free(NaN, 1), free(2, 2)), null)
  assert.equal(store.getState().addMeasure(free(0, 0), free(20_000, 0)), null)
  assert.equal(store.getState().measurements.length, 0)
  assert.match(store.getState().notice, /coordenadas|coinciden/)
})

test('la herramienta y la medida en curso son de sesión: ni historial ni diseño', () => {
  const store = createRoomStore()
  const before = JSON.stringify(persistedDesign(store.getState()))
  store.getState().setMeasureToolActive(true)
  store.getState().setMeasureAxis('horizontal')
  store.getState().setMeasureSnap(false)
  store.getState().setMeasureDraft({ start: free(0, 0), end: free(1, 1) })
  assert.equal(store.getState().undoCount, 0)
  assert.equal(store.getState().hasUnsavedChanges, false)
  assert.equal(JSON.stringify(persistedDesign(store.getState())), before)
  const id = store.getState().saveMeasureDraft('Guardada')
  assert.ok(id)
  assert.equal(store.getState().measureDraft, null, 'al guardar se descarta el borrador')
  store.getState().setMeasureDraft({ start: free(2, 2), end: null })
  assert.equal(store.getState().saveMeasureDraft(), null, 'sin segundo punto no se guarda')
  store.getState().setMeasureToolActive(false)
  assert.equal(store.getState().measureDraft, null)
})

test('mover el referente actualiza la cota anclada en el mismo paso de historial', () => {
  const { store, id } = withChair()
  const chair = store.getState().furniture[0]
  const anchor = { kind: 'furniture', id, point: 'center' } as const
  store.getState().addMeasure({ x: chair.x, z: chair.z, anchor }, free(chair.x + 3, chair.z + 4))
  const undoBefore = store.getState().undoCount
  store.getState().moveFurniture(id, chair.x + 1, chair.z + 1)
  const moved = store.getState().furniture[0]
  assert.deepEqual([store.getState().measurements[0].start.x, store.getState().measurements[0].start.z], [moved.x, moved.z])
  assert.equal(store.getState().undoCount, undoBefore + 1, 'mover mueble y recalcular la cota es un solo paso')
  store.getState().undo()
  assert.equal(store.getState().measurements[0].start.x, chair.x)
})

test('borrar el referente deja la cota fija, con advertencia y aviso; aceptarla la limpia', () => {
  const { store, id } = withChair()
  const chair = store.getState().furniture[0]
  store.getState().addMeasure({ x: chair.x, z: chair.z, anchor: { kind: 'furniture', id, point: 'center' } }, free(chair.x + 2, chair.z))
  store.getState().selectElement(id)
  store.getState().removeFurniture()
  const [measure] = store.getState().measurements
  assert.equal(store.getState().furniture.length, 0)
  assert.equal(measure.stale, true)
  assert.equal(measure.start.anchor, undefined)
  assert.deepEqual([measure.start.x, measure.start.z], [chair.x, chair.z])
  assert.match(store.getState().notice, /perdió su referente/)
  store.getState().acknowledgeMeasure(measure.id)
  assert.equal(store.getState().measurements[0].stale, undefined)
})

test('cambiar solo el nombre o un extremo conserva el anclaje del otro extremo', () => {
  const { store, id } = withChair()
  const chair = store.getState().furniture[0]
  const anchor = { kind: 'furniture', id, point: 'center' } as const
  const measureId = store.getState().addMeasure({ x: chair.x, z: chair.z, anchor }, { x: chair.x + 2, z: chair.z, anchor: { kind: 'furniture', id, point: 'c1' } })!
  const [start, end] = [store.getState().measurements[0].start, store.getState().measurements[0].end]
  // El formulario reenvía los dos extremos tal cual: nada cambia salvo el nombre.
  store.getState().updateMeasure(measureId, { name: 'Ancho', start: { x: start.x, z: start.z }, end: { x: end.x, z: end.z } })
  assert.equal(store.getState().measurements[0].start.anchor?.kind, 'furniture')
  assert.equal(store.getState().measurements[0].end.anchor?.kind, 'furniture')
  assert.equal(store.getState().measurements[0].name, 'Ancho')
  // Cambiar solo el punto B lo deja fijo; el A sigue a su mueble.
  store.getState().updateMeasure(measureId, { start: { x: start.x, z: start.z }, end: { x: 9, z: 9 } })
  assert.equal(store.getState().measurements[0].end.anchor, undefined)
  assert.ok(store.getState().measurements[0].start.anchor)
  store.getState().moveFurniture(id, chair.x + 1, chair.z)
  assert.equal(store.getState().measurements[0].start.x, store.getState().furniture[0].x, 'A sigue al mueble')
})

test('editar un extremo a mano lo deja fijo y resuelve la advertencia', () => {
  const { store, id } = withChair()
  const chair = store.getState().furniture[0]
  const measureId = store.getState().addMeasure({ x: chair.x, z: chair.z, anchor: { kind: 'furniture', id, point: 'center' } }, free(chair.x + 2, chair.z))!
  store.getState().updateMeasure(measureId, { start: { x: 1, z: 1 } })
  assert.equal(store.getState().measurements[0].start.anchor, undefined)
  assert.deepEqual(store.getState().measurements[0].start, free(1, 1))
})

test('sin cotas el diseño sigue siendo v12; con ellas es v13 y se guarda en el JSON', () => {
  const store = createRoomStore()
  assert.equal(persistedDesign(store.getState()).version, WALLS_OUTSIDE_VERSION)
  store.getState().addMeasure(free(0, 0), free(4, 3), 'Diagonal')
  store.getState().addMeasure(free(1, 1), free(1, 5))
  assert.equal(persistedDesign(store.getState()).version, MEASUREMENTS_VERSION)
  const imported = parseDesignFile(serializeDesignFile(asFile(store)))
  assert.deepEqual(imported.design.data.measurements, store.getState().measurements)
  assert.equal(persistedDesignSignature(imported.design.data), persistedDesignSignature(normalizeDesign(persistedDesign(store.getState()))))
  store.getState().removeMeasure(store.getState().measurements[0].id)
  store.getState().removeMeasure(store.getState().measurements[0].id)
  assert.equal(persistedDesign(store.getState()).version, WALLS_OUTSIDE_VERSION)
})

test('las cotas sobreviven a guardar, cambiar de diseño y recargar', () => {
  const store = createRoomStore()
  store.getState().addMeasure(free(0, 0), free(4, 3), 'Diagonal')
  store.getState().addMeasure(free(0, 0), free(0, 2), 'Lado')
  store.getState().updateMeasure(store.getState().measurements[1].id, { hidden: true })
  const reloaded = normalizeDesign(JSON.parse(JSON.stringify(persistedDesign(store.getState()))))
  assert.equal(reloaded.measurements?.length, 2)
  assert.equal(reloaded.measurements?.[1].hidden, true)
})

test('migración: un diseño v12 se abre sin cotas y uno anterior a v13 con cotas se rechaza', () => {
  const v12 = JSON.parse(JSON.stringify(persistedDesign(createRoomStore().getState())))
  delete v12.measurements
  assert.deepEqual(normalizeDesign(v12).measurements, [])
  assert.deepEqual(normalizeDesign({ ...v12, measurements: [] }).measurements, [])
  assert.throws(() => normalizeDesign({ ...v12, measurements: [{ id: 'a', start: { x: 0, z: 0 }, end: { x: 1, z: 1 } }] }), /v13/)
  const v13 = normalizeDesign({ ...v12, version: 13, measurements: [{ id: 'a', start: { x: 0, z: 0 }, end: { x: 4, z: 3 } }] })
  assert.equal(v13.measurements?.length, 1)
})

test('la importación de un JSON con cotas inválidas falla con un mensaje claro y no toca nada', () => {
  const store = createRoomStore()
  store.getState().addMeasure(free(0, 0), free(4, 3))
  const parsed = JSON.parse(serializeDesignFile(asFile(store)))
  parsed.design.data.measurements[0].end = { x: 'cuatro', z: 3 }
  assert.throws(() => parseDesignFile(JSON.stringify(parsed)), /extremos no válidos|cotas/)
  const old = JSON.parse(serializeDesignFile(asFile(store)))
  old.design.data.version = 12
  assert.throws(() => parseDesignFile(JSON.stringify(old)), /v13/)
})

test('cargar otro diseño sustituye las cotas y descarta la medida en curso', () => {
  const store = createRoomStore(createLocalDesignRepository(() => new MemoryStorage()))
  store.getState().addMeasure(free(0, 0), free(4, 3))
  store.getState().setMeasureDraft({ start: free(1, 1), end: null })
  store.getState().createDesign('blank', 'Vacío')
  assert.deepEqual(store.getState().measurements, [])
  assert.equal(store.getState().measureDraft, null)
})

test('mover un punto sobre un mueble lo ancla y la cota lo sigue; moverlo a un punto libre lo fija', () => {
  const { store, id } = withChair()
  const chair = store.getState().furniture[0]
  const measureId = store.getState().addMeasure(free(chair.x + 3, chair.z + 3), free(chair.x + 3, chair.z + 5))!
  const corner = { x: chair.x + chair.width / 2, z: chair.z + chair.depth / 2 }
  store.getState().updateMeasure(measureId, { start: { ...corner, anchor: { kind: 'furniture', id, point: 'c2' } } })
  assert.equal(store.getState().measurements[0].start.anchor?.kind, 'furniture')
  store.getState().moveFurniture(id, chair.x + 1, chair.z)
  assert.equal(store.getState().measurements[0].start.x, store.getState().furniture[0].x + chair.width / 2)
  store.getState().updateMeasure(measureId, { start: { x: 0, z: 0 } })
  assert.equal(store.getState().measurements[0].start.anchor, undefined)
})

test('editar los puntos y medir son modos excluyentes y la edición no deja restos en sesión', () => {
  const store = createRoomStore()
  const id = store.getState().addMeasure(free(0, 0), free(4, 3))!
  store.getState().setMeasureEditId('no-existe')
  assert.equal(store.getState().measureEditId, null)
  store.getState().setMeasureToolActive(true)
  store.getState().setMeasureEditId(id)
  assert.equal(store.getState().measureEditId, id)
  assert.equal(store.getState().measureToolActive, false, 'editar desactiva la herramienta')
  store.getState().setMeasureToolActive(true)
  assert.equal(store.getState().measureEditId, null, 'medir termina la edición')
  store.getState().setMeasureEditId(id)
  assert.equal(store.getState().undoCount, 1, 'editar no crea pasos de historial por sí mismo')
  store.getState().removeMeasure(id)
  assert.equal(store.getState().measureEditId, null)
  const second = store.getState().addMeasure(free(0, 0), free(1, 0))!
  store.getState().setMeasureEditId(second)
  store.getState().undo()
  assert.equal(store.getState().measureEditId, null, 'deshacer termina la edición')
})
