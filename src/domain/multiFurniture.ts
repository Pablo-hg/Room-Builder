import { furnitureHalfExtents } from './geometry'
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
    min.y = Math.min(min.y, item.y + 0.02)
    max.y = Math.max(max.y, item.y + item.height + 0.02)
  }
  return { min, max, center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 } }
}
