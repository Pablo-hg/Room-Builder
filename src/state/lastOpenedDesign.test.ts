import assert from 'node:assert/strict'
import { test } from 'node:test'
import { designToOpenOnStart, LAST_OPENED_DESIGN_KEY, loadLastOpenedDesignId, saveLastOpenedDesignId } from './lastOpenedDesign'

const designs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

test('al arrancar se abre el diseño recordado y, si no existe, el primero', () => {
  assert.equal(designToOpenOnStart(designs, 'c')?.id, 'c')
  assert.equal(designToOpenOnStart(designs, 'borrado')?.id, 'a', 'el recordado ya no existe')
  assert.equal(designToOpenOnStart(designs, null)?.id, 'a')
  assert.equal(designToOpenOnStart([], 'c'), undefined)
})

test('sin almacenamiento (pruebas, modo privado) no falla y no recuerda nada', () => {
  assert.equal(loadLastOpenedDesignId(), null)
  assert.doesNotThrow(() => saveLastOpenedDesignId('x'))
})

test('se recuerda y se lee el último diseño; un identificador vacío no se guarda', () => {
  const store = new Map<string, string>()
  const target = globalThis as { localStorage?: unknown }
  const previous = target.localStorage
  target.localStorage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value) } }
  try {
    saveLastOpenedDesignId('b')
    assert.equal(store.get(LAST_OPENED_DESIGN_KEY), 'b')
    assert.equal(loadLastOpenedDesignId(), 'b')
    saveLastOpenedDesignId('')
    assert.equal(loadLastOpenedDesignId(), 'b', 'el vacío (arranque) no borra el recuerdo')
  } finally { target.localStorage = previous }
})
