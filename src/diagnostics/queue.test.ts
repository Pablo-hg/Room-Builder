import test from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticQueue } from './queue'
import { DiagnosticEngine } from './engine'

test('sink recovery retries identical event IDs and a failure does not poison subsequent batches', async () => {
  const attempts: string[][] = []
  let fail = true
  const engine = new DiagnosticEngine()
  const queue = new DiagnosticQueue(async (batch) => { attempts.push(batch.map((event) => event.eventId)); if (fail) throw new Error('disk') }, () => undefined)
  queue.push(engine.emit({ action: 'first' })!)
  await queue.flush()
  fail = false
  await queue.drain()
  assert.deepEqual(attempts[0], attempts[1])
  queue.push(engine.emit({ action: 'second' })!)
  await queue.drain()
  assert.equal(attempts.length, 3)
})
test('queue drops low priority details under saturation and reports loss', async () => {
  const engine = new DiagnosticEngine()
  const written: string[] = []
  const queue = new DiagnosticQueue(async (batch) => { written.push(...batch.map((event) => event.action)) }, () => undefined, 2048)
  queue.push(engine.emit({ action: 'important', level: 'error' })!)
  for (let index = 0; index < 50; index++) queue.push(engine.emit({ action: 'detail', level: 'debug' })!)
  await queue.drain()
  assert.ok(queue.dropped > 0)
  assert.ok(written.includes('important'))
})
