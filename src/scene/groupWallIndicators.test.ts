import assert from 'node:assert/strict'
import { test } from 'node:test'
import { multiSelectionItems } from '../domain/multiSelection'
import { createRoomStore } from '../state/useRoomStore'
import { selectedBaseWallIndicators, showGroupedWallIndicators } from './groupWallIndicators'
import { BASE_FLOOR_ID, ROOT_ROOM_FOLDER } from '../domain/elementFolders'

test('los indicadores requieren una carpeta o pack con suelo y pared', () => {
  const store = createRoomStore()
  assert.equal(showGroupedWallIndicators([], []), false)
  store.getState().addStructurePack('up')
  const state = store.getState()
  const items = multiSelectionItems(state)
  assert.equal(showGroupedWallIndicators(state.selectedIds, items), true)
  assert.equal(showGroupedWallIndicators(state.selectedIds, items.filter((item) => item.surfaceId !== 'floor')), false)
  assert.equal(showGroupedWallIndicators(state.selectedIds, items.filter((item) => !item.surfaceId?.startsWith('wall-'))), false)
  assert.equal(showGroupedWallIndicators(items.map((item) => item.id), items), false)
})

test('los indicadores de la habitación principal siguen el contenido de la carpeta seleccionada', () => {
  const store = createRoomStore()
  const state = store.getState()
  assert.deepEqual(selectedBaseWallIndicators([`folder:${ROOT_ROOM_FOLDER}`], state.elementFolders, state.elementFolderAssignments), ['north', 'east', 'south', 'west'])
  assert.deepEqual(selectedBaseWallIndicators([], state.elementFolders, state.elementFolderAssignments), [])
  const assignments = { ...state.elementFolderAssignments }
  delete assignments[BASE_FLOOR_ID]
  assert.deepEqual(selectedBaseWallIndicators([`folder:${ROOT_ROOM_FOLDER}`], state.elementFolders, assignments), [])
})
