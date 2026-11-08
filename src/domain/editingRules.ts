import { ROOM_LIMITS } from './constants'
import { canPlaceFurniture, clampFurniture, clampFurnitureElevation, findAvailableOpeningOffset, findFreeFurniturePosition, validateOpenings, wallLength, withDoor, withWindow } from './geometry'
import { canElevateFurniture, furnitureAttachment, FURNITURE_PRESETS, isCeilingMountedFurniture, isFloorBoundFurniture } from './objectCatalog'
import type { FurnitureItem, RoomConfig, WindowConfig } from './types'
import type { OpeningConflict } from './geometry'
import { snapMeasurement } from './measurements'
import { furnitureAxisLocks } from './axisLocks'

export interface RoomEditingData {
  room: RoomConfig
  furniture: FurnitureItem[]
  gridSnap: boolean
}

type RoomRuleUpdate = Partial<{ room: RoomConfig; furniture: FurnitureItem[]; notice: string }>
type FurnitureRuleUpdate = Partial<{ furniture: FurnitureItem[]; notice: string }>

export function safeRoomUpdate(current: RoomEditingData, candidate: RoomConfig, onConflict?: (conflict: OpeningConflict) => void): RoomRuleUpdate {
  const error = validateOpenings(candidate, onConflict)
  if (error) return { notice: error }
  const furniture = current.furniture.map((item) => {
    if (item.axisLocks) return { ...item }
    const oldBounds = clampFurniture(item, current.room, false)
    const outside = oldBounds.x !== item.x || oldBounds.z !== item.z
    return outside ? { ...item } : { ...item, ...clampFurniture(item, candidate, false) }
  })
  furniture.forEach((item) => {
    const attachment = furnitureAttachment(item)
    if (attachment === 'floor' || attachment === 'ceiling') {
      item.y = clampFurnitureElevation(item, candidate, false)
      return
    }
    if (!item.attachmentPolicy && (isFloorBoundFurniture(item.kind) || isCeilingMountedFurniture(item.kind))) return
    if (clampFurnitureElevation(item, current.room, false) !== item.y) return
    item.y = clampFurnitureElevation(item, candidate, false)
  })
  return {
    room: candidate,
    furniture,
    notice: '',
  }
}

export function arrangeFurniture(items: FurnitureItem[], room: RoomConfig, snap: boolean) {
  const arranged: FurnitureItem[] = []
  for (const item of items) {
    const preset = FURNITURE_PRESETS[item.kind]
    if (!preset) return null
    const normalized = {
      ...item,
      width: preset.width,
      depth: preset.depth,
      height: preset.height,
      y: typeof item.y === 'number' && Number.isFinite(item.y) ? item.y : 0,
    }
    const attachment = furnitureAttachment(normalized)
    const clamped = { ...normalized, x: Number.isFinite(item.x) ? item.x : 0, y: attachment === 'floor' || attachment === 'ceiling' ? clampFurnitureElevation(normalized, room, false) : normalized.y, z: Number.isFinite(item.z) ? item.z : 0 }
    if (canPlaceFurniture(clamped, arranged)) {
      arranged.push(clamped)
      continue
    }
    const position = findFreeFurniturePosition(clamped, room, arranged)
    if (!position) return null
    arranged.push({ ...clamped, ...position })
  }
  return arranged
}

/** Rotations never reject overlaps: the red border warns about them. */
export function applyFurnitureRotation(state: RoomEditingData, item: FurnitureItem, rotation: number): FurnitureRuleUpdate {
  const fullTurn = Math.PI * 2
  const normalizedRotation = ((rotation % fullTurn) + fullTurn) % fullTurn
  const positioned = { ...item, rotation: normalizedRotation }
  return {
    furniture: state.furniture.map((candidate) => candidate.id === item.id ? positioned : candidate),
    notice: '',
  }
}

export function clampRoomDimension(key: 'width' | 'depth' | 'height', value: number) {
  const min = key === 'width' ? ROOM_LIMITS.minWidth : key === 'depth' ? ROOM_LIMITS.minDepth : ROOM_LIMITS.minHeight
  const max = key === 'width' ? ROOM_LIMITS.maxWidth : key === 'depth' ? ROOM_LIMITS.maxDepth : ROOM_LIMITS.maxHeight
  return Math.max(min, Math.min(max, value))
}

export function roomForDoorUpdate(room: RoomConfig, partial: { wall?: RoomConfig['door']['wall']; offset?: number; color?: string }) {
  const adjusted = partial.offset === undefined ? partial : { ...partial, offset: room.door.wallPosition ? partial.offset : snapMeasurement(partial.offset) }
  const candidate = withDoor(room, { ...adjusted, rotation: 0 })
  if (partial.wall === undefined || partial.wall === room.door.wall || partial.offset !== undefined || !validateOpenings(candidate)) return candidate

  // Solo reubicar automáticamente al cambiar de pared sin introducir un offset manual.
  const offset = findAvailableOpeningOffset(wallLength(room, partial.wall), room.door.width, room.door.offset, (value) =>
    !validateOpenings(withDoor(room, { ...adjusted, offset: value, rotation: 0 })),
  )
  return offset === null ? candidate : withDoor(room, { ...adjusted, offset, rotation: 0 })
}

export function roomForWindowUpdate(room: RoomConfig, currentWindow: WindowConfig, partial: Partial<Pick<WindowConfig, 'wall' | 'offset' | 'width' | 'sill' | 'rotation' | 'color'>>) {
  const adjusted = {
    ...partial,
    ...(partial.offset === undefined ? {} : { offset: currentWindow.wallPosition ? partial.offset : snapMeasurement(partial.offset) }),
    ...(partial.sill === undefined ? {} : currentWindow.wallPosition ? { sill: snapMeasurement(partial.sill) } : {
      sill: Math.max(0, Math.min(
        Math.floor((room.height - currentWindow.height - 0.08) * 100) / 100,
        snapMeasurement(partial.sill),
      )),
    }),
  }
  const candidate = withWindow(room, currentWindow.id, adjusted)
  if (currentWindow.freePosition) {
    if (partial.wall !== undefined) {
      candidate.windows = candidate.windows.map((window) => {
        if (window.id !== currentWindow.id) return window
        const { freePosition: _freePosition, wallPosition: _wallPosition, ...attached } = window
        return attached
      })
    } else return candidate
  }
  if (partial.wall === undefined || partial.wall === currentWindow.wall || partial.offset !== undefined || !validateOpenings(candidate)) return candidate
  const offset = findAvailableOpeningOffset(wallLength(room, partial.wall), currentWindow.width, currentWindow.offset, (value) =>
    !validateOpenings(withWindow(room, currentWindow.id, { ...adjusted, offset: value })),
  )
  return offset === null ? candidate : withWindow(room, currentWindow.id, { ...adjusted, offset })
}

export function movedFurniture(state: RoomEditingData, item: FurnitureItem, x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null
  const locks = furnitureAxisLocks(item)
  return { ...item, x: locks.x || x === item.x ? item.x : snapMeasurement(x), z: locks.z || z === item.z ? item.z : snapMeasurement(z) }
}

export function elevatedFurniture(state: RoomEditingData, item: FurnitureItem, y: number) {
  if (!canElevateFurniture(item)) return null
  if (!Number.isFinite(y)) return null
  if (y === item.y) return null
  const movedY = snapMeasurement(y)
  if (movedY === item.y) return null
  return { ...item, y: movedY }
}
