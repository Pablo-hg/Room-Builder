import type { RoomState } from '../state/types'
import { diagnostics } from './engine'

const fields = ['kind', 'shape', 'x', 'y', 'z', 'width', 'height', 'depth', 'rotation', 'wall', 'offset', 'sill', 'color', 'wallColor', 'wallColors', 'floorColor', 'axisLocks', 'freePosition', 'attachmentPolicy']
function spatial(value: object) {
  const record = value as Record<string, unknown>
  return Object.fromEntries(fields.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]))
}
function entities(state: RoomState) {
  const result = new Map<string, object>()
  result.set('room', spatial(state.room))
  result.set('door', spatial(state.room.door))
  for (const item of [...state.furniture, ...state.room.windows, ...(state.room.extraDoors ?? [])]) result.set(item.id, item)
  for (const pack of state.structurePacks) {
    result.set(pack.id, pack)
    for (const surface of pack.surfaces) result.set(`structure-surface:${pack.id}:${surface.id}`, surface)
    for (const item of [...(pack.doors ?? []), ...(pack.windows ?? [])]) result.set(item.id, item)
  }
  return result
}
const cameraFields = ['view', 'wallView', 'activeRoomId', 'cameraZoom', 'freeCameraZoom', 'povCameraZoom', 'isoAngle', 'freeAzimuth', 'freeElevation', 'frontCameraHeight', 'isoCameraHeight', 'topCameraX', 'topCameraZ', 'povYaw', 'freeCameraOffset'] as const
export function summarizeChange(before: RoomState, after: RoomState, includeGeometry = true) {
  const changes: Record<string, unknown>[] = []
  let changed = 0
  const objectIds = new Set<string>()
  const add = (entry: Record<string, unknown>) => { changed++; if (changes.length < 150) changes.push(entry) }
  const geometryChanged = before.room !== after.room || before.furniture !== after.furniture || before.structurePacks !== after.structurePacks
  if (geometryChanged && includeGeometry) {
    const old = entities(before), next = entities(after)
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      const a = old.get(id), b = next.get(id)
      if (a === b) continue
      const left = a ? spatial(a) : null, right = b ? spatial(b) : null
      if (JSON.stringify(left) === JSON.stringify(right) && (a as { name?: string })?.name === (b as { name?: string })?.name) continue
      const alias = diagnostics.objectId(id); objectIds.add(alias)
      const changedFields = left && right ? fields.filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field])) : fields
      const pick = (record: Record<string, unknown> | null) => record && Object.fromEntries(changedFields.filter((field) => record[field] !== undefined).map((field) => [field, record[field]]))
      add({ id: alias, before: pick(left), after: pick(right), ...(JSON.stringify(left) === JSON.stringify(right) ? { renamed: true } : {}) })
    }
  }
  for (const key of cameraFields) if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
    add({ field: key, before: key === 'activeRoomId' ? before[key] && diagnostics.objectId(before[key]!) : before[key], after: key === 'activeRoomId' ? after[key] && diagnostics.objectId(after[key]!) : after[key] })
  }
  for (const key of ['selectedIds', 'hiddenElementIds', 'lockedElementIds', 'sceneElementOrder'] as const) if (before[key] !== after[key] && JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
    const ids = after[key].map((id) => diagnostics.objectId(id)); ids.forEach((id) => objectIds.add(id))
    add({ field: key, before: before[key].map((id) => diagnostics.objectId(id)), after: ids })
  }
  if (before.elementFolders !== after.elementFolders || before.elementFolderAssignments !== after.elementFolderAssignments) {
    const folders = (state: RoomState) => ({ entries: state.elementFolders.map((folder) => ({ id: diagnostics.objectId(folder.id), parentId: folder.parentId ? diagnostics.objectId(folder.parentId) : null })), assignments: Object.fromEntries(Object.entries(state.elementFolderAssignments).map(([id, folder]) => [diagnostics.objectId(id), diagnostics.objectId(folder)])) })
    add({ field: 'folders', before: folders(before), after: folders(after), renamed: true })
  }
  for (const key of ['gridSnap', 'gridVisibility'] as const) if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) add({ field: key, before: before[key], after: after[key] })
  if (before.savedDesigns !== after.savedDesigns) add({ field: 'library', before: before.savedDesigns.length, after: after.savedDesigns.length })
  if (before.selectedSavedDesignId !== after.selectedSavedDesignId) add({ field: 'activeDesign', before: !!before.selectedSavedDesignId, after: !!after.selectedSavedDesignId })
  return { changes, changed, objectIds: [...objectIds].slice(0, 200), geometryChanged }
}
