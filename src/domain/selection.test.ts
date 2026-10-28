import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { makeId, structureSurfaceElementId } from './elementIds'
import { FURNITURE_PRESETS, OPENING_CATALOG, openingKindForShape } from './objectCatalog'
import { deriveSelection, elementName, type SelectionSource } from './selection'
import type { StructureSurfaceKey, WindowShape } from './types'
import { structureSurfaceElementId as storeSurfaceId } from '../state/useRoomStore'

function fixture(): SelectionSource {
  const shapes: WindowShape[] = [
    'rectangular', 'circular', 'wallShelf', 'pictureSmall', 'pictureMedium',
    'pictureLarge', 'mirrorRectangular', 'mirrorCircular', 'wallSconce',
  ]
  const surfaces: StructureSurfaceKey[] = ['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west']
  return {
    room: {
      ...structuredClone(DEFAULT_ROOM),
      windows: shapes.map((shape, index) => ({
        id: `old-opening:${index}`, shape, wall: 'north', offset: 0,
        width: 0.5, height: 0.5, sill: 1, rotation: 0,
      })),
    },
    furniture: Object.values(FURNITURE_PRESETS).map((preset, index) => ({
      ...preset, id: `legacy-furniture:${index}`, x: 0, y: 0, z: 0, rotation: 0,
    })),
    structurePacks: [{
      id: 'floor-pack-1720000000000-old:id', name: 'Pack antiguo', x: 0, y: 0, z: 0,
      surfaces: surfaces.map((id) => ({
        id, name: `Superficie ${id}`, kind: id === 'floor' ? 'floor' : id === 'ceiling' ? 'ceiling' : 'wall',
        x: 0, y: 0, z: 0, width: 4, height: 2.5, depth: 0.1, rotation: 0, color: '#abcdef',
      })),
    }],
  }
}

test('conserva el formato de IDs generado y el export público del store', (context) => {
  context.mock.method(Date, 'now', () => 1720000000000)
  context.mock.method(Math, 'random', () => 0.5)
  for (const prefix of ['design', 'floor-pack', 'floor-object', 'wall-object', 'window', 'table']) {
    assert.equal(makeId(prefix), `${prefix}-1720000000000-i`)
  }
  assert.equal(structureSurfaceElementId('old:pack', 'wall-north'), 'structure-surface:old:pack:wall-north')
  assert.equal(storeSurfaceId, structureSurfaceElementId)
})

test('deriva puerta y todas las formas murales con sus nombres y orden actuales', () => {
  const state = fixture()
  assert.deepEqual(deriveSelection(state, 'door').selectedOpening, {
    ...state.room.door, id: 'door', kind: 'door', sill: 0,
  })
  assert.equal(elementName(state, 'door'), 'Puerta')
  state.room.windows.forEach((window, index) => {
    const selected = deriveSelection(state, window.id)
    assert.equal(selected.selectedWindow, window)
    assert.deepEqual(selected.selectedOpening, { ...window, kind: 'window' })
    assert.equal(elementName(state, window.id), `${OPENING_CATALOG[openingKindForShape(window.shape)].name} ${index + 1}`)
  })
})

test('resuelve todos los muebles, packs y superficies sin interpretar sus IDs antiguos', () => {
  const state = fixture()
  const before = structuredClone(state)
  for (const item of state.furniture) {
    assert.equal(deriveSelection(state, item.id).selectedFurniture, item)
    assert.equal(elementName(state, item.id), item.name)
  }
  const pack = state.structurePacks[0]
  assert.equal(deriveSelection(state, pack.id).selectedPack, pack)
  assert.equal(elementName(state, pack.id), pack.name)
  for (const surface of pack.surfaces) {
    const id = structureSurfaceElementId(pack.id, surface.id)
    const selected = deriveSelection(state, id).selectedSurface
    assert.equal(selected?.pack, pack)
    assert.equal(selected?.surface, surface)
    assert.equal(elementName(state, id), `${pack.name} · ${surface.name}`)
    const restored = JSON.parse(JSON.stringify({ ...state, hiddenElementIds: [id] }))
    assert.equal(deriveSelection(restored, restored.hiddenElementIds[0]).selectedSurface?.surface.id, surface.id)
  }
  assert.deepEqual(state, before)
})

test('mantiene selecciones vacías o desconocidas y la precedencia de nombres', () => {
  const state = fixture()
  for (const id of [null, '', 'unknown-legacy-id', 'structure-surface:missing:floor']) {
    assert.deepEqual(deriveSelection(state, id), {
      selectedPack: undefined, selectedSurface: undefined, selectedFurniture: undefined,
      selectedWindow: undefined, selectedOpening: null,
    })
    assert.equal(elementName(state, id), id || null)
  }
  // v1 does not enforce globally unique IDs: preserve independent lookups and name priority.
  const id = state.room.windows[0].id
  state.structurePacks[0].id = id
  state.furniture[0].id = id
  const selection = deriveSelection(state, id)
  assert.equal(selection.selectedPack, state.structurePacks[0])
  assert.equal(selection.selectedFurniture, state.furniture[0])
  assert.equal(elementName(state, id), 'Ventana 1')
})
