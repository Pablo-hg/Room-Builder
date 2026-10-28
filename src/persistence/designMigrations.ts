import type { PersistedDesign, SavedDesign } from '../domain/designV1'
import type { FurnitureItem, RoomConfig, WallSide, WindowConfig } from '../domain/types'
import { snapToVisibleGrid, validateOpenings } from '../domain/geometry'
import { isWallPictureKind, OPENING_CATALOG } from '../domain/objectCatalog'

export function migrateLegacyDesign(data: PersistedDesign, id: string, savedAt: string): SavedDesign[] {
  return [{ id, name: 'Diseño guardado anteriormente', savedAt, data }]
}

export function migrateWallPictures(room: RoomConfig, furniture: FurnitureItem[]) {
  const windows = [...room.windows]
  const remainingFurniture: FurnitureItem[] = []
  const preferredWallFor = (item: FurnitureItem): { wall: WallSide; offset: number } => {
    const distances: { wall: WallSide; distance: number; offset: number }[] = [
      { wall: 'north', distance: Math.abs(item.z + room.depth / 2), offset: item.x },
      { wall: 'east', distance: Math.abs(item.x - room.width / 2), offset: item.z },
      { wall: 'south', distance: Math.abs(item.z - room.depth / 2), offset: -item.x },
      { wall: 'west', distance: Math.abs(item.x + room.width / 2), offset: -item.z },
    ]
    const preferred = distances.sort((a, b) => a.distance - b.distance)[0]
    return { wall: preferred.wall, offset: snapToVisibleGrid(preferred.offset) }
  }
  const offsets = [0, -0.5, 0.5, -1, 1, -1.5, 1.5, -2, 2]

  furniture.forEach((item) => {
    const legacyMirror = String(item.kind) === 'mirror'
    if (!isWallPictureKind(item.kind) && !legacyMirror) {
      remainingFurniture.push(item)
      return
    }
    const preferred = preferredWallFor(item)
    const shape = isWallPictureKind(item.kind) ? item.kind : 'mirrorRectangular'
    const definition = OPENING_CATALOG[shape]
    const walls = [preferred.wall, ...(['north', 'east', 'south', 'west'] as WallSide[]).filter((wall) => wall !== preferred.wall)]
    let placed = false

    for (const wall of walls) {
      const candidates = [preferred.offset, ...offsets.filter((offset) => offset !== preferred.offset)]
      for (const offset of candidates) {
        const picture: WindowConfig = {
          id: item.id,
          shape,
          wall,
          offset,
          width: definition.width,
          height: definition.height,
          sill: definition.defaultBottom,
          rotation: 0,
          color: item.color,
        }
        const candidateRoom = { ...room, windows: [...windows, picture] }
        if (validateOpenings(candidateRoom)) continue
        windows.push(picture)
        placed = true
        break
      }
      if (placed) break
    }

    if (!placed) remainingFurniture.push(item)
  })

  return { room: { ...room, windows }, remainingFurniture }
}

