import { useState } from 'react'
import { prepareDiagnosticDownload, downloadDiagnostic } from '../../diagnostics/export'
import { diagnosticStorageIssue } from '../../diagnostics/runtime'

export function DiagnosticExportButton() {
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
  return <div className="diagnostic-export">
    <button type="button" className="secondary-button diagnostic-export__button" disabled={busy}
      aria-describedby="diagnostic-export-description" onClick={() => { void run() }}>
      {busy ? 'Preparando diagnóstico…' : 'Exportar diagnóstico'}
    </button>
    <p id="diagnostic-export-description" className="shortcut-guide__hint">Descarga los registros recientes sin nombres ni diseños completos. No se envían automáticamente.</p>
    {status && <p className="shortcut-guide__hint" role="status">{status}</p>}
  </div>
}
