import { persistedDesign } from '../../domain/designV1'
import { recordInteraction } from '../../debug/interactionLog'
import { MAX_UNDO_STEPS } from '../defaults'
import { beginHistoryTransaction, finishHistoryTransaction } from '../historyTransactions'
import type { HistoryGestureToken, RoomActionContext, RoomState } from '../types'

type HistoryActions = Pick<
  RoomState,
  | 'undo'
  | 'redo'
  | 'beginHistoryGesture'
  | 'commitHistoryGesture'
  | 'cancelHistoryGesture'
  | 'isHistoryGestureActive'
>

export function createHistoryActions(context: Pick<RoomActionContext, 'set' | 'get' | 'runtime'>): HistoryActions {
  const { set, get, runtime } = context
  const restoreDesign = (design: ReturnType<typeof persistedDesign>) => {
    runtime.isUndoing = true
    set({ ...design, structurePacks: design.structurePacks ?? [] })
    runtime.isUndoing = false
  }
  const endGesture = (token?: HistoryGestureToken) => {
    const restore = finishHistoryTransaction(runtime, token, persistedDesign(get()))
    if (restore) restoreDesign(restore)
  }
  return {
    beginHistoryGesture: (targetId = get().selectedId) => {
      endGesture()
      return beginHistoryTransaction(runtime, persistedDesign(get()), targetId)
    },
    commitHistoryGesture: (token) => endGesture(token),
    cancelHistoryGesture: (token) => endGesture(token),
    isHistoryGestureActive: (token) => runtime.activeGesture?.token === token,
    undo: () => {
      finishHistoryTransaction(runtime)
      const previous = runtime.undoHistory.pop()
      if (!previous) return set({ notice: 'No hay cambios anteriores que deshacer.' })
      const current = get()
      runtime.redoHistory.push(persistedDesign(current))
      runtime.isUndoing = true
      set({
        ...previous,
        structurePacks: previous.structurePacks ?? [],
        selectedId: null,
        undoCount: runtime.undoHistory.length,
        redoCount: runtime.redoHistory.length,
        notice: 'Cambio anterior deshecho.',
      })
      runtime.isUndoing = false
      recordInteraction('state.design.undo', { view: current.view, selectedId: current.selectedId })
    },
    redo: () => {
      finishHistoryTransaction(runtime)
      const next = runtime.redoHistory.pop()
      if (!next) return set({ notice: 'No hay cambios posteriores que rehacer.' })
      const current = get()
      runtime.undoHistory.push(persistedDesign(current))
      if (runtime.undoHistory.length > MAX_UNDO_STEPS) runtime.undoHistory.shift()
      runtime.isUndoing = true
      set({
        ...next,
        structurePacks: next.structurePacks ?? [],
        selectedId: null,
        undoCount: runtime.undoHistory.length,
        redoCount: runtime.redoHistory.length,
        notice: 'Cambio anterior rehecho.',
      })
      runtime.isUndoing = false
      recordInteraction('state.design.redo', { view: current.view, selectedId: current.selectedId })
    },
  }
}
