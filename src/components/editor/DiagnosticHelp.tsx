import { useState } from 'react'
import { prepareDiagnosticDownload, downloadDiagnostic } from '../../diagnostics/export'
import { diagnosticStorageIssue } from '../../diagnostics/runtime'

export function DiagnosticHelp() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const run = async () => {
    setBusy(true)
    setStatus('')
    try {
      downloadDiagnostic(await prepareDiagnosticDownload())
      setStatus('Se ha solicitado la descarga del diagnóstico.')
      if (diagnosticStorageIssue()) setStatus((current) => `${current} ${diagnosticStorageIssue()}`)
    } catch { setStatus('No se pudo preparar el diagnóstico. Puedes volver a intentarlo.') }
    finally { setBusy(false) }
  }
  return <details className="diagnostic-help">
    <summary>Ayuda</summary>
    <div className="diagnostic-help__content">
      <strong>Diagnóstico local</strong>
      <p>Incluye acciones, cambios y errores recientes, sin nombres ni diseños completos. Los identificadores de objetos se sustituyen por códigos de sesión. No se envía automáticamente.</p>
      <button type="button" disabled={busy} onClick={() => { void run() }}>Exportar diagnóstico</button>
      <p role="status">{busy ? 'Preparando diagnóstico…' : status}</p>
    </div>
  </details>
}
