import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { SavedDesign } from '../domain/designV1'
import { createLocalDesignRepository, DesignStorageConflictError, SAVED_DESIGNS_KEY, STORAGE_KEY } from './localDesignRepository'

class MemoryStorage {
  values = new Map<string, string>()
  writes = 0
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.writes += 1; this.values.set(key, value) }
}

function design(id: string): SavedDesign {
  return { id, name: `Diseño ${id}`, savedAt: '2026-10-28T10:00:00.000Z', data: JSON.parse(readFileSync(new URL('../../tests/fixtures/persistence-v1/valid-complete.json', import.meta.url), 'utf8')) }
}

test('el repositorio conserva los cinco diseños completos, sus metadatos y la clave actual', () => {
  const storage = new MemoryStorage()
  const repository = createLocalDesignRepository(() => storage)
  const designs = Array.from({ length: 5 }, (_, index) => design(`old:${index}`))
  repository.write(designs)
  assert.equal(SAVED_DESIGNS_KEY, 'room-builder:v0.1:designs')
  assert.equal(STORAGE_KEY, 'room-builder:v0.1:design')
  assert.deepEqual(repository.read(), designs)
  assert.equal(storage.writes, 1)
  // Preserve the previous reader: ignore entries beyond the five-design limit.
  storage.values.set(SAVED_DESIGNS_KEY, JSON.stringify([...designs, { invalid: true }]))
  assert.deepEqual(repository.read(), designs)
  assert.equal(storage.writes, 1)
})

test('migra la clave legacy una vez y conserva el original y el ID generado al releer', () => {
  const storage = new MemoryStorage()
  const original = JSON.stringify(design('old').data)
  storage.values.set(STORAGE_KEY, original)
  const repository = createLocalDesignRepository(() => storage)
  const first = repository.read()
  assert.equal(first.length, 1)
  assert.match(first[0].id, /^design-\d+-[a-z0-9]*$/)
  assert.equal(first[0].name, 'Diseño guardado anteriormente')
  assert.ok(Number.isFinite(Date.parse(first[0].savedAt)))
  assert.deepEqual(first[0].data, JSON.parse(original))
  assert.deepEqual(repository.read(), first)
  assert.equal(storage.values.get(STORAGE_KEY), original)
  assert.equal(storage.writes, 1)
})

test('una lista actual vacía tiene prioridad sobre legacy; los datos corruptos no se sobrescriben', () => {
  const storage = new MemoryStorage()
  storage.values.set(STORAGE_KEY, JSON.stringify(design('legacy').data))
  const repository = createLocalDesignRepository(() => storage)
  storage.values.set(SAVED_DESIGNS_KEY, '[]')
  assert.deepEqual(repository.read(), [])
  for (const raw of ['{', '{}', '[null]', JSON.stringify([{ ...design('bad'), savedAt: null }]), JSON.stringify([{ ...design('bad'), data: { version: 2 } }])]) {
    storage.values.set(SAVED_DESIGNS_KEY, raw)
    const before = new Map(storage.values)
    assert.throws(() => repository.read())
    assert.deepEqual(storage.values, before)
  }
  assert.equal(storage.writes, 0)
})

test('legacy inválido o inaccesible no escribe una lista nueva', () => {
  const storage = new MemoryStorage()
  const repository = createLocalDesignRepository(() => storage)
  assert.deepEqual(repository.read(), [])
  for (const raw of ['{', JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, room: null, furniture: [] })]) {
    storage.values.set(STORAGE_KEY, raw)
    assert.throws(() => repository.read())
    assert.equal(storage.values.has(SAVED_DESIGNS_KEY), false)
  }
  assert.equal(storage.writes, 0)
  let accesses = 0
  const blocked = createLocalDesignRepository(() => { accesses += 1; throw new Error('storage blocked') })
  assert.equal(accesses, 0)
  assert.throws(() => blocked.read(), /storage blocked/)
  assert.throws(() => blocked.write([]), /storage blocked/)
})

test('un fallo de escritura durante migración o guardado conserva los valores anteriores', () => {
  const values = new Map([[STORAGE_KEY, JSON.stringify(design('legacy').data)]])
  const repository = createLocalDesignRepository(() => ({
    getItem: (key) => values.get(key) ?? null,
    setItem: () => { throw new Error('quota exceeded') },
  }))
  const before = new Map(values)
  assert.throws(() => repository.read(), /quota exceeded/)
  assert.deepEqual(values, before)
  values.set(SAVED_DESIGNS_KEY, JSON.stringify([design('saved')]))
  const saved = values.get(SAVED_DESIGNS_KEY)
  assert.deepEqual(repository.read(), [design('saved')])
  assert.throws(() => repository.write([design('replacement')]), /quota exceeded/)
  assert.equal(values.get(SAVED_DESIGNS_KEY), saved)
  assert.deepEqual(repository.read(), [design('saved')])
})


test('detecta escrituras de otra pestaña y nunca sobrescribe la biblioteca', () => {
  const storage = new MemoryStorage()
  const first = createLocalDesignRepository(() => storage)
  const second = createLocalDesignRepository(() => storage)
  assert.deepEqual(first.read(), [])
  assert.deepEqual(second.read(), [])
  first.write([design('primero')])
  const persisted = storage.getItem(SAVED_DESIGNS_KEY)
  assert.throws(() => second.write([design('segundo')]), DesignStorageConflictError)
  assert.equal(storage.getItem(SAVED_DESIGNS_KEY), persisted)
  assert.deepEqual(second.read(), [design('primero')])
  second.write([design('primero'), design('segundo')])
  assert.deepEqual(first.read(), [design('primero'), design('segundo')])
})

test('no sustituye una biblioteca no validada o corrupta, ni supera cinco diseños', () => {
  const storage = new MemoryStorage()
  storage.setItem(SAVED_DESIGNS_KEY, '{')
  const repository = createLocalDesignRepository(() => storage)
  assert.throws(() => repository.read())
  assert.throws(() => repository.write([]), DesignStorageConflictError)
  assert.equal(storage.getItem(SAVED_DESIGNS_KEY), '{')
  const fresh = createLocalDesignRepository(() => storage)
  assert.throws(() => fresh.write([]), DesignStorageConflictError)
  const empty = new MemoryStorage()
  const bounded = createLocalDesignRepository(() => empty)
  assert.throws(() => bounded.write(Array.from({ length: 6 }, (_, i) => design(String(i)))), /cinco/)
  assert.equal(empty.getItem(SAVED_DESIGNS_KEY), null)
})
