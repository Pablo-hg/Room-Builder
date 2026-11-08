import { appendFile, mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { byteSize, parseEvent, type DiagnosticEvent } from '../src/diagnostics/contract'

export class DiagnosticFileWriter {
  private chain = Promise.resolve()
  private seen = new Set<string>()
  private cleaned = 0
  constructor(private directory: string, private segmentBytes = 1024 * 1024, private totalBytes = 50 * 1024 * 1024) {}
  append(batch: DiagnosticEvent[]) {
    const work = this.chain.then(() => this.write(batch))
    this.chain = work.then(() => undefined, () => undefined)
    return work
  }
  private async write(batch: DiagnosticEvent[]) {
    await mkdir(this.directory, { recursive: true })
    for (const input of batch) {
      const event = parseEvent(input)
      if (this.seen.has(event.eventId)) continue
      const session = createHash('sha256').update(event.sessionId).digest('hex').slice(0, 16)
      const prefix = `${event.timestamp.slice(0, 10)}-${session}-${event.category}-`
      const files = (await readdir(this.directory)).filter((name) => name.startsWith(prefix) && /-\d{5}\.jsonl$/.test(name)).sort()
      let segment = files.length ? Number(files[files.length - 1].slice(-11, -6)) : 1
      const line = JSON.stringify(event) + '\n'
      let file = resolve(this.directory, `${prefix}${String(segment).padStart(5, '0')}.jsonl`)
      const size = await stat(file).then((info) => info.size).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return 0; throw error })
      if (size + Buffer.byteLength(line) > this.segmentBytes) { segment++; file = resolve(this.directory, `${prefix}${String(segment).padStart(5, '0')}.jsonl`) }
      await appendFile(file, line, 'utf8')
      this.seen.add(event.eventId)
      if (this.seen.size > 10000) this.seen.delete(this.seen.values().next().value!)
    }
    if (Date.now() - this.cleaned > 60_000) { await this.cleanup(); this.cleaned = Date.now() }
    return batch.map((event) => event.eventId)
  }
  private async cleanup() {
    const files = await Promise.all((await readdir(this.directory)).filter((name) => /^\d{4}-\d{2}-\d{2}-[a-f0-9]{16}-(interactions|collisions|errors|system)-\d{5}\.jsonl$/.test(name)).map(async (name) => ({ file: resolve(this.directory, name), info: await stat(resolve(this.directory, name)) })))
    files.sort((a, b) => a.info.mtimeMs - b.info.mtimeMs)
    let total = files.reduce((sum, item) => sum + item.info.size, 0)
    for (const { file, info } of files) if (info.mtimeMs < Date.now() - 7 * 86400000 || total > this.totalBytes) { await unlink(file); total -= info.size }
  }
}

export function diagnosticsPlugin(): Plugin {
  return {
    name: 'room-builder-local-diagnostics', apply: 'serve',
    configureServer(server) {
      const writer = new DiagnosticFileWriter(resolve(server.config.root, 'logs', 'diagnostics'))
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
