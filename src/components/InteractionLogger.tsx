import { useEffect } from 'react'
import { flushInteractionLog } from '../debug/interactionLog'
import { diagnostics } from '../diagnostics/engine'
import { flushDiagnostics, startDiagnostics } from '../diagnostics/runtime'
import { spatialDiagnostics } from '../diagnostics/spatial'
import { useRoomStore } from '../state/useRoomStore'

let sessionStarted = false

export default function InteractionLogger() {
  useEffect(() => {
    const state = useRoomStore.getState()
    startDiagnostics()
    if (!sessionStarted) {
      sessionStarted = true
      diagnostics.emit({ action: 'session.started', category: 'system', phase: 'observed', data: { view: state.view, appVersion: __APP_VERSION__ } })
      spatialDiagnostics.update(state)
    }

    const finish = () => {
      flushInteractionLog()
      spatialDiagnostics.flush()
      diagnostics.emit({ action: 'session.page-hidden', category: 'system', phase: 'observed' })
      void flushDiagnostics()
    }
    const visibility = () => { if (document.visibilityState === 'hidden') finish() }
    const error = () => diagnostics.emit({ action: 'runtime.error', category: 'errors', level: 'error', result: 'failed', data: { reason: 'uncaught-exception' } })
    const rejection = () => diagnostics.emit({ action: 'runtime.rejection', category: 'errors', level: 'error', result: 'failed', data: { reason: 'unhandled-rejection' } })
    window.addEventListener('pagehide', finish)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('error', error)
    window.addEventListener('unhandledrejection', rejection)
    let disposed = false
    let stopMirror: (() => void) | undefined
    if (import.meta.env.DEV) void import('../diagnostics/dev/fileMirror').then(({ startFileMirror }) => {
      if (!disposed) stopMirror = startFileMirror()
    }).catch(() => console.warn('[Room Builder] No se pudo iniciar la copia JSONL.'))
    return () => {
      disposed = true; stopMirror?.()
      window.removeEventListener('pagehide', finish)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('error', error)
      window.removeEventListener('unhandledrejection', rejection)
      flushInteractionLog()
    }
  }, [])

  return null
}
