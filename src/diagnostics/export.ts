import { diagnostics } from './engine'
import { diagnosticFile } from './portable'
import { diagnosticStorageIssue, readDiagnostics } from './runtime'

export async function prepareDiagnosticDownload() {
  const events = await readDiagnostics()
  const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'development'
  const contents = JSON.stringify(diagnosticFile(events, version, !!diagnosticStorageIssue()))
  return new File([contents], `room-builder-diagnostico-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
}
export function downloadDiagnostic(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url; link.download = file.name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  diagnostics.emit({ action: 'diagnostic.download-requested', result: 'completed', data: { eventFile: true } })
}
export async function shareDiagnostic(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (!navigator.canShare?.({ files: [file] }) || !navigator.share) { downloadDiagnostic(file); return 'downloaded' }
  try {
    await navigator.share({ files: [file], title: 'Diagnóstico de Room Builder' })
    diagnostics.emit({ action: 'diagnostic.shared', result: 'completed' })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    downloadDiagnostic(file); return 'downloaded'
  }
}
