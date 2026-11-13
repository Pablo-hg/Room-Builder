import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BASE_ROOM_SURFACE_IDS, canMoveFolder, folderElementIds, folderIdFromSelection, ROOT_ROOM_FOLDER, sceneEntryParent } from '../../domain/elementFolders'
import { useRoomStore } from '../../state/useRoomStore'

type MenuProps = { id: string; name: string; x: number; y: number; siblings: string[]; onClose: (restoreFocus?: boolean) => void; onRename: () => void; onCreateChild: (id: string) => void }

export function SceneContextMenu({ id, name, x, y, siblings, onClose, onRename, onCreateChild }: MenuProps) {
  const [moving, setMoving] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const state = useRoomStore()
  const folderId = folderIdFromSelection(id)
  const ids = state.selectedIds.length > 1 && state.selectedIds.includes(id) ? state.selectedIds : [id]
  const multiple = ids.length > 1
  const folder = folderId ? state.elementFolders.find((item) => item.id === folderId) : undefined
  const parentId = sceneEntryParent(id, state.elementFolders, state.elementFolderAssignments)
  const index = siblings.indexOf(id)
  const copyable = ids.every((selected) => state.furniture.some((item) => item.id === selected) || state.room.windows.some((item) => item.id === selected))
  const hasLocked = ids.some((selected) => { const inner = folderIdFromSelection(selected); return (inner ? folderElementIds(state.elementFolderAssignments, inner, state.elementFolders) : [selected]).some((element) => state.lockedElementIds.includes(element)) })
  const deletable = !hasLocked && !ids.includes('door') && !ids.includes(`folder:${ROOT_ROOM_FOLDER}`) && !ids.some((item) => BASE_ROOM_SURFACE_IDS.includes(item)) && (!!folder || id !== 'door')
  const canUngroup = !!folderId && (folderElementIds(state.elementFolderAssignments, folderId, state.elementFolders).length > 0 || state.elementFolders.some((candidate) => candidate.parentId === folderId))

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>(moving ? '.scene-context-submenu button:not(:disabled)' : 'button:not(:disabled)')?.focus()
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) onClose(false) }
    window.addEventListener('pointerdown', outside, true)
    return () => window.removeEventListener('pointerdown', outside, true)
  }, [onClose, moving])

  const act = (fn: () => void) => { onClose(); fn() }
  const move = (target: string | null) => act(() => { if (multiple) state.moveSceneItems(ids, target); else if (folderId) state.moveElementFolder(folderId, target); else state.moveElementToFolder(id, target) })
  const position = { left: Math.max(8, Math.min(x, window.innerWidth - 254)), top: Math.max(8, Math.min(y, window.innerHeight - 360)) }
  return createPortal(<div ref={menuRef} className="scene-context-menu" role="menu" aria-label={multiple ? `Acciones de ${ids.length} elementos` : `Acciones de ${name}`} style={position} onContextMenu={(event) => event.preventDefault()} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); if (moving) setMoving(false); else onClose(); return }
    if (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return
    event.preventDefault()
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)'))
    const active = buttons.indexOf(document.activeElement as HTMLButtonElement)
    buttons[(active + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
  }}>
      <button role="menuitem" type="button" aria-keyshortcuts="Control+C Meta+C" disabled={!copyable} title={!copyable ? 'La selección contiene elementos que todavía no se pueden copiar' : undefined} onClick={() => act(() => { if (!multiple) state.selectElement(id); state.copySelected() })}><span>Copiar</span><small>Ctrl / ⌘ C</small></button>
      <button role="menuitem" type="button" aria-keyshortcuts="Control+D Meta+D" disabled={!copyable} title={!copyable ? 'La selección contiene elementos que todavía no se pueden duplicar' : undefined} onClick={() => act(() => { if (!multiple) state.selectElement(id); if (state.copySelected()) state.pasteSelected() })}><span>Duplicar</span><small>Ctrl / ⌘ D</small></button>
      {multiple ? <button role="menuitem" type="button" aria-keyshortcuts="Control+Alt+G Meta+Alt+G" onClick={() => act(() => state.groupSceneItems(ids))}><span>Agrupar</span><small aria-hidden="true">Ctrl / ⌘ + Alt + G</small></button> : <button role="menuitem" type="button" aria-keyshortcuts="F2" disabled={BASE_ROOM_SURFACE_IDS.includes(id)} onClick={() => act(onRename)}><span>Renombrar</span><small aria-hidden="true">F2</small></button>}
      {folderId && folderId !== ROOT_ROOM_FOLDER && !multiple && canUngroup && <button role="menuitem" type="button" aria-keyshortcuts="Control+Shift+G Meta+Shift+G" onClick={() => act(() => state.deleteElementFolder(folderId, 'ungroup'))}><span>Desagrupar</span><small aria-hidden="true">Ctrl / ⌘ + Mayús + G</small></button>}
      <button role="menuitem" type="button" aria-haspopup="menu" aria-expanded={moving} disabled={folderId === ROOT_ROOM_FOLDER} onClick={() => setMoving((value) => !value)}><span>Mover a</span><small aria-hidden="true">›</small></button>
      <button role="menuitem" type="button" aria-keyshortcuts="Alt+Shift+ArrowUp" disabled={!multiple && index <= 0} onClick={() => act(() => { if (multiple) state.stepSceneItems(ids, 'up'); else state.reorderSceneElement(id, siblings[index - 1], 'before') })}><span>Subir</span><small aria-hidden="true">Alt + Mayús + ↑</small></button>
      <button role="menuitem" type="button" aria-keyshortcuts="Alt+Shift+ArrowDown" disabled={!multiple && (index < 0 || index >= siblings.length - 1)} onClick={() => act(() => { if (multiple) state.stepSceneItems(ids, 'down'); else state.reorderSceneElement(id, siblings[index + 1], 'after') })}><span>Bajar</span><small aria-hidden="true">Alt + Mayús + ↓</small></button>
      <button role="menuitem" type="button" aria-keyshortcuts="Delete Backspace" disabled={!deletable} title={hasLocked ? 'Hay elementos bloqueados en la selección' : undefined} onClick={() => act(() => { if (multiple) state.removeSceneItems(ids); else if (folderId) state.deleteElementFolder(folderId); else { state.selectElement(id); state.removeSelected() } })}><span>Borrar</span><small aria-hidden="true">Supr / Retroceso</small></button>
      {folderId && !multiple && <button role="menuitem" type="button" aria-keyshortcuts="Alt+Shift+N" onClick={() => act(() => onCreateChild(folderId))}><span>Crear subcarpeta</span><small aria-hidden="true">Alt + Mayús + N</small></button>}
      {moving && <div className="scene-context-submenu" role="menu" aria-label="Mover a" style={{ left: position.left + 238 + 200 <= window.innerWidth - 8 ? position.left + 238 : Math.max(8, position.left - 200), top: position.top + 100 }}>
        <button role="menuitem" type="button" disabled={ids.every((item) => !sceneEntryParent(item, state.elementFolders, state.elementFolderAssignments))} onClick={() => move(null)}><span>Sin carpeta</span></button>
        {state.elementFolders.filter((candidate) => ids.every((item) => { const current = folderIdFromSelection(item); return !current || canMoveFolder(state.elementFolders, current, candidate.id) })).map((candidate) => <button role="menuitem" type="button" key={candidate.id} disabled={ids.every((item) => sceneEntryParent(item, state.elementFolders, state.elementFolderAssignments) === candidate.id)} onClick={() => move(candidate.id)}><span>{candidate.name}</span>{!multiple && candidate.id === parentId && <small>Actual</small>}</button>)}
      </div>}
  </div>, document.body)
}
