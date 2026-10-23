export type InteractionDetails = Record<string, unknown>

interface InteractionContext {
  view?: string
  selectedId?: string | null
  details?: InteractionDetails
  coalesceKey?: string
}

interface InteractionLogEntry {
  sessionId: string
  timestamp: string
  action: string
  view?: string
  selectedId?: string | null
  details?: InteractionDetails
}

const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const developmentMode = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true
let pending: { key: string; entry: InteractionLogEntry; timer: number } | null = null
let delivery = Promise.resolve()

function deliver(entry: InteractionLogEntry) {
  if (typeof window === 'undefined' || !developmentMode) return
  delivery = delivery
    .then(() => fetch('/__room-builder/interaction-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true,
    }))
    .then(() => undefined)
    .catch(() => undefined)
}

function makeEntry(action: string, context: InteractionContext): InteractionLogEntry {
  return {
    sessionId,
    timestamp: new Date().toISOString(),
    action,
    ...(context.view === undefined ? {} : { view: context.view }),
    ...(context.selectedId === undefined ? {} : { selectedId: context.selectedId }),
    ...(context.details === undefined ? {} : { details: context.details }),
  }
}

export function flushInteractionLog() {
  if (!pending) return
  window.clearTimeout(pending.timer)
  const entry = pending.entry
  pending = null
  deliver(entry)
}

export function recordInteraction(action: string, context: InteractionContext = {}) {
  if (typeof window === 'undefined' || !developmentMode) return
  const entry = makeEntry(action, context)

  if (context.coalesceKey) {
    if (pending && pending.key !== context.coalesceKey) flushInteractionLog()
    if (pending) window.clearTimeout(pending.timer)
    pending = {
      key: context.coalesceKey,
      entry,
      timer: window.setTimeout(flushInteractionLog, 1200),
    }
    return
  }

  flushInteractionLog()
  deliver(entry)
}
