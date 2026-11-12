import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { WALL_LABELS, WALL_SIDES } from '../../domain/constants'
import { FURNITURE_CATALOG, FURNITURE_FAMILIES, isWallPictureShape, isWallMirrorShape, OPENING_CATALOG, openingKindForShape } from '../../domain/objectCatalog'
import { FurnitureIcon, StructurePackIcon, StructureSurfaceIcon } from '../iconCatalog'
import { useRoomStore } from '../../state/useRoomStore'
import { structureSurfaceElementId } from '../../domain/elementIds'
import { deriveSelection, elementName, structureSurfaceName } from '../../domain/selection'
import { BASE_FLOOR_ID, baseWallId, canMoveFolder, folderElementIds, folderIdFromSelection, folderRoomPack, folderSelectionId, orderedSceneIds, ROOT_ROOM_FOLDER, sceneEntryParent } from '../../domain/elementFolders'
import { OpeningSwatch } from './Controls'
import { EyeIcon, FolderIcon, LockIcon, RoomPackIcon } from './ElementIcons'
import { SceneContextMenu } from './SceneContextMenu'
import { ObjectCatalogSection } from './ObjectCatalogSection'
import { GridVisibilitySection } from './GridVisibilitySection'

export function ObjectsPanel() {
  const [draggedElement, setDraggedElement] = useState<string | null>(null)
  const [draggedFolder, setDraggedFolder] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
  const [sceneCollapsed, setSceneCollapsed] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ id: string; name: string; x: number; y: number } | null>(null)
  const contextTrigger = useRef<HTMLElement | null>(null)
  const longPress = useRef<{ timer: number; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renamingFolderName, setRenamingFolderName] = useState('')
  const [renamingElement, setRenamingElement] = useState<{ id: string; name: string } | null>(null)
  const [pointerFocusedId, setPointerFocusedId] = useState<string | null>(null)
  const cancelElementRename = useRef(false)
  const elementRenameInput = useRef<HTMLInputElement>(null)
  const room = useRoomStore((state) => state.room)
  const furniture = useRoomStore((state) => state.furniture)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const selectedIds = useRoomStore((state) => state.selectedIds)
  const selectElement = useRoomStore((state) => state.selectElement)
  const selectSceneListItem = useRoomStore((state) => state.selectSceneListItem)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const lockedElementIds = useRoomStore((state) => state.lockedElementIds)
  const toggleElementVisibility = useRoomStore((state) => state.toggleElementVisibility)
  const toggleElementLock = useRoomStore((state) => state.toggleElementLock)
  const elementFolders = useRoomStore((state) => state.elementFolders)
  const elementFolderAssignments = useRoomStore((state) => state.elementFolderAssignments)
  const sceneElementOrder = useRoomStore((state) => state.sceneElementOrder)
  const createElementFolder = useRoomStore((state) => state.createElementFolder)
  const renameElementFolder = useRoomStore((state) => state.renameElementFolder)
  const renameElement = useRoomStore((state) => state.renameElement)
  const moveSceneItems = useRoomStore((state) => state.moveSceneItems)
  const toggleSceneItemsVisibility = useRoomStore((state) => state.toggleSceneItemsVisibility)
  const toggleSceneItemsLock = useRoomStore((state) => state.toggleSceneItemsLock)
  const toggleElementFolderVisibility = useRoomStore((state) => state.toggleElementFolderVisibility)
  const toggleElementFolderLock = useRoomStore((state) => state.toggleElementFolderLock)
  const sceneElements = [
    ...(elementFolders.some((folder) => folder.id === ROOT_ROOM_FOLDER) ? [
      { id: BASE_FLOOR_ID, name: 'Suelo', kind: 'Superficie de la habitación', icon: <StructureSurfaceIcon kind="floor" /> },
      ...WALL_SIDES.map((wall) => ({ id: baseWallId(wall), name: `Pared ${WALL_LABELS[wall]}`, kind: 'Superficie de la habitación', icon: <StructureSurfaceIcon kind="wall" /> })),
    ] : []),
    { id: 'door', name: room.door.name || 'Puerta', kind: 'Apertura', icon: <OpeningSwatch kind="door" /> },
    ...(room.extraDoors ?? []).map((door) => ({ id: door.id, name: door.name || 'Puerta', kind: 'Apertura', icon: <OpeningSwatch kind="door" /> })),
    ...room.windows.map((window, index) => {
      const name = OPENING_CATALOG[openingKindForShape(window.shape)].name
      const family = window.shape === 'wallShelf' ? 'Almacenaje' : isWallPictureShape(window.shape) || isWallMirrorShape(window.shape) || window.shape === 'wallSconce' ? 'Decoración' : 'Apertura'
      const icon = isWallPictureShape(window.shape)
        ? <FurnitureIcon kind={window.shape} color={window.color} />
        : <OpeningSwatch kind={openingKindForShape(window.shape) as 'window' | 'circularWindow' | 'wallShelf' | 'mirrorRectangular' | 'mirrorCircular' | 'wallSconce'} color={window.color} />
      return { id: window.id, name: window.name || `${name} ${index + 1}`, kind: `${family} · ${window.freePosition ? 'libre' : `pared ${WALL_LABELS[window.wall]}`}`, icon }
    }),
    ...furniture.map((item) => ({ id: item.id, name: item.name, kind: FURNITURE_FAMILIES.find((family) => family.id === FURNITURE_CATALOG[item.kind].family)?.label ?? 'Mueble', icon: <FurnitureIcon kind={item.kind} color={item.color} /> })),
    ...structurePacks.flatMap((pack) => [
      ...(pack.doors ?? []).map((door) => ({ id: door.id, name: door.name || 'Puerta', kind: 'Apertura', icon: <OpeningSwatch kind="door" /> })),
      ...(pack.windows ?? []).map((window) => {
        const label = OPENING_CATALOG[openingKindForShape(window.shape)].name
        const family = window.shape === 'wallShelf' ? 'Almacenaje'
          : isWallPictureShape(window.shape) || isWallMirrorShape(window.shape) || window.shape === 'wallSconce' ? 'Decoración' : 'Apertura'
        const icon = isWallPictureShape(window.shape)
          ? <FurnitureIcon kind={window.shape} color={window.color} />
          : <OpeningSwatch kind={openingKindForShape(window.shape) as 'window' | 'circularWindow' | 'wallShelf' | 'mirrorRectangular' | 'mirrorCircular' | 'wallSconce'} color={window.color} />
        return { id: window.id, name: window.name || label, kind: `${family} · ${window.freePosition ? 'libre' : `pared ${WALL_LABELS[window.wall]}`}`, icon }
      }),
      ...(!pack.id.startsWith('floor-object-') && !pack.id.startsWith('wall-object-') ? [{ id: pack.id, name: pack.name, kind: 'Pack de construcción', icon: <StructurePackIcon /> }] : []),
      ...pack.surfaces.map((surface) => ({
        id: structureSurfaceElementId(pack.id, surface.id),
        name: structureSurfaceName(surface),
        kind: 'Superficie de construcción',
        icon: <StructureSurfaceIcon kind={surface.kind === 'ceiling' ? 'wall' : surface.kind} />,
      })),
    ]),
  ]
  const order = orderedSceneIds({ room, furniture, structurePacks, sceneElementOrder, elementFolders })
  const orderIndex = new Map(order.map((id, index) => [id, index]))
  sceneElements.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
  const toggleFolder = (id: string) => {
    setCollapsedFolders((current) => ({ ...current, [id]: !current[id] }))
  }
  const closeContextMenu = useCallback((restoreFocus = true) => {
    setContextMenu(null)
    if (restoreFocus) contextTrigger.current?.focus()
    contextTrigger.current = null
  }, [])
  const openContextMenu = (id: string, name: string, x: number, y: number, trigger: HTMLElement) => {
    if (!useRoomStore.getState().selectedIds.includes(id)) selectElement(id)
    contextTrigger.current = trigger
    setContextMenu({ id, name, x, y })
  }
  const contextEvents = (id: string, name: string) => ({
    onContextMenu: (event: MouseEvent<HTMLElement>) => { event.preventDefault(); event.stopPropagation(); openContextMenu(id, name, event.clientX, event.clientY, event.currentTarget.querySelector<HTMLElement>('.element-select, .element-folder__select') ?? event.currentTarget) },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
      event.preventDefault(); event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      openContextMenu(id, name, rect.left + 20, rect.top + 20, event.target as HTMLElement)
    },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'touch' || (event.target instanceof Element && event.target.closest('.element-actions, .element-folder__actions, .element-folder__collapse'))) return
      const trigger = event.currentTarget.querySelector<HTMLElement>('.element-select, .element-folder__select') ?? event.currentTarget
      const { clientX: x, clientY: y } = event
      longPress.current = { x, y, timer: window.setTimeout(() => { longPress.current = null; suppressClick.current = true; openContextMenu(id, name, x, y, trigger) }, 600) }
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => { const press = longPress.current; if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) { clearTimeout(press.timer); longPress.current = null } },
    onPointerUp: () => { if (longPress.current) clearTimeout(longPress.current.timer); longPress.current = null },
    onPointerCancel: () => { if (longPress.current) clearTimeout(longPress.current.timer); longPress.current = null },
    onClickCapture: (event: MouseEvent<HTMLElement>) => { if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation() } },
  })
  useEffect(() => () => { if (longPress.current) clearTimeout(longPress.current.timer) }, [])
  useEffect(() => {
    if (!renamingElement) return
    const finishOnScenePointer = (event: globalThis.PointerEvent) => {
      if (event.target instanceof HTMLCanvasElement && event.target.closest('.scene-panel')) elementRenameInput.current?.blur()
    }
    window.addEventListener('pointerdown', finishOnScenePointer, true)
    return () => window.removeEventListener('pointerdown', finishOnScenePointer, true)
  }, [renamingElement?.id])
  useEffect(() => {
    const close = () => setContextMenu(null)
    const rename = () => {
      const state = useRoomStore.getState()
      const selected = state.selectedId
      if (!selected) return
      if (selected === BASE_FLOOR_ID || WALL_SIDES.some((wall) => selected === baseWallId(wall))) return
      setContextMenu(null)
      const folderId = folderIdFromSelection(selected)
      const parentId = sceneEntryParent(selected, state.elementFolders, state.elementFolderAssignments)
      const ancestors: string[] = []
      let parent = parentId
      while (parent && !ancestors.includes(parent)) {
        ancestors.push(parent)
        parent = state.elementFolders.find((folder) => folder.id === parent)?.parentId ?? null
      }
      setCollapsedFolders((current) => ({ ...current, ...Object.fromEntries(ancestors.map((id) => [id, false])) }))
      if (folderId) {
        const folder = state.elementFolders.find((candidate) => candidate.id === folderId)
        if (folder) { setRenamingFolderId(folder.id); setRenamingFolderName(folder.name) }
        return
      }
      const selection = deriveSelection(state, selected)
      const name = selection.selectedSurface?.surface.name ?? elementName(state, selected)
      if (name) setRenamingElement({ id: selected, name })
    }
    const createChild = (event: Event) => {
      const id = (event as CustomEvent<string>).detail
      const state = useRoomStore.getState()
      if (!state.elementFolders.some((folder) => folder.id === id)) return
      state.createElementFolder('', undefined, id)
      setCollapsedFolders((current) => ({ ...current, [id]: false }))
      setContextMenu(null)
    }
    window.addEventListener('room-builder:close-context', close)
    window.addEventListener('room-builder:rename-selected', rename)
    window.addEventListener('room-builder:create-subfolder', createChild)
    return () => {
      window.removeEventListener('room-builder:close-context', close)
      window.removeEventListener('room-builder:rename-selected', rename)
      window.removeEventListener('room-builder:create-subfolder', createChild)
    }
  }, [])

  const folderIdFor = (elementId: string) => {
    const folderId = elementFolderAssignments[elementId]
    return folderId && elementFolders.some((folder) => folder.id === folderId) ? folderId : null
  }
  const siblingsFor = (parentId: string | null) => order.filter((id) => sceneEntryParent(id, elementFolders, elementFolderAssignments) === parentId && !(parentId && folderRoomPack(elementFolders, elementFolderAssignments, structurePacks, parentId)?.id === id))
  const visibleSceneIds = (parentId: string | null): string[] => siblingsFor(parentId).flatMap((id) => {
    const folderId = folderIdFromSelection(id)
    return folderId && !collapsedFolders[folderId] ? [id, ...visibleSceneIds(folderId)] : [id]
  })
  const selectListEntry = (id: string, event: MouseEvent<HTMLButtonElement>) => {
    const mode = event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'single'
    selectSceneListItem(id, mode, visibleSceneIds(null))
  }
  const draggedId = draggedFolder ? folderSelectionId(draggedFolder) : draggedElement
  const draggedItems = draggedId && selectedIds.includes(draggedId) ? selectedIds : draggedId ? [draggedId] : []
  const actionItems = (id: string) => selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : [id]

  const renderElementRow = (element: typeof sceneElements[number]) => {
    const hidden = hiddenElementIds.includes(element.id)
    const locked = lockedElementIds.includes(element.id)
    const folderId = folderIdFor(element.id)
    return (
      <div {...contextEvents(element.id, element.name)} draggable={renamingElement?.id !== element.id} onDragStart={(event) => { event.dataTransfer.setData('text/plain', element.id); event.dataTransfer.effectAllowed = 'move'; setDraggedElement(element.id) }} onDragEnd={() => { setDraggedElement(null); setDropTarget(null) }}
        onDragOver={(event) => {
          if (!draggedId) return
          if (draggedItems.includes(element.id)) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'none'; return }
          event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'
          const position = event.clientY < event.currentTarget.getBoundingClientRect().top + event.currentTarget.clientHeight / 2 ? 'before' : 'after'
          setDropTarget(`row:${element.id}:${position}`)
        }}
        onDrop={(event) => {
          if (!draggedId) return
          if (draggedItems.includes(element.id)) { event.preventDefault(); event.stopPropagation(); return }
          event.preventDefault(); event.stopPropagation()
          const position = event.clientY < event.currentTarget.getBoundingClientRect().top + event.currentTarget.clientHeight / 2 ? 'before' : 'after'
          moveSceneItems(draggedItems, folderId, element.id, position)
          setDraggedElement(null); setDraggedFolder(null); setDropTarget(null)
        }}
        className={`element-row ${selectedIds.includes(element.id) ? 'selected' : ''}${hidden ? ' element-row--hidden' : ''}${locked ? ' element-row--locked' : ''}${dropTarget === `row:${element.id}:before` ? ' element-row--drop-before' : ''}${dropTarget === `row:${element.id}:after` ? ' element-row--drop-after' : ''}`} key={element.id}>
        <span className="element-row__icon">{element.icon}</span>
        {renamingElement?.id === element.id ? <div className="element-select element-select--renaming">
          <input ref={elementRenameInput} className="element-rename-input" aria-label={`Nuevo nombre para ${element.name}`} autoFocus maxLength={80} value={renamingElement.name}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setRenamingElement({ id: element.id, name: event.target.value })}
            onBlur={() => { if (!cancelElementRename.current) renameElement(element.id, renamingElement.name); cancelElementRename.current = false; setRenamingElement(null) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelElementRename.current = true; event.currentTarget.blur() }
            }} />
          <small>{element.kind}</small>
        </div> : <button type="button" className={`element-select${pointerFocusedId === element.id ? ' element-select--pointer-focus' : ''}`} onMouseDown={(event) => { if (event.shiftKey) { event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); setPointerFocusedId(element.id) } }} onBlur={() => setPointerFocusedId((id) => id === element.id ? null : id)} onKeyDown={() => setPointerFocusedId(null)} onClick={(event) => selectListEntry(element.id, event)} aria-pressed={selectedIds.includes(element.id)}>
          <strong>{element.name}</strong><small>{element.kind}</small>
        </button>}
        <div className="element-actions">
          <button
            type="button"
            className="element-action element-visibility"
            aria-pressed={!hidden}
            aria-label={hidden ? `Mostrar ${element.name}` : `Ocultar ${element.name}`}
            title={hidden ? `Mostrar ${element.name}` : `Ocultar ${element.name}`}
            onClick={() => { const ids = actionItems(element.id); if (ids.length > 1) toggleSceneItemsVisibility(ids); else toggleElementVisibility(element.id) }}
          >
            <EyeIcon closed={hidden} />
          </button>
          <button
            type="button"
            className={`element-action element-lock${locked ? ' is-active' : ''}`}
            aria-pressed={locked}
            aria-label={locked ? `Desbloquear ${element.name}` : `Bloquear ${element.name}`}
            title={locked ? `Desbloquear ${element.name}` : `Bloquear ${element.name}`}
            onClick={() => { const ids = actionItems(element.id); if (ids.length > 1) toggleSceneItemsLock(ids); else toggleElementLock(element.id) }}
          >
            <LockIcon locked={locked} />
          </button>
        </div>
      </div>
    )
  }

  const renderFolder = (folder: typeof elementFolders[number]): React.ReactNode => {
          const roomPack = folderRoomPack(elementFolders, elementFolderAssignments, structurePacks, folder.id)
          const folderElements = sceneElements.filter((element) => folderIdFor(element.id) === folder.id && element.id !== roomPack?.id)
          const elementIds = folderElementIds(elementFolderAssignments, folder.id, elementFolders)
          const children = elementFolders.filter((candidate) => candidate.parentId === folder.id)
          const collapsed = collapsedFolders[folder.id] ?? false
          const selected = selectedIds.includes(folderSelectionId(folder.id)) || (!!roomPack && selectedIds.includes(roomPack.id))
          const empty = elementIds.length === 0
          const allHidden = elementIds.length > 0 && elementIds.every((id) => hiddenElementIds.includes(id))
          const allLocked = elementIds.length > 0 && elementIds.every((id) => lockedElementIds.includes(id))
          return (
            <section className={`element-folder${selected ? ' element-folder--selected' : ''}${dropTarget === folder.id ? ' element-folder--drop-target' : ''}${dropTarget === `row:${folderSelectionId(folder.id)}:before` ? ' element-folder--drop-before' : ''}${dropTarget === `row:${folderSelectionId(folder.id)}:after` ? ' element-folder--drop-after' : ''}`} key={folder.id} onDragOver={(event) => {
              if (!draggedElement && !draggedFolder) return
              event.stopPropagation()
              if (draggedItems.some((id) => { const candidate = folderIdFromSelection(id); return candidate && !canMoveFolder(elementFolders, candidate, folder.id) })) { event.dataTransfer.dropEffect = 'none'; setDropTarget(null); return }
              event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(folder.id)
            }} onDrop={(event) => {
              event.preventDefault(); event.stopPropagation()
              moveSceneItems(draggedItems, folder.id)
              setCollapsedFolders((current) => ({ ...current, [folder.id]: false }))
              setDraggedElement(null); setDraggedFolder(null); setDropTarget(null)
            }}>
              <div {...contextEvents(folderSelectionId(folder.id), folder.name)} className="element-folder__heading" draggable={folder.id !== ROOT_ROOM_FOLDER && renamingFolderId !== folder.id} onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData('text/plain', folder.id); event.dataTransfer.effectAllowed = 'move'; setDraggedFolder(folder.id) }} onDragEnd={(event) => { event.stopPropagation(); setDraggedFolder(null); setDropTarget(null) }}
                onDragOver={(event) => {
                  const targetId = folderSelectionId(folder.id)
                  if (!draggedId || draggedItems.includes(targetId)) return
                  const bounds = event.currentTarget.getBoundingClientRect()
                  const fraction = (event.clientY - bounds.top) / bounds.height
                  if (fraction > 0.25 && fraction < 0.75) return
                  event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'
                  setDropTarget(`row:${targetId}:${fraction <= 0.25 ? 'before' : 'after'}`)
                }}
                onDrop={(event) => {
                  const targetId = folderSelectionId(folder.id)
                  if (!draggedId || draggedItems.includes(targetId)) return
                  const bounds = event.currentTarget.getBoundingClientRect()
                  const fraction = (event.clientY - bounds.top) / bounds.height
                  if (fraction > 0.25 && fraction < 0.75) return
                  event.preventDefault(); event.stopPropagation(); moveSceneItems(draggedItems, folder.parentId ?? null, targetId, fraction <= 0.25 ? 'before' : 'after')
                  setDraggedElement(null); setDraggedFolder(null); setDropTarget(null)
                }}>
                {renamingFolderId === folder.id ? (
                  <div className="element-folder__rename">
                    <input
                      autoFocus
                      maxLength={48}
                      aria-label={`Nuevo nombre para ${folder.name}`}
                      value={renamingFolderName}
                      onChange={(event) => setRenamingFolderName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          renameElementFolder(folder.id, renamingFolderName)
                          setRenamingFolderId(null)
                        }
                        if (event.key === 'Escape') setRenamingFolderId(null)
                      }}
                    />
                    <button type="button" aria-label="Guardar nombre de carpeta" onClick={() => { renameElementFolder(folder.id, renamingFolderName); setRenamingFolderId(null) }}>✓</button>
                    <button type="button" aria-label="Cancelar cambio de nombre" onClick={() => setRenamingFolderId(null)}>×</button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="element-folder__collapse"
                      aria-label={`${collapsed ? 'Expandir' : 'Minimizar'} carpeta ${folder.name}`}
                      aria-expanded={!collapsed}
                      aria-controls={`element-folder-${folder.id}`}
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <span className="element-folder__chevron" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`element-folder__select${selected ? ' is-selected' : ''}${pointerFocusedId === folderSelectionId(folder.id) ? ' element-folder__select--pointer-focus' : ''}`}
                      aria-pressed={selected}
                      aria-label={`Carpeta ${folder.name}`}
                      onMouseDown={(event) => { if (event.shiftKey) { event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); setPointerFocusedId(folderSelectionId(folder.id)) } }}
                      onBlur={() => setPointerFocusedId((id) => id === folderSelectionId(folder.id) ? null : id)}
                      onKeyDown={() => setPointerFocusedId(null)}
                      onClick={(event) => selectListEntry(folderSelectionId(folder.id), event)}
                    >
                      {(folder.id === ROOT_ROOM_FOLDER || roomPack) ? <RoomPackIcon /> : <FolderIcon />}
                      <span className="element-folder__name">{folder.name}</span>
                      <small>{elementIds.length - (roomPack ? 1 : 0)}</small>
                    </button>
                    <div className="element-folder__actions">
                      <button
                        type="button"
                        aria-pressed={!allHidden}
                        aria-label={allHidden ? `Mostrar carpeta ${folder.name}` : `Ocultar carpeta ${folder.name}`}
                        title={empty ? 'La carpeta está vacía' : allHidden ? `Mostrar carpeta ${folder.name}` : `Ocultar carpeta ${folder.name}`}
                        disabled={empty && actionItems(folderSelectionId(folder.id)).length === 1}
                        onClick={() => { const ids = actionItems(folderSelectionId(folder.id)); if (ids.length > 1) toggleSceneItemsVisibility(ids); else toggleElementFolderVisibility(folder.id) }}
                      ><EyeIcon closed={allHidden} /></button>
                      <button
                        type="button"
                        aria-pressed={allLocked}
                        aria-label={allLocked ? `Desbloquear carpeta ${folder.name}` : `Bloquear carpeta ${folder.name}`}
                        title={empty ? 'La carpeta está vacía' : allLocked ? `Desbloquear carpeta ${folder.name}` : `Bloquear carpeta ${folder.name}`}
                        disabled={empty && actionItems(folderSelectionId(folder.id)).length === 1}
                        onClick={() => { const ids = actionItems(folderSelectionId(folder.id)); if (ids.length > 1) toggleSceneItemsLock(ids); else toggleElementFolderLock(folder.id) }}
                      ><LockIcon locked={allLocked} /></button>
                    </div>
                  </>
                )}
              </div>
              {!collapsed && (
                <div className="element-list" id={`element-folder-${folder.id}`}>
                  {renderEntries(folder.id)}
                  {children.length === 0 && folderElements.length === 0 && <p className="element-folder__empty">Carpeta vacía. Arrastra un elemento aquí o usa su menú de carpeta.</p>}
                </div>
              )}
            </section>
          )
  }

  const renderEntries = (parentId: string | null) => siblingsFor(parentId).map((id) => {
    const folderId = folderIdFromSelection(id)
    const folder = folderId && elementFolders.find((candidate) => candidate.id === folderId)
    if (folder) return renderFolder(folder)
    const element = sceneElements.find((candidate) => candidate.id === id)
    return element ? renderElementRow(element) : null
  })

  return (
    <aside id="objects-panel" className="side-panel objects-panel" aria-label="Catálogo de objetos">
      <div className="side-panel__content objects-panel__content">
        <ObjectCatalogSection />
        <section className="panel-section elements-section" aria-labelledby="scene-heading">
          <div className="scene-section__heading">
            <span className="eyebrow" id="scene-heading">Escena</span>
            <button
              type="button"
              className={`catalog-family__toggle catalog-toggle-all${sceneCollapsed ? ' scene-section__toggle--collapsed' : ''}`}
              aria-label={sceneCollapsed ? 'Mostrar escena' : 'Minimizar escena'}
              aria-expanded={!sceneCollapsed}
              aria-controls="scene-elements-content"
              onClick={() => setSceneCollapsed((collapsed) => !collapsed)}
            >
              <i aria-hidden="true" />
            </button>
          </div>
          {!sceneCollapsed && <div id="scene-elements-content">
            <div className="elements-heading">
              <h2 id="elements-heading">Elementos en la habitación</h2>
              <button
                type="button"
                className="element-folder-create"
                aria-label="Crear carpeta de elementos"
                title="Crear carpeta"
                onClick={() => createElementFolder('')}
              >＋ Carpeta</button>
            </div>
            <p className="section-copy">Organiza los elementos en carpetas, ocúltalos o bloquéalos sin eliminarlos.</p>
            {elementFolders.length > 0 && <p className={`element-group-label${dropTarget === 'root' ? ' element-group-label--drop-target' : ''}`} onDragOver={(event) => { if (!draggedElement && !draggedFolder) return; event.preventDefault(); setDropTarget('root') }} onDrop={(event) => { event.preventDefault(); moveSceneItems(draggedItems, null); setDraggedElement(null); setDraggedFolder(null); setDropTarget(null) }}>Nivel principal</p>}
            <div className="element-list">{renderEntries(null)}</div>
          </div>}
        </section>
        <GridVisibilitySection />
      </div>
      {contextMenu && <SceneContextMenu key={contextMenu.id} {...contextMenu} siblings={siblingsFor(sceneEntryParent(contextMenu.id, elementFolders, elementFolderAssignments))} onClose={closeContextMenu}
        onRename={() => {
          const id = folderIdFromSelection(contextMenu.id)
          if (id) { setRenamingFolderId(id); setRenamingFolderName(contextMenu.name) }
          else {
            const selection = deriveSelection({ room, furniture, structurePacks }, contextMenu.id)
            setRenamingElement({ id: contextMenu.id, name: selection.selectedSurface?.surface.name ?? contextMenu.name })
          }
        }}
        onCreateChild={(id) => { createElementFolder('', undefined, id); setCollapsedFolders((current) => ({ ...current, [id]: false })) }} />}
    </aside>
  )
}

