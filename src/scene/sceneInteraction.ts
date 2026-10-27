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

