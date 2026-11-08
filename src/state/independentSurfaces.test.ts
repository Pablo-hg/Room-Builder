import assert from 'node:assert/strict'
import { test } from 'node:test'
import { structureGridElementId, structureSurfaceElementId } from '../domain/elementIds'
import { persistedDesign } from '../domain/designV1'
import { roomVerticalBounds } from '../domain/roomEditing'
import { normalizeDesignPreferences, normalizeStructurePacks } from '../domain/normalizeDesignV1'
import { createRoomStore } from './useRoomStore'
import { multiSelectionItems, multiSelectionBounds } from '../domain/multiSelection'
import { canPlaceAgainstIndependentSurfaces, surfaceIntersectsFurniture } from '../domain/structureCollisions'

test('las habitaciones se crean en las seis direcciones y agrupan todas sus superficies', () => {
  for (const [direction, axis, sign] of [['up', 'y', 1], ['down', 'y', -1], ['east', 'x', 1], ['west', 'x', -1], ['south', 'z', 1], ['north', 'z', -1]] as const) {
    const store = createRoomStore()
    store.getState().addStructurePack(direction)
    const state = store.getState()
    const pack = state.structurePacks[0]
    assert.deepEqual(normalizeStructurePacks(persistedDesign(state).structurePacks, state.room), [pack])
    if (axis === 'y') {
      const rootBounds = roomVerticalBounds(state.room)
      const createdBounds = roomVerticalBounds(state.room, { ...pack, y: 0 })
      const expected = sign > 0 ? rootBounds.top - createdBounds.bottom : rootBounds.bottom - createdBounds.top
      assert.ok(Math.abs(pack.y - expected) < 1e-9)
    } else {
      const distance = axis === 'x' ? state.room.width : state.room.depth
      assert.equal(pack[axis], sign * distance)
    }
    const folderId = state.elementFolderAssignments[pack.id]
    assert.ok(state.elementFolders.some((folder) => folder.id === folderId))
    for (const surface of pack.surfaces) assert.equal(state.elementFolderAssignments[structureSurfaceElementId(pack.id, surface.id)], folderId)
    state.selectElement(`folder:${folderId}`)
    store.getState().moveSelectedFurnitureGroupBy({ x: 0.5, y: 0, z: 0 })
    assert.equal(store.getState().structurePacks[0].x, pack.x + 0.5)
    store.getState().undo()
    store.getState().undo()
    assert.equal(store.getState().structurePacks.length, 0)
    assert.equal(store.getState().elementFolders.length, 1)
  }
})

test('recupera los packs y sus carpetas de un diseño guardado', () => {
  const original = createRoomStore()
  original.getState().addStructurePack('up')
  const data = JSON.parse(JSON.stringify(persistedDesign(original.getState())))
  const repository = { read: () => [{ id: 'guardado', name: 'Casa', savedAt: '', data }], write: () => {} }
  const restored = createRoomStore(repository)
  restored.getState().initializeSavedDesigns()
  restored.getState().loadDesign('guardado')
  assert.equal(restored.getState().notice, 'Diseño recuperado.')
  assert.deepEqual(restored.getState().structurePacks, original.getState().structurePacks)
  assert.deepEqual(restored.getState().elementFolders, original.getState().elementFolders)
  assert.deepEqual(restored.getState().elementFolderAssignments, original.getState().elementFolderAssignments)
})

test('los muebles pueden cruzar los límites de la habitación y guardar su posición', () => {
  const original = createRoomStore()
  original.getState().addFurniture('chair')
  const id = original.getState().selectedId!
  original.getState().moveFurniture(id, 5, -5)
  original.getState().moveFurnitureVertically(id, -1)
  assert.deepEqual([original.getState().furniture[0].x, original.getState().furniture[0].y, original.getState().furniture[0].z], [5, -1, -5])
  const data = JSON.parse(JSON.stringify(persistedDesign(original.getState())))
  const repository = { read: () => [{ id: 'guardado', name: 'Casa', savedAt: '', data }], write: () => {} }
  const restored = createRoomStore(repository)
  restored.getState().initializeSavedDesigns()
  restored.getState().loadDesign('guardado')
  assert.deepEqual([restored.getState().furniture[0].x, restored.getState().furniture[0].y, restored.getState().furniture[0].z], [5, -1, -5])
  restored.getState().setDimension('width', 6)
  assert.deepEqual([restored.getState().furniture[0].x, restored.getState().furniture[0].y, restored.getState().furniture[0].z], [5, -1, -5])
  original.getState().undo()
  assert.equal(original.getState().furniture[0].y, 0)
})

test('una selección de muebles atraviesa el techo como conjunto', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const first = store.getState().selectedId!
  store.getState().addFurniture('chair')
  const second = store.getState().selectedId!
  store.getState().selectSceneListItem(first, 'single', [first, second])
  store.getState().selectSceneListItem(second, 'toggle', [first, second])
  store.getState().moveSelectedFurnitureGroup('y', 4)
  assert.deepEqual(store.getState().furniture.map((item) => item.y), [4, 4])
  store.getState().undo()
  assert.deepEqual(store.getState().furniture.map((item) => item.y), [0, 0])
})

test('renombrar y eliminar el pack mantiene coherente su carpeta sin borrar otros elementos', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  const folder = store.getState().elementFolderAssignments[pack.id]
  assert.equal(store.getState().selectedId, `folder:${folder}`)
  store.getState().renameElementFolder(folder, 'Estudio')
  assert.equal(store.getState().structurePacks[0].name, 'Estudio')
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  store.getState().moveElementToFolder(chair, folder)
  store.getState().removeStructurePack(pack.id)
  assert.equal(store.getState().structurePacks.length, 0)
  assert.equal(store.getState().elementFolderAssignments[chair], folder)
  assert.ok(store.getState().elementFolders.some((item) => item.id === folder))
  store.getState().undo()
  assert.equal(store.getState().structurePacks[0].name, 'Estudio')
})

test('borrar una carpeta de habitación elimina sus contenidos y subcarpetas en una acción reversible', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  const folder = store.getState().elementFolderAssignments[pack.id]
  store.getState().createElementFolder('Interior', undefined, folder)
  const child = store.getState().elementFolders.find((item) => item.parentId === folder)!.id
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  store.getState().moveElementToFolder(chair, child)
  store.getState().deleteElementFolder(folder)
  assert.equal(store.getState().structurePacks.length, 0)
  assert.equal(store.getState().furniture.length, 0)
  assert.equal(store.getState().elementFolders.length, 1)
  store.getState().undo()
  assert.equal(store.getState().structurePacks[0].id, pack.id)
  assert.equal(store.getState().elementFolderAssignments[chair], child)
  assert.equal(store.getState().elementFolders.length, 3)
  store.getState().redo()
  assert.equal(store.getState().structurePacks.length, 0)
  assert.equal(store.getState().furniture.length, 0)
})

test('desagrupar una habitación conserva el pack y la puerta principal impide borrar su carpeta', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  const folder = store.getState().elementFolderAssignments[pack.id]
  store.getState().moveElementToFolder('door', folder)
  store.getState().deleteElementFolder(folder)
  assert.equal(store.getState().structurePacks.length, 1)
  assert.match(store.getState().notice, /puerta principal/)
  store.getState().deleteElementFolder(folder, 'ungroup')
  assert.equal(store.getState().elementFolders.length, 1)
  assert.equal(store.getState().structurePacks[0].id, pack.id)
})

test('las superficies independientes nacen en el centro de la habitación y se pueden mover', () => {
  for (const kind of ['floor', 'wall'] as const) {
    const store = createRoomStore()
    store.getState().addStructureObject(kind)
    const { room, structurePacks, selectedId } = store.getState()
    const pack = structurePacks[0]
    const surface = pack.surfaces[0]
    assert.equal(pack.x + surface.x, 0)
    assert.equal(pack.y + surface.y + (kind === 'wall' ? room.height / 2 : 0), room.height / 2)
    assert.equal(pack.z + surface.z - (kind === 'wall' ? room.depth / 2 : 0), 0)
    assert.equal(selectedId, structureSurfaceElementId(pack.id, surface.id))
    for (const axis of ['x', 'y', 'z'] as const) {
      store.getState().moveStructureSurface(pack.id, surface.id, axis, 1.25)
      assert.equal(store.getState().structurePacks[0].surfaces[0][axis], 1.25)
    }
  }
})

test('la visibilidad de cuadrícula se conserva en v1 y se limpia al eliminar la superficie', () => {
  for (const kind of ['floor', 'wall'] as const) {
    const store = createRoomStore()
    store.getState().addStructureObject(kind)
    const pack = store.getState().structurePacks[0]
    const id = structureGridElementId(pack.id, pack.surfaces[0].id)
    store.getState().toggleElementVisibility(id)
    assert.ok(normalizeDesignPreferences(persistedDesign(store.getState())).hiddenElementIds.includes(id))
    store.getState().removeSelected()
    assert.ok(!store.getState().hiddenElementIds.includes(id))
  }
})

test('permite modificar el grosor de cada superficie en centímetros enteros', () => {
  for (const kind of ['floor', 'wall'] as const) {
    const store = createRoomStore()
    store.getState().addStructureObject(kind)
    const pack = store.getState().structurePacks[0]
    const surface = pack.surfaces[0]
    const dimension = kind === 'floor' ? 'height' : 'depth'
    assert.equal(surface[dimension], 0.13)
    store.getState().resizeStructureSurface(pack.id, surface.id, dimension, 0.25)
    assert.equal(store.getState().structurePacks[0].surfaces[0][dimension], 0.25)
    store.getState().resizeStructureSurface(pack.id, surface.id, dimension, 0.06)
    assert.equal(store.getState().structurePacks[0].surfaces[0][dimension], 0.06)
    store.getState().undo()
    assert.equal(store.getState().structurePacks[0].surfaces[0][dimension], 0.25)
  }
})

test('las posiciones y dimensiones de las superficies admiten centímetros enteros', () => {
  const store = createRoomStore()
  store.getState().addStructureObject('floor')
  const pack = store.getState().structurePacks[0]
  const surface = pack.surfaces[0]
  store.getState().moveStructureSurface(pack.id, surface.id, 'x', 1.3)
  store.getState().moveStructureSurface(pack.id, surface.id, 'z', 0.31)
  store.getState().resizeStructureSurface(pack.id, surface.id, 'width', 2.8)
  store.getState().resizeStructureSurface(pack.id, surface.id, 'height', 0.19)
  const moved = store.getState().structurePacks[0].surfaces[0]
  assert.equal(moved.x, 1.3)
  assert.equal(moved.z, 0.31)
  assert.equal(moved.width, 2.8)
  assert.equal(moved.height, 0.19)
})

test('permite soltar una superficie atravesando un mueble y deshacer', () => {
  const store = createRoomStore()
  store.getState().addStructureObject('floor')
  const pack = store.getState().structurePacks[0]
  const surface = pack.surfaces[0]
  const surfaceId = structureSurfaceElementId(pack.id, surface.id)
  store.getState().addFurniture('chair')
  const originalY = surface.y
  const token = store.getState().beginHistoryGesture(surfaceId)
  store.getState().moveStructureSurface(pack.id, surface.id, 'y', 0.5)
  assert.equal(store.getState().structurePacks[0].surfaces[0].y, 0.5)
  assert.equal(surfaceIntersectsFurniture(store.getState(), surfaceId), true)
  assert.equal(canPlaceAgainstIndependentSurfaces(store.getState(), store.getState().furniture[0]), false)
  assert.equal(store.getState().notice, '')
  store.getState().commitHistoryGesture(token)
  assert.equal(store.getState().structurePacks[0].surfaces[0].y, 0.5)
  store.getState().undo()
  assert.equal(store.getState().structurePacks[0].surfaces[0].y, originalY)
})

test('conserva la posición del gesto al soltar sobre un mueble', () => {
  const store = createRoomStore()
  store.getState().addStructureObject('floor')
  const pack = store.getState().structurePacks[0]
  const surface = pack.surfaces[0]
  const surfaceId = structureSurfaceElementId(pack.id, surface.id)
  store.getState().addFurniture('chair')
  const token = store.getState().beginHistoryGesture(surfaceId)
  store.getState().moveStructureSurface(pack.id, surface.id, 'y', 0.5)
  store.getState().moveStructureSurface(pack.id, surface.id, 'y', 1)
  store.getState().moveStructureSurface(pack.id, surface.id, 'y', 0.5)
  store.getState().commitHistoryGesture(token)
  assert.equal(store.getState().structurePacks[0].surfaces[0].y, 0.5)
})

test('permite atravesar la pared con un mueble y soltarlo dentro', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  store.getState().moveFurniture(store.getState().furniture[0].id, 0, 1)
  store.getState().addStructureObject('wall')
  const item = store.getState().furniture[0]
  const token = store.getState().beginHistoryGesture(item.id)
  store.getState().moveFurniture(item.id, item.x, 0)
  assert.equal(store.getState().furniture[0].z, 0)
  assert.equal(canPlaceAgainstIndependentSurfaces(store.getState(), store.getState().furniture[0]), false)
  store.getState().moveFurniture(item.id, item.x, -item.z)
  store.getState().commitHistoryGesture(token)
  assert.equal(store.getState().furniture[0].z, -item.z)
  store.getState().undo()
  assert.equal(store.getState().furniture[0].z, item.z)
  const second = store.getState().beginHistoryGesture(item.id)
  store.getState().moveFurniture(item.id, item.x, 0)
  store.getState().commitHistoryGesture(second)
  assert.equal(store.getState().furniture[0].z, 0)
})

test('seleccionar suelo y pared superpuestos conserva sus posiciones y crea un único volumen', () => {
  const store = createRoomStore()
  store.getState().addStructureObject('floor')
  const floor = store.getState().selectedId!
  store.getState().addStructureObject('wall')
  const wall = store.getState().selectedId!
  const before = structuredClone(store.getState().structurePacks)
  store.getState().selectSceneListItem(floor, 'single', [floor, wall])
  store.getState().selectSceneListItem(wall, 'toggle', [floor, wall])
  assert.deepEqual(store.getState().structurePacks, before)
  const selected = multiSelectionItems(store.getState())
  assert.deepEqual(new Set(selected.map((item) => item.id)), new Set([floor, wall]))
  const bounds = multiSelectionBounds(selected)!
  for (const item of selected) for (const axis of ['x', 'y', 'z'] as const) {
    assert.ok(bounds.min[axis] <= item.min[axis])
    assert.ok(bounds.max[axis] >= item.max[axis])
  }
})

test('permite que un mueble atraviese una pared con un salto grande', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  store.getState().moveFurniture(store.getState().furniture[0].id, 0, 1)
  store.getState().addStructureObject('wall')
  const item = store.getState().furniture[0]
  assert.ok(Math.abs(item.z) > 0.25)
  const history = store.getState().undoCount
  store.getState().moveFurniture(item.id, item.x, -item.z)
  assert.equal(store.getState().furniture[0].z, -item.z)
  assert.equal(store.getState().undoCount, history + 1)
})

test('permite unir un suelo y una pared independientes sin bloquear el cruce', () => {
  const store = createRoomStore()
  store.getState().addStructureObject('floor')
  const floor = store.getState().structurePacks[0]
  store.getState().addStructureObject('wall')
  const wall = store.getState().structurePacks[1]
  store.getState().moveStructureSurface(floor.id, 'floor', 'x', 1.25)
  store.getState().moveStructureSurface(wall.id, 'wall-north', 'x', -1.25)
  assert.equal(store.getState().structurePacks[0].surfaces[0].x, 1.25)
  assert.equal(store.getState().structurePacks[1].surfaces[0].x, -1.25)
  assert.equal(store.getState().notice, '')
})

test('permite crear una pared independiente aunque haya un mueble en el centro', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  store.getState().addStructureObject('wall')
  assert.equal(store.getState().structurePacks.length, 1)
  assert.ok(store.getState().selectedId?.startsWith('structure-surface:'))
})

test('permite girar una pared a través de un mueble', () => {
  const store = createRoomStore()
  store.getState().addStructureObject('wall')
  const pack = store.getState().structurePacks[0]
  store.getState().addFurniture('chair')
  const chair = store.getState().furniture[0]
  store.setState({ furniture: [{ ...chair, x: 1.5, z: -1.5 }] })
  const history = store.getState().undoCount
  store.getState().setStructureSurfaceRotation(pack.id, 'wall-north', Math.PI / 2)
  assert.equal(store.getState().structurePacks[0].surfaces[0].rotation, Math.PI / 2)
  assert.equal(store.getState().undoCount, history + 1)
})

test('permite trasladar una pared a través de un mueble', () => {
  const store = createRoomStore()
  store.getState().addStructureObject('wall')
  const pack = store.getState().structurePacks[0]
  store.getState().addFurniture('chair')
  const chair = store.getState().furniture[0]
  store.setState({ furniture: [{ ...chair, x: 0, z: -1.5 }] })
  const history = store.getState().undoCount
  store.getState().moveStructureSurface(pack.id, 'wall-north', 'z', -0.75)
  assert.equal(store.getState().structurePacks[0].surfaces[0].z, -0.75)
  assert.equal(store.getState().undoCount, history + 1)
})

test('permite desplazar o ampliar una superficie hasta atravesar un mueble', () => {
  const store = createRoomStore()
  store.getState().addStructureObject('floor')
  const floor = store.getState().structurePacks[0]
  store.getState().addFurniture('chair')
  store.getState().moveStructureSurface(floor.id, 'floor', 'y', 0.5)
  assert.equal(store.getState().structurePacks[0].surfaces[0].y, 0.5)
  store.getState().resizeStructureSurface(floor.id, 'floor', 'height', 2)
  assert.equal(store.getState().structurePacks[0].surfaces[0].height, 2)
})

test('conserva los solapamientos anteriores y permite separar los elementos', () => {
  const store = createRoomStore()
  store.getState().addStructureObject('floor')
  store.getState().addFurniture('chair')
  const chair = store.getState().furniture[0]
  store.setState({ furniture: [{ ...chair, y: 1 }] })
  store.getState().moveFurnitureVertically(chair.id, 0)
  assert.equal(store.getState().furniture[0].y, 0)
  store.getState().undo()
  assert.equal(store.getState().furniture[0].y, 1)
})

test('borrar una superficie independiente elimina también su contenedor interno y permite deshacer', () => {
  for (const kind of ['floor', 'wall'] as const) {
    const store = createRoomStore()
    store.getState().addStructureObject(kind)
    assert.equal(store.getState().structurePacks.length, 1)
    const pack = store.getState().structurePacks[0]
    store.getState().removeSelected()
    assert.equal(store.getState().structurePacks.length, 0)
    assert.equal(store.getState().elementFolderAssignments[pack.id], undefined)
    store.getState().undo()
    assert.equal(store.getState().structurePacks.length, 1)
    store.getState().removeStructureSurface(pack.id, pack.surfaces[0].id)
    assert.equal(store.getState().structurePacks.length, 0)
  }
})
