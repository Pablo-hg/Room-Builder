import type { RoomRuntime, RoomState } from '../state/types'
import { diagnostics } from './engine'
import { currentActionScope, enterActionScope, leaveActionScope, type ActionScope } from './actionScope'
import { summarizeChange } from './stateSummary'
import type { Result } from './contract'
import { spatialDiagnostics } from './spatial'

const ignored = /^(clearNotice|isHistoryGestureActive|setIsoOrbitDragging|setFreeOrbitDragging)$/
const gestureAction = /^(begin|end|commit|cancel).*(Gesture|Move)$/
const continuous = /^(move|set.*(Rotation|Color|Dimension|Height|Angle|Orbit|Position|Zoom)|adjustCameraZoom|resize)/
const cameraAction = /Camera|^setView$|^setIsoAngle$|^setFreeOrbit$|^look|^rotate(Front|Iso|Pov)$|^setActiveRoomId$/

/** Public action results are observed after ALL store validation, independently of undo/redo. */
export function instrumentActions(state: RoomState, get: () => RoomState, runtime: RoomRuntime): RoomState {
  if (typeof window === 'undefined') return state
  let gesture: { before: RoomState; operationId: string; action: string; rejection?: ActionScope; reasons: Set<string> } | undefined
  const record = (action: string, before: RoomState, after: RoomState, scope: ActionScope, operationId: string, result?: Result, group = false) => {
    // Loading/replacing a scene must not become a full design recording.
    const bulk = /^(loadDesign|createDesign|importDesign|initializeSavedDesigns|deleteSavedDesign)$/.test(action)
    const summary = summarizeChange(before, after, !bulk)
    const outcome = result ?? scope.result ?? 'completed'
    if (!summary.changed && !scope.result && !result && action !== 'copySelected' && !bulk) return
    const snapshots = (side: 'before' | 'after') => Object.fromEntries(summary.changes.map((change) => [String(change.id ?? change.field), change[side]]))
    const input = { action: `editor.${action}`, operationId, result: outcome,
      category: outcome === 'failed' ? 'errors' as const : 'interactions' as const,
      level: outcome === 'failed' ? 'error' as const : outcome === 'rejected' ? 'warn' as const : 'info' as const,
      objectIds: summary.objectIds.length ? summary.objectIds : scope.objectIds ?? [], data: { source: 'store', view: after.view, before: snapshots('before'), after: snapshots('after'), changesApplied: summary.changed > 0,
        ...(bulk ? { sceneReplaced: summary.geometryChanged, furnitureCount: after.furniture.length, packCount: after.structurePacks.length } : {}),
        ...(scope.reason ? { reason: scope.reason } : {}), ...(summary.changed > summary.changes.length ? { truncated: true, changedCount: summary.changed } : {}) } }
    const spatialOperation = group && outcome === 'completed'
      ? diagnostics.coalesce(`${action}:${summary.objectIds.join(':')}`, input)
      : (diagnostics.flush(), diagnostics.emit(input), operationId)
    if (summary.geometryChanged) spatialDiagnostics.update(after, spatialOperation)
  }
  return Object.fromEntries(Object.entries(state).map(([action, value]) => {
    if (typeof value !== 'function' || ignored.test(action)) return [action, value]
    return [action, (...args: unknown[]) => {
      if (currentActionScope()) return value(...args)
      const before = get()
      const previousToken = runtime.activeGesture?.token
      const operationId = gesture?.operationId ?? diagnostics.nextOperation()
      const target = typeof args[0] === 'string' && /^(move|rotate|resize|remove|update|setElement|setFurniture|setStructure|setWallObject|detach)/.test(action) ? args[0] : before.selectedId
      const scope: ActionScope = { operationId, objectIds: target ? [diagnostics.objectId(target)] : [] }
      enterActionScope(scope)
      let result: unknown
      try {
        result = value(...args)
        if (typeof result === 'string' && action === 'importDesign') { scope.result ??= 'rejected'; scope.reason ??= 'import-not-applied' }
        if (result === false && /^(copy|paste)/.test(action)) { scope.result = 'rejected'; scope.reason = 'clipboard-unavailable' }
        if (result === true && action === 'copySelected') { scope.result = undefined; scope.reason = undefined }
      } catch (error) {
        scope.result = 'failed'; scope.reason = error instanceof DOMException ? `exception.${error.name}` : 'unexpected-exception'
        throw error
      } finally {
        leaveActionScope()
        try {
          const after = get()
          if (runtime.activeGesture?.token && runtime.activeGesture.token !== previousToken) {
            if (gesture) record(gesture.action, gesture.before, before, {}, gesture.operationId, 'completed')
            diagnostics.flush()
            gesture = { before, operationId: diagnostics.nextOperation(), action: 'gesture', reasons: new Set() }
            diagnostics.emit({ action: 'editor.gesture', phase: 'started', operationId: gesture.operationId,
              objectIds: runtime.activeGesture.targetId ? [diagnostics.objectId(runtime.activeGesture.targetId)] : [] })
          }
          if (gesture && !runtime.activeGesture) {
            const explicitEnd = gestureAction.test(action)
            const endState = explicitEnd ? after : before
            const changed = summarizeChange(gesture.before, endState).changed > 0
            record(gesture.action, gesture.before, endState, scope, gesture.operationId,
              action.startsWith('cancel') ? 'cancelled' : scope.result ?? (!changed && gesture.rejection ? 'rejected' : 'completed'))
            gesture = undefined
            if (!explicitEnd) record(action, before, after, scope, diagnostics.nextOperation())
          } else if (gesture && !gestureAction.test(action) && cameraAction.test(action)) {
            record(action, before, after, scope, diagnostics.nextOperation(), undefined, continuous.test(action))
          } else if (gesture && !gestureAction.test(action)) {
            gesture.action = action
            if (before.room !== after.room || before.furniture !== after.furniture || before.structurePacks !== after.structurePacks) spatialDiagnostics.update(after, gesture.operationId)
            if (scope.result && !gesture.reasons.has(scope.reason ?? scope.result)) {
              gesture.reasons.add(scope.reason ?? scope.result); gesture.rejection = scope
              diagnostics.emit({ action: `editor.${action}.attempt`, operationId: gesture.operationId,
                category: scope.result === 'failed' ? 'errors' : 'interactions', level: scope.result === 'failed' ? 'error' : 'warn',
                phase: 'observed', data: { outcome: scope.result, reason: scope.reason, changesApplied: false } })
            }
          } else if (!gestureAction.test(action)) record(action, before, after, scope, operationId, undefined, continuous.test(action))
          if (!runtime.activeGesture) spatialDiagnostics.flush()
        } catch { /* Diagnostics must not replace an exception or change an action's return value. */ }
      }
      return result
    }]
  })) as RoomState
}
