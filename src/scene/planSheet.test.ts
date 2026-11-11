import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoomStore } from '../state/useRoomStore'
import { folderSelectionId, ROOT_ROOM_FOLDER } from '../domain/elementFolders'
import { extentAlong, PLAN_SHEET_GAP, planFloorGroups, planScreenRight, planSheetPlacements } from './planSheet'

const house = () => {
  const store = createRoomStore()
  store.getState().setDimension('width', 4)
  store.getState().setDimension('depth', 3)
  store.getState().addStructurePack('up')
  store.getState().setActiveRoomId(null)
  store.getState().selectElement(folderSelectionId(ROOT_ROOM_FOLDER))
  store.getState().addStructurePack('down')
  return store.getState()
}

test('agrupa la vivienda en plantas -1, 0 y 1 con sus habitaciones', () => {
  const state = house()
  const groups = planFloorGroups(state.room, state.structurePacks)
  assert.deepEqual(groups.map((group) => group.name), ['Planta -1', 'Planta 0', 'Planta 1'])
  assert.deepEqual(groups[1].roomIds, [null])
  assert.equal(groups[0].roomIds.length, 1)
  assert.ok(groups[0].level < 0 && groups[2].level > 0)
})

test('las plantas se dibujan de izquierda a derecha y la enfocada no se mueve', () => {
  const state = house()
  const groups = planFloorGroups(state.room, state.structurePacks)
  for (const focused of groups) {
    const placements = planSheetPlacements(groups, focused.key, 0)
    const own = placements.get(focused.key)!
    assert.deepEqual([own.offset.x + 0, own.offset.z + 0, own.lift + 0], [0, 0, 0])
    // De abajo arriba = de izquierda a derecha, sin solaparse y con separación.
    const right = planScreenRight(0)
    const extents = groups.map((group) => {
      const placement = placements.get(group.key)!
      const [min, max] = extentAlong(group.boxes.map((box) => ({ ...box, x: box.x + placement.offset.x, z: box.z + placement.offset.z })), right)
      return { min, max }
    })
    for (let index = 1; index < extents.length; index += 1) {
      assert.ok(Math.abs(extents[index].min - extents[index - 1].max - PLAN_SHEET_GAP) < 1e-9)
    }
    // Cada planta se dibuja a la altura de la enfocada.
    for (const group of groups) assert.ok(Math.abs(group.level + placements.get(group.key)!.lift - focused.level) < 1e-9)
  }
})

test('al girar el Plano la hoja sigue yendo hacia la derecha de la pantalla', () => {
  const state = house()
  const groups = planFloorGroups(state.room, state.structurePacks)
  for (const orientation of [0, 1, 2, 3]) {
    const right = planScreenRight(orientation)
    const placements = planSheetPlacements(groups, 0, orientation)
    const along = (key: number) => { const offset = placements.get(key)!.offset; return offset.x * right.x + offset.z * right.z }
    assert.ok(along(groups[0].key) < along(groups[1].key) && along(groups[1].key) < along(groups[2].key), `orientación ${orientation}`)
    // Sin desplazamiento en la dirección vertical de la pantalla.
    for (const group of groups) {
      const offset = placements.get(group.key)!.offset
      assert.ok(Math.abs(offset.x * right.z - offset.z * right.x) < 1e-9)
    }
  }
})
