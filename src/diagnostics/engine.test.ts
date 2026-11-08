import test from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticEngine } from './engine'
import { parseEvent, safeData } from './contract'
import { diagnosticFile, parseDiagnosticFile } from './portable'

test('contract keeps distinct legitimate actions and round-trips portable and JSONL', () => {
  const engine = new DiagnosticEngine()
  engine.emit({ action: 'editor.select', result: 'completed' })
  engine.emit({ action: 'editor.select', result: 'completed' })
  const events = engine.snapshot()
  assert.notEqual(events[0].eventId, events[1].eventId)
  assert.deepEqual(parseDiagnosticFile(JSON.stringify(diagnosticFile(events, '0.1.0'))), events)
  assert.deepEqual(parseDiagnosticFile(events.map((event) => JSON.stringify(event)).join('\n')), events)
})
test('continuous operations retain first before and effective final changes on all axes', () => {
  const engine = new DiagnosticEngine()
  engine.coalesce('move', { action: 'move', data: { before: { x: 0 }, after: { x: 1 } } })
  engine.coalesce('move', { action: 'move', data: { before: { y: 0, x: 1 }, after: { y: 2, x: 2 } } })
  engine.flush()
  assert.equal(engine.snapshot().length, 1)
  assert.deepEqual(engine.snapshot()[0].data, { before: { x: 0, y: 0 }, after: { x: 2, y: 2 } })
})
test('an unrelated camera event is not suppressed during another operation', () => {
  const engine = new DiagnosticEngine()
  engine.coalesce('measurement', { action: 'resize', data: { after: { width: 2 } } })
  engine.emit({ action: 'camera.zoom', result: 'completed' })
  engine.flush()
  assert.equal(engine.snapshot().length, 2)
})
test('coalescing preserves different fields changed on the same object', () => {
  const engine = new DiagnosticEngine()
  engine.coalesce('move', { action: 'move', data: { before: { obj: { x: 0 } }, after: { obj: { x: 1 } } } })
  engine.coalesce('move', { action: 'move', data: { before: { obj: { z: 0 } }, after: { obj: { z: 2 } } } })
  engine.flush()
  assert.deepEqual(engine.snapshot()[0].data, { before: { obj: { x: 0, z: 0 } }, after: { obj: { x: 1, z: 2 } } })
})
test('privacy rejects arbitrary strings and malformed envelopes, including oversize events', () => {
  assert.deepEqual(safeData({ name: 'Pablo', path: 'C:/private', note: 'private', x: 2, reason: 'axis-locked' }), { x: 2, reason: 'axis-locked' })
  assert.throws(() => parseEvent({ schemaVersion: 99 }))
  const engine = new DiagnosticEngine()
  const event = engine.emit({ action: 'move', data: { x: 3 } })!
  assert.throws(() => parseEvent({ ...event, timestamp: 'yesterday' }))
  assert.throws(() => parseDiagnosticFile(JSON.stringify({ format: 'room-builder-diagnostics', version: 2, events: [] })))
})
test('memory remains bounded and a broken consumer cannot break emission', () => {
  const engine = new DiagnosticEngine(true, 4096)
  engine.subscribe(() => { throw new Error('consumer') })
  for (let index = 0; index < 200; index++) engine.emit({ action: 'move', data: { x: index } })
  assert.ok(engine.dropped > 0)
  assert.ok(engine.snapshot().length < 200)
  assert.notEqual(engine.objectId('private@email.example'), 'private@email.example')
})
