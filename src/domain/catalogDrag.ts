import type { PersistedDesign } from './designV1'
import { structureSurfaceElementId } from './elementIds'
import type { ConnectedWall } from './wallConnections'
import { packRoomBox } from './roomEditing'
import type { FurnitureKind, RoomConfig, StructurePack, WindowShape } from './types'

/**
 * Arrastrar desde el catálogo a la vista (pulsar sin mover sigue creando el objeto como siempre).
 * Lógica pura: qué se crea, cómo se reconoce lo creado y cómo se traduce un punto del mundo a cada tipo.
 */
export type CatalogDragItem =
  | { type: 'furniture'; kind: FurnitureKind }
  | { type: 'wall-object'; shape: WindowShape }
  | { type: 'door' }
  | { type: 'structure'; kind: 'floor' | 'wall' }

/** Cómo se coloca mientras se arrastra: sobre el suelo de la habitación enfocada o pegado a una pared suya. */
export const catalogDragPlacement = (item: CatalogDragItem): 'floor' | 'wall' =>
  item.type === 'wall-object' || item.type === 'door' ? 'wall' : 'floor'

/** Distancia mínima (px) para que una pulsación pase a ser arrastre; por debajo es un clic normal. */
export const CATALOG_DRAG_THRESHOLD = 6

export const exceedsDragThreshold = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  Math.hypot(to.x - from.x, to.y - from.y) >= CATALOG_DRAG_THRESHOLD

type DesignIds = Pick<PersistedDesign, 'room' | 'furniture' | 'structurePacks'>

/** Identificadores de todo lo que se puede crear desde el catálogo. */
export function catalogElementIds(design: DesignIds): Set<string> {
  const ids = new Set<string>()
  design.furniture.forEach((item) => ids.add(item.id))
  design.room.windows.forEach((window) => ids.add(window.id))
  design.room.extraDoors?.forEach((door) => ids.add(door.id))
  for (const pack of design.structurePacks ?? []) {
    ids.add(pack.id)
    pack.windows?.forEach((window) => ids.add(window.id))
    pack.doors?.forEach((door) => ids.add(door.id))
  }
  return ids
}

/** El elemento que apareció entre dos estados (o `null` si la creación se rechazó). */
export function createdCatalogElement(before: DesignIds, after: DesignIds): string | null {
  const previous = catalogElementIds(before)
  for (const id of catalogElementIds(after)) if (!previous.has(id)) return id
  return null
}

/** Dueño de una apertura: `null` = habitación principal; si no, el id de su habitación. */
export function openingOwner(design: DesignIds, id: string): string | null | undefined {
  if (design.room.windows.some((window) => window.id === id) || design.room.extraDoors?.some((door) => door.id === id)) return null
  return design.structurePacks?.find((pack) => pack.windows?.some((window) => window.id === id) || pack.doors?.some((door) => door.id === id))?.id
}

/** Id de la pared física a partir del `userData.wallId` de su malla (el zócalo comparte pared). */
export const wallIdFromMesh = (meshWallId: unknown): string | null =>
  typeof meshWallId === 'string' && meshWallId ? meshWallId.replace(/:baseboard$/, '') : null

/** ¿Es una pared donde puede ir la apertura? Solo las de su misma habitación (la enfocada al crearla). */
export const wallBelongsTo = (wall: Pick<ConnectedWall, 'packId'>, owner: string | null) => (wall.packId ?? null) === owner

/**
 * Posición a lo largo de la pared (convención de `offset`) del punto del mundo, y altura del alféizar
 * para centrar el objeto en el cursor. Es la inversa de `wallObjectPosition`: x = wx + cos·o, z = wz − sin·o.
 */
export function wallPlacementAt(wall: Pick<ConnectedWall, 'x' | 'z' | 'yaw'>, point: { x: number; y: number; z: number }, floorY: number, objectHeight: number) {
  const offset = (point.x - wall.x) * Math.cos(wall.yaw) - (point.z - wall.z) * Math.sin(wall.yaw)
  const rawSill = point.y - floorY - objectHeight / 2
  return { offset, sill: Math.max(0, rawSill), rawSill }
}

type WallLine = Pick<ConnectedWall, 'x' | 'z' | 'yaw'>
type Point2 = { x: number; z: number }

/** Normal horizontal de la pared que apunta hacia el interior de su habitación. */
export function inwardNormal(wall: WallLine, roomCenter: Point2): Point2 {
  const n = { x: Math.sin(wall.yaw), z: Math.cos(wall.yaw) }
  return (roomCenter.x - wall.x) * n.x + (roomCenter.z - wall.z) * n.z < 0 ? { x: -n.x, z: -n.z } : n
}

/** La cámara ve la cara interior (la pared no es una de las que se ocultan por estar delante). */
export const cameraSeesInside = (wall: WallLine, inward: Point2, camera: Point2) =>
  (camera.x - wall.x) * inward.x + (camera.z - wall.z) * inward.z > 0

/**
 * Cuánto se sale el objeto (centrado en el cursor) del rectángulo de la pared, en metros, dentro del plano de
 * la pared. 0 = el cursor está sobre la pared real; más = está en la prolongación de la pared.
 */
export function outsideWallDistance(wall: Pick<ConnectedWall, 'width' | 'height'>, placement: { offset: number; sill: number; rawSill?: number }, objectHeight: number) {
  const sill = placement.rawSill ?? placement.sill
  const horizontal = Math.max(0, Math.abs(placement.offset) - wall.width / 2)
  const vertical = Math.max(0, sill + objectHeight - wall.height, -sill)
  return Math.hypot(horizontal, vertical)
}

/** Centro en planta y altura del suelo de la habitación a la que pertenece un objeto de pared. */
export function openingRoomFrame(room: RoomConfig, pack?: StructurePack): { center: Point2; floorY: number } {
  if (!pack) return { center: { x: 0, z: 0 }, floorY: 0 }
  const box = packRoomBox(pack, room)
  return { center: { x: pack.x + (box?.x ?? 0), z: pack.z + (box?.z ?? 0) }, floorY: pack.y + (box?.y ?? 0) }
}

/** Distancia (m) a la que un objeto de pared libre se fija solo al acercarlo a una pared de su habitación. */
export const WALL_OBJECT_SNAP_DISTANCE = 0.15

/**
 * Pared de su habitación a la que se fijaría un objeto de pared libre: la más cercana cuyo plano está a menos de
 * `WALL_OBJECT_SNAP_DISTANCE` de su centro y que lo contiene en ancho y alto. Devuelve la colocación equivalente.
 */
export function nearestWallSnap<W extends ConnectedWall>(walls: readonly W[], roomCenter: Point2, floorY: number,
  center: { x: number; y: number; z: number }, objectHeight: number): { wall: W; offset: number; sill: number } | null {
  let best: { wall: W; offset: number; sill: number; distance: number } | null = null
  for (const wall of walls) {
    const n = inwardNormal(wall, roomCenter)
    const faceDistance = Math.abs((center.x - wall.x) * n.x + (center.z - wall.z) * n.z) - wall.depth / 2
    if (faceDistance > WALL_OBJECT_SNAP_DISTANCE) continue
    const placement = wallPlacementAt(wall, center, floorY, objectHeight)
    if (outsideWallDistance(wall, placement, objectHeight) > 0) continue
    if (!best || faceDistance < best.distance) best = { wall, ...placement, distance: faceDistance }
  }
  return best && { wall: best.wall, offset: best.offset, sill: best.sill }
}

/** Id de selección de una superficie independiente recién creada (su pack contiene una única superficie). */
export const structureObjectSurfaceId = (packId: string, kind: 'floor' | 'wall') =>
  structureSurfaceElementId(packId, kind === 'floor' ? 'floor' : 'wall-north')
