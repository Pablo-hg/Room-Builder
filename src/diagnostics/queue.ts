import { byteSize, type DiagnosticEvent } from './contract'

/** Bounded async batch consumer. A failed sink cannot block the editor or poison later writes. */
export class DiagnosticQueue {
  private pending: DiagnosticEvent[] = []
  private bytes = 0
  private running: Promise<void> | undefined
  private timer: ReturnType<typeof setTimeout> | undefined
  private retry = 0
  dropped = 0
  failures = 0
  constructor(private write: (batch: DiagnosticEvent[]) => Promise<void>, private report: (code: string) => void,
    private maxBytes = 1024 * 1024, private batchBytes = 48 * 1024) {}
  push(event: DiagnosticEvent) {
    this.pending.push(event); this.bytes += byteSize(event)
    while (this.pending.length > 1000 || this.bytes > this.maxBytes) {
      const index = this.pending.findIndex((item) => item.level === 'debug' || item.level === 'info')
      const [removed] = this.pending.splice(index < 0 ? 0 : index, 1)
      this.bytes -= byteSize(removed); this.dropped++
    }
    this.schedule(250)
  }
  private schedule(delay: number) { if (!this.timer) this.timer = setTimeout(() => { this.timer = undefined; void this.flush() }, delay) }
  flush(): Promise<void> {
    if (this.running) return this.running.then(() => this.pending.length && !this.timer ? this.flush() : undefined)
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined }
    if (!this.pending.length) return Promise.resolve()
    const batch: DiagnosticEvent[] = []
    let size = 0
    while (this.pending.length && batch.length < 100 && size + byteSize(this.pending[0]) <= this.batchBytes) {
      const next = this.pending.shift()!; const bytes = byteSize(next)
      batch.push(next); this.bytes -= bytes; size += bytes
    }
    this.running = Promise.resolve().then(() => this.write(batch)).then(() => {
      if (this.failures || this.dropped) this.report('recovered')
      this.failures = 0; this.retry = 0
    }).catch(() => {
      this.failures++
      if (this.retry++ < 3) for (const event of [...batch].reverse()) { this.pending.unshift(event); this.bytes += byteSize(event) }
      else { this.dropped += batch.length; this.retry = 0 }
      this.report('write-failed')
    }).finally(() => {
      this.running = undefined
      if (this.pending.length) this.schedule(this.failures ? Math.min(8000, 500 * 2 ** this.retry) : 0)
    })
    return this.running
  }
  async drain() {
    // A finite drain for explicit export: stop on failure; background retries remain scheduled.
    do { await this.flush() } while (this.pending.length && !this.failures)
  }
}
