// Análisis offline y agregado del log LOCAL de desarrollo.
// No imprime el contenido, nombres de objetos, detalles ni identificadores de sesión.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const path = resolve(process.argv[2] ?? 'logs/interactions.log')
const eventTypes = [
  ['creación', /^(Se crea|Se añade|Se inicia una sesión)/],
  ['selección', /^(Se selecciona|Se deselecciona|Se vuelve a pulsar|El puntero alcanza)/],
  ['movimiento', /^(Se mueve|Comienza el movimiento|Finaliza el movimiento|Finaliza el arrastre)/],
  ['rotación', /^(Se gira|Comienza el giro|Finaliza el giro)/],
  ['cámara y vistas', /^(Se cambia la vista|Se abre la vista|Se cambia la orientación|Se ajusta el zoom|Se ajusta la altura)/],
  ['medidas', /^(Se cambia (anchura|altura|profundidad)|Se modifica)/],
  ['visibilidad', /^(Se muestra|Se oculta)/],
  ['otros', /.*/],
]
const pattern = /^\[(\d{2}\/\d{2}\/\d{4}),?\s+(\d{2}:\d{2}:\d{2})\.\d{3}\] \[([^\]]+)\] (.*)$/
const counts = new Map(eventTypes.map(([name]) => [name, 0]))
const bursts = new Map()
const sessions = new Set()
let lines = 0
let invalid = 0
let duplicates = 0
let lastDescription = ''
let totalLineBytes = 0
let largestLineBytes = 0
const categories = new Map()
const eventIds = new Set()
let repeatedEventIds = 0

try {
  const info = await stat(path)
  const stream = createReadStream(path, { encoding: 'utf8' })
  const reader = createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of reader) {
    if (!line.trim()) continue
    lines += 1
    const bytes = Buffer.byteLength(line, 'utf8')
    totalLineBytes += bytes
    largestLineBytes = Math.max(largestLineBytes, bytes)
    if (line.trimStart().startsWith('{')) {
      try {
        const event = JSON.parse(line)
        if (event.schemaVersion !== 1 || typeof event.eventId !== 'string' || typeof event.timestamp !== 'string' || typeof event.category !== 'string' || typeof event.sessionId !== 'string') throw new Error('invalid event')
        if (eventIds.has(event.eventId)) repeatedEventIds++
        eventIds.add(event.eventId)
        sessions.add(event.sessionId)
        categories.set(event.category, (categories.get(event.category) ?? 0) + 1)
        const bucket = event.timestamp.slice(0, 19)
        bursts.set(bucket, (bursts.get(bucket) ?? 0) + 1)
      } catch { invalid++ }
      continue
    }
    const match = pattern.exec(line)
    if (!match) {
      invalid += 1
      continue
    }
    const [, date, second, session, description] = match
    if (description === lastDescription) duplicates += 1
    lastDescription = description
    sessions.add(session)
    const bucket = `${date} ${second}`
    bursts.set(bucket, (bursts.get(bucket) ?? 0) + 1)
    const type = eventTypes.find(([, regex]) => regex.test(description))?.[0] ?? 'otros'
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  let peak = 0
  for (const count of bursts.values()) peak = Math.max(peak, count)
  const secondsWithEvents = bursts.size
  const report = {
    fileBytes: info.size,
    entries: lines,
    sessions: sessions.size,
    entriesWithUnrecognizedFormat: invalid,
    consecutiveRepeatedDescriptions: duplicates,
    repeatedStructuredEventIds: repeatedEventIds,
    structuredCategories: Object.fromEntries(categories),
    averageLineBytes: lines ? Math.round(totalLineBytes / lines) : 0,
    maxLineBytes: largestLineBytes,
    maxEntriesInOneSecond: peak,
    averageEntriesPerActiveSecond: secondsWithEvents ? Number((lines / secondsWithEvents).toFixed(2)) : 0,
    eventBuckets: Object.fromEntries(counts),
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
} catch (error) {
  process.stderr.write(`No se pudo analizar el archivo local: ${error?.code ?? 'ERROR'}\n`)
  process.exitCode = 1
}
