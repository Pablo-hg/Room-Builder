import type { FurnitureKind, WindowShape } from './types'

export type FurnitureDimension = 'width' | 'depth' | 'height'
export interface ResizeCapability {
  dimensions: Partial<Record<FurnitureDimension, { min: number; max: number }>>
  diameter?: readonly [FurnitureDimension, FurnitureDimension]
}

const range = { min: 0.01, max: 10 }
const volume: ResizeCapability = { dimensions: { width: range, depth: range, height: range } }
const circularVolume: ResizeCapability = { ...volume, diameter: ['width', 'depth'] }
const rug: ResizeCapability = { dimensions: { width: range, depth: range } }
const circularRug: ResizeCapability = { ...rug, diameter: ['width', 'depth'] }
const mural: ResizeCapability = { dimensions: { width: range, height: range } }
const circularMural: ResizeCapability = { ...mural, diameter: ['width', 'height'] }

export function furnitureResizeCapability(kind: FurnitureKind): ResizeCapability | undefined {
  if (kind === 'pictureSmall' || kind === 'pictureMedium' || kind === 'pictureLarge') return undefined
  if (kind === 'rug') return rug
  if (kind === 'circularRug') return circularRug
  if (['lamp', 'tableLamp', 'ceilingLamp', 'vase', 'wastebasket', 'plant'].includes(kind)) return circularVolume
  return volume
}

export function openingResizeCapability(shape: WindowShape): ResizeCapability | undefined {
  return shape === 'circular' || shape === 'mirrorCircular' ? circularMural : mural
}
