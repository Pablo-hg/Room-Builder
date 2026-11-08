import { ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from './constants'
import { DEFAULT_ROTATION_STEP, furnitureAttachment } from './objectCatalog'
import type { DoorConfig, FurnitureItem, RoomConfig, ViewMode, WallOpening, WallSegment, WallSide, WindowConfig } from './types'

export const wallLength = (room: RoomConfig, wall: WallSide) =>
  wall === 'north' || wall === 'south' ? room.width : room.depth

export const isWallMountedDecoration = (shape?: WindowConfig['shape']) =>
  shape === 'wallShelf'
  || shape === 'pictureSmall'
  || shape === 'pictureMedium'
  || shape === 'pictureLarge'
  || shape === 'mirrorRectangular'
  || shape === 'mirrorCircular'
  || shape === 'wallSconce'

export function openingInterval(offset: number, width: number): [number, number] {
  return [offset - width / 2, offset + width / 2]
}

/**
 * Encuentra la posición en centímetros más cercana a la posición preferida.
 * Se utiliza al cambiar de pared: el offset anterior puede quedar fuera del
 * nuevo muro o colisionar con otra apertura aunque existan huecos libres.
 * No sustituye la validación: cada candidato se comprueba con el validador real.
 */
export function findAvailableOpeningOffset(length: number, width: number, preferred: number, isValid: (offset: number) => boolean, edgeMargin: number = ROOM_LIMITS.edgeMargin): number | null {
  if (![length, width, preferred, edgeMargin].every(Number.isFinite)) return null
  const maximumCm = Math.floor(((length - width) / 2 - edgeMargin) * 100 + 1e-7)
  if (maximumCm < 0) return null
  const preferredCm = Math.max(-maximumCm, Math.min(maximumCm, Math.round(preferred * 100)))
  for (let distance = 0; distance <= maximumCm * 2; distance += 1) {
    // Desempate estable: primero hacia la izquierda, después a la derecha.
    const candidates = distance === 0 ? [preferredCm] : [preferredCm - distance, preferredCm + distance]
    for (const cm of candidates) {
      if (cm < -maximumCm || cm > maximumCm) continue
      const offset = cm / 100
      if (isValid(offset)) return offset
    }
  }
  return null
}

export function openingsForWall(room: RoomConfig, wall: WallSide): WallOpening[] {
  const openings: WallOpening[] = []
  if (room.door.wall === wall) {
    openings.push({ id: 'door', kind: 'door', offset: room.door.offset, width: room.door.width, bottom: 0, height: room.door.height, rotation: room.door.rotation, color: room.door.color ?? '#ac704b' })
  }
  for (const door of room.extraDoors ?? []) if (door.wall === wall) openings.push({ id: door.id, kind: 'door', offset: door.offset, width: door.width, bottom: 0, height: door.height, rotation: door.rotation, color: door.color ?? '#ac704b' })
  room.windows.filter((window) => window.wall === wall && !window.freePosition).forEach((window) => {
    openings.push({ id: window.id, kind: 'window', shape: window.shape, offset: window.offset, width: window.width, bottom: window.sill, height: window.height, rotation: window.rotation, color: window.color ?? '#c88f58' })
  })
  return openings
}

export interface OpeningConflict { rule: 'opening-bounds' | 'opening-height' | 'opening-gap'; objectIds: string[]; wall: WallSide; requiredGap?: number }
export function validateOpenings(room: RoomConfig, onConflict?: (conflict: OpeningConflict) => void): string | null {
  for (const wall of ['north', 'east', 'south', 'west'] as WallSide[]) {
    const length = wallLength(room, wall)
    // v10 anchors are validated against the connected physical wall union.
    const anchored = new Set([...(room.door.wallPosition ? ['door'] : []),
      ...(room.extraDoors ?? []).filter((door) => door.wallPosition).map((door) => door.id),
      ...room.windows.filter((window) => window.wallPosition).map((window) => window.id)])
    const items = openingsForWall(room, wall).filter((item) => !anchored.has(item.id))
    for (const item of items) {
      const [start, end] = openingInterval(item.offset, item.width)
      if (start < -length / 2 + ROOM_LIMITS.edgeMargin || end > length / 2 - ROOM_LIMITS.edgeMargin) {
        onConflict?.({ rule: 'opening-bounds', objectIds: [item.id], wall })
        return `${item.kind === 'door' ? 'La puerta' : 'Una ventana'} queda fuera de la pared ${WALL_LABELS[wall]}.`
      }
      if (item.bottom < 0 || item.bottom + item.height > room.height - 0.08) {
        onConflict?.({ rule: 'opening-height', objectIds: [item.id], wall })
        return `Una apertura supera la altura disponible.`
      }
    }
    // Solapamientos: aviso en la escena, no error de validación.
  }
  return null
}

// Divides a wall into a small grid using every opening edge, then omits cells
// whose centre lies inside an opening. The result preserves real door/window gaps.
export function buildWallSegments(length: number, height: number, openings: WallOpening[]): WallSegment[] {
  const cutOpenings = openings.filter((opening) => !isWallMountedDecoration(opening.shape))
  const xEdges = new Set([-length / 2, length / 2])
  const yEdges = new Set([0, height])
  cutOpenings.forEach((opening) => {
    const [start, end] = openingInterval(opening.offset, opening.width)
    xEdges.add(Math.max(-length / 2, start))
    xEdges.add(Math.min(length / 2, end))
    yEdges.add(Math.max(0, opening.bottom))
    yEdges.add(Math.min(height, opening.bottom + opening.height))
  })
  const xs = [...xEdges].sort((a, b) => a - b)
  const ys = [...yEdges].sort((a, b) => a - b)
  const segments: WallSegment[] = []
  for (let x = 0; x < xs.length - 1; x += 1) {
    for (let y = 0; y < ys.length - 1; y += 1) {
      const centerX = (xs[x] + xs[x + 1]) / 2
      const centerY = (ys[y] + ys[y + 1]) / 2
      const insideOpening = cutOpenings.some((opening) => {
        const [start, end] = openingInterval(opening.offset, opening.width)
        return centerX > start && centerX < end && centerY > opening.bottom && centerY < opening.bottom + opening.height
      })
      if (!insideOpening && xs[x + 1] - xs[x] > 0.001 && ys[y + 1] - ys[y] > 0.001) {
        segments.push({ center: [centerX, centerY], size: [xs[x + 1] - xs[x], ys[y + 1] - ys[y]] })
      }
    }
  }
  return segments
}

export const hiddenWallsForOrientation = (orientation: number): WallSide[] => {
  const pairs: WallSide[][] = [
    ['east', 'south'],
    ['south', 'west'],
    ['west', 'north'],
    ['north', 'east'],
  ]
  return pairs[((orientation % 4) + 4) % 4]
}

export const visibleWallsForOrientation = (orientation: number): WallSide[] => {
  const hidden = hiddenWallsForOrientation(orientation)
  return WALL_SIDES.filter((wall) => !hidden.includes(wall))
}

export const topViewWallForOrientation = (orientation: number): WallSide => (
  WALL_SIDES[((orientation % 4) + 4) % 4]
)

export const frontWallForOrientation = (orientation: number): WallSide => (
  WALL_SIDES[(((orientation % 4) + 4) % 4 + WALL_SIDES.length - 1) % WALL_SIDES.length]
)

export const orientationForFrontWall = (wall: WallSide): number => (
  (WALL_SIDES.indexOf(wall) + 1) % WALL_SIDES.length
)

export const sideWallsForFrontView = (frontWall: WallSide): { left: WallSide; right: WallSide } => {
  const sides: Record<WallSide, { left: WallSide; right: WallSide }> = {
    north: { left: 'west', right: 'east' },
    east: { left: 'north', right: 'south' },
    south: { left: 'east', right: 'west' },
    west: { left: 'south', right: 'north' },
  }
  return sides[frontWall]
}

export function orientationForAzimuth(azimuth: number) {
  const fullTurn = Math.PI * 2
  const normalized = ((azimuth % fullTurn) + fullTurn) % fullTurn
  return (Math.round((normalized - Math.PI / 4) / (Math.PI / 2)) + 4) % 4
}

export const hiddenWallForCardinalTarget = (targetWall: WallSide): WallSide => {
  const opposite: Record<WallSide, WallSide> = {
    north: 'south',
    east: 'west',
    south: 'north',
    west: 'east',
  }
  return opposite[targetWall]
}

/** Shared visibility policy for rendering and placing elements in the current view. */
export function hiddenWallsForView(view: ViewMode, orientation: number, wallView: WallSide | null, freeAzimuth: number, exportMode = false): WallSide[] {
  if (exportMode) return []
  if (view === 'top') return [...WALL_SIDES]
  if (view === 'front') return [hiddenWallForCardinalTarget(wallView ?? 'north')]
  if (view === 'isometric') return hiddenWallsForOrientation(orientation)
  if (view === 'free') return hiddenWallsForOrientation(orientationForAzimuth(freeAzimuth))
  return []
}

export function shortestAngleDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

export const FURNITURE_CLEARANCE = 0

export function snapToPlacementGrid(value: number) {
  return Math.round(value / ROOM_LIMITS.placementStep) * ROOM_LIMITS.placementStep
}

export function snapToVisibleGrid(value: number) {
  return Math.round(value / ROOM_LIMITS.gridSize) * ROOM_LIMITS.gridSize
}

export function snapFurnitureRotation(rotation: number) {
  return Math.round(rotation / DEFAULT_ROTATION_STEP) * DEFAULT_ROTATION_STEP
}

export function furnitureHalfExtents(item: FurnitureItem) {
  const cosine = Math.abs(Math.cos(item.rotation))
  const sine = Math.abs(Math.sin(item.rotation))
  return {
    halfWidth: (item.width * cosine + item.depth * sine) / 2,
    halfDepth: (item.width * sine + item.depth * cosine) / 2,
  }
}

export function furnitureItemsOverlap(a: FurnitureItem, b: FurnitureItem, clearance = FURNITURE_CLEARANCE) {
  const aBottom = Number.isFinite(a.y) ? a.y : 0
  const bBottom = Number.isFinite(b.y) ? b.y : 0
  const verticalOverlap = aBottom < bBottom + b.height - 1e-9
    && bBottom < aBottom + a.height - 1e-9
  if (!verticalOverlap) return false

  const axes = (item: FurnitureItem) => {
    const cosine = Math.cos(item.rotation)
    const sine = Math.sin(item.rotation)
    return [
      { x: cosine, z: -sine },
      { x: sine, z: cosine },
    ]
  }
  const aAxes = axes(a)
  const bAxes = axes(b)
  const centerDelta = { x: b.x - a.x, z: b.z - a.z }
  const epsilon = 1e-9

  return [...aAxes, ...bAxes].every((axis) => {
    const distance = Math.abs(centerDelta.x * axis.x + centerDelta.z * axis.z)
    const aRadius = a.width / 2 * Math.abs(aAxes[0].x * axis.x + aAxes[0].z * axis.z)
      + a.depth / 2 * Math.abs(aAxes[1].x * axis.x + aAxes[1].z * axis.z)
    const bRadius = b.width / 2 * Math.abs(bAxes[0].x * axis.x + bAxes[0].z * axis.z)
      + b.depth / 2 * Math.abs(bAxes[1].x * axis.x + bAxes[1].z * axis.z)
    return distance < aRadius + bRadius + clearance - epsilon
  })
}

export function canPlaceFurniture(candidate: FurnitureItem, furniture: FurnitureItem[], ignoreId = candidate.id) {
  return furniture.every((item) => item.id === ignoreId || !furnitureItemsOverlap(candidate, item))
}

export function hasFurnitureCollisions(furniture: FurnitureItem[]) {
  for (let index = 0; index < furniture.length; index += 1) {
    for (let next = index + 1; next < furniture.length; next += 1) {
      if (furnitureItemsOverlap(furniture[index], furniture[next])) return true
    }
  }
  return false
}

export function clampFurniture(item: FurnitureItem, room: RoomConfig, snap: boolean): Pick<FurnitureItem, 'x' | 'z'> {
  const { halfWidth, halfDepth } = furnitureHalfExtents(item)
  const limitX = Math.max(0, room.width / 2 - halfWidth)
  const limitZ = Math.max(0, room.depth / 2 - halfDepth)
  const constrain = (value: number, limit: number) => {
    if (!snap) return Math.max(-limit, Math.min(limit, value))
    const quantized = snapToPlacementGrid(value)
    return Math.max(-limit, Math.min(limit, quantized))
  }
  return {
    x: constrain(item.x, limitX),
    z: constrain(item.z, limitZ),
  }
}

export function clampFurnitureElevation(item: FurnitureItem, room: RoomConfig, snap: boolean) {
  const attachment = furnitureAttachment(item)
  if (attachment === 'floor') return 0
  if (attachment === 'ceiling') return room.height - item.height
  const limit = Math.max(0, room.height - item.height)
  const elevation = Number.isFinite(item.y) ? item.y : 0
  const positioned = snap ? snapToPlacementGrid(elevation) : elevation
  return Math.max(0, Math.min(limit, positioned))
}

export function findFreeFurniturePosition(
  item: FurnitureItem,
  room: RoomConfig,
  furniture: FurnitureItem[],
  accept: (candidate: FurnitureItem) => boolean = () => true,
): Pick<FurnitureItem, 'x' | 'z'> | null {
  const { halfWidth, halfDepth } = furnitureHalfExtents(item)
  const limitX = room.width / 2 - halfWidth
  const limitZ = room.depth / 2 - halfDepth
  if (limitX < 0 || limitZ < 0) return null

  const step = ROOM_LIMITS.placementStep
  const candidates: Array<Pick<FurnitureItem, 'x' | 'z'>> = []
  for (let xIndex = Math.ceil(-limitX / step); xIndex <= Math.floor(limitX / step); xIndex += 1) {
    for (let zIndex = Math.ceil(-limitZ / step); zIndex <= Math.floor(limitZ / step); zIndex += 1) {
      candidates.push({ x: xIndex * step, z: zIndex * step })
    }
  }
  candidates.sort((a, b) => a.x ** 2 + a.z ** 2 - (b.x ** 2 + b.z ** 2))
  return candidates.find((position) => canPlaceFurniture({ ...item, ...position }, furniture) && accept({ ...item, ...position })) ?? null
}

export function doorWorldPosition(room: RoomConfig, door: DoorConfig): [number, number, number] {
  const inset = 0.32
  switch (door.wall) {
    case 'north': return [door.offset, 1.65, -room.depth / 2 + inset]
    case 'south': return [door.offset, 1.65, room.depth / 2 - inset]
    case 'east': return [room.width / 2 - inset, 1.65, door.offset]
    case 'west': return [-room.width / 2 + inset, 1.65, door.offset]
  }
}

export function inwardDirection(wall: WallSide): [number, number, number] {
  if (wall === 'north') return [0, 0, 1]
  if (wall === 'south') return [0, 0, -1]
  if (wall === 'east') return [-1, 0, 0]
  return [1, 0, 0]
}

export function withDoor(room: RoomConfig, partial: Partial<DoorConfig>): RoomConfig {
  return { ...room, door: { ...room.door, ...partial } }
}

export function withWindow(room: RoomConfig, id: string, partial: Partial<WindowConfig>): RoomConfig {
  return { ...room, windows: room.windows.map((window) => window.id === id ? { ...window, ...partial } : window) }
}
