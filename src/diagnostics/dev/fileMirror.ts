import { parseEvent } from '../contract'
import { diagnostics } from '../engine'
import { DiagnosticQueue } from '../queue'

/** This module is loaded only inside import.meta.env.DEV. No production network sink. */
export function startFileMirror() {
  let failed = false
  const queue = new DiagnosticQueue(async (batch) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    try {
      const response = await fetch('/__room-builder/interaction-log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch),
        signal: controller.signal, keepalive: true,
      })
      if (!response.ok) throw new Error('diagnostic.mirror-http')
      const ack = await response.json() as { eventIds?: string[] }
      if (!batch.every((event) => ack.eventIds?.includes(event.eventId))) throw new Error('diagnostic.mirror-ack')
    } finally { clearTimeout(timer) }
  }, (code) => {
    if (code === 'recovered') {
      if (failed) { failed = false; diagnostics.emit({ action: 'mirror.recovered', category: 'system', data: { dropped: queue.dropped } }) }
    } else if (!failed) {
      failed = true
      // Console is deliberately separate: recording this failure into its own sink would recurse.
      console.warn('[Room Builder] Copia JSONL no disponible. El registro del navegador continúa.')
    }
  })
  diagnostics.snapshot().forEach((event) => queue.push(parseEvent(event)))
  const unsubscribe = diagnostics.subscribe((event) => queue.push(event))
  const flush = () => { void queue.flush() }
  window.addEventListener('pagehide', flush)
  return () => { unsubscribe(); window.removeEventListener('pagehide', flush); flush() }
}
