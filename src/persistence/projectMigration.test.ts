import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { persistedDesignSignature, type PersistedDesign, type SavedDesign } from '../domain/designV1'
import { projectStructureFingerprint, validateProject } from '../domain/projectV2'
import { migrateDesignToProject, projectToPersistedDesignV1 } from './projectMigration'

test('un v5 antiguo de variantes converge con R4 como un único diseño', () => {
  const data = JSON.parse(readFileSync(new URL('../../tests/fixtures/persisted-designs/valid-v5.json', import.meta.url), 'utf8'))
  const before = structuredClone(data)
  const project = migrateDesignToProject({ id: 'v5', name: 'Dos variantes', savedAt: '2026-11-03T10:00:00.000Z', data })
  assert.deepEqual(validateProject(project), [])
  assert.equal(project.metadata.migratedFromVersion, 4)
  assert.equal(project.layouts.length, 1)
  assert.equal(project.activeLayoutId, project.layouts[0].id)
  assert.deepEqual(project.layouts[0].furniture.map((item) => item.id), data.furniture.map((item: { id: string }) => item.id))
  const projected = projectToPersistedDesignV1(project)
  assert.deepEqual(projected.furniture, data.furniture)
  assert.deepEqual(projected.room, data.room)
  assert.deepEqual(projected.elementFolders, data.elementFolders)
  assert.deepEqual(projected.elementFolderAssignments, data.elementFolderAssignments)
  assert.deepEqual(data, before)
})

function fixtureData(name: string): PersistedDesign {
  return JSON.parse(readFileSync(new URL(`../../tests/fixtures/persistence-v1/${name}.json`, import.meta.url), 'utf8'))
}

function fixtureSaved(name: string): SavedDesign {
  return {
    id: `design-${name}`,
    name: `Diseño ${name}`,
    savedAt: '2026-11-03T10:00:00.000Z',
    data: fixtureData(name),
  }
}

test('migra los diseños v1 válidos a un proyecto de una habitación sin pérdida semántica', () => {
  for (const name of ['valid-complete', 'valid-legacy-optional-fields', 'valid-boundary']) {
    const saved = fixtureSaved(name)
    const before = structuredClone(saved)
    const project = migrateDesignToProject(saved)

    assert.deepEqual(validateProject(project), [])
    assert.equal(project.schemaVersion, 2)
    assert.equal(project.units, 'meters')
    assert.equal(project.structureRevision, 0)
    assert.equal(project.floors.length, 1)
    assert.equal(project.rooms.length, 1)
    assert.equal(project.walls.length, 4)
    assert.equal(project.layouts.length, 1)
    assert.equal(project.layouts[0].kind, 'original')
    assert.equal(project.activeLayoutId, project.layouts[0].id)
    assert.equal(project.metadata.source, 'v1-design')
    assert.equal(project.metadata.migratedFromVersion, saved.data.version)

    const room = project.rooms[0]
    assert.equal(room.boundary.width, saved.data.room.width)
    assert.equal(room.boundary.depth, saved.data.room.depth)
    assert.equal(room.height, saved.data.room.height)
    assert.deepEqual(project.openings.map((opening) => opening.id), [
      `${room.id}:door`,
      ...saved.data.room.windows.map((window) => window.id),
    ])
    assert.deepEqual(
      project.layouts[0].furniture.map((item) => item.id),
      saved.data.furniture.map((item) => item.id),
    )
    assert.deepEqual(project.legacyStructurePacks, saved.data.structurePacks)

    const roundTrip = projectToPersistedDesignV1(project)
    assert.equal(persistedDesignSignature(roundTrip), persistedDesignSignature(saved.data))
    assert.deepEqual(roundTrip.room.windows.map((window) => window.id), saved.data.room.windows.map((window) => window.id))
    assert.deepEqual(roundTrip.structurePacks, saved.data.structurePacks)
    assert.deepEqual(saved, before)
  }
})

test('conserva los packs constructivos como legado y no los convierte en paredes', () => {
  const saved = fixtureSaved('valid-boundary')
  const project = migrateDesignToProject(saved)
  assert.equal(project.walls.length, 4)
  assert.deepEqual(project.legacyStructurePacks, saved.data.structurePacks)
  assert.equal(project.walls.some((wall) => wall.id.includes('legacy')), false)
  assert.deepEqual(validateProject(project), [])
})

test('la migración conserva nombres, candados, carpetas y orden de una versión 4', () => {
  const data = structuredClone(fixtureData('valid-complete'))
  data.version = 4
  data.room.door.name = 'Puerta principal'
  data.room.windows[0].name = 'Ventana del salón'
  data.lockedElementIds = [data.furniture[0].id]
  data.elementFolders = [
    { id: 'folder-salon', name: 'Salón' },
    { id: 'folder-muebles', name: 'Muebles', parentId: 'folder-salon' },
  ]
  data.elementFolderAssignments = { [data.furniture[0].id]: 'folder-muebles' }
  data.sceneElementOrder = data.furniture.map((item) => item.id).reverse()
  const saved = { ...fixtureSaved('valid-complete'), data }
  const before = structuredClone(data)

  const project = migrateDesignToProject(saved)
  assert.deepEqual(validateProject(project), [])
  assert.equal(project.metadata.migratedFromVersion, 4)
  assert.equal(project.openings.find((opening) => opening.kind === 'door')?.name, 'Puerta principal')
  assert.equal(project.openings.find((opening) => opening.kind === 'window')?.name, 'Ventana del salón')
  assert.deepEqual(project.preferences.lockedElementIds, [data.furniture[0].id])
  assert.deepEqual(project.preferences.elementFolders, data.elementFolders)
  assert.deepEqual(project.preferences.elementFolderAssignments, data.elementFolderAssignments)
  assert.deepEqual(project.preferences.sceneElementOrder, data.sceneElementOrder)

  const roundTrip = projectToPersistedDesignV1(project)
  assert.equal(roundTrip.version, 4)
  assert.equal(roundTrip.room.door.name, 'Puerta principal')
  assert.equal(roundTrip.room.windows[0].name, 'Ventana del salón')
  assert.deepEqual(roundTrip.lockedElementIds, data.lockedElementIds)
  assert.deepEqual(roundTrip.elementFolders, data.elementFolders)
  assert.deepEqual(roundTrip.elementFolderAssignments, data.elementFolderAssignments)
  assert.deepEqual(roundTrip.sceneElementOrder, data.sceneElementOrder)
  assert.deepEqual(roundTrip, data)
  assert.deepEqual(data, before)
})

test('remapea las referencias de la puerta en preferencias y las restaura al volver al diseño', () => {
  const saved = fixtureSaved('valid-complete')
  saved.data.version = 4
  const furnitureId = saved.data.furniture[0].id
  saved.data.hiddenElementIds = ['door', furnitureId]
  saved.data.lockedElementIds = ['door', furnitureId]
  saved.data.elementFolders = [{ id: 'folder-openings', name: 'Aberturas' }]
  saved.data.elementFolderAssignments = { door: 'folder-openings', [furnitureId]: 'folder-openings' }
  saved.data.sceneElementOrder = [furnitureId, 'door']
  const before = structuredClone(saved)

  const project = migrateDesignToProject(saved, { projectId: 'custom-project' })
  const doorId = project.openings.find((opening) => opening.kind === 'door')!.id
  assert.equal(doorId, 'custom-project:room-0:door')
  assert.deepEqual(project.preferences.hiddenElementIds, [doorId, furnitureId])
  assert.deepEqual(project.preferences.lockedElementIds, [doorId, furnitureId])
  assert.deepEqual(project.preferences.elementFolderAssignments, { [doorId]: 'folder-openings', [furnitureId]: 'folder-openings' })
  assert.deepEqual(project.preferences.sceneElementOrder, [furnitureId, doorId])
  const migratedBefore = structuredClone(project)
  const roundTrip = projectToPersistedDesignV1(project)
  assert.deepEqual(roundTrip.hiddenElementIds, saved.data.hiddenElementIds)
  assert.deepEqual(roundTrip.lockedElementIds, saved.data.lockedElementIds)
  assert.deepEqual(roundTrip.elementFolderAssignments, saved.data.elementFolderAssignments)
  assert.deepEqual(roundTrip.sceneElementOrder, saved.data.sceneElementOrder)
  assert.deepEqual(project, migratedBefore)
  assert.deepEqual(saved, before)
})

test('la migración es determinista y conserva los IDs de aperturas y muebles', () => {
  const saved = fixtureSaved('valid-complete')
  const first = migrateDesignToProject(saved)
  const second = migrateDesignToProject(saved)
  assert.deepEqual(first, second)
  assert.equal(first.walls.length, 4)
  assert.equal(new Set(first.walls.map((wall) => wall.id)).size, 4)
  assert.ok(first.openings.every((opening) => first.walls.some((wall) => wall.id === opening.wallId)))
  assert.deepEqual(
    first.layouts[0].furniture.map((item) => item.id),
    saved.data.furniture.map((item) => item.id),
  )
  assert.deepEqual(
    first.openings.filter((opening) => opening.kind === 'window').map((opening) => opening.id),
    saved.data.room.windows.map((window) => window.id),
  )
})

test('rechaza cabeceras, habitaciones, aberturas y mobiliario no migrables sin mutar la entrada', () => {
  const invalid = [
    fixtureSaved('invalid-unsupported-version'),
    fixtureSaved('invalid-malformed-room'),
    fixtureSaved('invalid-unknown-furniture'),
  ]
  for (const saved of invalid) {
    const before = structuredClone(saved)
    assert.throws(() => migrateDesignToProject(saved))
    assert.deepEqual(saved, before)
  }

  const overlapping = fixtureSaved('valid-complete')
  overlapping.data.room.windows.push({ ...overlapping.data.room.windows[0], id: 'overlap', wall: 'north', offset: 0 })
  assert.throws(() => migrateDesignToProject(overlapping))

  const outside = fixtureSaved('valid-complete')
  outside.data.room.door.offset = 10
  assert.throws(() => migrateDesignToProject(outside))

  const invalidWindow = fixtureSaved('valid-complete')
  invalidWindow.data.room.windows[0].width = 0
  assert.throws(() => migrateDesignToProject(invalidWindow))

  const invalidPack = fixtureSaved('valid-boundary')
  invalidPack.data.structurePacks = [{
    id: 'bad',
    name: 'Bad',
    x: 0,
    y: 0,
    z: 0,
    surfaces: [{ id: 'floor', kind: 'wall', name: '', x: 0, y: 0, z: 0, width: 1, height: 1, depth: 1, rotation: 0, color: '#fff' }],
  } as never]
  assert.throws(() => migrateDesignToProject(invalidPack))
})

test('la huella estructural del proyecto migrado es estable y no depende del mobiliario', () => {
  const project = migrateDesignToProject(fixtureSaved('valid-complete'))
  const before = projectStructureFingerprint(project)
  const changedFurniture = structuredClone(project)
  changedFurniture.layouts[0].furniture[0].x += 1
  assert.equal(projectStructureFingerprint(changedFurniture), before)

  const changedStructure = structuredClone(project)
  changedStructure.rooms[0].boundary.width += 1
  assert.notEqual(projectStructureFingerprint(changedStructure), before)
})
