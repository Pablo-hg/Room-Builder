import { diagnostics } from '../diagnostics/engine'
import { currentActionScope } from '../diagnostics/actionScope'
export type InteractionDetails = Record<string, unknown>
interface InteractionContext { view?: string; selectedId?: string | null; details?: InteractionDetails; coalesceKey?: string }
let measurementGroup: { token: symbol; finish: () => void } | null = null
export function beginMeasurementLog(finish: () => void) {
  measurementGroup?.finish()
  const token = Symbol('measurement-log')
  measurementGroup = { token, finish }
  return token
}
export function finishMeasurementLog(token: symbol, _context: InteractionContext, _changed: boolean) {
  if (measurementGroup?.token === token) measurementGroup = null
  // Effective values and the terminal result are recorded by the store gesture.
}
export function flushInteractionLog() { measurementGroup?.finish(); diagnostics.flush() }
/** Compatibility facade. State outcomes now have one source: instrumentActions. */
export function recordInteraction(action: string, context: InteractionContext = {}) {
  if (currentActionScope() || action.startsWith('state.')) return
  if (/^session\./.test(action)) return
  if (action.startsWith('scene.model.')) {
    diagnostics.emit({ action, category: action.endsWith('failed') ? 'errors' : 'interactions',
      level: action.endsWith('failed') ? 'error' : 'info', result: action.endsWith('failed') ? 'failed' : 'completed',
      data: { format: 'glb', reason: action.endsWith('failed') ? 'export-failed' : undefined } })
  } else if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV && action.endsWith('pointer-missed')) {
    diagnostics.emit({ action, level: 'debug', phase: 'observed', data: { view: context.view } })
  }
}
