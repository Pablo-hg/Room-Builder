import type { PersistedLayout } from './designV1'
import type { FurnitureItem } from './types'

export interface LayoutState {
  layouts: PersistedLayout[]
  activeLayoutId: string
  furniture: FurnitureItem[]
}

export function ensureOriginalLayout(furniture: FurnitureItem[]): LayoutState {
  return {
    layouts: [{ id: 'original', name: 'Original', kind: 'original', furniture: structuredClone(furniture) }],
    activeLayoutId: 'original',
    furniture: structuredClone(furniture),
  }
}

/** Captura el mobiliario activo en un snapshot independiente. */
export function syncActiveLayout(state: LayoutState): LayoutState {
  if (!state.layouts.some((layout) => layout.id === state.activeLayoutId)) throw new Error('Variante activa inexistente.')
  return {
    activeLayoutId: state.activeLayoutId,
    furniture: structuredClone(state.furniture),
    layouts: state.layouts.map((layout) => ({ ...layout, furniture: structuredClone(layout.id === state.activeLayoutId ? state.furniture : layout.furniture) })),
  }
}

export function switchLayout(state: LayoutState, id: string): LayoutState {
  const synced = syncActiveLayout(state)
  const layout = synced.layouts.find((candidate) => candidate.id === id)
  if (!layout) throw new Error('Variante inexistente.')
  return { ...synced, activeLayoutId: id, furniture: structuredClone(layout.furniture) }
}

export function duplicateLayout(state: LayoutState, id: string, name = 'Alternativa A'): LayoutState {
  if (!id.trim() || state.layouts.some((layout) => layout.id === id)) throw new Error('ID de variante vacío o duplicado.')
  if (!name.trim()) throw new Error('Escribe un nombre para la variante.')
  const synced = syncActiveLayout(state)
  const layout: PersistedLayout = { id, name: name.trim(), kind: 'alternative', furniture: structuredClone(state.furniture) }
  return { ...synced, layouts: [...synced.layouts, layout], activeLayoutId: id, furniture: structuredClone(layout.furniture) }
}

export function renameLayout(state: LayoutState, id: string, name: string): LayoutState {
  if (!name.trim()) throw new Error('Escribe un nombre para la variante.')
  if (!state.layouts.some((layout) => layout.id === id)) throw new Error('Variante inexistente.')
  const synced = syncActiveLayout(state)
  return { ...synced, layouts: synced.layouts.map((layout) => layout.id === id ? { ...layout, name: name.trim() } : layout) }
}

export function removeLayout(state: LayoutState, id: string): LayoutState {
  const layout = state.layouts.find((candidate) => candidate.id === id)
  if (!layout || layout.kind === 'original') throw new Error('No se puede eliminar Original.')
  const original = state.layouts.find((candidate) => candidate.kind === 'original')
  if (!original) throw new Error('Falta Original.')
  const synced = switchLayout(state, original.id)
  return { ...synced, layouts: synced.layouts.filter((candidate) => candidate.id !== id) }
}

/** Validación de las relaciones entre variantes. La validación geométrica es independiente. */
export function validateLayouts(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Diseño inválido.']
  const design = value as Record<string, unknown>
  if (!Array.isArray(design.layouts)) return ['Faltan las variantes.']
  const errors: string[] = []
  const ids = new Set<string>()
  let originals = 0
  let active: Record<string, unknown> | undefined
  for (const raw of design.layouts) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push('Variante inválida.')
      continue
    }
    const layout = raw as Record<string, unknown>
    if (typeof layout.id !== 'string' || !layout.id.trim() || ids.has(layout.id)) errors.push('ID de variante vacío o duplicado.')
    else ids.add(layout.id)
    if (typeof layout.name !== 'string' || !layout.name.trim()) errors.push('Nombre de variante inválido.')
    if (layout.kind === 'original') originals++
    else if (layout.kind !== 'alternative') errors.push('Tipo de variante inválido.')
    if (!Array.isArray(layout.furniture)) errors.push('Mobiliario de variante inválido.')
    if (layout.id === design.activeLayoutId) active = layout
  }
  if (originals !== 1) errors.push('Debe existir una única variante Original.')
  if (typeof design.activeLayoutId !== 'string' || !ids.has(design.activeLayoutId) || !active) errors.push('Variante activa inexistente.')
  if (!Array.isArray(design.furniture)) errors.push('Mobiliario activo inválido.')
  else if (active && Array.isArray(active.furniture) && !sameValue(design.furniture, active.furniture)) {
    errors.push('El mobiliario activo no coincide con el de su variante.')
  }
  return errors
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => sameValue(item, b[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]))
}
