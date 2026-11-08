import { appendFile, mkdir, readFile, writeFile, rename, stat, rmdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { byteSize, parseEvent, type DiagnosticEvent } from '../src/diagnostics/contract'
import { READABLE_HEADER, readableEvent } from './diagnostics/readable'

/** One bounded, readable development log. Browser IndexedDB remains canonical. */
export class DiagnosticFileWriter {
  private chain = Promise.resolve()
  private seen = new Set<string>()
  /** One visible enter/exit per collision pair during a user operation; structured events are untouched. */
  private summarizedCollisions = new Set<string>()
  private opening?: Promise<void>
  readonly file: string
  constructor(private directory: string, private maxBytes = 5 * 1024 * 1024) {
    this.file = resolve(directory, 'LECTURA.log')
    if (maxBytes < Buffer.byteLength(READABLE_HEADER) + 256) throw new Error('diagnostic.file-limit-too-small')
  }
  initialize() {
    if (!this.opening) this.opening = this.open().catch((error) => { this.opening = undefined; throw error })
    return this.opening
  }
  private async open() {
    await mkdir(this.directory, { recursive: true })
    let contents: string
    try { contents = await readFile(this.file, 'utf8') }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      // Migrate the former active file on first start; leave unrelated historical files in place.
      const oldDirectory = resolve(this.directory, 'diagnostics')
      try {
        await rename(resolve(oldDirectory, 'LECTURA.log'), this.file)
        await rmdir(oldDirectory).catch(() => undefined)
        contents = await readFile(this.file, 'utf8')
      } catch (migrationError) {
        if ((migrationError as NodeJS.ErrnoException).code !== 'ENOENT') throw migrationError
        await writeFile(this.file, READABLE_HEADER, { encoding: 'utf8', flag: 'wx' })
        return
      }
    }
    if (contents.trim() && !contents.trimStart().startsWith('ROOM BUILDER · DIAGNÓSTICO DEL EDITOR')) throw new Error('diagnostic.unrecognized-reading')
    const entries = contents.search(/^\[\d{2}\/\d{2}\/\d{4}/m)
    contents = READABLE_HEADER + (entries >= 0 ? contents.slice(entries) : '')
    // IDs stay in the underlying events (IndexedDB/export), never in the human-readable text.
    contents = contents.replace(/^Referencia: #[^\r\n]*(?:\r?\n)?/gm, '')
    await this.replace(this.bound(contents))
  }
  append(batch: DiagnosticEvent[]) {
    const work = this.chain.then(() => this.write(batch))
    this.chain = work.then(() => undefined, () => undefined)
    return work
  }
  /** Deduplicate retries during the Vite process without requiring IDs in the visible log. */
  private collisionKey(event: DiagnosticEvent) {
    if (event.category !== 'collisions' || !event.operationId || !/^spatial\.(entered|left)$/.test(event.action)) return undefined
    return [event.operationId, event.action, String(event.data.rule ?? ''), ...[...event.objectIds].sort()].join('|')
  }
  private bound(contents: string) {
    if (Buffer.byteLength(contents) <= this.maxBytes) return contents
    const tail = Buffer.from(contents).subarray(-(this.maxBytes - Buffer.byteLength(READABLE_HEADER))).toString('utf8')
    const firstComplete = tail.search(/^\[\d{2}\/\d{2}\/\d{4}/m)
    return READABLE_HEADER + (firstComplete >= 0 ? tail.slice(firstComplete) : '')
  }
  private async replace(contents: string) {
    await writeFile(`${this.file}.tmp`, contents, 'utf8')
    await rename(`${this.file}.tmp`, this.file)
  }
  private async write(batch: DiagnosticEvent[]) {
    await this.initialize()
    let size = await stat(this.file).then((info) => info.size).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return 0; throw error })
    if (!size) {
      this.opening = undefined; this.seen.clear()
      await this.initialize(); size = (await stat(this.file)).size
    }
    const events = batch.map(parseEvent)
    const newEvents = new Map(events.filter((event) => !this.seen.has(event.eventId)).map((event) => [event.eventId, event]))
    if (newEvents.size) {
      const committedCollisionKeys = new Set<string>()
      const addition = [...newEvents.values()].filter((event) => {
        const key = this.collisionKey(event)
        if (!key) return true
        if (this.summarizedCollisions.has(key) || committedCollisionKeys.has(key)) return false
        committedCollisionKeys.add(key)
        return true
      }).map(readableEvent).join('')
      if (addition && size + Buffer.byteLength(addition) <= this.maxBytes) await appendFile(this.file, addition, 'utf8')
      else if (addition) await this.replace(this.bound(await readFile(this.file, 'utf8') + addition))
      // Commit deduplication state only after a successful write; failed sends must retry.
      for (const key of committedCollisionKeys) {
        this.summarizedCollisions.add(key)
        if (this.summarizedCollisions.size > 10000) this.summarizedCollisions.delete(this.summarizedCollisions.values().next().value!)
      }
      for (const id of newEvents.keys()) {
        this.seen.add(id)
        if (this.seen.size > 10000) this.seen.delete(this.seen.values().next().value!)
      }
    }
    return events.map((event) => event.eventId)
  }
}

export function diagnosticsPlugin(): Plugin {
  return {
    name: 'room-builder-local-diagnostics', apply: 'serve',
    configureServer(server) {
      const writer = new DiagnosticFileWriter(resolve(server.config.root, 'logs'))
      void writer.initialize().catch(() => console.warn('[Room Builder] No se pudo abrir logs/LECTURA.log; se reintentará al recibir eventos.'))
      let waiting = 0
      server.middlewares.use('/__room-builder/interaction-log', (request, response) => {
        if (request.method !== 'POST') { response.writeHead(405).end(); return }
        if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}` && request.headers.origin !== `https://${request.headers.host}`) { response.writeHead(403).end(); return }
        if (!request.headers['content-type']?.startsWith('application/json')) { response.writeHead(415).end(); return }
        if (waiting >= 32) { response.writeHead(429).end(); return }
        waiting++
        let finished = false
        const finish = () => { if (!finished) { finished = true; waiting-- } }
        response.on('close', finish)
        const chunks: Buffer[] = []; let bytes = 0; let tooLarge = false
        request.on('error', () => { finish(); if (!response.headersSent) response.writeHead(400).end() })
        request.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes > 64 * 1024) { tooLarge = true; chunks.length = 0; if (!response.headersSent) response.writeHead(413).end(); return }
          if (!tooLarge) chunks.push(chunk)
        })
        request.on('end', () => {
          if (tooLarge) { finish(); return }
          let events: DiagnosticEvent[]
          try {
            const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            if (!Array.isArray(data) || !data.length || data.length > 100 || byteSize(data) > 64 * 1024) throw new Error('invalid batch')
            events = data.map(parseEvent)
          } catch { response.writeHead(400).end(); finish(); return }
          void writer.append(events).then((eventIds) => {
            response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ eventIds }))
          }).catch(() => { response.writeHead(503).end() }).finally(finish)
        })
      })
    },
  }
}
