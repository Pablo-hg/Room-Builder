import { useEffect } from 'react'
import { flushInteractionLog, recordInteraction } from '../debug/interactionLog'
import { useRoomStore } from '../state/useRoomStore'

let sessionStarted = false

export default function InteractionLogger() {
  useEffect(() => {
    const state = useRoomStore.getState()
    if (!sessionStarted) {
      sessionStarted = true
      recordInteraction('session.started', {
        view: state.view,
        selectedId: state.selectedId,
        details: { viewport: `${window.innerWidth}x${window.innerHeight}` },
      })
    }

    const finish = () => {
      flushInteractionLog()
      const current = useRoomStore.getState()
      recordInteraction('session.ended', { view: current.view, selectedId: current.selectedId })
    }
    window.addEventListener('beforeunload', finish)
    return () => {
      window.removeEventListener('beforeunload', finish)
      flushInteractionLog()
    }
  }, [])

  return null
}
