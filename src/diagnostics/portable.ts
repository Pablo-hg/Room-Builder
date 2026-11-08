import { byteSize, parseEvent, type DiagnosticEvent } from './contract'
export const PORTABLE_MAX_BYTES = 8 * 1024 * 1024
export interface DiagnosticFile {
  format: 'room-builder-diagnostics'
  version: 1
  exportedAt: string
  appVersion: string
  storageLimited: boolean
  browser?: 'Firefox' | 'Chromium' | 'Safari' | 'Other'
  events: DiagnosticEvent[]
}
export function diagnosticFile(events: DiagnosticEvent[], appVersion: string, storageLimited = false): DiagnosticFile {
  const agent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const browser = /Firefox\//.test(agent) ? 'Firefox' : /Chrom(e|ium)\//.test(agent) ? 'Chromium' : /Safari\//.test(agent) ? 'Safari' : 'Other'
  return { format: 'room-builder-diagnostics', version: 1, exportedAt: new Date().toISOString(), appVersion, storageLimited,
    browser, events: events.map(parseEvent) }
}
export function parseDiagnosticFile(text: string): DiagnosticEvent[] {
  if (new TextEncoder().encode(text).byteLength > PORTABLE_MAX_BYTES) throw new Error('El diagnóstico supera el límite de 8 MB.')
  let entries: unknown[]
  if (text.trimStart().startsWith('{') && !text.includes('\n{"schemaVersion"')) {
    let envelope: Record<string, unknown> | undefined
    try { envelope = JSON.parse(text) as Record<string, unknown> } catch { /* JSONL is handled below. */ }
    if (envelope?.format === 'room-builder-diagnostics') {
      if (envelope.version !== 1 || !Array.isArray(envelope.events)) throw new Error('Versión de diagnóstico no compatible.')
      entries = envelope.events
    } else entries = text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line))
  } else entries = text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line))
  if (entries.length > 30000) throw new Error('El diagnóstico contiene demasiados eventos.')
  const result = new Map<string, DiagnosticEvent>()
  for (const entry of entries) { const event = parseEvent(entry); result.set(event.eventId, event) }
  if (byteSize([...result.values()]) > PORTABLE_MAX_BYTES) throw new Error('Diagnóstico demasiado grande.')
  return [...result.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.seq - b.seq)
}
