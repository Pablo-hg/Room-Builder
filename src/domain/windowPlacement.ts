import { WALL_SIDES } from './constants'
import { baseWallId } from './elementFolders'
import { structureSurfaceElementId } from './elementIds'
import { hiddenWallsForView } from './geometry'
import type { RoomState } from '../state/types'

type PlacementState = Pick<RoomState, 'view' | 'isoOrientation' | 'wallView' | 'freeAzimuth' | 'hiddenElementIds' | 'lockedElementIds' | 'activeRoomId' | 'structurePacks'> & Partial<Pick<RoomState, 'selectedId'>>

/** An explicitly selected independent wall is also a valid creation support. */
export function openingCreationPack(state: Pick<PlacementState, 'activeRoomId' | 'structurePacks' | 'selectedId'>) {
  return state.structurePacks.find((pack) => !pack.id.startsWith('floor-pack-')
    && pack.surfaces.some((surface) => surface.kind === 'wall' && (state.selectedId === pack.id || state.selectedId === structureSurfaceElementId(pack.id, surface.id))))
    ?? state.structurePacks.find((pack) => pack.id === state.activeRoomId && pack.id.startsWith('floor-pack-'))
}

/** Visible usable walls first; camera-hidden walls are only a fallback. */
export function windowPlacementWalls(state: PlacementState) {
  const pack = openingCreationPack(state)
  if (pack && (state.hiddenElementIds.includes(pack.id) || state.lockedElementIds.includes(pack.id))) return []
  // In plan view the wall outlines are visible although the tall wall meshes are hidden.
  const hiddenByCamera = state.view === 'top' ? [] : hiddenWallsForView(state.view, state.isoOrientation, state.wallView, state.freeAzimuth)
  const candidates = WALL_SIDES.flatMap((wall) => {
    const surface = pack?.surfaces.find((item) => item.kind === 'wall' && item.wall === wall)
    if (pack && !surface) return []
    const id = pack ? structureSurfaceElementId(pack.id, surface!.id) : baseWallId(wall)
    if (state.hiddenElementIds.includes(id) || state.lockedElementIds.includes(id)) return []
    return [{ wall, visible: !hiddenByCamera.includes(wall) }]
  })
  const rank = (candidate: typeof candidates[number]) => !candidate.visible ? 2 : state.view === 'front' && candidate.wall === (state.wallView ?? 'north') ? 0 : 1
  return candidates.sort((first, second) => rank(first) - rank(second))
}
