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
    const writer = new DiagnosticFileWriter(directory, 1024)
    const engine = new DiagnosticEngine()
    const event = engine.emit({ action: 'create', result: 'completed' })!
    await assert.rejects(writer.append([event]))
    await unlink(directory); await mkdir(directory)
    await writer.append([event]); await writer.append([event])
    for (let index = 0; index < 10; index++) await writer.append([engine.emit({ action: 'move', result: 'completed' })!])
    const files = await readdir(directory)
    assert.ok(files.length > 1)
    const lines = (await Promise.all(files.map((file) => readFile(join(directory, file), 'utf8')))).join('').trim().split('\n')
    assert.equal(lines.filter((line) => JSON.parse(line).eventId === event.eventId).length, 1)
    assert.equal(await readFile(history, 'utf8'), 'historic untouched')
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('legacy reader retains original text without inventing operation outcomes', () => {
  const entries = parseLegacy('[08/11/2026, 14:00:00.000] [old-session] Se mueve un objeto.\n')
  assert.equal(entries[0].description, 'Se mueve un objeto.')
  assert.equal('result' in entries[0], false)
})
