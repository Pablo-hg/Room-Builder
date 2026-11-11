import { floorLevels, roundFloorLevel } from '../domain/floorLevels'
import { topViewWallForOrientation } from '../domain/geometry'
import { packRoomBox } from '../domain/roomEditing'
import type { RoomConfig, StructurePack } from '../domain/types'

/**
 * Hoja de plantas de la vista Plano: como en arquitectura, cada planta se
 * dibuja por separado, una al lado de otra (de izquierda a derecha, de la
 * más baja a la más alta). Es solo una transformación de dibujo: el mundo,
 * las coordenadas guardadas y la planta enfocada (editable) no se mueven.
 */

const LEVEL_TOLERANCE = 0.01
/** Separación entre plantas: deja sitio a cotas, etiquetas y títulos. */
export const PLAN_SHEET_GAP = 4

export interface PlanVector { x: number; z: number }

interface Box { x: number; z: number; width: number; depth: number }

export interface PlanFloorGroup {
  /** Altura redondeada de la planta (clave del selector «Cámara enfocada en…»). */
  key: number
  number: number
  name: string
  /** Altura real del suelo de la planta, como la usa la escena enfocada. */
  level: number
  /** Altura libre de la planta. */
  height: number
  /** `null` = habitación raíz. */
  roomIds: Array<string | null>
  boxes: Box[]
}

/** Misma regla que la escena enfocada para decidir si un paquete está en una planta. */
export function packOnLevel(pack: StructurePack, room: RoomConfig, level: number) {
  if (pack.id.startsWith('floor-pack-')) return Math.abs(pack.y - level) < LEVEL_TOLERANCE
  return pack.surfaces.some((surface) => {
    const y = pack.y + surface.y + (surface.kind === 'wall' ? room.height / 2 : surface.kind === 'ceiling' ? room.height : 0)
    return y >= level - LEVEL_TOLERANCE && y < level + room.height
  })
}

/** Plantas con sus habitaciones, ordenadas de abajo arriba (−1, 0, 1, 2…). */
export function planFloorGroups(room: RoomConfig, structurePacks: readonly StructurePack[]): PlanFloorGroup[] {
  const rooms = structurePacks.filter((pack) => pack.id.startsWith('floor-pack-'))
  return floorLevels(rooms.map((pack) => pack.y)).map((floor) => {
    const members = rooms.filter((pack) => roundFloorLevel(pack.y) === floor.y)
    const isGround = floor.y === 0
    const boxes: Box[] = isGround ? [{ x: 0, z: 0, width: room.width, depth: room.depth }] : []
    let level = isGround ? 0 : Number.NaN
    let height = isGround ? room.height : 0
    for (const pack of members) {
      const box = packRoomBox(pack, room)
      boxes.push({ x: pack.x + (box?.x ?? 0), z: pack.z + (box?.z ?? 0), width: box?.width ?? room.width, depth: box?.depth ?? room.depth })
      if (Number.isNaN(level)) level = pack.y + (box?.y ?? 0)
      height = Math.max(height, box?.height ?? room.height)
    }
    return { key: floor.y, number: floor.number, name: floor.name, level: Number.isNaN(level) ? floor.y : level, height: height || room.height,
      roomIds: [...(isGround ? [null] : []), ...members.map((pack) => pack.id)], boxes }
  })
}

/** Dirección del mundo que se ve hacia la derecha de la pantalla en Plano. */
export function planScreenRight(orientation: number): PlanVector {
  return { north: { x: 1, z: 0 }, east: { x: 0, z: 1 }, south: { x: -1, z: 0 }, west: { x: 0, z: -1 } }[topViewWallForOrientation(orientation)]
}

/** Dirección del mundo que se ve hacia arriba de la pantalla en Plano. */
export function planScreenUp(orientation: number): PlanVector {
  const right = planScreenRight(orientation)
  return { x: right.z, z: -right.x }
}

/** Intervalo que ocupa un conjunto de cajas a lo largo de un eje del plano. */
export function extentAlong(boxes: readonly Box[], axis: PlanVector): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const box of boxes) {
    const centre = box.x * axis.x + box.z * axis.z
    const half = (Math.abs(axis.x) * box.width + Math.abs(axis.z) * box.depth) / 2
    min = Math.min(min, centre - half)
    max = Math.max(max, centre + half)
  }
  return Number.isFinite(min) ? [min, max] : [0, 0]
}

export interface PlanSheetPlacement {
  /** Desplazamiento de dibujo en X/Z (la planta enfocada siempre 0). */
  offset: PlanVector
  /** Desplazamiento vertical para dibujar la planta a la altura de la enfocada. */
  lift: number
}

/**
 * Coloca las plantas de izquierda a derecha en pantalla, con `gap` metros
 * entre ellas, sin moverlas en la dirección vertical de la pantalla (quedan
 * alineadas como en una lámina). La planta enfocada queda en su sitio real.
 */
export function planSheetPlacements(groups: readonly PlanFloorGroup[], focusedKey: number, orientation: number, gap = PLAN_SHEET_GAP): Map<number, PlanSheetPlacement> {
  const right = planScreenRight(orientation)
  const shifts = new Map<number, number>()
  let cursor = 0
  for (const group of groups) {
    const [min, max] = extentAlong(group.boxes, right)
    shifts.set(group.key, cursor - min)
    cursor += max - min + gap
  }
  const focused = groups.find((group) => group.key === focusedKey) ?? groups.find((group) => group.key === 0)
  const base = shifts.get(focused?.key ?? 0) ?? 0
  const focusedLevel = focused?.level ?? 0
  return new Map(groups.map((group) => {
    const shift = (shifts.get(group.key) ?? 0) - base
    return [group.key, { offset: { x: right.x * shift, z: right.z * shift }, lift: focusedLevel - group.level }]
  }))
}
