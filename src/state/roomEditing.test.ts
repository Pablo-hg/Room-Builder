import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from './useRoomStore'
import { BASE_ROOM_SURFACE_IDS, folderSelectionId, ROOT_ROOM_FOLDER } from '../domain/elementFolders'
import { packRoomBox, selectedEditableRoom, surfacePosition } from '../domain/roomEditing'
import { elementName } from '../domain/selection'
import { structureSurfaceElementId } from '../domain/elementIds'
import { persistedDesign } from '../domain/designV1'
import { normalizeDesign } from '../persistence/designMigrations'
import { parseDesignFile, serializeDesignFile } from '../persistence/designFile'
import { migrateDesignToProject, projectToPersistedDesignV1 } from '../persistence/projectMigration'
import { structureDoorOpenings, structureDoorPosition } from '../domain/structureDoors'

test('dimensiones solo desde una carpeta con exactamente una habitación completa', () => {
  const store = createRoomStore()
  assert.equal(selectedEditableRoom(store.getState()), null)
  const before = store.getState().room.width
  store.getState().setSelectedRoomDimension('width', 7)
  assert.equal(store.getState().room.width, before)
  for (const id of BASE_ROOM_SURFACE_IDS) {
    store.getState().selectElement(id)
    assert.equal(store.getState().selectedId, id)
    assert.equal(selectedEditableRoom(store.getState()), null)
  }
  store.getState().selectElement(folderSelectionId(ROOT_ROOM_FOLDER))
  assert.equal(selectedEditableRoom(store.getState())?.kind, 'root')
  store.getState().setSelectedRoomDimension('width', 7)
  assert.equal(store.getState().room.width, 7)
  store.setState({ elementFolderAssignments: { ...store.getState().elementFolderAssignments, [BASE_ROOM_SURFACE_IDS[0]]: 'another-folder' } })
  assert.equal(selectedEditableRoom(store.getState()), null)
})

test('redimensionar una habitación conserva la raíz y el otro pack; deshacer restaura', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const first = structuredClone(store.getState().structurePacks[0])
  const root = structuredClone(store.getState().room)
  store.getState().addStructurePack('up')
  const second = store.getState().structurePacks[1]
  store.getState().setSelectedRoomDimension('width', 7)
  assert.equal(packRoomBox(store.getState().structurePacks[1], root)?.width, 7)
  assert.deepEqual(store.getState().room, root)
  assert.deepEqual(store.getState().structurePacks[0], first)
  store.getState().undo()
  assert.deepEqual(store.getState().structurePacks[1], second)
  const folder = store.getState().elementFolderAssignments[second.id]
  store.getState().moveElementToFolder(structureSurfaceElementId(second.id, 'wall-north'), null)
  store.getState().selectElement(folderSelectionId(folder))
  assert.equal(selectedEditableRoom(store.getState()), null)
})

test('redimensionar raíz conserva dimensiones y posiciones mundiales de otras habitaciones', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('east')
  const room = structuredClone(store.getState().room)
  const pack = structuredClone(store.getState().structurePacks[0])
  const positions = pack.surfaces.map((surface) => surfacePosition(room, surface))
  store.getState().selectElement(folderSelectionId(ROOT_ROOM_FOLDER))
  store.getState().setSelectedRoomDimension('width', 7)
  store.getState().setSelectedRoomDimension('height', 4)
  store.getState().setSelectedRoomDimension('depth', 6)
  const next = store.getState().structurePacks[0]
  next.surfaces.forEach((surface, index) => surfacePosition(store.getState().room, surface).forEach((value, axis) => assert.ok(Math.abs(value - positions[index][axis]) < 1e-9)))
  assert.deepEqual(packRoomBox(next, store.getState().room), packRoomBox(pack, room))
})

test('nombres simples para superficies, IDs y nombres persistidos intactos', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const pack = store.getState().structurePacks[0]
  const floor = pack.surfaces.find((surface) => surface.kind === 'floor')!
  assert.equal(elementName(store.getState(), structureSurfaceElementId(pack.id, floor.id)), 'Suelo')
  assert.equal(pack.name, 'Habitación 2')
  assert.equal(floor.name, 'Suelo')
})

test('crear junto a una habitación redimensionada respeta sus medidas y posición', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().setSelectedRoomDimension('width', 7)
  store.getState().setSelectedRoomDimension('height', 4)
  const first = store.getState().structurePacks[0]
  store.getState().addStructurePack('east')
  const next = store.getState().structurePacks[1]
  assert.equal(next.x - first.x, 7)
  assert.equal(packRoomBox(next, store.getState().room)?.width, 7)
  assert.equal(packRoomBox(next, store.getState().room)?.height, 4)
})

test('reducir la raíz no recoloca un mueble de la habitación superior', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  store.getState().addFurniture('chair')
  const id = store.getState().selectedId!
  store.getState().moveFurniture(id, 1.8, 0)
  const item = structuredClone(store.getState().furniture[0])
  store.getState().selectElement(folderSelectionId(ROOT_ROOM_FOLDER))
  store.getState().setSelectedRoomDimension('width', 3)
  assert.deepEqual(store.getState().furniture[0], item)
})

test('añade varias puertas con huecos reales en la pared indicada y conserva JSON/R4', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const id = store.getState().structurePacks[0].id
  store.getState().selectElement(structureSurfaceElementId(id, 'wall-north'))
  store.getState().addStructureDoor()
  const first = store.getState().selectedId!
  store.getState().selectElement(structureSurfaceElementId(id, 'wall-east'))
  store.getState().addStructureDoor()
  const pack = store.getState().structurePacks[0]
  assert.equal(pack.doors?.length, 2)
  assert.equal(pack.doors![0].wall, 'north')
  const openings = structureDoorOpenings(pack, pack.surfaces.find((surface) => surface.wall === 'north')!)
  assert.equal(openings[0].id, first)
  assert.equal(openings[0].kind, 'door')
  assert.equal(openings[0].bottom, 0)
  const data = persistedDesign(store.getState())
  assert.equal(data.version, 10)
  const design = { id: 'doors', name: 'Puertas', savedAt: '2026-11-07T12:00:00.000Z', data }
  assert.deepEqual(normalizeDesign(data).structurePacks, data.structurePacks)
  assert.deepEqual(parseDesignFile(serializeDesignFile(design)).design.data.structurePacks, data.structurePacks)
  assert.deepEqual(projectToPersistedDesignV1(migrateDesignToProject(design)).structurePacks, data.structurePacks)
})

test('puerta ligada a pared: candado indirecto, borrado en cascada y deshacer', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('up')
  const packId = store.getState().structurePacks[0].id
  store.getState().selectElement(structureSurfaceElementId(packId, 'wall-north'))
  store.getState().addStructureDoor()
  const doorId = store.getState().selectedId!
  store.getState().setElementAxisLock(doorId, 'x', true)
  const before = structureDoorPosition(store.getState().room, store.getState().structurePacks[0], store.getState().structurePacks[0].doors![0])
  store.getState().moveStructureSurface(packId, 'wall-north', 'x', 1)
  assert.deepEqual(structureDoorPosition(store.getState().room, store.getState().structurePacks[0], store.getState().structurePacks[0].doors![0]), before)
  store.getState().removeStructureSurface(packId, 'wall-north')
  assert.equal(store.getState().structurePacks[0].doors?.length, 0)
  assert.equal(store.getState().elementFolderAssignments[doorId], undefined)
  assert.equal(store.getState().lockedElementIds.includes(doorId), false)
  store.getState().undo()
  assert.equal(store.getState().structurePacks[0].doors?.[0].id, doorId)
  assert.ok(store.getState().elementFolderAssignments[doorId])
})

test('abre pasos en paredes conectadas y rechaza mover la puerta fuera del soporte', () => {
  const store = createRoomStore()
  store.getState().addStructurePack('north')
  const packId = store.getState().structurePacks[0].id
  store.getState().selectElement(structureSurfaceElementId(packId, 'wall-south'))
  store.getState().addStructureDoor()
  const created = store.getState().structurePacks[0].doors![0]
  store.getState().setStructureDoor(created.id, { wall: 'south' })
  assert.equal(store.getState().structurePacks[0].doors![0].wall, 'south')
  assert.equal(store.getState().notice, '')
  store.getState().selectElement(structureSurfaceElementId(packId, 'wall-north'))
  store.getState().addStructureDoor()
  const door = store.getState().structurePacks[0].doors![0]
  store.getState().setStructureDoor(door.id, { offset: 100 })
  assert.equal(store.getState().structurePacks[0].doors![0].offset, door.offset)
  const data = structuredClone(persistedDesign(store.getState()))
  data.structurePacks![0].doors![0].wallPosition!.x = NaN
  assert.throws(() => normalizeDesign(data), /[Pp]osición/)
})
