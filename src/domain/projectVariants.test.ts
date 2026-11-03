import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { PersistedDesign, SavedDesign } from './designV1'
import { migrateDesignToProject, projectToPersistedDesignV1 } from '../persistence/projectMigration'
import {
  addFurnitureToLayout,
  currentLayout,
  duplicateLayoutAsAlternative,
  layoutIsStale,
  nextFurnitureId,
  rebaseLayoutsOnStructure,
  removeFurnitureFromLayout,
  replaceLayoutFurniture,
  reviseStructure,
  switchActiveLayout,
  variantsShareStructure,
} from './projectVariants'
import { validateProject, type FurnitureInstanceV2 } from './projectV2'

function fixtureSaved(): SavedDesign {
  const data: PersistedDesign = JSON.parse(readFileSync(new URL('../../tests/fixtures/persistence-v1/valid-complete.json', import.meta.url), 'utf8'))
  return { id: 'design-variants', name: 'Variantes', savedAt: '2026-11-03T10:00:00.000Z', data }
}

function newChair(projectRoomId: string, id: string): FurnitureInstanceV2 {
  return {
    id,
    roomId: projectRoomId,
    kind: 'chair',
    name: 'Silla',
    x: 1,
    y: 0,
    z: 1,
    rotation: 0,
    width: 0.5,
    depth: 0.5,
    height: 0.85,
    color: '#bd8b5f',
  }
}

test('duplica una variante sin mutar la Original y comparte IDs de mueble lógico', () => {
  const project = migrateDesignToProject(fixtureSaved())
  const before = structuredClone(project)
  assert.equal(project.layouts.length, 1)

  const withAlternative = duplicateLayoutAsAlternative(project, 'design-variants:layout-original', 'Propuesta A')
  assert.deepEqual(project, before)
  assert.equal(withAlternative.layouts.length, 2)
  const original = withAlternative.layouts[0]
  const alternative = withAlternative.layouts[1]
  assert.equal(alternative.kind, 'alternative')
  assert.equal(alternative.name, 'Propuesta A')
  assert.equal(alternative.basedOnLayoutId, original.id)
  assert.equal(alternative.structureRevision, withAlternative.structureRevision)
  assert.equal(withAlternative.activeLayoutId, alternative.id)
  assert.deepEqual(alternative.furniture, original.furniture)
  assert.deepEqual(alternative.furniture.map((item) => item.id), original.furniture.map((item) => item.id))
  assert.notEqual(alternative.furniture[0], original.furniture[0])
  assert.deepEqual(validateProject(withAlternative), [])
})

test('editar una alternativa no cambia la Original, la estructura ni las demás variantes', () => {
  const project = duplicateLayoutAsAlternative(migrateDesignToProject(fixtureSaved()), undefined, 'Propuesta A')
  const original = project.layouts[0]
  const alternative = project.layouts[1]
  const originalFurniture = structuredClone(original.furniture)
  const updatedFurniture = alternative.furniture.map((item, index) => index === 0 ? { ...item, x: item.x + 1.25 } : { ...item })
  const updated = replaceLayoutFurniture(project, alternative.id, updatedFurniture)

  assert.deepEqual(updated.layouts[0].furniture, originalFurniture)
  assert.equal(updated.layouts[1].furniture[0].x, originalFurniture[0].x + 1.25)
  assert.equal(project.layouts[1].furniture[0].x, originalFurniture[0].x)
  assert.deepEqual(validateProject(updated), [])
})

test('añade y elimina mobiliario solo en la variante indicada', () => {
  const project = duplicateLayoutAsAlternative(migrateDesignToProject(fixtureSaved()))
  const alternative = project.layouts[1]
  const chair = newChair(project.rooms[0].id, nextFurnitureId(project))
  const added = addFurnitureToLayout(project, alternative.id, chair)
  assert.equal(added.layouts[1].furniture.at(-1)?.id, chair.id)
  assert.equal(added.layouts[0].furniture.some((item) => item.id === chair.id), false)
  assert.throws(() => addFurnitureToLayout(added, alternative.id, chair))
  assert.throws(() => addFurnitureToLayout(added, project.layouts[0].id, added.layouts[0].furniture[0]))

  const removed = removeFurnitureFromLayout(added, alternative.id, chair.id)
  assert.equal(removed.layouts[1].furniture.some((item) => item.id === chair.id), false)
  assert.equal(removed.layouts[0].furniture.length, project.layouts[0].furniture.length)
})

test('un cambio estructural explícito marca variantes obsoletas y permite confirmarlas', () => {
  const project = duplicateLayoutAsAlternative(migrateDesignToProject(fixtureSaved()), undefined, 'Propuesta A')
  assert.equal(variantsShareStructure(project), true)
  assert.deepEqual(project.layouts.map((layout) => layoutIsStale(project, layout.id)), [false, false])

  const changedWalls = project.walls.map((wall) => ({ ...wall, thickness: wall.thickness + 0.05 }))
  const revised = reviseStructure(project, {
    floors: project.floors,
    rooms: project.rooms,
    walls: changedWalls,
    openings: project.openings,
  }, '2026-11-03T11:00:00.000Z')
  assert.equal(revised.structureRevision, 1)
  assert.deepEqual(revised.layouts.map((layout) => layout.structureRevision), [0, 0])
  assert.deepEqual(revised.layouts.map((layout) => layoutIsStale(revised, layout.id)), [true, true])
  assert.equal(revised.metadata.updatedAt, '2026-11-03T11:00:00.000Z')
  assert.equal(variantsShareStructure(revised), false)

  const rebased = rebaseLayoutsOnStructure(revised)
  assert.deepEqual(rebased.layouts.map((layout) => layout.structureRevision), [1, 1])
  assert.deepEqual(rebased.layouts.map((layout) => layoutIsStale(rebased, layout.id)), [false, false])
  assert.equal(variantsShareStructure(rebased), true)
  assert.deepEqual(rebased.layouts[0].furniture, project.layouts[0].furniture)
  assert.deepEqual(rebased.layouts[1].furniture, project.layouts[1].furniture)
  assert.deepEqual(validateProject(rebased), [])
})

test('duplicar una variante obsoleta conserva su revisión hasta confirmar la estructura', () => {
  const project = migrateDesignToProject(fixtureSaved())
  const revised = reviseStructure(project, {
    floors: project.floors,
    rooms: project.rooms,
    walls: project.walls.map((wall) => ({ ...wall, thickness: wall.thickness + 0.05 })),
    openings: project.openings,
  })
  const before = structuredClone(revised)
  const duplicated = duplicateLayoutAsAlternative(revised)
  const alternative = currentLayout(duplicated)

  assert.equal(alternative.structureRevision, project.layouts[0].structureRevision)
  assert.equal(layoutIsStale(duplicated, alternative.id), true)
  assert.equal(layoutIsStale(duplicated, project.activeLayoutId), true)
  assert.deepEqual(alternative.furniture, project.layouts[0].furniture)
  assert.deepEqual(revised, before)
  assert.deepEqual(validateProject(duplicated), [])

  const confirmed = rebaseLayoutsOnStructure(duplicated)
  assert.equal(layoutIsStale(confirmed, alternative.id), false)
  assert.equal(layoutIsStale(duplicated, alternative.id), true)
})

test('cambia la variante activa y proyecta cada variante a v1 sin mezclar muebles', () => {
  const project = duplicateLayoutAsAlternative(migrateDesignToProject(fixtureSaved()), undefined, 'Propuesta A')
  const alternative = project.layouts[1]
  const updated = replaceLayoutFurniture(project, alternative.id, alternative.furniture.map((item) => ({ ...item, x: item.x + 1 })))
  assert.equal(currentLayout(updated).id, alternative.id)
  assert.throws(() => switchActiveLayout(updated, 'missing'))

  const originalV1 = projectToPersistedDesignV1(updated, updated.layouts[0].id)
  const alternativeV1 = projectToPersistedDesignV1(updated, updated.layouts[1].id)
  assert.deepEqual(originalV1.furniture.map((item) => item.x), project.layouts[0].furniture.map((item) => item.x))
  assert.deepEqual(alternativeV1.furniture.map((item) => item.x), updated.layouts[1].furniture.map((item) => item.x))
  assert.throws(() => projectToPersistedDesignV1(updated, 'missing'))
})
