import { recordInteraction, type InteractionDetails } from '../debug/interactionLog'
import { useRoomStore } from '../state/useRoomStore'

export function recordSceneInteraction(action: string, details?: InteractionDetails) {
  const state = useRoomStore.getState()
  recordInteraction(`scene.${action}`, {
    view: state.view,
    selectedId: state.selectedId,
    details,
  })
}

/** In the scene there is no meaningful spatial range, so modifiers toggle individual objects. */
export function selectSceneObject(id: string, event: PointerEvent | MouseEvent, options?: { allowShiftDrag?: boolean }) {
  const state = useRoomStore.getState()
  if (event.ctrlKey || event.metaKey || (event.shiftKey && !options?.allowShiftDrag)) {
    event.preventDefault()
    state.selectSceneListItem(id, 'toggle', [id])
    return true
  }
  state.selectElement(id)
  return false
}
