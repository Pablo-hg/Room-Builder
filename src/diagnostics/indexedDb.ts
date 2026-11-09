import { byteSize, type DiagnosticEvent } from './contract'

export interface Retention { days: number; maxBytes: number }
export const DEFAULT_RETENTION: Retention = { days: 7, maxBytes: 5 * 1024 * 1024 }
type Row = { eventId: string; timestamp: string; priority: number; bytes: number; event: DiagnosticEvent }
const request = <T>(value: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error)
})
const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('diagnostic.transaction-aborted')); tx.onerror = () => reject(tx.error)
})
export class DiagnosticRepository {
  private database?: Promise<IDBDatabase>
  constructor(private factory: IDBFactory, private retention = DEFAULT_RETENTION, private name = 'room-builder-diagnostics') {}
  private open() {
    if (!this.database) this.database = new Promise<IDBDatabase>((resolve, reject) => {
      const opening = this.factory.open(this.name, 1)
      let expired = false
      const timer = setTimeout(() => { expired = true; reject(new Error('diagnostic.database-timeout')) }, 3000)
      opening.onupgradeneeded = () => {
        const db = opening.result
        const events = db.createObjectStore('events', { keyPath: 'eventId' })
        events.createIndex('timestamp', 'timestamp')
        events.createIndex('retention', ['priority', 'timestamp'])
        db.createObjectStore('meta')
      }
      opening.onsuccess = () => {
        clearTimeout(timer)
        if (expired) { opening.result.close(); return }
        opening.result.onversionchange = () => { opening.result.close(); this.database = undefined }
        resolve(opening.result)
      }
      opening.onerror = () => { clearTimeout(timer); reject(opening.error) }
    }).catch((error) => { this.database = undefined; throw error })
    return this.database
  }
  async configure(retention: Retention) {
    if (!Number.isFinite(retention.days) || retention.days < 1 || retention.days > 30 || !Number.isFinite(retention.maxBytes) || retention.maxBytes < 65536 || retention.maxBytes > 20 * 1024 * 1024) throw new Error('diagnostic.invalid-retention')
    this.retention = { ...retention }
    const db = await this.open(), tx = db.transaction('meta', 'readwrite'), complete = done(tx)
    tx.objectStore('meta').put(this.retention, 'retention')
    await complete
    await this.append([])
  }
  async append(batch: DiagnosticEvent[]) {
    const db = await this.open()
    const tx = db.transaction(['events', 'meta'], 'readwrite')
    const complete = done(tx)
    const events = tx.objectStore('events'), meta = tx.objectStore('meta')
    try {
      let total = Number(await request(meta.get('bytes'))) || 0
      const configured = await request(meta.get('retention')) as Retention | undefined
      if (configured) this.retention = configured
      // Queue lookups together while the transaction is active. Deduplicate the
      // batch first, because none of its puts exist when the lookups are queued.
      const unique = [...new Map([...batch].reverse().map((event) => [event.eventId, event])).values()].reverse()
      const existing = await Promise.all(unique.map((event) => request(events.getKey(event.eventId))))
      for (const [index, event] of unique.entries()) {
        if (existing[index] !== undefined) continue
        const row: Row = { eventId: event.eventId, timestamp: event.timestamp, priority: event.level === 'error' ? 3 : event.level === 'warn' ? 2 : event.level === 'info' ? 1 : 0, bytes: byteSize(event), event }
        events.put(row); total += row.bytes
      }
      const cutoff = new Date(Date.now() - this.retention.days * 86400000).toISOString()
      await new Promise<void>((resolve, reject) => {
        const cursor = events.index('timestamp').openCursor(IDBKeyRange.upperBound(cutoff))
        cursor.onerror = () => reject(cursor.error)
        cursor.onsuccess = () => { const item = cursor.result; if (!item) { resolve(); return }; total -= (item.value as Row).bytes; item.delete(); item.continue() }
      })
      if (total > this.retention.maxBytes) await new Promise<void>((resolve, reject) => {
        const cursor = events.index('retention').openCursor()
        cursor.onerror = () => reject(cursor.error)
        cursor.onsuccess = () => { const item = cursor.result; if (!item || total <= this.retention.maxBytes) { resolve(); return }; total -= (item.value as Row).bytes; item.delete(); item.continue() }
      })
      meta.put(Math.max(0, total), 'bytes')
      await complete
    } catch (error) { try { tx.abort() } catch { /* Already finished. */ }; await complete.catch(() => undefined); this.database = undefined; db.close(); throw error }
  }
  async read(): Promise<DiagnosticEvent[]> {
    await this.append([])
    const db = await this.open()
    const tx = db.transaction('events', 'readonly'), complete = done(tx)
    const rows = await request(tx.objectStore('events').index('timestamp').getAll()) as Row[]
    await complete
    return rows.map((row) => row.event)
  }
}
