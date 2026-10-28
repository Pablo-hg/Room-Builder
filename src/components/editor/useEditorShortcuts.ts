import { useEffect } from 'react'
import { useRoomStore } from '../../state/useRoomStore'
import { useShallow } from 'zustand/react/shallow'
import { selectEditorShortcuts } from '../../state/selectors'

export function useEditorShortcuts() {
  const state = useRoomStore(useShallow(selectEditorShortcuts))
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) return

      const key = event.key.toLowerCase()
      const modifier = event.ctrlKey || event.metaKey
      if (modifier && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) state.redo()
        else state.undo()
        return
      }
      if (modifier && key === 'y') {
        event.preventDefault()
        state.redo()
        return
      }
      if (modifier && key === 'c' && state.copySelected()) {
        event.preventDefault()
        return
      }
      if (modifier && key === 'v' && state.pasteSelected()) {
        event.preventDefault()
        return
      }
      if (modifier && key === 'd') {
        if (state.copySelected()) {
          event.preventDefault()
          state.pasteSelected()
        }
        return
      }
      if (modifier || event.altKey) return
      if (key === 'r') state.rotateFurniture()
      if (event.key === 'Delete' || event.key === 'Backspace') state.removeSelected()
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [state.copySelected, state.pasteSelected, state.redo, state.removeSelected, state.rotateFurniture, state.undo])

}
