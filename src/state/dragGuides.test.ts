import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { persistedDesign } from '../domain/designV1'
import { setMovementSnap, snapMovement } from '../domain/measurements'
import type { FurnitureItem } from '../domain/types'
import { setMagnetSuspended } from './dragModifiers'
import { DEFAULT_EDITOR_PREFERENCES, loadEditorPreferences } from './editorPreferences'
import { createRoomStore } from './useRoomStore'

afterEach(() => { setMagnetSuspended(false); setMovementSnap(true) })
const chair = (id: string, x: number, z: number): FurnitureItem => ({
  id, kind: 'chair', name: id, color: '#abcdef', x, y: 0, z, width: 0.4, depth: 0.4, height: 0.8, rotation: 0,
  axisLocks: { x: false, y: false, z: false },
})
const setup = () => {
  const store = createRoomStore()
  store.setState({ furniture: [chair('fixed', 1, 0), chair('moving', -1, 0)], selectedId: 'moving', selectedIds: ['moving'] })
  return store
}
const x = (store: ReturnType<typeof createRoomStore>) => store.getState().furniture.find((item) => item.id === 'moving')!.x

test('el arrastre con puntero se atrae al borde de otro mueble y publica la guía', () => {
  const store = setup()
  store.getState().moveFurniture('moving', 0.63, 0, 'pointer')
  assert.equal(x(store), 0.6) // borde derecho en 0,8 = borde izquierdo del fijo
  assert.ok(store.getState().activeGuides.some((guide) => guide.type === 'line'))
})

test('Alt suspende el magnetismo mientras está pulsada y al soltarla vuelve', () => {
  const store = setup()
  setMagnetSuspended(true)
  store.getState().moveFurniture('moving', 0.63, 0, 'pointer')
  assert.equal(x(store), 0.63)
  setMagnetSuspended(false)
  store.getState().moveFurniture('moving', 0.63, 0, 'pointer')
  assert.equal(x(store), 0.6)
})

test('sin magnetismo las guías no cambian el destino; sin guías no se publica nada', () => {
  const store = setup()
  store.getState().setMagnetism(false)
  store.getState().moveFurniture('moving', 0.63, 0, 'pointer')
  assert.equal(x(store), 0.63)
  store.getState().setGuides(false)
  store.getState().moveFurniture('moving', 0.2, 0, 'pointer')
  assert.deepEqual(store.getState().activeGuides, [])
})

test('salir de la tolerancia suelta el mueble sin saltos', () => {
  const store = setup()
  store.getState().moveFurniture('moving', 0.63, 0, 'pointer')
  assert.equal(x(store), 0.6)
  store.getState().moveFurniture('moving', 0.4, 0, 'pointer')
  assert.equal(x(store), 0.4)
})

test('teclado e inspector (sin puntero) nunca se atraen', () => {
  const store = setup()
  store.getState().moveFurniture('moving', 0.63, 0)
  assert.equal(x(store), 0.63)
})

test('las guías desaparecen al cancelar el gesto y no entran en el historial ni en el diseño', () => {
  const store = setup()
  const token = store.getState().beginHistoryGesture('moving')
  store.getState().moveFurniture('moving', 0.63, 0, 'pointer')
  assert.ok(store.getState().activeGuides.length > 0)
  store.getState().cancelHistoryGesture(token)
  assert.deepEqual(store.getState().activeGuides, [])
  const persisted = JSON.stringify(persistedDesign(store.getState()))
  assert.ok(!persisted.includes('activeGuides') && !persisted.includes('magnetism'))
})

test('una pasada completa con guías se deshace de una vez', () => {
  const store = setup()
  const token = store.getState().beginHistoryGesture('moving')
  for (const target of [-0.5, 0.2, 0.63]) store.getState().moveFurniture('moving', target, 0, 'pointer')
  store.getState().commitHistoryGesture(token)
  assert.equal(store.getState().undoCount, 1)
  store.getState().undo()
  assert.equal(x(store), -1)
})

test('un mueble bloqueado no se mueve ni se atrae', () => {
  const store = setup()
  store.getState().toggleElementLock('moving')
  store.getState().moveFurniture('moving', 0.63, 0, 'pointer')
  assert.equal(x(store), -1)
})

test('en vista frontal no hay guías ni imán de alineación', () => {
  const store = setup()
  store.getState().setView('front')
  store.getState().moveFurniture('moving', 0.63, 0, 'pointer')
  assert.equal(x(store), 0.63)
})

test('el imán de paredes obedece al interruptor y a Alt', () => {
  const near = (store: ReturnType<typeof createRoomStore>) => {
    const wallZ = -store.getState().room.depth / 2 + 0.2
    store.setState({ furniture: [chair('moving', 0, 0)] })
    store.getState().moveFurniture('moving', 0, wallZ + 0.04, 'pointer')
    return { z: store.getState().furniture[0].z, wallZ }
  }
  const on = near(createRoomStore())
  assert.ok(Math.abs(on.z - on.wallZ) < 1e-6, 'con magnetismo se pega a la pared')
  const off = createRoomStore(); off.getState().setMagnetism(false)
  const result = near(off)
  assert.ok(Math.abs(result.z - (result.wallZ + 0.04)) < 1e-6, 'apagado, sigue al puntero')
  setMagnetSuspended(true)
  const alt = near(createRoomStore())
  assert.ok(Math.abs(alt.z - (alt.wallZ + 0.04)) < 1e-6, 'con Alt, sigue al puntero')
})

test('«Ajuste a 5 cm» es independiente del magnetismo y cambia el paso del arrastre', () => {
  const store = createRoomStore()
  assert.equal(snapMovement(0.037), 0.05)
  setMovementSnap(false)
  assert.equal(snapMovement(0.037), 0.04)
  store.getState().setGridSnap(false)
  assert.equal(store.getState().gridSnap, false)
  assert.equal(store.getState().magnetismEnabled, true)
})

test('las preferencias no rompen sin almacenamiento y usan valores por defecto', () => {
  assert.deepEqual(loadEditorPreferences(), DEFAULT_EDITOR_PREFERENCES)
  const store = createRoomStore()
  assert.equal(store.getState().magnetismEnabled, true)
  assert.equal(store.getState().guidesEnabled, true)
})

test('un mueble fijado a la pared dibuja las guías donde queda, no donde está el puntero', () => {
  const store = createRoomStore()
  store.setState({ furniture: [chair('moving', 0, 0), chair('other', 1.5, -2)], selectedId: 'moving', selectedIds: ['moving'] })
  store.getState().setFurnitureWallAttachment('moving', true)
  const attached = store.getState().furniture.find((item) => item.id === 'moving')!
  store.getState().moveFurniture('moving', attached.x + 0.3, attached.z + 2, 'pointer')
  const gaps = store.getState().activeGuides.filter((guide) => guide.type === 'gap' && guide.axis === 'x')
  const final = store.getState().furniture.find((item) => item.id === 'moving')!
  assert.ok(Math.abs(final.z - attached.z) < 1e-6, 'sigue en la pared')
  for (const guide of gaps) if (guide.type === 'gap') assert.ok(Math.abs(guide.at - final.z) < 0.5, `la cota está junto al mueble (${guide.at} vs ${final.z})`)
})

test('activar o no el ajuste a 5 cm no cuenta como cambio nuevo y sobrevive a deshacer', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  store.setState({ hasUnsavedChanges: false })
  const undoBefore = store.getState().undoCount
  store.getState().setGridSnap(false)
  assert.equal(store.getState().gridSnap, false)
  assert.equal(store.getState().hasUnsavedChanges, false)
  assert.equal(store.getState().undoCount, undoBefore)
  store.getState().moveFurniture('moving-none', 1, 1)
  store.getState().undo()
  assert.equal(store.getState().gridSnap, false, 'deshacer otro cambio no revierte la ayuda')
})
