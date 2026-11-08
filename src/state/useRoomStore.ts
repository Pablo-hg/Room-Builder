import { create } from 'zustand'
import { instrumentActions } from '../diagnostics/instrumentActions'
import { rejectDiagnosticAction } from '../diagnostics/actionScope'
import { DEFAULT_ROOM } from '../domain/constants'
import { DEFAULT_GRID_VISIBILITY, persistedDesign, persistedDesignSignature } from '../domain/designV1'
import { createLocalDesignRepository, type DesignRepository } from '../persistence/localDesignRepository'
import { cloneRoom, ISO_BASE_ANGLE } from './defaults'
import { finishHistoryTransaction, recordHistoryChange } from './historyTransactions'
import type { RoomActionContext, RoomRuntime, RoomState, RoomUpdate } from './types'
import { createCameraActions } from './actions/cameraActions'
import { createConstructionActions } from './actions/constructionActions'
import { createFurnitureActions } from './actions/furnitureActions'
import { createSelectionActions } from './actions/selectionActions'
import { createHistoryActions } from './actions/historyActions'
import { createDesignActions } from './actions/designActions'
import { createFolderActions } from './actions/folderActions'
import { initialRoomFolder, ROOT_ROOM_FOLDER } from '../domain/elementFolders'
import { normalizeDesign } from '../persistence/designMigrations'
import { createResizeActions } from './actions/resizeActions'
import { createStructureDoorActions } from './actions/structureDoorActions'
import { createWallObjectActions } from './actions/wallObjectActions'
import { rootDoorPack, structureDoorsWorldError, structureDoorPosition } from '../domain/structureDoors'
import { packRoomBox } from '../domain/roomEditing'
import { movedSceneFolderAssignments } from '../domain/spatialFolderPlacement'
import { anchorWallOpenings, connectedOpeningError, fitOpeningToConnectedRun, openingHasSupport, openingTranslationSupported, openingWallRun, reconcileWallOpeningPositions, worldOpenings } from '../domain/wallConnections'

export { structureSurfaceElementId } from '../domain/elementIds'

// Wall limits already reject the edit. Keep validation errors for data/imports
// and diagnostics, but do not turn these routine limits into editor toasts.
function editorNotice(notice: string): string {
  const wallLimit = /^(?:(?:La puerta|Una ventana) queda fuera de la pared [ABCD]\.|Una apertura supera la altura disponible\.|La puerta no cabe en su pared\.|La ventana girada no cabe en la pared con esas medidas\.|La apertura excede el soporte de las paredes conectadas\.)$/
  return wallLimit.test(notice) ? '' : notice
}

export const createRoomStore = (repository: DesignRepository = createLocalDesignRepository()) => create<RoomState>((storeSet, get) => {
  // Camera navigation is session state, never part of a saved design or undo entry.
  let roomFocusHistory: Array<string | null> = [null]
  const runtime: RoomRuntime = {
    undoHistory: [],
    redoHistory: [],
    copiedElement: null,
    copiedElements: null,
    isUndoing: false,
    activeGesture: null,
  }
  const initialWorld = anchorWallOpenings({ room: cloneRoom(), structurePacks: [] })
  const set = (update: RoomUpdate) => {
    let current = get()
    const requestedUpdate = typeof update === 'function' ? update(current) : update
    if (Object.keys(requestedUpdate).length === 1 && requestedUpdate.notice) rejectDiagnosticAction('rule-rejected')
    const rawUpdate = requestedUpdate.notice ? { ...requestedUpdate, notice: editorNotice(requestedUpdate.notice) } : requestedUpdate
    const oldOpeningGeometry = new Map(worldOpenings(current).map((opening) => [opening.id, opening]))
    const editedOpenings = new Set(worldOpenings({ room: rawUpdate.room ?? current.room, structurePacks: rawUpdate.structurePacks ?? current.structurePacks }).filter((opening) => {
      const previous = oldOpeningGeometry.get(opening.id)
      if (!previous) return true
      return (['offset', 'width', 'height', 'rotation', 'wall', 'freePosition', 'wallPosition'] as const)
        .some((key) => JSON.stringify(opening.object[key]) !== JSON.stringify(previous.object[key]))
        || ('sill' in opening.object && opening.object.sill !== ('sill' in previous.object ? previous.object.sill : 0))
    }).map((opening) => opening.id))
    const interruptsGesture = runtime.activeGesture && ['selectedId', 'selectedIds', 'view'].some((key) => Object.prototype.hasOwnProperty.call(rawUpdate, key))
    if (interruptsGesture) {
      const restore = finishHistoryTransaction(runtime, undefined, persistedDesign(current))
      if (restore) {
        runtime.isUndoing = true
        storeSet({ ...restore, structurePacks: restore.structurePacks ?? [] })
        runtime.isUndoing = false
        current = get()
      }
    }
    let nextUpdate: Partial<RoomState> = Object.prototype.hasOwnProperty.call(rawUpdate, 'selectedId') && !Object.prototype.hasOwnProperty.call(rawUpdate, 'selectedIds')
      ? { ...rawUpdate, selectedIds: rawUpdate.selectedId ? [rawUpdate.selectedId] : [], selectionAnchor: rawUpdate.selectedId ?? null }
      : rawUpdate
    if (nextUpdate.structurePacks || nextUpdate.room) {
      if (!runtime.isUndoing && !Object.hasOwn(rawUpdate, 'selectedSavedDesignId')) {
        let room = nextUpdate.room ?? current.room
        const packs = nextUpdate.structurePacks ?? current.structurePacks
        // Removing a physical support must not delete its logical apertures.
        for (const pack of current.structurePacks.filter((old) => !packs.some((item) => item.id === old.id))) {
          const present = new Set(worldOpenings({ room, structurePacks: packs }).map((opening) => opening.id))
          // Preserve an aperture only when it still has a physical wall to
          // attach to. Removing an entire room must not resurrect unsupported
          // windows in the root room or leave orphaned scene-folder entries.
          const candidateWorld = { room, structurePacks: packs }
          const survives = (id: string) => {
            const opening = oldOpeningGeometry.get(id)
            return opening && openingHasSupport(candidateWorld, opening)
          }
          const doors = (pack.doors ?? []).filter((door) => !present.has(door.id) && survives(door.id))
          const windows = (pack.windows ?? []).filter((window) => !present.has(window.id)
            && (window.shape === 'rectangular' || window.shape === 'circular') && survives(window.id))
          room = { ...room, extraDoors: [...(room.extraDoors ?? []), ...doors], windows: [...room.windows, ...windows] }
          const preserved = new Set([...doors, ...windows].map((opening) => opening.id))
          const folders = nextUpdate.elementFolders ?? current.elementFolders
          nextUpdate = { ...nextUpdate,
            hiddenElementIds: [...new Set([...(nextUpdate.hiddenElementIds ?? current.hiddenElementIds), ...current.hiddenElementIds.filter((id) => preserved.has(id))])],
            lockedElementIds: [...new Set([...(nextUpdate.lockedElementIds ?? current.lockedElementIds), ...current.lockedElementIds.filter((id) => preserved.has(id))])],
            sceneElementOrder: [...new Set([...(nextUpdate.sceneElementOrder ?? current.sceneElementOrder), ...current.sceneElementOrder.filter((id) => preserved.has(id))])],
            elementFolderAssignments: { ...(nextUpdate.elementFolderAssignments ?? current.elementFolderAssignments),
              ...Object.fromEntries([...preserved].map((id) => [id, folders.some((folder) => folder.id === current.elementFolderAssignments[id]) ? current.elementFolderAssignments[id] : ROOT_ROOM_FOLDER])) },
          }
        }
        nextUpdate = { ...nextUpdate, ...reconcileWallOpeningPositions(current, { room, structurePacks: packs }) }
        for (const opening of worldOpenings({ room: nextUpdate.room!, structurePacks: nextUpdate.structurePacks! })) {
          const previous = oldOpeningGeometry.get(opening.id)
          if (!previous || opening.object.offset !== previous.object.offset || opening.object.wall === previous.object.wall && !previous.object.freePosition) continue
          if (connectedOpeningError({ room: nextUpdate.room!, structurePacks: nextUpdate.structurePacks! }, new Set([opening.id]))) {
            const fitted = fitOpeningToConnectedRun({ room: nextUpdate.room!, structurePacks: nextUpdate.structurePacks! }, opening.id)
            if (fitted) nextUpdate = { ...nextUpdate, ...fitted }
          }
        }
      }
      // Loading a v1-v9 design must not silently upgrade it to v10 by
      // inserting wallPosition everywhere: that changed its persisted
      // signature and incorrectly marked an undo as unsaved. Existing
      // anchors are preserved; new geometrical edits are reconciled above.
      const candidatePacks = nextUpdate.structurePacks ?? current.structurePacks
      const structurePacks = candidatePacks.map((pack) => {
        const old = current.structurePacks.find((candidate) => candidate.id === pack.id)
        const removedWalls = old?.surfaces.filter((surface) => surface.kind === 'wall' && !pack.surfaces.some((candidate) => candidate.id === surface.id)).map((surface) => surface.wall) ?? []
        if (!removedWalls.length) return pack
        const validSupport = (id: string) => {
          const opening = oldOpeningGeometry.get(id)
          return !!opening && openingHasSupport({ room: nextUpdate.room ?? current.room, structurePacks: candidatePacks }, opening)
        }
        return { ...pack,
          ...(pack.doors ? { doors: pack.doors.filter((door) => !removedWalls.includes(door.wall) || !!door.wallPosition && validSupport(door.id)) } : {}),
          ...(pack.windows ? { windows: pack.windows.filter((window) => window.freePosition || !removedWalls.includes(window.wall) || !!window.wallPosition && validSupport(window.id)) } : {}),
        }
      })
      const remaining = new Set([...(nextUpdate.room ?? current.room).windows.map((window) => window.id), ...((nextUpdate.room ?? current.room).extraDoors ?? []).map((door) => door.id), ...structurePacks.flatMap((pack) => [...(pack.doors ?? []).map((door) => door.id), ...(pack.windows ?? []).map((window) => window.id)])])
      const removed = new Set([...current.room.windows.map((window) => window.id), ...(current.room.extraDoors ?? []).map((door) => door.id), ...current.structurePacks.flatMap((pack) => [...(pack.doors ?? []).map((door) => door.id), ...(pack.windows ?? []).map((window) => window.id)])].filter((id) => !remaining.has(id)))
      nextUpdate = { ...nextUpdate, structurePacks }
      if (removed.size) nextUpdate = { ...nextUpdate,
        hiddenElementIds: (nextUpdate.hiddenElementIds ?? current.hiddenElementIds).filter((id) => !removed.has(id)),
        lockedElementIds: (nextUpdate.lockedElementIds ?? current.lockedElementIds).filter((id) => !removed.has(id)),
        sceneElementOrder: (nextUpdate.sceneElementOrder ?? current.sceneElementOrder).filter((id) => !removed.has(id)),
        elementFolderAssignments: Object.fromEntries(Object.entries(nextUpdate.elementFolderAssignments ?? current.elementFolderAssignments).filter(([id]) => !removed.has(id))),
        selectedIds: (nextUpdate.selectedIds ?? current.selectedIds).filter((id) => !removed.has(id)),
        ...(removed.has(nextUpdate.selectedId ?? current.selectedId ?? '') ? { selectedId: null, selectedIds: [], selectionAnchor: null } : {}),
      }
    }
    const packs = nextUpdate.structurePacks ?? current.structurePacks
    const validFocus = (id: string | null) => id === null || packs.some((pack) => pack.id === id && pack.id.startsWith('floor-pack-'))
    const replacingDesign = Object.hasOwn(rawUpdate, 'room') && Object.hasOwn(rawUpdate, 'selectedSavedDesignId')
    let nextFocusHistory = replacingDesign ? [null] : roomFocusHistory.filter(validFocus)
    const requestedFocus = replacingDesign ? null : nextUpdate.activeRoomId === undefined ? current.activeRoomId : nextUpdate.activeRoomId
    const activeRoomId = validFocus(requestedFocus) ? requestedFocus : [...nextFocusHistory].reverse().find(validFocus) ?? null
    if (activeRoomId !== current.activeRoomId || activeRoomId !== requestedFocus || replacingDesign) {
      const pack = packs.find((candidate) => candidate.id === activeRoomId)
      const box = pack && packRoomBox(pack, nextUpdate.room ?? current.room)
      const origin = { x: (pack?.x ?? 0) + (box?.x ?? 0), y: (pack?.y ?? 0) + (box?.y ?? 0), z: (pack?.z ?? 0) + (box?.z ?? 0) }
      nextUpdate = { ...nextUpdate, activeRoomId, isoCameraHeight: origin.y,
        topCameraX: 0, topCameraZ: 0, freeCameraOffset: origin, freeCameraNavigated: false }
      nextFocusHistory = [...nextFocusHistory.filter((id) => id !== activeRoomId), activeRoomId]
    }
    // An element entering another room's 3D volume moves into that room's
    // scene folder in the SAME history entry as its geometry. Undo/redo restore
    // persisted assignments verbatim, without a second automatic reparenting.
    if (!runtime.isUndoing && !replacingDesign && (Object.hasOwn(rawUpdate, 'furniture') || Object.hasOwn(rawUpdate, 'structurePacks') || Object.hasOwn(rawUpdate, 'room'))) {
      const movedAssignments = movedSceneFolderAssignments(
        current, { ...current, ...nextUpdate },
        Object.hasOwn(rawUpdate, 'furniture'), Object.hasOwn(rawUpdate, 'structurePacks'),
      )
      if (movedAssignments) nextUpdate = { ...nextUpdate, elementFolderAssignments: movedAssignments }
    }
    const nextState = { ...current, ...nextUpdate }
    if (Object.hasOwn(rawUpdate, 'room') || Object.hasOwn(rawUpdate, 'structurePacks')) {
      if (!runtime.isUndoing && !Object.hasOwn(rawUpdate, 'selectedSavedDesignId')) {
        const oldOpenings = new Map(worldOpenings(current).map((item) => [item.id, item]))
        const changed = new Set<string>()
        for (const opening of worldOpenings(nextState)) {
          const previous = oldOpenings.get(opening.id)
          const moved = previous && (['x', 'y', 'z'] as const).some((axis) => Math.abs(opening.position[axis] - previous.position[axis]) > 1e-9)
          if (previous && moved && editedOpenings.has(opening.id) && previous.object.wall === opening.object.wall && openingHasSupport(current, previous) && !openingTranslationSupported(nextState, previous, opening)) {
            rejectDiagnosticAction('opening-path-unsupported'); return
          }
          if (previous && (['x', 'y', 'z'] as const).some((axis) => previous.object.axisLocks?.[axis] && Math.abs(opening.position[axis] - previous.position[axis]) > 1e-9)) {
            rejectDiagnosticAction('opening-axis-locked'); return
          }
          if (editedOpenings.has(opening.id)) changed.add(opening.id)
        }
        const openingError = changed.size ? connectedOpeningError(nextState, changed) : null
        if (openingError) { rejectDiagnosticAction('connected-opening-invalid'); storeSet({ notice: editorNotice(openingError) }); return }
        for (const opening of worldOpenings(nextState).filter((item) => changed.has(item.id))) {
          const previous = oldOpenings.get(opening.id)
          const affected = [...openingWallRun(nextState, opening), ...(previous ? openingWallRun(current, previous) : [])]
          if (affected.some((wall) => current.lockedElementIds.includes(wall.id) || wall.packId && current.lockedElementIds.includes(wall.packId))) {
            rejectDiagnosticAction('opening-support-locked'); return
          }
        }
        for (const pack of [rootDoorPack(current.room), ...current.structurePacks]) for (const door of pack.doors ?? []) {
          const nextPack = pack.id === '__root__' ? rootDoorPack(nextState.room) : nextState.structurePacks.find((candidate) => candidate.id === pack.id)
          const nextDoor = nextPack?.doors?.find((candidate) => candidate.id === door.id)
          if (!nextPack || !nextDoor) continue
          const before = structureDoorPosition(current.room, pack, door)
          const after = structureDoorPosition(nextState.room, nextPack, nextDoor)
          if (before && after && (['x', 'y', 'z'] as const).some((axis) => (door.axisLocks?.[axis] || current.lockedElementIds.includes(door.id)) && Math.abs(before[axis] - after[axis]) > 1e-9)) { rejectDiagnosticAction('door-axis-locked'); storeSet({ notice: 'El movimiento desplazaría un eje bloqueado de una puerta.' }); return }
        }
      }
      const error = structureDoorsWorldError(nextState.room, nextState.structurePacks)
      if (error) { rejectDiagnosticAction('structure-door-invalid'); storeSet({ notice: editorNotice(error) }); return }
    }
    roomFocusHistory = nextFocusHistory
    const designChanged = persistedDesignSignature(persistedDesign(current)) !== persistedDesignSignature(persistedDesign(nextState))
    if (designChanged) {
      recordHistoryChange(runtime, persistedDesign(current))
      const activeDesign = nextState.savedDesigns.find((design) => design.id === nextState.selectedSavedDesignId)
      let savedSignature = ''
      if (activeDesign) {
        try { savedSignature = persistedDesignSignature(normalizeDesign(activeDesign.data)) }
        catch { /* Una entrada inválida no impide editar el diseño actual. */ }
      }
      storeSet({
        ...nextUpdate,
        undoCount: runtime.undoHistory.length,
        redoCount: runtime.redoHistory.length,
        hasUnsavedChanges: nextUpdate.hasUnsavedChanges ?? (!activeDesign || persistedDesignSignature(persistedDesign(nextState)) !== savedSignature),
      })
      return
    }
    storeSet(nextUpdate)
  }

  const context: RoomActionContext = { set, get, runtime, repository }

  return instrumentActions({
    room: initialWorld.room,
    furniture: [],
    structurePacks: [],
    selectedId: null,
    selectedIds: [],
    selectionAnchor: null,
    view: 'isometric',
    isoOrientation: 0,
    topOrientation: 0,
    topCameraX: 0,
    topCameraZ: 0,
    activeRoomId: null,
    setActiveRoomId: (activeRoomId) => set({ activeRoomId }),
    isoAngle: ISO_BASE_ANGLE,
    isoCameraHeight: 0,
    setIsoCameraHeight: (isoCameraHeight) => set({ isoCameraHeight }),
    freeCameraOffset: { x: 0, y: 0, z: 0 },
    freeCameraNavigated: false,
    moveFreeCamera: (x, y, z) => set((state) => ({ freeCameraNavigated: true, freeCameraOffset: { x: state.freeCameraOffset.x + x, y: state.freeCameraOffset.y + y, z: state.freeCameraOffset.z + z } })),
    isIsoOrbitDragging: false,
    freeAzimuth: ISO_BASE_ANGLE,
    freeElevation: 0.58,
    isFreeOrbitDragging: false,
    cameraZoom: 1,
    freeCameraZoom: 1,
    povCameraZoom: 1,
    wallView: null,
    frontCameraHeight: DEFAULT_ROOM.height / 2,
    povYaw: 0,
    gridSnap: true,
    gridVisibility: { ...DEFAULT_GRID_VISIBILITY },
    hiddenElementIds: [],
    lockedElementIds: [],
    ...initialRoomFolder(DEFAULT_ROOM),
    sceneElementOrder: [],
    notice: '',
    undoCount: 0,
    redoCount: 0,
    savedDesigns: [],
    selectedSavedDesignId: '',
    hasUnsavedChanges: false,
    ...createCameraActions(context),
    ...createConstructionActions(context),
    ...createStructureDoorActions(context),
    ...createWallObjectActions(context),
    ...createFurnitureActions(context),
    ...createSelectionActions(context),
    ...createFolderActions(context),
    ...createHistoryActions(context),
    ...createDesignActions(context),
    ...createResizeActions(context),
  }, get, runtime)
})

export const useRoomStore = createRoomStore()
