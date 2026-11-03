/**
 * Capacidades separadas por modalidad de producto (R4).
 *
 * Valores técnicos propuestos para que el mismo núcleo pueda servir a la
 * aplicación completa y a una futura versión Mini. No implican que la UI
 * multihabitación o la importación JSON estén entregadas.
 */
export type ProductMode = 'full' | 'mini'

export interface ProductCapabilities {
  mode: ProductMode
  /** null = sin límite definido; Mini se queda en una habitación. */
  maxRooms: number | null
  multiRoom: boolean
  layoutVariants: boolean
  editableJson: boolean
  glbExport: boolean
  catalog: 'full' | 'reduced'
  contextualNavigation: boolean
}

const FULL_CAPABILITIES: Readonly<ProductCapabilities> = Object.freeze({
  mode: 'full',
  maxRooms: null,
  multiRoom: true,
  layoutVariants: true,
  editableJson: true,
  glbExport: true,
  catalog: 'full',
  contextualNavigation: false,
})

const MINI_CAPABILITIES: Readonly<ProductCapabilities> = Object.freeze({
  mode: 'mini',
  maxRooms: 1,
  multiRoom: false,
  layoutVariants: false,
  editableJson: false,
  glbExport: false,
  catalog: 'reduced',
  contextualNavigation: true,
})

export const PRODUCT_CAPABILITIES: Readonly<Record<ProductMode, Readonly<ProductCapabilities>>> = Object.freeze({
  full: FULL_CAPABILITIES,
  mini: MINI_CAPABILITIES,
})

/** Devuelve una copia para que la UI no pueda mutar las capacidades globales. */
export function capabilitiesForMode(mode: ProductMode): ProductCapabilities {
  return { ...PRODUCT_CAPABILITIES[mode] }
}

export function supportsRoomCount(capabilities: ProductCapabilities, roomCount: number): boolean {
  if (!Number.isInteger(roomCount) || roomCount < 1) return false
  return capabilities.maxRooms === null || roomCount <= capabilities.maxRooms
}

export function supportsFeature(capabilities: ProductCapabilities, feature: 'multiRoom' | 'layoutVariants' | 'editableJson' | 'glbExport' | 'contextualNavigation'): boolean {
  return capabilities[feature]
}
