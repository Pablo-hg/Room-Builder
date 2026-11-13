import { useEffect } from 'react'
import { useRoomStore } from '../../state/useRoomStore'
import { useShallow } from 'zustand/react/shallow'
import { selectEditorShortcuts } from '../../state/selectors'
import { selectableItems } from '../../domain/multiSelection'
import { folderElementIds, folderIdFromSelection, orderedSceneIds, sceneEntryParent } from '../../domain/elementFolders'

export function useEditorShortcuts() {
  const state = useRoomStore(useShallow(selectEditorShortcuts))
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target
      const key = event.key.toLowerCase()
      const modifier = event.ctrlKey || event.metaKey
      if (modifier && !event.altKey && !event.shiftKey && key === 'g') {
        event.preventDefault()
        if (event.repeat) return
        // Confirma primero un valor o nombre que se esté editando.
        if (target instanceof HTMLElement && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable)) target.blur()
        useRoomStore.getState().saveDesign()
        return
      }
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) return

      const current = useRoomStore.getState()
      const selectedId = current.selectedId
      const folderId = folderIdFromSelection(selectedId)
      if (folderId && modifier && event.shiftKey && !event.altKey && key === 'g') {
        const hasContents = folderElementIds(current.elementFolderAssignments, folderId, current.elementFolders).length > 0 || current.elementFolders.some((folder) => folder.parentId === folderId)
        if (hasContents) {
          event.preventDefault()
          current.deleteElementFolder(folderId, 'ungroup')
          window.dispatchEvent(new CustomEvent('room-builder:close-context'))
        }
        return
      }
      if (current.selectedIds.length > 1 && modifier && event.altKey && !event.shiftKey && key === 'g') {
        event.preventDefault()
        current.groupSceneItems(current.selectedIds)
        window.dispatchEvent(new CustomEvent('room-builder:close-context'))
        return
      }
      if (current.selectedIds.length > 1 && !modifier && event.altKey && event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        current.stepSceneItems(current.selectedIds, event.key === 'ArrowUp' ? 'up' : 'down')
        window.dispatchEvent(new CustomEvent('room-builder:close-context'))
        return
      }
      if (selectedId && !modifier && !event.altKey && !event.shiftKey && event.key === 'F2') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('room-builder:rename-selected'))
        return
      }
      if (selectedId && !modifier && event.altKey && event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        const parent = sceneEntryParent(selectedId, current.elementFolders, current.elementFolderAssignments)
        const siblings = orderedSceneIds(current).filter((id) => sceneEntryParent(id, current.elementFolders, current.elementFolderAssignments) === parent)
        const index = siblings.indexOf(selectedId)
        const targetIndex = index + (event.key === 'ArrowUp' ? -1 : 1)
        if (index >= 0 && siblings[targetIndex]) current.reorderSceneElement(selectedId, siblings[targetIndex], event.key === 'ArrowUp' ? 'before' : 'after')
        window.dispatchEvent(new CustomEvent('room-builder:close-context'))
        return
      }
      if (folderId && !modifier && event.altKey && event.shiftKey && key === 'n') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('room-builder:create-subfolder', { detail: folderId }))
        return
      }
      if (modifier && !event.altKey && !event.shiftKey && key === 'a') {
        event.preventDefault()
        current.selectElements(selectableItems(current).map((item) => item.id))
        return
      }
      if (!modifier && !event.altKey && !event.shiftKey && event.key === 'Escape' && (current.areaSelect || current.selectedIds.length > 0)) {
        if (current.areaSelect) current.setAreaSelect(false)
        else current.selectElement(null)
        window.dispatchEvent(new CustomEvent('room-builder:close-context'))
        return
      }
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
        window.dispatchEvent(new CustomEvent('room-builder:close-context'))
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
          window.dispatchEvent(new CustomEvent('room-builder:close-context'))
        }
        return
      }
      if (modifier || event.altKey) return
      if (key === 'r') { if (current.selectedIds.length > 1) current.rotateSelectedFurnitureGroup(); else state.rotateFurniture() }
      if ((event.key === 'Delete' || event.key === 'Backspace') && current.selectedIds.length > 1) {
        event.preventDefault()
        current.removeSceneItems(current.selectedIds)
        window.dispatchEvent(new CustomEvent('room-builder:close-context'))
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault()
        if (folderId) current.deleteElementFolder(folderId)
        else state.removeSelected()
        window.dispatchEvent(new CustomEvent('room-builder:close-context'))
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [state.copySelected, state.pasteSelected, state.redo, state.removeSelected, state.rotateFurniture, state.undo])

}
