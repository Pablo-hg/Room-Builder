import test from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticEngine } from './engine'
import { readableEvent } from '../../tools/diagnostics/readable'
import { filterEvents } from '../../tools/diagnostics/read'

test('internal reading explains effective movement, zoom and cancellation in Spanish', () => {
  const engine = new DiagnosticEngine()
  const event = engine.emit({ action: 'editor.moveFurniture', result: 'cancelled', objectIds: ['obj-123'], data: {
    view: 'isometric', before: { 'obj-123': { x: 0 } }, after: { 'obj-123': { x: .5 } }, changesApplied: true,
  } })!
  const text = readableEvent(event)
  assert.match(text, /Mover mueble — Cancelada/)
  assert.match(text, /Posición X: 0 m → 0,5 m/)
  assert.match(text, /conserva los cambios ya aceptados/)
  assert.match(readableEvent(engine.emit({ action: 'editor.adjustCameraZoom', data: { before: { cameraZoom: 1 }, after: { cameraZoom: .85 } } })!), /Zoom: 100 % → 85 %/)
})
test('blocking conflicts have their reason, minimum distance and both object references', () => {
  const engine = new DiagnosticEngine()
  const text = readableEvent(engine.emit({ action: 'spatial.constraint', level: 'warn', category: 'collisions', objectIds: ['obj-a', 'obj-b'],
    data: { disposition: 'blocking', rule: 'opening-gap', requiredGap: .15 } })!)
  assert.match(text, /bloquea la operación/)
  assert.match(text, /separación mínima/)
  assert.match(text, /0,15 m/)
  assert.match(text, /obj-a, obj-b/)
})
test('file reader filters actual event fields, without interpreting descriptions', () => {
  const engine = new DiagnosticEngine()
  const a = engine.emit({ action: 'same', category: 'interactions', objectIds: ['obj-a'] })!
  const b = engine.emit({ action: 'same', category: 'collisions', level: 'warn', objectIds: ['obj-b'], operationId: 'op2' })!
  assert.deepEqual(filterEvents([a, b], { categoria: 'collisions', nivel: 'warn', objeto: 'obj-b', operacion: 'op2' }), [b])
})
