import { ROOM_LIMITS } from './constants'
import { canPlaceFurniture, clampFurniture, clampFurnitureElevation, findFreeFurniturePosition, validateOpenings, withDoor, withWindow } from './geometry'
import { canElevateFurniture, furnitureAttachment, FURNITURE_PRESETS, isCeilingMountedFurniture, isFloorBoundFurniture } from './objectCatalog'
import type { FurnitureItem, RoomConfig, WindowConfig } from './types'
import { snapMeasurement } from './measurements'

export interface RoomEditingData {
  room: RoomConfig
  furniture: FurnitureItem[]
  gridSnap: boolean
}

type RoomRuleUpdate = Partial<{ room: RoomConfig; furniture: FurnitureItem[]; notice: string }>
type FurnitureRuleUpdate = Partial<{ furniture: FurnitureItem[]; notice: string }>

export function safeRoomUpdate(current: RoomEditingData, candidate: RoomConfig): RoomRuleUpdate {
  const error = validateOpenings(candidate)
  if (error) return { notice: error }
  const furniture = current.furniture.map((item) => {
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
  const adjusted = partial.offset === undefined ? partial : { ...partial, offset: snapMeasurement(partial.offset) }
  return withDoor(room, { ...adjusted, rotation: 0 })
}

export function roomForWindowUpdate(room: RoomConfig, currentWindow: WindowConfig, partial: Partial<Pick<WindowConfig, 'wall' | 'offset' | 'width' | 'sill' | 'rotation' | 'color'>>) {
  const adjusted = {
    ...partial,
    ...(partial.offset === undefined ? {} : { offset: snapMeasurement(partial.offset) }),
    ...(partial.sill === undefined ? {} : {
      sill: Math.max(0, Math.min(
        Math.floor((room.height - currentWindow.height - 0.08) * 100) / 100,
        snapMeasurement(partial.sill),
      )),
    }),
  }
  return withWindow(room, currentWindow.id, adjusted)
}

export function movedFurniture(state: RoomEditingData, item: FurnitureItem, x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null
  return { ...item, x: x === item.x ? x : snapMeasurement(x), z: z === item.z ? z : snapMeasurement(z) }
}

export function elevatedFurniture(state: RoomEditingData, item: FurnitureItem, y: number) {
  if (!canElevateFurniture(item)) return null
  if (!Number.isFinite(y)) return null
  if (y === item.y) return null
  const movedY = snapMeasurement(y)
  if (movedY === item.y) return null
  return { ...item, y: movedY }
}
