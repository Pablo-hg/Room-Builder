export const DIAGNOSTIC_VERSION = 1
export const CATEGORIES = ['interactions', 'collisions', 'errors', 'system'] as const
export const LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type Category = typeof CATEGORIES[number]
export type Level = typeof LEVELS[number]
export type Result = 'completed' | 'cancelled' | 'rejected' | 'failed'
export interface DiagnosticEvent {
  schemaVersion: 1
  eventId: string
  sessionId: string
  seq: number
  timestamp: string
  operationId?: string
  category: Category
  level: Level
  action: string
  phase: 'started' | 'finished' | 'observed'
  result?: Result
  objectIds: string[]
  data: Record<string, unknown>
}
export const MAX_EVENT_BYTES = 16 * 1024
export const byteSize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** Only diagnostic tokens/numbers, never arbitrary messages, names, URLs or file contents. */
export function safeData(value: unknown, depth = 0): unknown {
  if (depth > 6) return undefined
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') return token(value) || /^#[a-fA-F0-9]{3,8}$/.test(value) ? value : undefined
  if (Array.isArray(value)) return value.slice(0, 200).map((entry) => safeData(entry, depth + 1)).filter((entry) => entry !== undefined)
  if (!object(value)) return undefined
  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value).slice(0, 100)) {
    if (!token(key) || /name|message|stack|content|note|path|url|file|prototype|constructor|__proto__/i.test(key)) continue
    const clean = safeData(entry, depth + 1)
    if (clean !== undefined) result[key] = clean
  }
  return result
}

/** Strict envelope shared by import and dev receiver; unknown envelope fields are discarded. */
export function parseEvent(value: unknown): DiagnosticEvent {
  if (!object(value) || value.schemaVersion !== 1 || !token(value.eventId) || !token(value.sessionId)
    || !token(value.action) || !Number.isSafeInteger(value.seq) || Number(value.seq) < 1
    || typeof value.timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value.timestamp) || !Number.isFinite(Date.parse(value.timestamp))
    || !CATEGORIES.includes(value.category as Category) || !LEVELS.includes(value.level as Level)
    || !['started', 'finished', 'observed'].includes(String(value.phase))
    || value.result !== undefined && !['completed', 'cancelled', 'rejected', 'failed'].includes(String(value.result))
    || value.operationId !== undefined && !token(value.operationId)
    || !Array.isArray(value.objectIds) || value.objectIds.length > 200 || !value.objectIds.every(token)
    || !object(value.data) || byteSize(value) > MAX_EVENT_BYTES) throw new Error('diagnostic.invalid-event')
  return {
    schemaVersion: 1, eventId: value.eventId, sessionId: value.sessionId, seq: Number(value.seq), timestamp: value.timestamp,
    ...(value.operationId ? { operationId: String(value.operationId) } : {}), category: value.category as Category,
    level: value.level as Level, action: value.action, phase: value.phase as DiagnosticEvent['phase'],
    ...(value.result ? { result: value.result as Result } : {}), objectIds: value.objectIds as string[],
    data: safeData(value.data) as Record<string, unknown>,
  }
}

export function formatEvent(event: DiagnosticEvent) {
  return `${event.timestamp} [${event.level}] ${event.action} ${event.result ?? event.phase} ${event.objectIds.join(', ')} ${JSON.stringify(event.data)}`
}
