import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { ROOT_ROOM_FOLDER } from '../domain/elementFolders'
import { structureSurfaceElementId } from '../domain/elementIds'
import { focusedCreationTarget, surfacePosition } from '../domain/roomEditing'
import { persistedDesign } from '../domain/designV1'

const eq = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)

test('la habitación principal es el destino por defecto de muebles y superficies', () => {
  const store = createRoomStore()
  store.getState().addFurniture('chair')
  const chair = store.getState().selectedId!
  assert.equal(store.getState().elementFolderAssignments[chair], ROOT_ROOM_FOLDER)
  store.getState().addStructureObject('floor')
  const surfaceId = store.getState().selectedId!
  assert.equal(store.getState().elementFolderAssignments[surfaceId], ROOT_ROOM_FOLDER)
  assert.ok(store.getState().structurePacks.some((pack) => pack.id.startsWith('floor-object-')))
})

for (const direction of ['up', 'east'] as const) {
  test(`los objetos y superficies se crean en la habitación enfocada ${direction}`, () => {
    const store = createRoomStore()
    store.getState().addStructurePack(direction)
    const focusedPack = store.getState().structurePacks.find((pack) => pack.id === store.getState().activeRoomId)!
    const target = focusedCreationTarget(store.getState())
    assert.ok(target.folderId)
    store.getState().addFurniture('chair')
    const chairId = store.getState().selectedId!
    assert.equal(store.getState().elementFolderAssignments[chairId], target.folderId)
    const chair = store.getState().furniture.find((item) => item.id === chairId)!
    assert.ok(Math.abs(chair.x - target.center.x) <= target.size.width / 2)
    assert.ok(Math.abs(chair.z - target.center.z) <= target.size.depth / 2)

    for (const kind of ['floor', 'wall'] as const) {
      store.getState().addStructureObject(kind)
      const surfaceId = store.getState().selectedId!
      const independent = store.getState().structurePacks.find((pack) => pack.id.startsWith(kind + '-object-'))!
      const surface = independent.surfaces[0]
      assert.equal(store.getState().elementFolderAssignments[surfaceId], target.folderId)
      const [x, y, z] = surfacePosition(store.getState().room, surface)
      eq(independent.x + x, target.center.x)
      eq(independent.y + y, target.center.y + target.size.height / 2)
      eq(independent.z + z, target.center.z)
      eq(surface.width, target.size.width)
      if (kind === 'floor') eq(surface.depth, target.size.depth)
      if (kind === 'wall') eq(surface.height, target.size.height)
    }
    assert.equal(store.getState().activeRoomId, focusedPack.id)
    const persisted = persistedDesign(store.getState())
    assert.equal(persisted.elementFolderAssignments![chairId], target.folderId)
  })
}

test('mover una superficie a otra carpeta no cambia su posición ni deja packs vacíos al borrarla', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().addStructureObject('wall')
  const surfaceId = store.getState().selectedId!
  const pack = store.getState().structurePacks.find((item) => item.id.startsWith('wall-object-'))!
  const before = structuredClone(pack)
  store.getState().moveElementToFolder(surfaceId, null)
  assert.equal(store.getState().elementFolderAssignments[surfaceId], undefined)
  assert.deepEqual(store.getState().structurePacks.find((item) => item.id === pack.id), before)
  store.getState().removeSceneItems([surfaceId])
  assert.equal(store.getState().structurePacks.some((item) => item.id === pack.id), false)
  store.getState().undo()
  assert.equal(store.getState().structurePacks.some((item) => item.id === pack.id), true)
})

test('cambiar el foco a Raíz dirige nuevas creaciones a Raíz aunque haya otras habitaciones', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().setActiveRoomId(null)
  store.getState().addFurniture('chair')
  assert.equal(store.getState().elementFolderAssignments[store.getState().selectedId!], ROOT_ROOM_FOLDER)
  store.getState().addStructureObject('wall')
  assert.equal(store.getState().elementFolderAssignments[store.getState().selectedId!], ROOT_ROOM_FOLDER)
})
