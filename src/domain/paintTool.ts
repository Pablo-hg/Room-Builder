import { DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR, WALL_SIDES } from './constants'
import { BASE_FLOOR_ID, baseWallId } from './elementFolders'
import { finishFromLegacyColor, type MaterialFinish } from './materials'
import { deriveSelection, elementName, type SelectionSource } from './selection'
import { worldOpenings } from './wallConnections'

/**
 * Herramientas Pintar y Cuentagotas (#39): qué acabado tiene un elemento y cómo llamarlo.
 * Funciones puras sobre el diseño; la escena solo traduce el puntero a un identificador de elemento.
 */

export type PaintMode = 'paint' | 'eyedropper'

export interface PaintToolState {
  mode: PaintMode
  /** Acabado del pincel: el que se aplica al pintar y el que el cuentagotas actualiza. */
  finish: MaterialFinish
}

/** Pincel inicial cuando no hay nada que copiar: pintura lisa del color de pared por defecto. */
export const DEFAULT_PAINT_FINISH: MaterialFinish = { id: 'paint', color: DEFAULT_WALL_COLOR, scale: 1, rotation: 0 }

const legacy = (color: string | undefined, fallback: string): MaterialFinish | null => finishFromLegacyColor(color ?? fallback)

/**
 * Acabado actual de un elemento: el material guardado o, si solo tiene un color, ese color como pintura lisa.
 * `null` si el elemento no existe o su color histórico no se puede leer (el cuentagotas avisa en vez de inventarlo).
 * Solo se lee el aspecto: nunca posición, medidas ni otras propiedades.
 */
export function elementFinish(state: SelectionSource, id: string): MaterialFinish | null {
  if (id === BASE_FLOOR_ID) return state.room.floorMaterial ?? legacy(state.room.floorColor, DEFAULT_FLOOR_COLOR)
  const wall = WALL_SIDES.find((side) => baseWallId(side) === id)
  if (wall) return state.room.wallMaterials?.[wall] ?? legacy(state.room.wallColors?.[wall] ?? state.room.wallColor, DEFAULT_WALL_COLOR)

  const { selectedFurniture, selectedSurface } = deriveSelection(state, id)
  if (selectedFurniture) return selectedFurniture.material ?? legacy(selectedFurniture.color, selectedFurniture.color)
  if (selectedSurface) return selectedSurface.surface.material ?? legacy(selectedSurface.surface.color, selectedSurface.surface.color)

  const opening = worldOpenings(state).find((item) => item.id === id)
  if (!opening) return null
  const object = opening.object as { material?: MaterialFinish; color?: string }
  return object.material ?? (object.color ? legacy(object.color, object.color) : null)
}

/**
 * Nombre legible del elemento bajo el pincel, con su habitación cuando es de una habitación añadida: así se distingue
 * la «Pared A» de la principal de la de otra habitación (cada habitación tiene sus propias paredes).
 */
export function paintTargetLabel(state: SelectionSource, id: string): string | null {
  const name = elementName(state, id)
  if (!name) return null
  const { selectedSurface } = deriveSelection(state, id)
  if (selectedSurface) return `${name} · ${selectedSurface.pack.name}`
  const opening = worldOpenings(state).find((item) => item.id === id)
  const pack = opening?.packId && state.structurePacks.find((candidate) => candidate.id === opening.packId)
  return pack ? `${name} · ${pack.name}` : name
}

/** Identificador de elemento a partir de los `userData` de un objeto de la escena (o `null` si no es pintable). */
export function paintTargetId(userData: Record<string, unknown>): string | null {
  const surface = userData.structureSurfaceId
  if (typeof surface === 'string' && surface) return surface
  const wall = userData.wallId
  if (typeof wall === 'string' && wall) return wall.replace(/:baseboard$/, '')
  const element = userData.elementId
  return typeof element === 'string' && element ? element : null
}
