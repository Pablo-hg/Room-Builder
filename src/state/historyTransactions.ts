import { MAX_UNDO_STEPS } from './defaults'
import type { HistoryGestureToken, RoomRuntime } from './types'
import type { PersistedDesign } from '../domain/designV1'

export function beginHistoryTransaction(runtime: RoomRuntime, before: PersistedDesign, targetId: string | null): HistoryGestureToken {
  const token = Symbol('history-gesture')
  // A new gesture closes the previous one at its last accepted position.
  runtime.activeGesture = {
    token,
    before,
    targetId,
    hasChanges: false,
  }
  return token
}

export function finishHistoryTransaction(runtime: RoomRuntime, token?: HistoryGestureToken, _current?: PersistedDesign): PersistedDesign | null {
  const gesture = runtime.activeGesture
  if (token !== undefined && gesture?.token !== token) return null
  runtime.activeGesture = null
  return null
}

export function recordHistoryChange(runtime: RoomRuntime, previous: PersistedDesign) {
  if (runtime.isUndoing) return
  const gesture = runtime.activeGesture
  if (!gesture || !gesture.hasChanges) {
    runtime.undoHistory.push(gesture ? gesture.before : previous)
    runtime.redoHistory.length = 0
    if (gesture) gesture.hasChanges = true
  }
  if (runtime.undoHistory.length > MAX_UNDO_STEPS) runtime.undoHistory.shift()
}
