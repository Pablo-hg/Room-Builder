import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cameraSeesInside, catalogDragPlacement, createdCatalogElement, exceedsDragThreshold, inwardNormal, nearestWallSnap,
  openingOwner, openingRoomFrame, outsideWallDistance, structureObjectSurfaceId, wallBelongsTo, wallIdFromMesh, wallPlacementAt,
} from './catalogDrag'
import { persistedDesign } from './designV1'
import { wallObjectPosition } from './wallObjectPlacement'
import { physicalWalls } from './wallConnections'
import { createRoomStore } from '../state/useRoomStore'

test('pulsar sin moverse sigue siendo un clic; a partir de 6 px es un arrastre', () => {
  assert.equal(exceedsDragThreshold({ x: 10, y: 10 }, { x: 14, y: 13 }), false)
  assert.equal(exceedsDragThreshold({ x: 10, y: 10 }, { x: 16, y: 10 }), true)
})

test('muebles y construcción van al suelo; aperturas y objetos de pared, a una pared', () => {
  assert.equal(catalogDragPlacement({ type: 'furniture', kind: 'sofa' }), 'floor')
  assert.equal(catalogDragPlacement({ type: 'furniture', kind: 'ceilingLamp' }), 'floor')
  assert.equal(catalogDragPlacement({ type: 'structure', kind: 'wall' }), 'floor')
  assert.equal(catalogDragPlacement({ type: 'wall-object', shape: 'pictureSmall' }), 'wall')
  assert.equal(catalogDragPlacement({ type: 'door' }), 'wall')
})

test('reconoce lo que ha creado el catálogo y nada más', () => {
  const store = createRoomStore()
  const before = persistedDesign(store.getState())
  assert.equal(createdCatalogElement(before, before), null)
  store.getState().addFurniture('sofa')
  const withSofa = persistedDesign(store.getState())
  const sofa = createdCatalogElement(before, withSofa)
  assert.ok(sofa && withSofa.furniture.some((item) => item.id === sofa))
  store.getState().addWindow('rectangular')
  const withWindow = persistedDesign(store.getState())
  const window = createdCatalogElement(withSofa, withWindow)!
  assert.ok(withWindow.room.windows.some((item) => item.id === window))
  assert.equal(openingOwner(withWindow, window), null)
  store.getState().addStructureObject('floor')
  const withFloor = persistedDesign(store.getState())
  const pack = createdCatalogElement(withWindow, withFloor)!
  assert.ok(withFloor.structurePacks!.some((item) => item.id === pack))
  assert.equal(store.getState().selectedId, structureObjectSurfaceId(pack, 'floor'))
})

test('el dueño de una apertura de otra habitación es esa habitación', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const packId = store.getState().structurePacks[0].id
  const design = persistedDesign(store.getState())
  const withDoor = { ...design, structurePacks: design.structurePacks!.map((pack) => ({ ...pack, doors: [{ ...design.room.door, id: 'd-1' }] })) }
  assert.equal(openingOwner(withDoor, 'd-1'), packId)
  assert.equal(openingOwner(withDoor, 'no-existe'), undefined)
})

test('crear y mover en un gesto es un único paso de deshacer; revertir no deja rastro', () => {
  const store = createRoomStore()
  const before = store.getState().furniture.length
  const undoBefore = store.getState().undoCount
  // Igual que el arrastre del catálogo: se crea y el gesto se abre después (crear selecciona y cerraría uno ya abierto).
  const first = persistedDesign(store.getState())
  store.getState().addFurniture('chair')
  const kept = store.getState().continueHistoryGesture(first, null)
  const id = store.getState().selectedId!
  store.getState().moveFurniture(id, 0.5, 0.5, 'pointer')
  store.getState().moveFurniture(id, 0.8, 0.4, 'pointer')
  store.getState().commitHistoryGesture(kept)
  assert.equal(store.getState().furniture.length, before + 1)
  store.getState().undo()
  assert.equal(store.getState().furniture.length, before, 'un solo deshacer elimina crear + mover')
  store.getState().redo()
  const afterCommit = store.getState().undoCount
  const second = persistedDesign(store.getState())
  store.getState().addFurniture('chair')
  const reverted = store.getState().continueHistoryGesture(second, null)
  store.getState().moveFurniture(store.getState().selectedId!, 1, 1, 'pointer')
  store.getState().revertHistoryGesture(reverted)
  assert.equal(store.getState().furniture.length, before + 1, 'la segunda silla desaparece')
  assert.equal(store.getState().undoCount, afterCommit, 'sin paso nuevo en el historial')
  assert.equal(store.getState().selectedId, null)
  assert.ok(undoBefore <= afterCommit)
})

test('el zócalo apunta a su pared y solo valen las paredes de la misma habitación', () => {
  assert.equal(wallIdFromMesh('room-wall:north:baseboard'), 'room-wall:north')
  assert.equal(wallIdFromMesh('structure-surface:p:wall-east'), 'structure-surface:p:wall-east')
  assert.equal(wallIdFromMesh(undefined), null)
  assert.equal(wallBelongsTo({}, null), true)
  assert.equal(wallBelongsTo({ packId: 'p' }, null), false)
  assert.equal(wallBelongsTo({ packId: 'p' }, 'p'), true)
})

test('la posición en la pared es la inversa exacta de wallObjectPosition en las cuatro paredes', () => {
  const store = createRoomStore()
  const state = store.getState()
  const window = state.room.windows[0]
  for (const wall of physicalWalls(state).filter((item) => !item.packId)) {
    const placed = { ...window, wall: wall.side, offset: 0.4, sill: 0.9, wallPosition: undefined, freePosition: undefined }
    const point = wallObjectPosition(state.room, placed)
    const result = wallPlacementAt(wall, { ...point, y: point.y + placed.height / 2 }, 0, placed.height)
    assert.ok(Math.abs(result.offset - 0.4) < 1e-9, `${wall.side}: ${result.offset}`)
    assert.ok(Math.abs(result.sill - point.y) < 1e-9, `${wall.side} alféizar`)
  }
  assert.equal(wallPlacementAt({ x: 0, z: 0, yaw: 0 }, { x: 0, y: 0.1, z: 0 }, 0, 1).sill, 0, 'nunca por debajo del suelo')
})

test('la normal interior apunta al centro de la habitación y decide qué paredes ve la cámara', () => {
  const north = { x: 0, z: -2, yaw: 0 }
  assert.deepEqual(inwardNormal(north, { x: 0, z: 0 }), { x: 0, z: 1 })
  const south = { x: 0, z: 2, yaw: Math.PI }
  const inward = inwardNormal(south, { x: 0, z: 0 })
  assert.ok(Math.abs(inward.z + 1) < 1e-9)
  // Cámara isométrica delante (sur-este): ve la cara interior de la pared norte, no la de la sur.
  assert.equal(cameraSeesInside(north, inwardNormal(north, { x: 0, z: 0 }), { x: 8, z: 8 }), true)
  assert.equal(cameraSeesInside(south, inward, { x: 8, z: 8 }), false)
})

test('fuera de la pared: distancia en su plano; sobre ella, cero', () => {
  const wall = { width: 4, height: 2.5 }
  assert.equal(outsideWallDistance(wall, { offset: 1, sill: 1 }, 0.5), 0)
  assert.ok(Math.abs(outsideWallDistance(wall, { offset: 3, sill: 1 }, 0.5) - 1) < 1e-9)
  assert.ok(outsideWallDistance(wall, { offset: 0, sill: 0, rawSill: -0.4 }, 0.5) > 0, 'por debajo del suelo no está sobre la pared')
})

test('un objeto libre se fija a la pared de su habitación solo cerca y dentro de ella', () => {
  const state = createRoomStore().getState()
  const walls = physicalWalls(state).filter((wall) => !wall.packId)
  const north = walls.find((wall) => wall.side === 'north')!
  const frame = openingRoomFrame(state.room)
  assert.deepEqual(frame, { center: { x: 0, z: 0 }, floorY: 0 })
  const innerFace = north.z + north.depth / 2
  const near = nearestWallSnap(walls, frame.center, 0, { x: 0.5, y: 1.4, z: innerFace + 0.1 }, 0.5)
  assert.equal(near?.wall.side, 'north')
  assert.ok(Math.abs(near!.sill - 1.15) < 1e-9)
  assert.equal(nearestWallSnap(walls, frame.center, 0, { x: 0.5, y: 1.4, z: innerFace + 0.5 }, 0.5), null, 'demasiado lejos')
  assert.equal(nearestWallSnap(walls, frame.center, 0, { x: 30, y: 1.4, z: innerFace + 0.1 }, 0.5), null, 'fuera del ancho de la pared')
})

test('un objeto de pared se puede dejar libre con posición y orientación, sin cambiar de habitación', () => {
  const store = createRoomStore()
  const id = store.getState().room.windows[0].id
  store.getState().setWallObjectFreePosition(id, { x: 0.2, y: 1, z: -0.5, yaw: Math.PI / 2 })
  const window = store.getState().room.windows.find((item) => item.id === id)!
  assert.deepEqual(window.freePosition, { x: 0.2, y: 1, z: -0.5, yaw: Math.PI / 2 })
  assert.equal(window.wallPosition, undefined)
  store.getState().setWallObjectFreePosition(id, { x: Number.NaN, y: 1, z: 0, yaw: 0 })
  assert.equal(store.getState().room.windows.find((item) => item.id === id)!.freePosition!.x, 0.2, 'ignora valores no finitos')
  store.getState().updateWindow(id, { wall: window.wall })
  assert.equal(store.getState().room.windows.find((item) => item.id === id)!.freePosition, undefined, 'marcar la casilla lo vuelve a fijar')
})
