// Migración a v12: paredes de habitación por fuera del suelo (15/11/2026).
//
// Hasta v11 cada pared de habitación estaba centrada sobre el borde del suelo. Desde v12
// va entera por fuera: su cara interior coincide con el borde del suelo. Los datos de las
// paredes no cambian (siguen referidos al borde del suelo), pero sí lo que se guardó en
// coordenadas del mundo pegado a ellas, y la separación entre habitaciones contiguas:
//
// 1. Habitaciones contiguas: antes compartían la frontera; ahora deben separarse un grosor
//    de pared para compartir una única pared. Cada habitación se desplaza un grosor por
//    cada frontera de contacto entre ella y la habitación principal, con todo su contenido.
// 2. Puertas y ventanas ancladas (`wallPosition`) y muebles fijados a una pared de
//    habitación se desplazan medio grosor hacia fuera para seguir en/sobre su pared.
import { ROOM_WALL_THICKNESS } from '../domain/constants'
import type { PersistedDesign } from '../domain/designV1'
import { WALLS_OUTSIDE_VERSION } from '../domain/designV1'
import { isRoomPackId, roomWallOutset, worldRoomBoxes } from '../domain/roomEditing'
import type { DoorConfig, FurnitureItem, RoomConfig, StructurePack, WindowConfig } from '../domain/types'
import { physicalWalls, type ConnectedWall } from '../domain/wallConnections'

const EPS = 1e-6
type Shift = { x: number; z: number }
type Box = { x: number; y: number; z: number; width: number; depth: number; height: number }

const rangesOverlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > EPS

/** Planos de contacto entre habitaciones (x de fronteras este-oeste, z de norte-sur). */
function contactPlanes(boxes: Box[]) {
  const xs = new Set<number>(), zs = new Set<number>()
  for (const a of boxes) for (const b of boxes) {
    if (a === b || !rangesOverlap(a.y, a.y + a.height, b.y, b.y + b.height)) continue
    const aEast = a.x + a.width / 2, bWest = b.x - b.width / 2
    if (Math.abs(aEast - bWest) < EPS && rangesOverlap(a.z - a.depth / 2, a.z + a.depth / 2, b.z - b.depth / 2, b.z + b.depth / 2)) xs.add(Math.round(aEast * 1e6) / 1e6)
    const aSouth = a.z + a.depth / 2, bNorth = b.z - b.depth / 2
    if (Math.abs(aSouth - bNorth) < EPS && rangesOverlap(a.x - a.width / 2, a.x + a.width / 2, b.x - b.width / 2, b.x + b.width / 2)) zs.add(Math.round(aSouth * 1e6) / 1e6)
  }
  return { xs: [...xs], zs: [...zs] }
}

/** Desplazamiento de una coordenada: un grosor por cada plano de contacto entre 0 y ella. */
function shiftFor(value: number, planes: number[]): number {
  let count = 0
  for (const plane of planes) {
    if (plane > EPS && plane < value - EPS) count++
    else if (plane < -EPS && plane > value + EPS) count--
  }
  return count * ROOM_WALL_THICKNESS
}

function containingRoom(boxes: Box[], point: { x: number; y: number; z: number }): number {
  // Índice 0 = habitación principal; el resto, habitaciones en orden de `worldRoomBoxes`.
  for (let index = 1; index < boxes.length; index++) {
    const box = boxes[index]
    if (Math.abs(point.x - box.x) <= box.width / 2 + EPS && Math.abs(point.z - box.z) <= box.depth / 2 + EPS
      && point.y >= box.y - 0.2 && point.y <= box.y + box.height + EPS) return index
  }
  return 0
}

const moved = <T extends { x: number; z: number }>(position: T, shift: Shift): T => ({ ...position, x: position.x + shift.x, z: position.z + shift.z })

export function needsWallLayoutMigration(design: PersistedDesign): boolean {
  return design.version < WALLS_OUTSIDE_VERSION
}

/** Convierte un diseño anterior a v12. No muta la entrada. */
export function migrateWallLayout(source: PersistedDesign): PersistedDesign {
  if (!needsWallLayoutMigration(source)) return source
  const design = structuredClone(source)
  const room: RoomConfig = design.room
  const packs: StructurePack[] = design.structurePacks ?? []

  // 1. Separación de habitaciones contiguas.
  const roomPacks = packs.filter((pack) => isRoomPackId(pack.id))
  const boxes: Box[] = worldRoomBoxes(room, packs)
  const planes = contactPlanes(boxes)
  const roomShift = (index: number): Shift => index === 0 ? { x: 0, z: 0 } : { x: shiftFor(boxes[index].x, planes.xs), z: shiftFor(boxes[index].z, planes.zs) }
  const shiftByPack = new Map(roomPacks.map((pack, index) => [pack.id, roomShift(index + 1)]))
  const shiftAt = (point: { x: number; y: number; z: number }) => roomShift(containingRoom(boxes, point))

  const shiftedFurniture = design.furniture.map((item) => ({ item, shift: shiftAt({ x: item.x, y: item.y ?? 0, z: item.z }) }))
  for (const pack of packs) {
    // Suelos y paredes independientes viajan con la habitación que los contiene.
    const shift = shiftByPack.get(pack.id) ?? shiftAt({ x: pack.x, y: pack.y, z: pack.z })
    pack.x += shift.x
    pack.z += shift.z
    for (const door of pack.doors ?? []) if (door.wallPosition) door.wallPosition = moved(door.wallPosition, shift)
    for (const window of pack.windows ?? []) {
      if (window.wallPosition) window.wallPosition = moved(window.wallPosition, shift)
      if (window.freePosition) window.freePosition = moved(window.freePosition, shift)
    }
  }
  for (const window of room.windows) if (window.freePosition) window.freePosition = moved(window.freePosition, shiftAt(window.freePosition))
  design.furniture = shiftedFurniture.map(({ item, shift }) => ({ ...item, x: item.x + shift.x, z: item.z + shift.z }))

  // 2. Objetos pegados a paredes de habitación: medio grosor hacia fuera (geometría v12).
  const walls = new Map(physicalWalls({ room, structurePacks: packs }).map((wall) => [wall.id, wall]))
  const isRoomWall = (wall: ConnectedWall | undefined): wall is ConnectedWall => !!wall && (!wall.packId || isRoomPackId(wall.packId))
  const outward = (wall: ConnectedWall): Shift => { const [x, z] = roomWallOutset(wall.yaw, wall.depth); return { x, z } }
  const ownerWall = (object: DoorConfig | WindowConfig, packId?: string) =>
    walls.get(packId ? [...walls.values()].find((wall) => wall.packId === packId && wall.side === object.wall)?.id ?? '' : `room-wall:${object.wall}`)
  const anchor = (object: DoorConfig | WindowConfig, packId?: string) => {
    if (!object.wallPosition) return
    const wall = object.wallPosition.supportId ? walls.get(object.wallPosition.supportId) : ownerWall(object, packId)
    if (isRoomWall(wall)) object.wallPosition = moved(object.wallPosition, outward(wall))
  }
  anchor(room.door)
  for (const door of room.extraDoors ?? []) anchor(door)
  for (const window of room.windows) anchor(window)
  for (const pack of packs) for (const opening of [...(pack.doors ?? []), ...(pack.windows ?? [])]) anchor(opening, pack.id)
  design.furniture = design.furniture.map((item: FurnitureItem) => {
    const wall = item.wallAttachment ? walls.get(item.wallAttachment.wallId) : undefined
    return isRoomWall(wall) ? moved(item, outward(wall)) : item
  })

  design.version = WALLS_OUTSIDE_VERSION
  return design
}
