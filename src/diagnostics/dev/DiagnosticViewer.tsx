import { useEffect, useState } from 'react'
import { CATEGORIES, LEVELS, formatEvent, type DiagnosticEvent } from '../contract'
import { diagnostics } from '../engine'
import { parseDiagnosticFile, PORTABLE_MAX_BYTES } from '../portable'
import { readDiagnostics, diagnosticStorageIssue, configureDiagnosticRetention } from '../runtime'
import { DesignModal } from '../../components/editor/DesignModal'
import { parseLegacy, type LegacyEntry } from './legacy'
import './viewer.css'

export default function DiagnosticViewer() {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<DiagnosticEvent[]>([])
  const [imported, setImported] = useState<DiagnosticEvent[] | null>(null)
  const [legacy, setLegacy] = useState<LegacyEntry[]>([])
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ date: '', level: '', category: '', session: '', object: '', operation: '' })
  const [selected, setSelected] = useState<DiagnosticEvent | null>(null)
  const [limit, setLimit] = useState(200)
  const [days, setDays] = useState(7)
  const [megabytes, setMegabytes] = useState(5)
  useEffect(() => {
    if (!open) return
    let mounted = true
    const refresh = () => { void readDiagnostics().then((data) => { if (mounted) setEvents(data) }).catch(() => { if (mounted) setError('No se pudo leer el diagnóstico.') }) }
    refresh()
    // Read a bounded snapshot at most once/second, not an entire database per event.
    const timer = setInterval(refresh, 1000)
    return () => { mounted = false; clearInterval(timer) }
  }, [open])
  const source = imported ?? events
  const filtered = source.filter((event) => (!filters.date || event.timestamp.startsWith(filters.date))
    && (!filters.level || event.level === filters.level) && (!filters.category || event.category === filters.category)
    && (!filters.session || event.sessionId.includes(filters.session)) && (!filters.operation || event.operationId?.includes(filters.operation))
    && (!filters.object || event.objectIds.some((id) => id.includes(filters.object))))
  const filter = (key: keyof typeof filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setLimit(200) }
  return <>
    <button type="button" className="diagnostic-dev-button" onClick={() => setOpen(true)}>Diagnósticos · desarrollo</button>
    {open && <DesignModal titleId="diagnostic-title" descriptionId="diagnostic-copy" onClose={() => setOpen(false)}>
      <div className="diagnostic-viewer">
        <h2 id="diagnostic-title">Diagnósticos de desarrollo</h2>
        <p id="diagnostic-copy">{imported || legacy.length ? 'Archivo importado (aislado de los registros locales).' : 'Registro local en directo.'} Los filtros de fecha usan UTC.</p>
        <button type="button" onClick={() => setOpen(false)}>Cerrar</button>
        <label>Importar diagnóstico o histórico <input type="file" accept=".json,.jsonl,.log" onChange={(event) => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''
          if (!file) return
          if (file.size > PORTABLE_MAX_BYTES) { setError('El archivo supera 8 MB.'); return }
          void file.text().then((text) => {
            if (text.trimStart().startsWith('[')) { setLegacy(parseLegacy(text)); setImported([]) }
            else { setImported(parseDiagnosticFile(text)); setLegacy([]) }
            setError(''); setSelected(null); setLimit(200)
          }).catch(() => setError('El archivo no tiene un formato de diagnóstico compatible.'))
        }} /></label>
        <button type="button" onClick={() => { setImported(null); setLegacy([]); setSelected(null) }}>Volver al registro local</button>
        <div className="diagnostic-filters">
          <label>Fecha UTC <input type="date" value={filters.date} onChange={(e) => filter('date', e.target.value)} /></label>
          <label>Nivel <select value={filters.level} onChange={(e) => filter('level', e.target.value)}><option value="">Todos</option>{LEVELS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Categoría <select value={filters.category} onChange={(e) => filter('category', e.target.value)}><option value="">Todas</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
          {(['session', 'object', 'operation'] as const).map((key) => <label key={key}>{{ session: 'Sesión', object: 'Objeto', operation: 'Operación' }[key]} <input value={filters[key]} onChange={(e) => filter(key, e.target.value)} /></label>)}
        </div>
        <p role="status">{error || diagnosticStorageIssue()} {diagnostics.dropped ? `Búfer temporal: ${diagnostics.dropped} eventos desplazados por el límite de memoria.` : ''}</p>
        {legacy.length > 0 ? <><p>Histórico sin categorías ni resultados fiables; se muestra el texto original.</p><pre>{legacy.slice(-limit).map((entry) => `[${entry.localTimestamp}] [${entry.session}] ${entry.description}`).join('\n')}</pre></>
          : <ol className="diagnostic-events">{filtered.slice(-limit).reverse().map((event) => <li key={event.eventId}><button type="button" onClick={() => setSelected(event)}>{formatEvent(event)}</button></li>)}</ol>}
        <button type="button" disabled={limit >= Math.max(filtered.length, legacy.length)} onClick={() => setLimit((n) => n + 200)}>Mostrar 200 anteriores</button>
        {selected && <pre aria-label="Detalles del evento">{JSON.stringify(selected, null, 2)}</pre>}
        <details><summary>Retención local</summary>
          <label>Días <input type="number" min="1" max="30" value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
          <label>MiB <input type="number" min="1" max="20" value={megabytes} onChange={(e) => setMegabytes(Number(e.target.value))} /></label>
          <button type="button" onClick={() => { void configureDiagnosticRetention(days, megabytes * 1024 * 1024).then(() => setError('Retención actualizada.')).catch(() => setError('No se pudo cambiar la retención.')) }}>Aplicar retención</button>
        </details>
      </div>
    </DesignModal>}
  </>
}
