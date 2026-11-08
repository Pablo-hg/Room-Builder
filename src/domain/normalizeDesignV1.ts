import { DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR, WALL_SIDES } from './constants'
import { DEFAULT_GRID_VISIBILITY, type PersistedDesign } from './designV1'
import { FURNITURE_PRESETS, isWallMirrorShape, isWallPictureShape, isWindowShape, OPENING_CATALOG, openingKindForShape } from './objectCatalog'
import { createStructureSurface } from './structureRules'
import { validateAxisLocks } from './axisLocks'
import { rootDoorPack, structureDoorError } from './structureDoors'
import { structureWindowError } from './structureWindows'
import type { GridSurface, RoomConfig, StructurePack, StructureSurface, StructureSurfaceKey } from './types'

export function normalizeStructurePacks(value: unknown, room: RoomConfig): StructurePack[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('invalid structure packs')
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== 'object') throw new Error('invalid structure pack')
    const pack = candidate as Partial<StructurePack>
    validateAxisLocks(pack.axisLocks)
    if (
      typeof pack.id !== 'string'
      || typeof pack.name !== 'string'
      || ![pack.x, pack.y, pack.z].every((position) => typeof position === 'number' && Number.isFinite(position))
      || !Array.isArray(pack.surfaces)
    ) throw new Error('invalid structure pack')
    const seen = new Set<string>()
    const surfaces = pack.surfaces.map((surfaceCandidate) => {
      if (!surfaceCandidate || typeof surfaceCandidate !== 'object') throw new Error('invalid structure surface')
      const surface = surfaceCandidate as Partial<StructureSurface>
      validateAxisLocks(surface.axisLocks)
      const validWall = surface.wall === 'north' || surface.wall === 'east' || surface.wall === 'south' || surface.wall === 'west'
      const defaultSurface = ['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west'].includes(surface.id ?? '')
        ? createStructureSurface(room, surface.id as StructureSurfaceKey)
        : null
      if (
        typeof surface.id !== 'string'
        || !['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west'].includes(surface.id)
        || typeof surface.name !== 'string'
        || !['wall', 'floor', 'ceiling'].includes(surface.kind ?? '')
        || ![surface.x, surface.y, surface.z].every((position) => typeof position === 'number' && Number.isFinite(position))
        || ![surface.width ?? defaultSurface?.width, surface.height ?? defaultSurface?.height, surface.depth ?? defaultSurface?.depth]
          .every((dimension) => typeof dimension === 'number' && Number.isFinite(dimension) && dimension > 0)
        || typeof (surface.rotation ?? 0) !== 'number' || !Number.isFinite(surface.rotation ?? 0)
        || typeof surface.color !== 'string'
        || seen.has(surface.id)
        || (surface.kind === 'wall' && (!validWall || surface.id !== `wall-${surface.wall}`))
        || (surface.kind !== 'wall' && surface.wall !== undefined)
        || (surface.id === 'floor' && surface.kind !== 'floor')
        || (surface.id === 'ceiling' && surface.kind !== 'ceiling')
      ) throw new Error('invalid structure surface')
      seen.add(surface.id)
      return {
        ...defaultSurface,
        ...surface,
        width: surface.width ?? defaultSurface!.width,
        height: surface.height ?? (surface.kind === 'floor' || surface.kind === 'ceiling' ? 0.125 : defaultSurface!.height),
        depth: surface.depth ?? (surface.kind === 'wall' ? 0.125 : defaultSurface!.depth),
        rotation: surface.rotation ?? 0,
      } as StructureSurface
    })
    const normalized = { ...pack, surfaces } as StructurePack
    const doorError = structureDoorError(normalized) || structureWindowError(normalized)
    if (doorError) throw new Error(doorError)
    return normalized
  })
}

export function normalizeDesignRoom(data: PersistedDesign): RoomConfig {
  const doorError = structureDoorError(rootDoorPack(data.room))
  if (doorError) throw new Error(doorError)
  validateAxisLocks(data.room.door.axisLocks)
  data.room.windows.forEach((window) => validateAxisLocks(window.axisLocks))
  const validName = (name: unknown) => typeof name === 'string' && name.trim() && name.trim().length <= 80 ? name.trim() : undefined
  const { name: doorName, ...door } = data.room.door
  return {
    ...data.room,
    wallColor: typeof data.room.wallColor === 'string' ? data.room.wallColor : DEFAULT_WALL_COLOR,
    wallColors: Object.fromEntries(WALL_SIDES.flatMap((wall) => {
      const color = data.room.wallColors?.[wall]
      return typeof color === 'string' ? [[wall, color]] : []
    })),
    floorColor: typeof data.room.floorColor === 'string' ? data.room.floorColor : DEFAULT_FLOOR_COLOR,
    door: {
      ...door,
      ...(data.version >= 2 && validName(doorName) ? { name: validName(doorName) } : {}),
      width: OPENING_CATALOG.door.width,
      height: OPENING_CATALOG.door.height,
      rotation: 0,
      color: typeof data.room.door.color === 'string' ? data.room.door.color : '#ac704b',
    },
    windows: data.room.windows.map((window) => {
      const { name: windowName, ...windowData } = window
      const shape = isWindowShape(window.shape) ? window.shape : 'rectangular'
      const definition = OPENING_CATALOG[openingKindForShape(shape)]
      return {
        ...windowData,
        ...(data.version >= 2 && validName(windowName) ? { name: validName(windowName) } : {}),
        shape,
        width: Number.isFinite(window.width) && window.width > 0 ? window.width : definition.width,
        height: Number.isFinite(window.height) && window.height > 0 ? window.height : definition.height,
        offset: Number.isFinite(window.offset) ? window.offset : 0,
        sill: typeof window.sill === 'number'
          ? window.sill
          : definition.defaultBottom,
        rotation: typeof window.rotation === 'number' ? window.rotation : 0,
        color: typeof window.color === 'string'
          ? window.color
          : isWallPictureShape(shape)
            ? FURNITURE_PRESETS[shape].color
            : isWallMirrorShape(shape)
              ? '#9a8067'
              : shape === 'wallSconce'
                ? '#d3a755'
              : '#c88f58',
      }
    }),
  }
}

export function normalizeDesignPreferences(data: PersistedDesign) {
  const elementFolders: import('./types').ElementFolder[] = Array.isArray(data.elementFolders)
    ? data.elementFolders.flatMap((folder) => (
      folder && typeof folder === 'object'
        && typeof folder.id === 'string' && folder.id.length > 0
        && typeof folder.name === 'string' && folder.name.trim().length > 0
        ? [{ id: folder.id, name: folder.name.trim().slice(0, 48) }]
        : []
    ))
    : []
  const folderIds = new Set(elementFolders.map((folder) => folder.id))
  if (data.version >= 3 && Array.isArray(data.elementFolders)) {
    const originals = new Map(data.elementFolders.filter((folder) => folder && typeof folder === 'object' && typeof folder.id === 'string').map((folder) => [folder.id, folder]))
    for (const folder of elementFolders) {
      const parentId = originals.get(folder.id)?.parentId
      if (typeof parentId !== 'string' || !folderIds.has(parentId)) continue
      const visited = new Set([folder.id])
      let current: string | undefined = parentId
      while (current && folderIds.has(current) && !visited.has(current)) {
        visited.add(current)
        current = originals.get(current)?.parentId
      }
      if (!current || !folderIds.has(current)) folder.parentId = parentId
    }
  }
  const elementFolderAssignments = Object.fromEntries(
    Object.entries(data.elementFolderAssignments ?? {}).filter(([, folderId]) => typeof folderId === 'string' && folderIds.has(folderId)),
  )
  return {
    gridSnap: typeof data.gridSnap === 'boolean' ? data.gridSnap : true,
    gridVisibility: (Object.keys(DEFAULT_GRID_VISIBILITY) as GridSurface[]).reduce<Record<GridSurface, boolean>>(
      (visibility, surface) => ({
        ...visibility,
        [surface]: typeof data.gridVisibility?.[surface] === 'boolean'
          ? data.gridVisibility[surface]
          : DEFAULT_GRID_VISIBILITY[surface],
      }),
      { ...DEFAULT_GRID_VISIBILITY },
    ),
    hiddenElementIds: Array.isArray(data.hiddenElementIds)
      ? data.hiddenElementIds.filter((id): id is string => typeof id === 'string')
      : [],
    lockedElementIds: Array.isArray(data.lockedElementIds)
      ? data.lockedElementIds.filter((id): id is string => typeof id === 'string')
      : [],
    elementFolders,
    elementFolderAssignments,
    sceneElementOrder: data.version >= 4 && Array.isArray(data.sceneElementOrder) ? [...new Set(data.sceneElementOrder.filter((id): id is string => typeof id === 'string' && id.length > 0))] : [],
  }
}
