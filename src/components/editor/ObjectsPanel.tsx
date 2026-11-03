import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { WALL_LABELS } from '../../domain/constants'
import { visibleWallsForView } from './viewHelpers'
import { FURNITURE_CATALOG, FURNITURE_FAMILIES, FURNITURE_PRESETS, isWallPictureKind, isWallPictureShape, isWallMirrorShape, OPENING_CATALOG, openingKindForShape } from '../../domain/objectCatalog'
import type { FurnitureKind } from '../../domain/types'
import { FurnitureIcon, StructurePackIcon, StructureSurfaceIcon } from '../iconCatalog'
import { useRoomStore } from '../../state/useRoomStore'
import { structureGridElementId, structureSurfaceElementId } from '../../domain/elementIds'
import { deriveSelection, elementName } from '../../domain/selection'
import { BASE_FLOOR_ID, baseWallId, canMoveFolder, folderElementIds, folderIdFromSelection, folderRoomPack, folderSelectionId, orderedSceneIds, ROOT_ROOM_FOLDER, sceneEntryParent } from '../../domain/elementFolders'
import { WALL_SIDES } from '../../domain/constants'
import { OpeningSwatch } from './Controls'
import { EyeIcon, FolderIcon, LockIcon, RoomPackIcon } from './ElementIcons'
import { SceneContextMenu } from './SceneContextMenu'
import { VariantSwitcher } from './VariantSwitcher'

export function ObjectsPanel() {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const [catalogCollapsed, setCatalogCollapsed] = useState(false)
  const [choosingRoomPosition, setChoosingRoomPosition] = useState(false)
  const [draggedElement, setDraggedElement] = useState<string | null>(null)
  const [draggedFolder, setDraggedFolder] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
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
  const activeRoomId = useRoomStore((state) => state.activeRoomId)
  const selectedId = useRoomStore((state) => state.selectedId)
  const selectedIds = useRoomStore((state) => state.selectedIds)
  const view = useRoomStore((state) => state.view)
  const isoOrientation = useRoomStore((state) => state.isoOrientation)
  const freeAzimuth = useRoomStore((state) => state.freeAzimuth)
  const wallView = useRoomStore((state) => state.wallView)
  const gridVisibility = useRoomStore((state) => state.gridVisibility)
  const addFurniture = useRoomStore((state) => state.addFurniture)
  const addWindow = useRoomStore((state) => state.addWindow)
  const addStructurePack = useRoomStore((state) => state.addStructurePack)
  const addStructureObject = useRoomStore((state) => state.addStructureObject)
  const selectElement = useRoomStore((state) => state.selectElement)
  const selectSceneListItem = useRoomStore((state) => state.selectSceneListItem)
  const toggleGridVisibility = useRoomStore((state) => state.toggleGridVisibility)
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
    ...room.windows.map((window, index) => {
      const name = OPENING_CATALOG[openingKindForShape(window.shape)].name
      const family = window.shape === 'wallShelf' ? 'Almacenaje' : isWallPictureShape(window.shape) || isWallMirrorShape(window.shape) || window.shape === 'wallSconce' ? 'Decoración' : 'Apertura'
      const icon = isWallPictureShape(window.shape)
        ? <FurnitureIcon kind={window.shape} color={window.color} />
        : <OpeningSwatch kind={openingKindForShape(window.shape) as 'window' | 'circularWindow' | 'wallShelf' | 'mirrorRectangular' | 'mirrorCircular' | 'wallSconce'} color={window.color} />
      return { id: window.id, name: window.name || `${name} ${index + 1}`, kind: `${family} · pared ${WALL_LABELS[window.wall]}`, icon }
    }),
    ...furniture.map((item) => ({ id: item.id, name: item.name, kind: FURNITURE_FAMILIES.find((family) => family.id === FURNITURE_CATALOG[item.kind].family)?.label ?? 'Mueble', icon: <FurnitureIcon kind={item.kind} color={item.color} /> })),
    ...structurePacks.flatMap((pack) => [
      { id: pack.id, name: pack.name, kind: 'Pack de construcción', icon: <StructurePackIcon /> },
      ...pack.surfaces.map((surface) => ({
        id: structureSurfaceElementId(pack.id, surface.id),
        name: `${pack.name} · ${surface.name}`,
        kind: 'Superficie de construcción',
        icon: <StructureSurfaceIcon kind={surface.kind === 'ceiling' ? 'wall' : surface.kind} />,
      })),
    ]),
  ]
  const order = orderedSceneIds({ room, furniture, structurePacks, sceneElementOrder, elementFolders })
  const orderIndex = new Map(order.map((id, index) => [id, index]))
  sceneElements.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
  const visibleGridWalls = visibleWallsForView(view, isoOrientation, wallView, freeAzimuth)
  const activeRoom = structurePacks.find((pack) => pack.id === activeRoomId && pack.id.startsWith('floor-pack-'))
  const gridControls = [
    { id: 'floor' as const, label: 'Suelo' },
    ...visibleGridWalls.map((wall) => ({ id: wall, label: `Pared ${WALL_LABELS[wall]}` })),
  ].filter((control) => !activeRoom || activeRoom.surfaces.some((surface) => control.id === 'floor' ? surface.kind === 'floor' : surface.kind === 'wall' && surface.wall === control.id))
  const toggleCategory = (category: string) => {
    setCollapsedCategories((current) => ({ ...current, [category]: !current[category] }))
  }
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
                      {roomPack ? <RoomPackIcon /> : <FolderIcon />}
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
        <VariantSwitcher />
        <section className="panel-section">
        <span className="eyebrow">Objetos</span>
        <div className="catalog-heading">
          <div>
            <h2>Pequeño catálogo</h2>
            {!catalogCollapsed && <p className="section-copy">Añade muebles, aperturas y decoración mural, o selecciona la puerta existente.</p>}
          </div>
          <button
            type="button"
            className="catalog-family__toggle catalog-toggle-all"
            aria-expanded={!catalogCollapsed}
            aria-controls="catalog-families"
            aria-label={catalogCollapsed ? 'Mostrar catálogo completo' : 'Minimizar catálogo completo'}
            onClick={() => setCatalogCollapsed((collapsed) => !collapsed)}
          >
            <i aria-hidden="true" />
          </button>
        </div>
        {!catalogCollapsed && <div className="catalog-families" id="catalog-families">
          <section className={`catalog-family ${collapsedCategories.structure ? 'catalog-family--collapsed' : ''}`} aria-labelledby="catalog-structure">
            <h3>
              <button
                id="catalog-structure"
                type="button"
                className="catalog-family__toggle"
                aria-expanded={!collapsedCategories.structure}
                aria-controls="catalog-grid-structure"
                onClick={() => toggleCategory('structure')}
              >
                <span>Construcción</span><i aria-hidden="true" />
              </button>
            </h3>
            {!collapsedCategories.structure && <div className="catalog-grid" id="catalog-grid-structure">
              <button type="button" className="catalog-card" aria-expanded={choosingRoomPosition} onClick={() => setChoosingRoomPosition((open) => !open)}>
                <StructurePackIcon />
                <span>Nueva habitación vacía</span><small>＋ Elegir ubicación</small>
              </button>
              {choosingRoomPosition && <div className="room-position-choices" aria-label="Ubicación de la nueva habitación">
                <strong>¿Dónde crearla?</strong>
                {([['up', 'Encima'], ['down', 'Debajo'], ['north', `Pared ${WALL_LABELS.north}`], ['east', `Pared ${WALL_LABELS.east}`], ['south', `Pared ${WALL_LABELS.south}`], ['west', `Pared ${WALL_LABELS.west}`]] as const).map(([direction, label]) => <button type="button" key={direction} onClick={() => { addStructurePack(direction); setChoosingRoomPosition(false) }}>{label}</button>)}
              </div>}
              <button type="button" className="catalog-card" onClick={() => addStructureObject('floor')}>
                <StructureSurfaceIcon kind="floor" />
                <span>Suelo</span><small>＋ Objeto independiente</small>
              </button>
              <button type="button" className="catalog-card" onClick={() => addStructureObject('wall')}>
                <StructureSurfaceIcon kind="wall" />
                <span>Pared</span><small>＋ Objeto independiente</small>
              </button>
            </div>}
          </section>
          <section className={`catalog-family ${collapsedCategories.openings ? 'catalog-family--collapsed' : ''}`} aria-labelledby="catalog-openings">
            <h3>
              <button
                id="catalog-openings"
                type="button"
                className="catalog-family__toggle"
                aria-expanded={!collapsedCategories.openings}
                aria-controls="catalog-grid-openings"
                onClick={() => toggleCategory('openings')}
              >
                <span>Aperturas</span><i aria-hidden="true" />
              </button>
            </h3>
            {!collapsedCategories.openings && <div className="catalog-grid" id="catalog-grid-openings">
              <button type="button" className={`catalog-card ${selectedId === 'door' ? 'active' : ''}`} onClick={() => selectElement('door')} aria-pressed={selectedId === 'door'}>
                <OpeningSwatch kind="door" />
                <span>{OPENING_CATALOG.door.name}</span><small>Seleccionar</small>
              </button>
              <button type="button" className="catalog-card" onClick={() => addWindow('rectangular')}>
                <OpeningSwatch kind="window" />
                <span>{OPENING_CATALOG.window.name}</span><small>＋ Añadir</small>
              </button>
              <button type="button" className="catalog-card" onClick={() => addWindow('circular')}>
                <OpeningSwatch kind="circularWindow" />
                <span>{OPENING_CATALOG.circularWindow.name}</span><small>＋ Añadir</small>
              </button>
            </div>}
          </section>
          {FURNITURE_FAMILIES.map((family) => {
            const kinds = (Object.keys(FURNITURE_CATALOG) as FurnitureKind[]).filter((kind) => FURNITURE_CATALOG[kind].family === family.id)
            return (
              <section className={`catalog-family ${collapsedCategories[family.id] ? 'catalog-family--collapsed' : ''}`} key={family.id} aria-labelledby={`catalog-${family.id}`}>
                <h3>
                  <button
                    id={`catalog-${family.id}`}
                    type="button"
                    className="catalog-family__toggle"
                    aria-expanded={!collapsedCategories[family.id]}
                    aria-controls={`catalog-grid-${family.id}`}
                    onClick={() => toggleCategory(family.id)}
                  >
                    <span>{family.label}</span><i aria-hidden="true" />
                  </button>
                </h3>
                {!collapsedCategories[family.id] && <div className="catalog-grid" id={`catalog-grid-${family.id}`}>
                  {kinds.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className="catalog-card"
                      onClick={() => {
                        if (isWallPictureKind(kind)) addWindow(kind)
                        else addFurniture(kind)
                      }}
                    >
                      <FurnitureIcon kind={kind} />
                      <span>{FURNITURE_PRESETS[kind].name}</span><small>＋ Añadir</small>
                    </button>
                  ))}
                  {family.id === 'wallDecor' && (
                    <>
                      <button type="button" className="catalog-card" onClick={() => addWindow('wallSconce')}>
                        <OpeningSwatch kind="wallSconce" />
                        <span>{OPENING_CATALOG.wallSconce.name}</span><small>＋ Añadir</small>
                      </button>
                      <button type="button" className="catalog-card" onClick={() => addWindow('mirrorRectangular')}>
                        <OpeningSwatch kind="mirrorRectangular" />
                        <span>{OPENING_CATALOG.mirrorRectangular.name}</span><small>＋ Añadir</small>
                      </button>
                      <button type="button" className="catalog-card" onClick={() => addWindow('mirrorCircular')}>
                        <OpeningSwatch kind="mirrorCircular" />
                        <span>{OPENING_CATALOG.mirrorCircular.name}</span><small>＋ Añadir</small>
                      </button>
                    </>
                  )}
                  {family.id === 'storage' && (
                    <button type="button" className="catalog-card" onClick={() => addWindow('wallShelf')}>
                      <OpeningSwatch kind="wallShelf" />
                      <span>{OPENING_CATALOG.wallShelf.name}</span><small>＋ Añadir</small>
                    </button>
                  )}
                </div>}
              </section>
            )
          })}
        </div>}
        </section>
        <section className="panel-section elements-section" aria-labelledby="elements-heading">
        <span className="eyebrow">Escena</span>
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
        {elementFolders.length > 0 && <p className={`element-group-label${dropTarget === 'root' ? ' element-group-label--drop-target' : ''}`} onDragOver={(event) => { if (!draggedElement && !draggedFolder) return; event.preventDefault(); setDropTarget('root') }} onDrop={(event) => { event.preventDefault(); moveSceneItems(draggedItems, null); setDraggedElement(null); setDraggedFolder(null); setDropTarget(null) }}>Nivel principal · Sin carpeta</p>}
        <div className="element-list">{renderEntries(null)}</div>
        </section>
        <section className="panel-section grid-section" aria-labelledby="grid-heading">
        <div className="grid-section__heading">
          <span className="grid-icon" aria-hidden="true">▦</span>
          <span><strong id="grid-heading">Cuadrículas visibles</strong><small>{activeRoom?.name ?? elementFolders.find((folder) => folder.id === ROOT_ROOM_FOLDER)?.name ?? 'Habitación principal'} · cuadrados de 25 cm</small></span>
        </div>
        <div className="grid-visibility-list">
          {gridControls.map((surface) => {
            const roomSurface = activeRoom?.surfaces.find((item) => surface.id === 'floor' ? item.kind === 'floor' : item.kind === 'wall' && item.wall === surface.id)
            const gridId = activeRoom && roomSurface ? structureGridElementId(activeRoom.id, roomSurface.id) : null
            const visible = gridId ? !hiddenElementIds.includes(gridId) : gridVisibility[surface.id]
            return (
            <div className="grid-visibility-row" key={surface.id}>
              <span>{surface.label}</span>
              <button
                type="button"
                className={`switch ${visible ? 'on' : ''}`}
                role="switch"
                aria-checked={visible}
                aria-label={`Mostrar cuadrícula de ${surface.label.toLowerCase()}`}
                onClick={() => gridId ? toggleElementVisibility(gridId) : toggleGridVisibility(surface.id)}
              ><span /></button>
            </div>
          )})}
          {structurePacks.filter((pack) => pack.id.startsWith('floor-object-') || pack.id.startsWith('wall-object-')).flatMap((pack) => pack.surfaces.map((surface) => {
            const id = structureGridElementId(pack.id, surface.id)
            const visible = !hiddenElementIds.includes(id)
            return <div className="grid-visibility-row" key={id}>
              <span>{pack.name}</span>
              <button type="button" className={`switch ${visible ? 'on' : ''}`} role="switch" aria-checked={visible} aria-label={`Mostrar cuadrícula de ${pack.name}`} onClick={() => toggleElementVisibility(id)}><span /></button>
            </div>
          }))}
        </div>
        <small className="grid-snap-note">El ajuste de movimiento a 12,5 cm se mantiene activo.</small>
        </section>
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

