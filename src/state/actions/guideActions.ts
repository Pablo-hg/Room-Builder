import { furnitureAxisLocks } from '../../domain/axisLocks'
import { furnitureWallAxes } from '../../domain/furnitureWalls'
import { furnitureVisualYOffset } from '../../domain/objectCatalog'
import { furnitureGuideBox, guideTargets, resolveDragGuides, sameGuides, type Axis, type GuideBox } from '../../domain/dragGuides'
import { saveEditorPreferences } from '../editorPreferences'
import { isMagnetSuspended } from '../dragModifiers'
import type { RoomActionContext, RoomState } from '../types'

type GuideActions = Pick<RoomState, 'setMagnetism' | 'setGuides' | 'setGridSnap' | 'clearDragGuides' | 'guideGroupMove'>

/** Guías y magnetismo solo existen donde se ve el suelo desde arriba: Plano, Isométrica y Libre. */
export const guidesAvailableIn = (view: RoomState['view']) => view === 'top' || view === 'isometric' || view === 'free'

export function createGuideActions({ set, get }: Pick<RoomActionContext, 'set' | 'get'>): GuideActions {
  return {
    setMagnetism: (magnetism) => {
      if (get().magnetismEnabled === magnetism) return
      saveEditorPreferences({ magnetism, guides: get().guidesEnabled })
      set({ magnetismEnabled: magnetism, activeGuides: [] })
    },
    setGuides: (guides) => {
      if (get().guidesEnabled === guides) return
      saveEditorPreferences({ magnetism: get().magnetismEnabled, guides })
      set({ guidesEnabled: guides, activeGuides: [] })
    },
    setGridSnap: (gridSnap) => { if (get().gridSnap !== gridSnap) set({ gridSnap }) },
    clearDragGuides: () => { if (get().activeGuides.length) set({ activeGuides: [] }) },
    guideGroupMove: (box, delta, ids, axes) => {
      const state = get()
      const none = { dx: 0, dz: 0 }
      if (!guidesAvailableIn(state.view) || (!state.guidesEnabled && !state.magnetismEnabled)) return none
      const magnetism = state.magnetismEnabled && !isMagnetSuspended()
      const targets = guideTargets(state, new Set(ids), { min: box.minY, max: box.maxY })
      const moving: GuideBox = { minX: box.minX + delta.x, maxX: box.maxX + delta.x, minZ: box.minZ + delta.z, maxZ: box.maxZ + delta.z }
      const result = resolveDragGuides(moving, targets, { magnetism, axes })
      const guides = state.guidesEnabled ? result.guides : []
      if (!sameGuides(state.activeGuides, guides)) set({ activeGuides: guides })
      return { dx: result.dx, dz: result.dz }
    },
  }
}

/**
 * Ajuste de un mueble arrastrado con el puntero. Devuelve el destino (x, z) corregido por el imán
 * y publica las guías. El destino sale siempre del puntero, nunca del resultado anterior:
 * al salir de la tolerancia o pulsar Alt no queda ningún «salto» pendiente.
 */
export function pointerMoveGuides(state: RoomState, id: string, x: number, z: number, axis?: Axis): { x: number; z: number; guides: RoomState['activeGuides'] } {
  const item = state.furniture.find((candidate) => candidate.id === id)
  const unchanged = { x, z, guides: state.activeGuides.length ? [] : state.activeGuides }
  if (!item || !guidesAvailableIn(state.view) || (!state.guidesEnabled && !state.magnetismEnabled)) return unchanged
  const locks = furnitureAxisLocks(item), available = furnitureWallAxes(state, item)
  // Un mueble fijado a una pared oblicua puede deslizarse en ambos ejes a la vez; ahí no hay guías fiables.
  if (item.wallAttachment && available.x && available.z) return unchanged
  const axes = (['x', 'z'] as const).filter((candidate) => (!axis || axis === candidate) && !locks[candidate] && available[candidate])
  // Las guías se calculan donde el mueble quedará de verdad: un eje bloqueado o impedido por la pared
  // conserva su coordenada actual aunque el puntero esté en otra parte.
  const gx = locks.x || !available.x ? item.x : x, gz = locks.z || !available.z ? item.z : z
  const magnetism = state.magnetismEnabled && !isMagnetSuspended()
  const bottom = item.y + furnitureVisualYOffset(item, state)
  const targets = guideTargets(state, new Set([id]), { min: bottom, max: bottom + item.height })
  const result = resolveDragGuides(furnitureGuideBox(item, gx, gz), targets, { magnetism, axes })
  return { x: x + result.dx, z: z + result.dz, guides: state.guidesEnabled ? result.guides : [] }
}
