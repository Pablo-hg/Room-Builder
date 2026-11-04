import { furnitureHalfExtents } from './geometry'
import { furnitureVisualYOffset } from './objectCatalog'
import type { FurnitureItem } from './types'

export function furnitureSelectionBounds(items: FurnitureItem[]) {
  if (!items.length) return null
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const item of items) {
    const extent = furnitureHalfExtents(item)
    min.x = Math.min(min.x, item.x - extent.halfWidth)
    max.x = Math.max(max.x, item.x + extent.halfWidth)
    min.z = Math.min(min.z, item.z - extent.halfDepth)
    max.z = Math.max(max.z, item.z + extent.halfDepth)
    const y = item.y + furnitureVisualYOffset(item)
    min.y = Math.min(min.y, y)
    max.y = Math.max(max.y, y + item.height)
  }
  return { min, max, center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 } }
}
