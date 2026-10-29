import { ROOM_LIMITS } from './constants'
import { canPlaceFurniture, clampFurniture, clampFurnitureElevation, findFreeFurniturePosition, hasFurnitureCollisions, snapToPlacementGrid, snapToVisibleGrid, validateOpenings, withDoor, withWindow } from './geometry'
import { FURNITURE_PRESETS, isCeilingMountedFurniture, isWallPictureKind } from './objectCatalog'
import type { FurnitureItem, RoomConfig, WindowConfig } from './types'

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
    return outside ? { ...item } : { ...item, ...clampFurniture(item, candidate, current.gridSnap) }
  })
  furniture.forEach((item) => {
    if (clampFurnitureElevation(item, current.room, false) !== item.y) return
    item.y = isCeilingMountedFurniture(item.kind)
      ? Math.max(0, candidate.height - item.height)
      : clampFurnitureElevation(item, candidate, current.gridSnap)
  })
  if (hasFurnitureCollisions(furniture)) {
    return { notice: 'No se puede reducir la habitación porque los muebles quedarían solapados.' }
  }
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
      y: isCeilingMountedFurniture(item.kind)
        ? Math.max(0, room.height - preset.height)
        : typeof item.y === 'number' && Number.isFinite(item.y) ? item.y : 0,
    }
    const clamped = { ...normalized, x: Number.isFinite(item.x) ? item.x : 0, y: typeof item.y === 'number' && Number.isFinite(item.y) ? item.y : normalized.y, z: Number.isFinite(item.z) ? item.z : 0 }
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

export function applyFurnitureRotation(state: RoomEditingData, item: FurnitureItem, rotation: number, showNotice: boolean): FurnitureRuleUpdate {
  const fullTurn = Math.PI * 2
  const normalizedRotation = ((rotation % fullTurn) + fullTurn) % fullTurn
  const rotated = { ...item, rotation: normalizedRotation }
  const positioned = rotated
  if (!canPlaceFurniture(positioned, state.furniture)) {
    return showNotice ? { notice: 'No hay espacio suficiente para girar el objeto.' } : {}
  }
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
  const adjusted = partial.offset === undefined ? partial : { ...partial, offset: snapToPlacementGrid(partial.offset) }
  return withDoor(room, { ...adjusted, rotation: 0 })
}

export function roomForWindowUpdate(room: RoomConfig, currentWindow: WindowConfig, partial: Partial<Pick<WindowConfig, 'wall' | 'offset' | 'width' | 'sill' | 'rotation' | 'color'>>) {
  const adjusted = {
    ...partial,
    ...(partial.offset === undefined ? {} : { offset: snapToVisibleGrid(partial.offset) }),
    ...(partial.sill === undefined ? {} : {
      sill: Math.max(0, Math.min(
        Math.floor((room.height - currentWindow.height - 0.08) / ROOM_LIMITS.gridSize) * ROOM_LIMITS.gridSize,
        snapToVisibleGrid(partial.sill),
      )),
    }),
  }
  return withWindow(room, currentWindow.id, adjusted)
}

export function movedFurniture(state: RoomEditingData, item: FurnitureItem, x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null
  const moved = { ...item, x: state.gridSnap ? snapToPlacementGrid(x) : x, z: state.gridSnap ? snapToPlacementGrid(z) : z }
  return canPlaceFurniture(moved, state.furniture) ? moved : null
}

export function elevatedFurniture(state: RoomEditingData, item: FurnitureItem, y: number) {
  if (isWallPictureKind(item.kind)) return null
  if (!Number.isFinite(y)) return null
  const movedY = state.gridSnap ? snapToPlacementGrid(y) : y
  if (movedY === item.y) return null
  const moved = { ...item, y: movedY }
  return canPlaceFurniture(moved, state.furniture) ? moved : null
}
