import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_FLOOR_COLOR } from '../domain/constants'
import { structureSurfaceElementId } from '../domain/elementIds'
import { BASE_FLOOR_ID, baseWallId } from '../domain/elementFolders'
import { persistedDesign } from '../domain/designV1'
import type { MaterialFinish } from '../domain/materials'
import { DEFAULT_PAINT_FINISH, elementFinish, paintTargetId, paintTargetLabel } from '../domain/paintTool'
import { createRoomStore } from './useRoomStore'

const OAK: MaterialFinish = { id: 'oak', color: '#c9a06c', scale: 2, rotation: 90 }
const BRICK: MaterialFinish = { id: 'brick', color: '#b5503c', scale: 1, rotation: 0 }

/** Habitación con un sofá y una habitación añadida al este; devuelve los identificadores útiles. */
function scene() {
  const store = createRoomStore()
  store.getState().addFurniture('sofa')
  const sofaId = store.getState().selectedId!
  store.getState().addStructurePack('east')
  const pack = store.getState().structurePacks[0]
  return { store, sofaId, pack, packFloorId: structureSurfaceElementId(pack.id, 'floor') }
}

test('el acabado de un elemento es su material o su color como pintura lisa', () => {
  const { store, sofaId } = scene()
  const state = store.getState()
  assert.deepEqual(elementFinish(state, BASE_FLOOR_ID), { id: 'paint', color: DEFAULT_FLOOR_COLOR, scale: 1, rotation: 0 })
  assert.equal(elementFinish(state, sofaId)?.id, 'paint')
  store.getState().setMaterialFinish(sofaId, OAK)
  assert.deepEqual(elementFinish(store.getState(), sofaId), OAK)
  store.getState().setMaterialFinish(BASE_FLOOR_ID, BRICK)
  assert.deepEqual(elementFinish(store.getState(), BASE_FLOOR_ID), BRICK)
  assert.equal(elementFinish(store.getState(), baseWallId('north'))?.id, 'paint')
  assert.equal(elementFinish(store.getState(), 'no-existe'), null)
})

test('un elemento de una habitación añadida se lee y se nombra con su habitación', () => {
  const { store, pack, packFloorId } = scene()
  assert.ok(elementFinish(store.getState(), packFloorId))
  assert.match(paintTargetLabel(store.getState(), packFloorId) ?? '', new RegExp(pack.name))
  assert.equal(paintTargetLabel(store.getState(), BASE_FLOOR_ID), 'Suelo')
  assert.equal(paintTargetLabel(store.getState(), 'no-existe'), 'no-existe', 'un id desconocido cae al nombre por defecto de la selección')
})

test('el identificador pintable sale de los datos del objeto de la escena', () => {
  assert.equal(paintTargetId({ structureSurfaceId: 'structure-surface:p:floor', wallId: 'x' }), 'structure-surface:p:floor')
  assert.equal(paintTargetId({ wallId: 'room-wall:north:baseboard' }), 'room-wall:north')
  assert.equal(paintTargetId({ wallId: 'structure-surface:p:wall-east' }), 'structure-surface:p:wall-east')
  assert.equal(paintTargetId({ elementId: 'sofa-1' }), 'sofa-1')
  assert.equal(paintTargetId({ selectionGizmo: true }), null)
  assert.equal(paintTargetId({}), null)
})

test('al activar Pintar el pincel parte del elemento seleccionado o de pintura lisa', () => {
  const { store, sofaId } = scene()
  store.getState().selectElement(null)
  store.getState().startPaintTool()
  assert.deepEqual(store.getState().paintTool, { mode: 'paint', finish: DEFAULT_PAINT_FINISH })
  store.getState().stopPaintTool()
  assert.equal(store.getState().paintTool, null)
  store.getState().setMaterialFinish(sofaId, OAK)
  store.getState().selectElement(sofaId)
  store.getState().startPaintTool()
  assert.deepEqual(store.getState().paintTool?.finish, OAK)
})

test('pintar aplica el pincel solo al aspecto: no mueve ni redimensiona, y se deshace por pincelada', () => {
  const { store, sofaId } = scene()
  const before = store.getState().furniture.find((item) => item.id === sofaId)!
  store.getState().startPaintTool()
  store.getState().setPaintFinish(BRICK)
  const undoBefore = store.getState().undoCount
  assert.equal(store.getState().applyPaint(sofaId), true)
  const painted = store.getState().furniture.find((item) => item.id === sofaId)!
  assert.deepEqual(painted.material, BRICK)
  assert.deepEqual({ x: painted.x, y: painted.y, z: painted.z, width: painted.width, depth: painted.depth, height: painted.height, rotation: painted.rotation },
    { x: before.x, y: before.y, z: before.z, width: before.width, depth: before.depth, height: before.height, rotation: before.rotation })
  assert.match(store.getState().notice, /Pintado/)
  assert.equal(store.getState().undoCount, undoBefore + 1, 'una pincelada es un paso de historial')
  store.getState().undo()
  assert.equal(store.getState().furniture.find((item) => item.id === sofaId)!.material, undefined)
  store.getState().redo()
  assert.deepEqual(store.getState().furniture.find((item) => item.id === sofaId)!.material, BRICK)
})

test('pintar el suelo, una pared y una superficie de otra habitación', () => {
  const { store, packFloorId } = scene()
  store.getState().startPaintTool()
  store.getState().setPaintFinish(OAK)
  for (const id of [BASE_FLOOR_ID, baseWallId('east'), packFloorId]) assert.equal(store.getState().applyPaint(id), true, id)
  assert.deepEqual(store.getState().room.floorMaterial, OAK)
  assert.deepEqual(store.getState().room.wallMaterials?.east, OAK)
  const floor = store.getState().structurePacks[0].surfaces.find((surface) => structureSurfaceElementId(store.getState().structurePacks[0].id, surface.id) === packFloorId)!
  assert.deepEqual(floor.material, OAK)
  assert.equal(store.getState().room.wallMaterials?.north, undefined, 'las demás paredes no cambian')
})

test('un elemento bloqueado no se pinta, avisa y no deja historial', () => {
  const { store, sofaId } = scene()
  store.getState().toggleElementLock(sofaId)
  store.getState().startPaintTool()
  store.getState().setPaintFinish(BRICK)
  const undoBefore = store.getState().undoCount
  assert.equal(store.getState().applyPaint(sofaId), false)
  assert.match(store.getState().notice, /Desbloquea/)
  assert.equal(store.getState().furniture.find((item) => item.id === sofaId)!.material, undefined)
  assert.equal(store.getState().undoCount, undoBefore)
})

test('con la herramienta apagada no se pinta, y un elemento inexistente avisa', () => {
  const { store, sofaId } = scene()
  assert.equal(store.getState().applyPaint(sofaId), false)
  store.getState().startPaintTool()
  assert.equal(store.getState().applyPaint('no-existe'), false)
  assert.ok(store.getState().notice, 'avisa de que no hay nada que pintar')
})

test('el cuentagotas copia solo el aspecto y vuelve al pincel; el origen no cambia', () => {
  const { store, sofaId } = scene()
  store.getState().setMaterialFinish(sofaId, OAK)
  const source = store.getState().furniture.find((item) => item.id === sofaId)!
  const roomSize = { width: store.getState().room.width, depth: store.getState().room.depth, height: store.getState().room.height }
  store.getState().startPaintTool()
  store.getState().setPaintMode('eyedropper')
  assert.equal(store.getState().samplePaint(sofaId), true)
  assert.deepEqual(store.getState().paintTool, { mode: 'paint', finish: OAK })
  assert.match(store.getState().notice, /copiado/i)
  assert.deepEqual(store.getState().furniture.find((item) => item.id === sofaId), source, 'copiar no modifica el origen')
  assert.equal(store.getState().applyPaint(BASE_FLOOR_ID), true)
  assert.deepEqual(store.getState().room.floorMaterial, OAK)
  assert.deepEqual({ width: store.getState().room.width, depth: store.getState().room.depth, height: store.getState().room.height }, roomSize, 'pintar no cambia las dimensiones')
})

test('el cuentagotas avisa si no hay nada que copiar y no cambia el pincel', () => {
  const { store } = scene()
  store.getState().startPaintTool()
  store.getState().setPaintFinish(BRICK)
  assert.equal(store.getState().samplePaint('no-existe'), false)
  assert.match(store.getState().notice, /no tiene un acabado/)
  assert.deepEqual(store.getState().paintTool?.finish, BRICK)
  store.getState().setPaintHover('x')
  assert.equal(store.getState().paintHoverId, 'x')
})

test('un pincel inválido se rechaza con aviso y la herramienta no entra en el diseño guardado', () => {
  const { store } = scene()
  const designBefore = JSON.stringify(persistedDesign(store.getState()))
  const undoBefore = store.getState().undoCount
  store.getState().startPaintTool()
  store.getState().setPaintFinish({ id: 'inventado', color: '#fff', scale: 1, rotation: 0 } as unknown as MaterialFinish)
  assert.match(store.getState().notice, /no es válido/)
  assert.deepEqual(store.getState().paintTool?.finish, DEFAULT_PAINT_FINISH)
  assert.equal(JSON.stringify(persistedDesign(store.getState())), designBefore, 'la herramienta es de sesión')
  assert.equal(store.getState().undoCount, undoBefore)
})

test('pintar la selección aplica el mismo material a varios elementos en un solo paso de deshacer', () => {
  const { store, sofaId } = scene()
  store.getState().addFurniture('chair')
  const chairId = store.getState().selectedId!
  store.getState().toggleElementLock(chairId)
  store.getState().startPaintTool()
  store.getState().setPaintFinish(OAK)
  const undoBefore = store.getState().undoCount
  assert.equal(store.getState().applyPaintToMany([sofaId, BASE_FLOOR_ID, chairId]), 2, 'la silla bloqueada se salta')
  assert.match(store.getState().notice, /Pintados 2 elementos · 1 sin pintar/)
  assert.deepEqual(store.getState().furniture.find((item) => item.id === sofaId)!.material, OAK)
  assert.deepEqual(store.getState().room.floorMaterial, OAK)
  assert.equal(store.getState().furniture.find((item) => item.id === chairId)!.material, undefined)
  assert.equal(store.getState().undoCount, undoBefore + 1, 'un único paso de historial')
  store.getState().undo()
  assert.equal(store.getState().furniture.find((item) => item.id === sofaId)!.material, undefined)
  assert.equal(store.getState().room.floorMaterial, undefined)
  assert.equal(store.getState().applyPaintToMany([]), 0)
})
