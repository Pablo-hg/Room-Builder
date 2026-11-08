import { diagnostics } from './engine'
import { DiagnosticRepository } from './indexedDb'
import { DiagnosticQueue } from './queue'

let repository: DiagnosticRepository | undefined
let queue: DiagnosticQueue | undefined
let started = false
let storageIssue = ''
export function diagnosticStorageIssue() { return queue?.dropped ? `Se perdieron ${queue.dropped} eventos del almacenamiento por errores o saturación. ${storageIssue}` : storageIssue }
export function startDiagnostics() {
  if (started || typeof window === 'undefined') return
  started = true
  try {
    repository = new DiagnosticRepository(window.indexedDB)
    let warned = false
    queue = new DiagnosticQueue((batch) => repository!.append(batch), (code) => {
      storageIssue = code === 'recovered' ? '' : 'No se pudieron guardar todos los registros. Se conserva una copia temporal limitada en memoria.'
      if (code === 'recovered') {
        if (warned) { warned = false; diagnostics.emit({ action: 'storage.recovered', category: 'system', level: 'warn', data: { dropped: queue?.dropped ?? 0 } }) }
        return
      }
      if (!warned) { warned = true; console.warn('[Room Builder] Diagnóstico local: escritura no disponible; se reintentará.') }
    })
    diagnostics.snapshot().forEach((event) => queue!.push(event))
    diagnostics.subscribe((event) => queue!.push(event))
    // Also enforce retention on startup, even if the user has not edited anything yet.
    void repository.append([]).catch(() => { storageIssue = 'El almacenamiento del diagnóstico no está disponible.' })
  } catch { storageIssue = 'El navegador no permite almacenar el diagnóstico.' }
}
export async function flushDiagnostics() { diagnostics.flush(); await queue?.drain() }
export async function readDiagnostics() {
  startDiagnostics(); await flushDiagnostics()
  const events = new Map(diagnostics.snapshot().map((event) => [event.eventId, event]))
  try { for (const event of await repository?.read() ?? []) events.set(event.eventId, event) } catch { storageIssue = 'El diagnóstico solo incluye los registros que siguen en memoria.' }
  return [...events.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.seq - b.seq)
}
export async function configureDiagnosticRetention(days: number, maxBytes: number) { startDiagnostics(); await repository?.configure({ days, maxBytes }) }
