import { makeId, structureGridElementId, structureSurfaceElementId } from '../../domain/elementIds'
import { BASE_ROOM_SURFACE_IDS, canMoveFolder, folderElementIds, folderIdFromSelection, folderRoomPack, folderSelectionId, orderedSceneIds, sceneEntryParent, ROOT_ROOM_FOLDER } from '../../domain/elementFolders'
import { recordInteraction } from '../../debug/interactionLog'
import type { RoomActionContext, RoomState } from '../types'

type FolderActions = Pick<
  RoomState,
  | 'createElementFolder'
  | 'renameElementFolder'
  | 'moveElementFolder'
  | 'deleteElementFolder'
  | 'moveElementToFolder'
  | 'moveSceneItems'
  | 'groupSceneItems'
  | 'removeSceneItems'
  | 'stepSceneItems'
  | 'toggleSceneItemsVisibility'
  | 'toggleSceneItemsLock'
  | 'reorderSceneElement'
  | 'toggleElementFolderVisibility'
  | 'toggleElementFolderLock'
>

function nextFolderName(state: RoomState) {
  const names = new Set(state.elementFolders.map((folder) => folder.name))
  let index = state.elementFolders.filter((folder) => folder.id !== ROOT_ROOM_FOLDER).length + 1
  while (names.has(`Carpeta ${index}`)) index += 1
  return `Carpeta ${index}`
}

function topLevelSelection(state: RoomState, ids: string[]) {
  const selected = new Set(ids)
  return orderedSceneIds(state).filter((id) => {
    if (!selected.has(id)) return false
    let parent = sceneEntryParent(id, state.elementFolders, state.elementFolderAssignments)
    const visited = new Set<string>()
    while (parent && !visited.has(parent)) {
      if (selected.has(folderSelectionId(parent))) return false
      visited.add(parent)
      parent = state.elementFolders.find((folder) => folder.id === parent)?.parentId ?? null
    }
    return true
  })
}

export function createFolderActions(context: Pick<RoomActionContext, 'set' | 'get'>): FolderActions {
  const { set, get } = context
  return {
    createElementFolder: (name, elementId, parentId) => set((state) => {
      if (parentId && !state.elementFolders.some((folder) => folder.id === parentId)) return {}
      const cleanName = name.trim().slice(0, 48) || nextFolderName(state)
      const folder = { id: makeId('folder'), name: cleanName, ...(parentId ? { parentId } : {}) }
      recordInteraction('state.element-folder.created', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id: folder.id, name: folder.name, elementId },
      })
      return {
        elementFolders: [...state.elementFolders, folder],
        elementFolderAssignments: elementId
          ? { ...state.elementFolderAssignments, [elementId]: folder.id }
          : state.elementFolderAssignments,
        notice: `Carpeta «${cleanName}» creada.`,
      }
    }),
    renameElementFolder: (id, name) => set((state) => {
      const cleanName = name.trim().slice(0, 48)
      const folder = state.elementFolders.find((candidate) => candidate.id === id)
      if (!folder || !cleanName || cleanName === folder.name) return {}
      const roomPack = folderRoomPack(state.elementFolders, state.elementFolderAssignments, state.structurePacks, id)
      recordInteraction('state.element-folder.renamed', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, previousName: folder.name, name: cleanName },
      })
      return {
        elementFolders: state.elementFolders.map((candidate) => candidate.id === id ? { ...candidate, name: cleanName } : candidate),
        ...(roomPack ? { structurePacks: state.structurePacks.map((pack) => pack.id === roomPack.id ? { ...pack, name: cleanName } : pack) } : {}),
        notice: '',
      }
    }),
    moveElementFolder: (id, parentId) => set((state) => {
      const folder = state.elementFolders.find((candidate) => candidate.id === id)
      if (!folder || (folder.parentId ?? null) === parentId || !canMoveFolder(state.elementFolders, id, parentId)) return {}
      return {
        elementFolders: state.elementFolders.map((candidate) => {
          if (candidate.id !== id) return candidate
          const { parentId: _parentId, ...rest } = candidate
          return parentId ? { ...rest, parentId } : rest
        }),
        notice: '',
      }
    }),
    deleteElementFolder: (id, mode) => {
      if (id === ROOT_ROOM_FOLDER) { set({ notice: 'La carpeta raíz no se puede eliminar ni desagrupar.' }); return }
      const current = get()
      if (mode !== 'ungroup' && current.elementFolders.some((folder) => folder.id === id)) {
        get().removeSceneItems([folderSelectionId(id)])
        return
      }
      set((state) => {
      const folder = state.elementFolders.find((candidate) => candidate.id === id)
      if (!folder) return {}
      recordInteraction('state.element-folder.deleted', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: folder.name },
      })
      return {
        elementFolders: state.elementFolders.filter((candidate) => candidate.id !== id).map((candidate) => {
          if (candidate.parentId !== id) return candidate
          const { parentId: _parentId, ...rest } = candidate
          return folder.parentId ? { ...rest, parentId: folder.parentId } : rest
        }),
        elementFolderAssignments: Object.fromEntries(Object.entries(state.elementFolderAssignments).flatMap(([elementId, folderId]) => folderId !== id ? [[elementId, folderId]] : folder.parentId ? [[elementId, folder.parentId]] : [])),
        selectedId: state.selectedId === folderSelectionId(id) ? null : state.selectedId,
        notice: mode === 'ungroup' ? `Carpeta «${folder.name}» desagrupada.` : `Carpeta «${folder.name}» eliminada.`,
      }
      })
    },
    moveElementToFolder: (elementId, folderId) => set((state) => {
      if (folderId && !state.elementFolders.some((folder) => folder.id === folderId)) return {}
      if ((state.elementFolderAssignments[elementId] ?? null) === folderId) return {}
      const elementFolderAssignments = { ...state.elementFolderAssignments }
      if (folderId) elementFolderAssignments[elementId] = folderId
      else delete elementFolderAssignments[elementId]
      recordInteraction('state.element-folder.moved', {
        view: state.view,
        selectedId: state.selectedId,
        details: { elementId, folderId },
      })
      return { elementFolderAssignments, notice: '' }
    }),
    moveSceneItems: (ids, folderId, targetId, position = 'before') => set((state) => {
      if (folderId && !state.elementFolders.some((folder) => folder.id === folderId)) return {}
      const moving = topLevelSelection(state, ids)
      if (!moving.length || (targetId && moving.includes(targetId))) return {}
      if (moving.some((id) => { const folder = folderIdFromSelection(id); return folder && !canMoveFolder(state.elementFolders, folder, folderId) })) return { notice: 'No se puede mover una carpeta dentro de sí misma o de sus subcarpetas.' }
      if (targetId && (!orderedSceneIds(state).includes(targetId) || sceneEntryParent(targetId, state.elementFolders, state.elementFolderAssignments) !== folderId)) return {}
      const assignments = { ...state.elementFolderAssignments }
      for (const id of moving) if (!folderIdFromSelection(id)) {
        if (folderId) assignments[id] = folderId
        else delete assignments[id]
      }
      const folders = state.elementFolders.map((folder) => {
        if (!moving.includes(folderSelectionId(folder.id))) return folder
        const { parentId: _parentId, ...rest } = folder
        return folderId ? { ...rest, parentId: folderId } : rest
      })
      const original = orderedSceneIds(state)
      const next = original.filter((id) => !moving.includes(id))
      if (targetId) next.splice(next.indexOf(targetId) + (position === 'after' ? 1 : 0), 0, ...moving)
      else next.push(...moving)
      if (JSON.stringify(assignments) === JSON.stringify(state.elementFolderAssignments) && JSON.stringify(folders) === JSON.stringify(state.elementFolders) && next.every((id, index) => id === original[index])) return {}
      return { elementFolderAssignments: assignments, elementFolders: folders, sceneElementOrder: next, notice: '' }
    }),
    groupSceneItems: (ids) => set((state) => {
      if (ids.includes(folderSelectionId(ROOT_ROOM_FOLDER))) return { notice: 'La carpeta raíz debe permanecer en el nivel principal.' }
      const moving = topLevelSelection(state, ids)
      if (ids.length < 2 || !moving.length) return {}
      const parents = moving.map((id) => sceneEntryParent(id, state.elementFolders, state.elementFolderAssignments))
      const parentId = parents.every((parent) => parent === parents[0]) ? parents[0] : null
      const folder = { id: makeId('folder'), name: nextFolderName(state), ...(parentId ? { parentId } : {}) }
      const assignments = { ...state.elementFolderAssignments }
      moving.filter((id) => !folderIdFromSelection(id)).forEach((id) => { assignments[id] = folder.id })
      const folders = state.elementFolders.map((candidate) => moving.includes(folderSelectionId(candidate.id)) ? { ...candidate, parentId: folder.id } : candidate)
      const order = orderedSceneIds(state)
      const firstIndex = order.findIndex((id) => moving.includes(id))
      order.splice(firstIndex, 0, folderSelectionId(folder.id))
      return { elementFolders: [...folders, folder], elementFolderAssignments: assignments, sceneElementOrder: order, selectedId: folderSelectionId(folder.id), notice: `Carpeta «${folder.name}» creada.` }
    }),
    stepSceneItems: (ids, direction) => set((state) => {
      const selected = new Set(topLevelSelection(state, ids))
      const order = orderedSceneIds(state)
      const parents = new Set([...selected].map((id) => sceneEntryParent(id, state.elementFolders, state.elementFolderAssignments)))
      let changed = false
      for (const parent of parents) {
        const positions = order.flatMap((id, index) => sceneEntryParent(id, state.elementFolders, state.elementFolderAssignments) === parent ? [index] : [])
        const siblings = positions.map((index) => order[index])
        const indexes = direction === 'up' ? siblings.map((_, index) => index) : siblings.map((_, index) => index).reverse()
        for (const index of indexes) {
          const other = index + (direction === 'up' ? -1 : 1)
          if (other < 0 || other >= siblings.length || !selected.has(siblings[index]) || selected.has(siblings[other])) continue
          ;[siblings[index], siblings[other]] = [siblings[other], siblings[index]]
          changed = true
        }
        positions.forEach((position, index) => { order[position] = siblings[index] })
      }
      return changed ? { sceneElementOrder: order, notice: '' } : {}
    }),
    removeSceneItems: (ids) => set((state) => {
      const selected = new Set(ids)
      if (selected.has(folderSelectionId(ROOT_ROOM_FOLDER))) return { notice: 'La carpeta raíz no se puede eliminar.' }
      const foldersToRemove = new Set(state.elementFolders.filter((folder) => selected.has(folderSelectionId(folder.id))).map((folder) => folder.id))
      // Eliminar una carpeta elimina también su contenido; para conservarlo existe «Desagrupar».
      const recursiveFolders = new Set(foldersToRemove)
      let expanded = true
      while (expanded) {
        expanded = false
        for (const folder of state.elementFolders) if (folder.parentId && recursiveFolders.has(folder.parentId) && !recursiveFolders.has(folder.id)) {
          recursiveFolders.add(folder.id)
          foldersToRemove.add(folder.id)
          expanded = true
        }
      }
      if (foldersToRemove.has(ROOT_ROOM_FOLDER)) return { notice: 'La carpeta raíz no se puede eliminar.' }
      const deletedIds = new Set(ids.filter((id) => !folderIdFromSelection(id)))
      for (const [id, folder] of Object.entries(state.elementFolderAssignments)) if (recursiveFolders.has(folder)) deletedIds.add(id)
      if (deletedIds.has('door')) return { notice: 'La puerta principal no se puede eliminar.' }
      if (BASE_ROOM_SURFACE_IDS.some((id) => deletedIds.has(id))) return { notice: 'Las superficies de la habitación principal no se pueden eliminar.' }
      const survivingParent = (id: string | undefined): string | undefined => {
        let current = id
        const seen = new Set<string>()
        while (current && foldersToRemove.has(current) && !seen.has(current)) { seen.add(current); current = state.elementFolders.find((folder) => folder.id === current)?.parentId }
        return current
      }
      // Independent surfaces have no visible parent pack. Removing their
      // entry from a folder must also remove the now-empty internal pack.
      for (const pack of state.structurePacks) {
        if ((pack.id.startsWith('floor-object-') || pack.id.startsWith('wall-object-'))
          && pack.surfaces.every((surface) => deletedIds.has(structureSurfaceElementId(pack.id, surface.id)))) deletedIds.add(pack.id)
      }
      for (const pack of state.structurePacks) if (deletedIds.has(pack.id)) {
        for (const surface of pack.surfaces) {
          deletedIds.add(structureSurfaceElementId(pack.id, surface.id)); deletedIds.add(structureGridElementId(pack.id, surface.id))
        }
        for (const opening of [...(pack.doors ?? []), ...(pack.windows ?? [])]) deletedIds.add(opening.id)
      }
      for (const pack of state.structurePacks) for (const surface of pack.surfaces) if (deletedIds.has(structureSurfaceElementId(pack.id, surface.id))) deletedIds.add(structureGridElementId(pack.id, surface.id))
      const folders = state.elementFolders.filter((folder) => !foldersToRemove.has(folder.id)).map((folder) => {
        const parentId = survivingParent(folder.parentId)
        const { parentId: _parentId, ...rest } = folder
        return parentId ? { ...rest, parentId } : rest
      })
      const assignments = Object.fromEntries(Object.entries(state.elementFolderAssignments).flatMap(([id, folderId]) => {
        if (deletedIds.has(id)) return []
        const parent = survivingParent(folderId)
        return parent ? [[id, parent]] : []
      }))
      return {
        room: { ...state.room, windows: state.room.windows.filter((window) => !deletedIds.has(window.id)), ...(state.room.extraDoors ? { extraDoors: state.room.extraDoors.filter((door) => !deletedIds.has(door.id)) } : {}) },
        furniture: state.furniture.filter((item) => !deletedIds.has(item.id)),
        structurePacks: state.structurePacks.filter((pack) => !deletedIds.has(pack.id)).map((pack) => ({ ...pack, surfaces: pack.surfaces.filter((surface) => !deletedIds.has(structureSurfaceElementId(pack.id, surface.id))), ...(pack.doors ? { doors: pack.doors.filter((door) => !deletedIds.has(door.id)) } : {}), ...(pack.windows ? { windows: pack.windows.filter((window) => !deletedIds.has(window.id)) } : {}) })),
        elementFolders: folders, elementFolderAssignments: assignments,
        hiddenElementIds: state.hiddenElementIds.filter((id) => !deletedIds.has(id)), lockedElementIds: state.lockedElementIds.filter((id) => !deletedIds.has(id)),
        selectedId: null, notice: 'Elementos seleccionados eliminados.',
      }
    }),
    toggleSceneItemsVisibility: (ids) => set((state) => {
      const elements = new Set(ids.flatMap((id) => { const folder = folderIdFromSelection(id); return folder ? folderElementIds(state.elementFolderAssignments, folder, state.elementFolders) : [id] }))
      if (!elements.size) return {}
      const hidden = new Set(state.hiddenElementIds)
      const show = [...elements].every((id) => hidden.has(id))
      for (const id of elements) { if (show) hidden.delete(id); else hidden.add(id) }
      return { hiddenElementIds: [...hidden], notice: '' }
    }),
    toggleSceneItemsLock: (ids) => set((state) => {
      const elements = new Set(ids.flatMap((id) => { const folder = folderIdFromSelection(id); return folder ? folderElementIds(state.elementFolderAssignments, folder, state.elementFolders) : [id] }))
      if (!elements.size) return {}
      const locked = new Set(state.lockedElementIds)
      const unlock = [...elements].every((id) => locked.has(id))
      for (const id of elements) { if (unlock) locked.delete(id); else locked.add(id) }
      return { lockedElementIds: [...locked], notice: '' }
    }),
    reorderSceneElement: (elementId, targetId, position) => set((state) => {
      const order = orderedSceneIds(state)
      if (elementId === targetId || !order.includes(elementId) || !order.includes(targetId)) return {}
      if (sceneEntryParent(elementId, state.elementFolders, state.elementFolderAssignments) !== sceneEntryParent(targetId, state.elementFolders, state.elementFolderAssignments)) return {}
      const next = order.filter((id) => id !== elementId)
      next.splice(next.indexOf(targetId) + (position === 'after' ? 1 : 0), 0, elementId)
      if (next.every((id, index) => id === order[index])) return {}
      return { sceneElementOrder: next, notice: '' }
    }),
    toggleElementFolderVisibility: (id) => set((state) => {
      const folder = state.elementFolders.find((candidate) => candidate.id === id)
      const elementIds = folderElementIds(state.elementFolderAssignments, id, state.elementFolders)
      if (!folder || elementIds.length === 0) return {}
      const allHidden = elementIds.every((elementId) => state.hiddenElementIds.includes(elementId))
      const hidden = new Set(state.hiddenElementIds)
      elementIds.forEach((elementId) => {
        if (allHidden) hidden.delete(elementId)
        else hidden.add(elementId)
      })
      recordInteraction('state.element-folder.visibility', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: folder.name, visible: allHidden, elementIds },
      })
      return {
        hiddenElementIds: [...hidden],
        selectedId: !allHidden && state.selectedId && elementIds.includes(state.selectedId) ? null : state.selectedId,
      }
    }),
    toggleElementFolderLock: (id) => set((state) => {
      const folder = state.elementFolders.find((candidate) => candidate.id === id)
      const elementIds = folderElementIds(state.elementFolderAssignments, id, state.elementFolders)
      if (!folder || elementIds.length === 0) return {}
      const allLocked = elementIds.every((elementId) => state.lockedElementIds.includes(elementId))
      const locked = new Set(state.lockedElementIds)
      elementIds.forEach((elementId) => {
        if (allLocked) locked.delete(elementId)
        else locked.add(elementId)
      })
      recordInteraction('state.element-folder.lock', {
        view: state.view,
        selectedId: state.selectedId,
        details: { id, name: folder.name, locked: !allLocked, elementIds },
      })
      return { lockedElementIds: [...locked] }
    }),
  }
}
