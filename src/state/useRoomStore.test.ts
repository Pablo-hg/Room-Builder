import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM } from '../domain/constants'
import { useRoomStore } from './useRoomStore'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

test('deshace cambios y administra hasta cinco diseños locales', () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  })

  try {
    const store = useRoomStore
    const originalWidth = store.getState().room.width
    store.getState().setWallColor('#aabbcc')
    assert.deepEqual(store.getState().room.wallColors, {
      north: '#aabbcc',
      east: '#aabbcc',
      south: '#aabbcc',
      west: '#aabbcc',
    })
    store.getState().setWallSideColor('north', '#112233')
    store.getState().setFloorColor('#334455')
    assert.equal(store.getState().room.wallColors?.north, '#112233')
    assert.equal(store.getState().room.wallColors?.east, '#aabbcc')
    assert.equal(store.getState().room.floorColor, '#334455')
    store.getState().undo()
    assert.equal(store.getState().room.floorColor, undefined)
    store.getState().undo()
    assert.equal(store.getState().room.wallColors?.north, '#aabbcc')
    store.getState().undo()
    assert.equal(store.getState().room.wallColors, undefined)

    store.getState().setDimension('width', originalWidth + 0.5)
    assert.equal(store.getState().undoCount, 1)
    store.getState().undo()
    assert.equal(store.getState().room.width, originalWidth)
    assert.equal(store.getState().undoCount, 0)

    store.getState().initializeSavedDesigns()
    store.getState().addFurniture('table')
    const table = store.getState().furniture[0]
    assert.equal(table.y, 0)
    store.getState().moveFurnitureVertically(table.id, 0.63)
    assert.equal(store.getState().furniture[0].y, 0.625)
    store.getState().moveFurnitureVertically(table.id, 20)
    assert.equal(store.getState().furniture[0].y, store.getState().room.height - table.height)
    store.getState().addFurniture('chair')
    const chair = store.getState().furniture.find((item) => item.kind === 'chair')
    assert.ok(chair)
    assert.equal(chair.x, table.x)
    assert.equal(chair.z, table.z)
    store.getState().moveFurnitureVertically(chair.id, table.y)
    assert.equal(store.getState().furniture.find((item) => item.id === chair.id)?.y, 0)
    store.getState().createDesign('blank', 'Sala')
    assert.equal(store.getState().savedDesigns.length, 1)
    assert.equal(store.getState().hasUnsavedChanges, false)

    const activeId = store.getState().selectedSavedDesignId
    store.getState().setDimension('width', originalWidth + 0.5)
    assert.equal(store.getState().hasUnsavedChanges, true)
    store.getState().saveDesign()
    assert.equal(store.getState().savedDesigns.length, 1)
    assert.equal(store.getState().savedDesigns[0].id, activeId)
    assert.equal(store.getState().hasUnsavedChanges, false)
    assert.equal(store.getState().savedDesigns[0].data.room.width, originalWidth + 0.5)

    store.getState().renameSavedDesign(activeId, 'Sala principal')
    assert.equal(store.getState().savedDesigns[0].name, 'Sala principal')
    store.getState().createDesign('copy', 'Copia')
    assert.equal(store.getState().savedDesigns.length, 2)
    assert.equal(store.getState().savedDesigns[1].data.room.width, originalWidth + 0.5)
    store.getState().createDesign('blank', 'Blanco')
    assert.equal(store.getState().savedDesigns[2].data.furniture.length, 0)
    assert.equal(store.getState().savedDesigns[2].data.room.width, originalWidth)
    store.getState().createDesign('blank', 'Cuarto')
    store.getState().createDesign('blank', 'Quinto')
    assert.equal(store.getState().savedDesigns.length, 5)

    const originalDepth = store.getState().room.depth
    store.getState().setDimension('depth', originalDepth + 0.5)
    store.getState().loadDesign()
    assert.equal(store.getState().room.depth, originalDepth)

    const selectedId = store.getState().selectedSavedDesignId
    store.getState().setDimension('depth', originalDepth + 0.25)
    assert.equal(store.getState().hasUnsavedChanges, true)
    store.getState().saveDesign()
    assert.equal(store.getState().savedDesigns.length, 5)
    assert.equal(store.getState().savedDesigns.find((design) => design.id === selectedId)?.data.room.depth, originalDepth + 0.25)
    assert.equal(store.getState().hasUnsavedChanges, false)

    store.getState().deleteSavedDesign()
    assert.equal(store.getState().savedDesigns.length, 4)
    assert.equal(store.getState().hasUnsavedChanges, true)
    store.getState().createDesign('blank', 'Sexto')
    assert.equal(store.getState().savedDesigns.length, 5)

    store.getState().initializeSavedDesigns()
    assert.equal(store.getState().savedDesigns.length, 5)
  } finally {
    if (previousStorage) {
      Object.defineProperty(globalThis, 'localStorage', previousStorage)
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
  }
})

test('conserva la orientación de las paredes al cambiar a plano y frontal', () => {
  const store = useRoomStore
  store.getState().lookFromIsoOrientation(2)
  store.getState().setView('top')
  assert.equal(store.getState().topOrientation, 2)
  assert.equal(store.getState().wallView, 'east')
  store.getState().setView('front')
  assert.equal(store.getState().wallView, 'east')
})

test('deshace un arrastre de mueble hasta la posición que tenía al empezar', () => {
  const store = useRoomStore
  store.getState().createDesign('blank', 'Prueba de arrastre')
  store.getState().addFurniture('table')
  const table = store.getState().furniture[0]
  const originalPosition = { x: table.x, z: table.z }
  const undoCountBeforeMove = store.getState().undoCount

  store.getState().beginFurnitureMove()
  store.getState().moveFurniture(table.id, 0.5, 0)
  store.getState().moveFurniture(table.id, 1, 0.5)
  store.getState().moveFurniture(table.id, 1.5, 1)
  store.getState().endFurnitureMove()

  assert.deepEqual(
    { x: store.getState().furniture[0].x, z: store.getState().furniture[0].z },
    { x: 1.5, z: 1 },
  )
  assert.equal(store.getState().undoCount, undoCountBeforeMove + 1)

  store.getState().undo()

  const restoredTable = store.getState().furniture.find((item) => item.id === table.id)
  assert.ok(restoredTable)
  assert.deepEqual({ x: restoredTable.x, z: restoredTable.z }, originalPosition)
})

test('copia y pega elementos seleccionados y permite deshacer y rehacer', () => {
  const store = useRoomStore
  const originalCount = store.getState().furniture.length
  store.getState().addFurniture('table')
  const originalId = store.getState().selectedId
  assert.equal(store.getState().copySelected(), true)
  assert.equal(store.getState().pasteSelected(), true)
  assert.equal(store.getState().furniture.length, originalCount + 2)
  assert.notEqual(store.getState().selectedId, originalId)

  store.getState().undo()
  assert.equal(store.getState().furniture.length, originalCount + 1)
  assert.equal(store.getState().redoCount, 1)
  store.getState().redo()
  assert.equal(store.getState().furniture.length, originalCount + 2)
  assert.equal(store.getState().undoCount > 0, true)

  store.getState().undo()
  store.getState().addFurniture('chair')
  assert.equal(store.getState().redoCount, 0)
})

test('migra espejos de diseños guardados desde el suelo a una pared', () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const storage = new MemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

  try {
    storage.setItem('room-builder:v0.1:designs', JSON.stringify([{
      id: 'legacy-mirror-design',
      name: 'Diseño anterior',
      savedAt: new Date(0).toISOString(),
      data: {
        version: 1,
        room: DEFAULT_ROOM,
        furniture: [{
          id: 'old-mirror',
          kind: 'mirror',
          name: 'Espejo',
          x: 0,
          z: 0,
          rotation: 0,
          width: 0.5,
          depth: 0.25,
          height: 1.5,
          color: '#9a8067',
        }],
        gridSnap: true,
      },
    }]))

    const store = useRoomStore
    store.getState().initializeSavedDesigns()
    store.getState().loadDesign('legacy-mirror-design')

    assert.equal(store.getState().furniture.length, 0)
    assert.equal(store.getState().room.windows.some((window) => window.id === 'old-mirror' && window.shape === 'mirrorRectangular'), true)
  } finally {
    if (previousStorage) {
      Object.defineProperty(globalThis, 'localStorage', previousStorage)
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
  }
})

test('permite habitaciones de hasta 10 m y limita el zoom entre 25 % y 300 %', () => {
  const store = useRoomStore

  store.getState().setDimension('height', 10)
  assert.equal(store.getState().room.height, 10)
  store.getState().setDimension('height', 20)
  assert.equal(store.getState().room.height, 10)

  store.getState().setFrontCameraHeight(20)
  assert.equal(store.getState().frontCameraHeight, 10)

  for (let step = 0; step < 60; step += 1) store.getState().adjustCameraZoom(120)
  assert.equal(store.getState().cameraZoom, 0.25)

  for (let step = 0; step < 60; step += 1) store.getState().adjustCameraZoom(-120)
  assert.equal(store.getState().cameraZoom, 3)
})
