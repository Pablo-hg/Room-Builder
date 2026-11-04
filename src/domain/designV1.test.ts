import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DEFAULT_ROOM } from './constants'
import { DEFAULT_GRID_VISIBILITY, isPersistedDesign, persistedDesign, persistedDesignSignature, type PersistedDesign } from './designV1'
import { arrangeFurniture } from './editingRules'
import { validateOpenings } from './geometry'
import { normalizeDesignPreferences, normalizeDesignRoom, normalizeStructurePacks } from './normalizeDesignV1'
import { OPENING_CATALOG } from './objectCatalog'
import { createStructureSurface } from './structureRules'
import type { StructurePack, WindowConfig, WindowShape } from './types'

function fixture(name: string): PersistedDesign {
  return JSON.parse(readFileSync(new URL(`../../tests/fixtures/persistence-v1/${name}.json`, import.meta.url), 'utf8'))
}

test('v1 conserva fixtures completos, antiguos y de límite sin mutaciones ni cambios de IDs', () => {
  for (const name of ['valid-complete', 'valid-legacy-optional-fields', 'valid-boundary']) {
    const data = fixture(name)
    const before = structuredClone(data)
    assert.equal(isPersistedDesign(data), true)
    const room = normalizeDesignRoom(data)
    const structurePacks = normalizeStructurePacks(data.structurePacks, room)
    const preferences = normalizeDesignPreferences(data)
    const furniture = arrangeFurniture(data.furniture, room, true)
    assert.ok(furniture)
    assert.equal(validateOpenings(room), null)
    const serialized = persistedDesign({ room, furniture, structurePacks, ...preferences })
    assert.deepEqual(serialized.furniture.map((item) => item.id), data.furniture.map((item) => item.id))
    assert.deepEqual(JSON.parse(JSON.stringify(serialized)), serialized)
    assert.equal(persistedDesignSignature(data), persistedDesignSignature(serialized))
    assert.deepEqual(data, before)
  }
})

test('v1 mantiene el control de cabecera y diferencia validación de lista y carga anidada', () => {
  for (const value of [null, [], 1, '', {}, { version: 1 }, { version: 6, room: {}, furniture: [] }, { version: 1, room: {}, furniture: {} }]) {
    assert.equal(isPersistedDesign(value), false)
  }
  assert.equal(isPersistedDesign(fixture('invalid-unsupported-version')), false)
  const malformed = fixture('invalid-malformed-room')
  assert.equal(isPersistedDesign(malformed), true)
  assert.throws(() => normalizeDesignRoom(malformed))
  const unknownFurniture = fixture('invalid-unknown-furniture')
  assert.equal(isPersistedDesign(unknownFurniture), true)
  assert.equal(arrangeFurniture(unknownFurniture.furniture, normalizeDesignRoom(unknownFurniture), true), null)
})

test('v1 firma igual los opcionales ausentes y vacíos y conserva los falsos explícitos', () => {
  const legacy = fixture('valid-legacy-optional-fields')
  const explicit = { ...legacy, structurePacks: [], gridVisibility: { ...DEFAULT_GRID_VISIBILITY }, hiddenElementIds: [] }
  assert.equal(persistedDesignSignature(legacy), persistedDesignSignature(explicit))
  assert.notEqual(persistedDesignSignature(legacy), persistedDesignSignature({ ...explicit, gridSnap: false }))
  const data = { ...explicit, gridSnap: false, gridVisibility: { ...DEFAULT_GRID_VISIBILITY, floor: false } }
  const preferences = normalizeDesignPreferences(data)
  assert.equal(preferences.gridSnap, false)
  assert.equal(preferences.gridVisibility.floor, false)
  assert.notEqual(preferences.gridVisibility, data.gridVisibility)
  assert.notEqual(preferences.hiddenElementIds, data.hiddenElementIds)
  assert.deepEqual(normalizeDesignPreferences(legacy), { gridSnap: true, gridVisibility: DEFAULT_GRID_VISIBILITY, hiddenElementIds: [], lockedElementIds: [], elementFolders: [], elementFolderAssignments: {}, sceneElementOrder: [] })
})

test('v1 conserva defaults de todas las aperturas y no endurece formas antiguas desconocidas', () => {
  const shapes: WindowShape[] = ['rectangular', 'circular', 'wallShelf', 'pictureSmall', 'pictureMedium', 'pictureLarge', 'mirrorRectangular', 'mirrorCircular', 'wallSconce']
  const data = fixture('valid-legacy-optional-fields')
  data.room = { ...structuredClone(DEFAULT_ROOM), wallColor: undefined, floorColor: undefined,
    windows: [...shapes, 'old-shape'].map((shape, index) => ({
      id: `old:${index}`, shape, wall: 'north', offset: 0.38,
    } as WindowConfig)),
  }
  const before = structuredClone(data)
  const room = normalizeDesignRoom(data)
  assert.equal(room.wallColor, '#f5eadb')
  assert.equal(room.floorColor, '#dcc3a3')
  assert.equal(room.door.width, OPENING_CATALOG.door.width)
  assert.equal(room.door.rotation, 0)
  room.windows.forEach((window, index) => {
    assert.equal(window.id, `old:${index}`)
    assert.equal(window.offset, 0.38)
    assert.equal(window.rotation, 0)
    assert.equal(typeof window.color, 'string')
    assert.equal(Number.isFinite(window.sill), true)
    assert.ok(window.width > 0 && window.height > 0)
  })
  assert.equal(room.windows.at(-1)?.shape, 'rectangular')
  assert.deepEqual(data, before)
})

test('v1 acepta giros finitos y rechaza packs y superficies malformados', () => {
  const pack: StructurePack = { id: 'old:pack', name: 'Pack', x: 0, y: 0, z: 0, surfaces: [{ ...createStructureSurface(DEFAULT_ROOM, 'floor'), rotation: 0.5 }] }
  const surface = pack.surfaces[0]
  const before = structuredClone(pack)
  assert.deepEqual(normalizeStructurePacks([pack], DEFAULT_ROOM), [pack])
  for (const rotation of [0, -1]) assert.equal(normalizeStructurePacks([{ ...pack, surfaces: [{ ...surface, rotation }] }], DEFAULT_ROOM)[0].surfaces[0].rotation, rotation)
  const invalid: unknown[] = [null, {}, [null], [{ ...pack, x: Number.NaN }], [{ ...pack, surfaces: null }],
    ...[Number.NaN, Number.POSITIVE_INFINITY].map((rotation) => [{ ...pack, surfaces: [{ ...surface, rotation }] }]),
    [{ ...pack, surfaces: [{ ...surface, width: 0 }] }],
    [{ ...pack, surfaces: [surface, surface] }],
    [{ ...pack, surfaces: [{ ...surface, id: 'wall-north', kind: 'wall', wall: 'east' }] }],
    [{ ...pack, surfaces: [{ ...surface, wall: 'north' }] }],
  ]
  for (const value of invalid) assert.throws(() => normalizeStructurePacks(value, DEFAULT_ROOM))
  assert.deepEqual(normalizeStructurePacks(undefined, DEFAULT_ROOM), [])
  assert.deepEqual(pack, before)
})
