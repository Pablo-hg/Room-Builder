import { byteSize, MAX_EVENT_BYTES, safeData, type DiagnosticEvent } from './contract'

type Input = Pick<DiagnosticEvent, 'action'> & Partial<Omit<DiagnosticEvent, 'schemaVersion' | 'eventId' | 'sessionId' | 'seq' | 'timestamp'>>
function mergeSnapshots(first: unknown, second: unknown, keepFirst: boolean) {
  const left = (first ?? {}) as Record<string, unknown>, right = (second ?? {}) as Record<string, unknown>
  const result = { ...left }
  for (const [key, value] of Object.entries(right)) {
    const old = left[key]
    if (old && value && typeof old === 'object' && typeof value === 'object' && !Array.isArray(old) && !Array.isArray(value)) result[key] = keepFirst ? { ...value, ...old } : { ...old, ...value }
    else if (!keepFirst || !Object.hasOwn(left, key)) result[key] = value
  }
  return result
}
export class DiagnosticEngine {
  readonly sessionId = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  private seq = 0
  private operation = 0
  private entries: DiagnosticEvent[] = []
  private bytes = 0
  private listeners = new Set<(event: DiagnosticEvent) => void>()
  private groups = new Map<string, { input: Input; timer: ReturnType<typeof setTimeout> }>()
  dropped = 0
  constructor(private enabled = true, private maxBytes = 1024 * 1024) {}
  nextOperation() { return `${this.sessionId}:op${++this.operation}` }
  /** Pseudonyms protect even user-supplied IDs from imported designs. Stable within a session. */
  objectId(id: string) {
    let hash = 2166136261
    for (const char of `${this.sessionId}:${id}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    return `obj-${(hash >>> 0).toString(16)}`
  }
  emit(input: Input) {
    if (!this.enabled) return
    const seq = ++this.seq
    const event: DiagnosticEvent = {
      schemaVersion: 1, eventId: `${this.sessionId}:${seq}`, sessionId: this.sessionId, seq,
      timestamp: new Date().toISOString(), category: input.category ?? 'interactions', level: input.level ?? 'info',
      action: input.action, phase: input.phase ?? 'finished', ...(input.result ? { result: input.result } : {}),
      ...(input.operationId ? { operationId: input.operationId } : {}), objectIds: input.objectIds?.slice(0, 200) ?? [],
      data: (safeData(input.data ?? {}) ?? {}) as Record<string, unknown>,
    }
    if (byteSize(event) > MAX_EVENT_BYTES) event.data = { truncated: true, reason: 'event-size-limit' }
    const size = byteSize(event)
    this.entries.push(event); this.bytes += size
    while (this.entries.length > 1000 || this.bytes > this.maxBytes) {
      const index = this.entries.findIndex((item) => item.level === 'debug' || item.level === 'info')
      const [removed] = this.entries.splice(index < 0 ? 0 : index, 1)
      this.bytes -= byteSize(removed); this.dropped++
    }
    for (const listener of this.listeners) { try { listener(event) } catch { /* A diagnostic consumer cannot break an editor action. */ } }
    return event
  }
  /** One terminal summary per continuous operation: first before, last effective after. */
  coalesce(key: string, input: Input) {
    const previous = this.groups.get(key)
    if (previous) clearTimeout(previous.timer)
    else if (this.groups.size >= 32) this.flush(this.groups.keys().next().value)
    const merged = { ...input, operationId: previous?.input.operationId ?? input.operationId ?? this.nextOperation(),
      objectIds: [...new Set([...(previous?.input.objectIds ?? []), ...(input.objectIds ?? [])])].slice(0, 200),
      data: { ...input.data,
        before: mergeSnapshots(previous?.input.data?.before, input.data?.before, true),
        after: mergeSnapshots(previous?.input.data?.after, input.data?.after, false) } }
    this.groups.set(key, { input: merged, timer: setTimeout(() => this.flush(key), 350) })
    return merged.operationId
  }
  flush(key?: string) {
    for (const [id, group] of this.groups) if (key === undefined || id === key) {
      clearTimeout(group.timer); this.groups.delete(id); this.emit(group.input)
    }
  }
  snapshot() { return [...this.entries] }
  subscribe(listener: (event: DiagnosticEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
}
export const diagnostics = new DiagnosticEngine(typeof window !== 'undefined')
