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
  | 'revertHistoryGesture'
  | 'continueHistoryGesture'
  | 'isHistoryGestureActive'
>

export function createHistoryActions(context: Pick<RoomActionContext, 'set' | 'get' | 'runtime'>): HistoryActions {
  const { set, get, runtime } = context
  const restoreDesign = (design: ReturnType<typeof persistedDesign>) => {
    runtime.isUndoing = true
    set({ ...design, gridSnap: get().gridSnap, structurePacks: design.structurePacks ?? [], measurements: design.measurements ?? [], measureDraft: null, measureEditId: null })
    runtime.isUndoing = false
  }
  const endGesture = (token?: HistoryGestureToken) => {
    const restore = finishHistoryTransaction(runtime, token, persistedDesign(get()))
    if (restore) restoreDesign(restore)
    // Las guías pertenecen al gesto: al soltar o cancelar desaparecen.
    if (get().activeGuides.length) set({ activeGuides: [] })
  }
  return {
    beginHistoryGesture: (targetId = get().selectedId) => {
      endGesture()
      return beginHistoryTransaction(runtime, persistedDesign(get()), targetId)
    },
    commitHistoryGesture: (token) => endGesture(token),
    cancelHistoryGesture: (token) => endGesture(token),
    // Crear un objeto selecciona el nuevo, y cambiar la selección cierra el gesto en curso: por eso un arrastre desde el
    // catálogo crea primero y abre el gesto después, «continuando» el paso que ya dejó la creación (el estado anterior
    // es `before`). Así crear + mover es un único paso de deshacer y `revertHistoryGesture` lo elimina entero.
    continueHistoryGesture: (before, targetId = null) => {
      const token = beginHistoryTransaction(runtime, before, targetId)
      runtime.activeGesture!.hasChanges = true
      return token
    },
    // Deshace todo lo hecho durante el gesto y no deja rastro en el historial (p. ej. arrastre del
    // catálogo soltado fuera de la vista o cancelado con Esc). `cancelHistoryGesture` solo lo cierra.
    revertHistoryGesture: (token) => {
      const gesture = runtime.activeGesture
      if (!gesture || gesture.token !== token) return
      runtime.activeGesture = null
      if (gesture.hasChanges) {
        runtime.undoHistory.pop()
        restoreDesign(gesture.before)
        set({ selectedId: null, undoCount: runtime.undoHistory.length, redoCount: runtime.redoHistory.length })
      }
      if (get().activeGuides.length) set({ activeGuides: [] })
    },
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
        gridSnap: current.gridSnap,
        structurePacks: previous.structurePacks ?? [],
        measurements: previous.measurements ?? [],
        measureDraft: null,
        measureEditId: null,
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
        gridSnap: current.gridSnap,
        structurePacks: next.structurePacks ?? [],
        measurements: next.measurements ?? [],
        measureDraft: null,
        measureEditId: null,
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
