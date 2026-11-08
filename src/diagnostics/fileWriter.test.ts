import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DiagnosticFileWriter } from '../../tools/diagnosticsPlugin'
import { DiagnosticEngine } from './engine'
import { parseLegacy } from './dev/legacy'

test('file writer recovers after filesystem failure, deduplicates retries and preserves history', async () => {
  const root = await mkdtemp(join(tmpdir(), 'room-builder-logs-'))
  try {
    const directory = join(root, 'diagnostics'), history = join(root, 'interactions.log')
    await writeFile(history, 'historic untouched')
    await writeFile(directory, 'temporarily blocks mkdir')
    const writer = new DiagnosticFileWriter(directory, 8192)
    const engine = new DiagnosticEngine()
    const event = engine.emit({ action: 'create', result: 'completed' })!
    await assert.rejects(writer.append([event]))
    await unlink(directory); await mkdir(directory)
    await writer.append([event]); await writer.append([event])
    for (let index = 0; index < 10; index++) await writer.append([engine.emit({ action: 'move', result: 'completed' })!])
    assert.deepEqual(await readdir(directory), ['LECTURA.log'])
    const readable = await readFile(writer.file, 'utf8')
    assert.match(readable, /DIAGNÓSTICO DEL EDITOR/)
    assert.match(readable, /Completada/)
    assert.equal(readable.split(`Referencia: #${event.seq} · sesión ${event.sessionId}`).length - 1, 1)
    const reopened = new DiagnosticFileWriter(directory, 8192)
    await reopened.append([event])
    assert.equal(await readFile(writer.file, 'utf8'), readable)
    await writeFile(writer.file, '')
    await reopened.append([event])
    assert.match(await readFile(writer.file, 'utf8'), /DIAGNÓSTICO DEL EDITOR/)
    assert.equal(await readFile(history, 'utf8'), 'historic untouched')
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('one active file combines all categories and trims complete old entries within its limit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'room-builder-single-log-'))
  try {
    const engine = new DiagnosticEngine(), writer = new DiagnosticFileWriter(root, 1600)
    await writer.initialize()
    for (const category of ['interactions', 'collisions', 'errors', 'system'] as const) await writer.append([engine.emit({ action: 'session.started', category })!])
    const mixed = await readFile(writer.file, 'utf8')
    for (const category of ['INTERACCIÓN', 'CONFLICTO ESPACIAL', 'ERROR / ADVERTENCIA', 'SISTEMA']) assert.ok(mixed.includes(category))
    for (let index = 0; index < 20; index++) await writer.append([engine.emit({ action: 'editor.moveFurniture', result: 'completed' })!])
    const bounded = await readFile(writer.file, 'utf8')
    assert.ok(Buffer.byteLength(bounded) <= 1600)
    assert.ok(bounded.includes('Referencia: #24 '))
    assert.ok(!bounded.includes('Referencia: #1 '))
    assert.ok(bounded.endsWith('\n\n'))
    assert.deepEqual(await readdir(root), ['LECTURA.log'])
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('legacy reader retains original text without inventing operation outcomes', () => {
  const entries = parseLegacy('[08/11/2026, 14:00:00.000] [old-session] Se mueve un objeto.\n')
  assert.equal(entries[0].description, 'Se mueve un objeto.')
  assert.equal('result' in entries[0], false)
})
