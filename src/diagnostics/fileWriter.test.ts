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
    assert.equal(readable.split('create — Completada').length - 1, 1)
    assert.doesNotMatch(readable, /Referencia:|sesión s-/)
    const reopened = new DiagnosticFileWriter(directory, 8192)
    await reopened.initialize()
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
    assert.ok(bounded.includes('Mover mueble'))
    assert.ok(!bounded.includes('Referencia:'))
    assert.ok(bounded.endsWith('\n\n'))
    assert.deepEqual(await readdir(root), ['LECTURA.log'])
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('legacy reader retains original text without inventing operation outcomes', () => {
  const entries = parseLegacy('[08/11/2026, 14:00:00.000] [old-session] Se mueve un objeto.\n')
  assert.equal(entries[0].description, 'Se mueve un objeto.')
  assert.equal('result' in entries[0], false)
})
test('old nested reading migrates intact to logs/LECTURA.log without visible reference lines', async () => {
  const root = await mkdtemp(join(tmpdir(), 'room-builder-log-migrate-'))
  try {
    const oldDir = join(root, 'diagnostics')
    await mkdir(oldDir)
    const old = 'ROOM BUILDER · DIAGNÓSTICO DEL EDITOR\n\n[08/11/2026, 21:17:25,660] INFO · INTERACCIÓN\nMover mueble — Completada\nReferencia: #10 · operación op7 · sesión s-test\n\n'
    await writeFile(join(oldDir, 'LECTURA.log'), old)
    const writer = new DiagnosticFileWriter(root, 8192)
    await writer.initialize()
    const migrated = await readFile(join(root, 'LECTURA.log'), 'utf8')
    assert.match(migrated, /Mover mueble — Completada/)
    assert.doesNotMatch(migrated, /Referencia:/)
    assert.deepEqual(await readdir(root), ['LECTURA.log'])
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('repeated collision transitions in a single operation are summarized only in the reading', async () => {
  const root = await mkdtemp(join(tmpdir(), 'room-builder-log-collisions-'))
  try {
    const writer = new DiagnosticFileWriter(root)
    const engine = new DiagnosticEngine()
    const events = Array.from({ length: 8 }, (_, i) => engine.emit({
      action: i % 2 ? 'spatial.left' : 'spatial.entered', category: 'collisions',
      operationId: 'operation-1', objectIds: ['obj-a', 'obj-b'], data: { rule: 'oriented-box-overlap' },
    })!)
    await writer.append(events)
    const contents = await readFile(writer.file, 'utf8')
    assert.equal(contents.split('Aparece un conflicto espacial').length - 1, 1)
    assert.equal(contents.split('Deja de detectarse un conflicto espacial').length - 1, 1)
    assert.equal(engine.snapshot().length, 8)
    await writer.append([events[0]])
    assert.equal(await readFile(writer.file, 'utf8'), contents)
  } finally { await rm(root, { recursive: true, force: true }) }
})
