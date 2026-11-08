import { FURNITURE_CATALOG, furnitureAttachment, OPENING_CATALOG, openingKindForShape } from './objectCatalog'
import { isMeasurementStep, MEASUREMENT_STEP_NOTICE, snapMeasurement } from './measurements'
import { openingsForWall, validateOpenings, wallLength } from './geometry'
import { ROOM_LIMITS } from './constants'
import type { FurnitureDimension, ResizeCapability } from './resizeCapabilities'
import type { FurnitureItem, RoomConfig, WindowConfig } from './types'

type Result<T> = { value: T; error?: never } | { error: string; value?: never }

function dimensions<T extends Pick<FurnitureItem, 'width' | 'height'> & Partial<Pick<FurnitureItem, 'depth'>>>(item: T, capability: ResizeCapability | undefined, dimension: FurnitureDimension, value: number): Result<T> {
  const range = capability?.dimensions[dimension]
  if (!range) return { error: 'Este tipo de objeto no permite editar esa medida.' }
  if (!isMeasurementStep(value)) return { error: MEASUREMENT_STEP_NOTICE }
  if (value < range.min || value > range.max) return { error: `La medida debe estar entre ${range.min} y ${range.max} m.` }
  const next = { ...item, [dimension]: snapMeasurement(value) }
  if (capability.diameter?.includes(dimension)) {
    for (const linked of capability.diameter) Object.assign(next, { [linked]: snapMeasurement(value) })
  }
  return { value: next }
}

/** El origen local está en el centro de la base; los atravesamientos son avisos visuales. */
export function resizedFurniture(item: FurnitureItem, room: RoomConfig, dimension: FurnitureDimension, value: number): Result<FurnitureItem> {
  const result = dimensions(item, FURNITURE_CATALOG[item.kind]?.capabilities.resize, dimension, value)
  if (!result.value) return result
  const next = result.value
  if (furnitureAttachment(item) === 'floor') next.y = 0
  if (furnitureAttachment(item) === 'ceiling') next.y = room.height - next.height
  return { value: next }
}

export function resizedWallObject(room: RoomConfig, item: WindowConfig, dimension: FurnitureDimension, value: number): Result<RoomConfig> {
  const result = dimensions(item, OPENING_CATALOG[openingKindForShape(item.shape)].capabilities.resize, dimension, value)
  if (!result.value) return { error: result.error! }
  // Se conserva offset/sill: son el centro horizontal y la base sobre la pared.
  const next = { ...room, windows: room.windows.map((candidate) => candidate.id === item.id ? result.value! : candidate) }
  if (item.freePosition) return { value: next }
  const error = validateOpenings(next)
  if (error) return { error }
  if (item.shape === 'rectangular' || item.shape === 'circular') {
    const bounds = (opening: ReturnType<typeof openingsForWall>[number]) => {
      const cos = Math.abs(Math.cos(opening.rotation))
      const sin = Math.abs(Math.sin(opening.rotation))
      const halfWidth = opening.shape === 'circular' ? Math.hypot(opening.width * cos, opening.height * sin) / 2 : (opening.width * cos + opening.height * sin) / 2
      const halfHeight = opening.shape === 'circular' ? Math.hypot(opening.width * sin, opening.height * cos) / 2 : (opening.width * sin + opening.height * cos) / 2
      const center = opening.bottom + opening.height / 2
      return { left: opening.offset - halfWidth, right: opening.offset + halfWidth, bottom: center - halfHeight, top: center + halfHeight }
    }
    const openings = openingsForWall(next, item.wall)
    const resized = openings.find((opening) => opening.id === item.id)!
    const box = bounds(resized)
    const limit = wallLength(next, item.wall) / 2 - ROOM_LIMITS.edgeMargin
    if (box.left < -limit || box.right > limit || box.bottom < 0 || box.top > next.height - 0.08) return { error: 'La ventana girada no cabe en la pared con esas medidas.' }
    if (openings.some((opening) => {
      if (opening.id === item.id) return false
      const other = bounds(opening)
      const gap = ROOM_LIMITS.openingGap
      return box.right + gap > other.left && other.right + gap > box.left && box.top + gap > other.bottom && other.top + gap > box.bottom
    })) return { error: 'La ventana girada no deja suficiente espacio respecto a otra apertura.' }
  }
  return { value: next }
}
