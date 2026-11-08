import { useState } from 'react'
import { prepareDiagnosticDownload, downloadDiagnostic, shareDiagnostic } from '../../diagnostics/export'
import { diagnosticStorageIssue } from '../../diagnostics/runtime'

export function DiagnosticHelp() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [prepared, setPrepared] = useState<File | null>(null)
  const prepare = async () => {
    setBusy(true)
    try { const file = await prepareDiagnosticDownload(); setPrepared(file); return file }
    finally { setBusy(false) }
  }
  const run = async (share: boolean) => {
    setStatus('')
    try {
      // A prepared file preserves transient user activation for browsers which require it.
      const file = share && prepared ? prepared : await prepare()
      if (share) {
        const result = await shareDiagnostic(file)
        setStatus(result === 'shared' ? 'Diagnóstico compartido.' : result === 'cancelled' ? 'Se ha cancelado compartir.' : 'Compartir archivos no está disponible. Se ha solicitado la descarga.')
      } else { downloadDiagnostic(file); setStatus('Se ha solicitado la descarga del diagnóstico.') }
      if (diagnosticStorageIssue()) setStatus((current) => `${current} ${diagnosticStorageIssue()}`)
    } catch { setStatus('No se pudo preparar el diagnóstico. Puedes volver a intentarlo.') }
  }
  return <details className="diagnostic-help" onToggle={(event) => {
    if (event.currentTarget.open) void prepare().catch(() => setStatus('No se pudo preparar el diagnóstico.'))
    else setPrepared(null)
  }}>
    <summary>Ayuda</summary>
    <div className="diagnostic-help__content">
      <strong>Diagnóstico local</strong>
      <p>Incluye acciones, cambios y errores recientes, sin nombres ni diseños completos. Los identificadores de objetos se sustituyen por códigos de sesión. No se envía automáticamente.</p>
      <p>Compartir abre el selector de tu dispositivo: tú eliges la aplicación y el destino. El archivo para compartir se prepara al abrir Ayuda.</p>
      <button type="button" disabled={busy} onClick={() => { void run(false) }}>Exportar diagnóstico</button>
      <button type="button" disabled={busy || !prepared} onClick={() => { void run(true) }}>Compartir diagnóstico</button>
      <p role="status">{busy ? 'Preparando diagnóstico…' : status}</p>
    </div>
  </details>
}
