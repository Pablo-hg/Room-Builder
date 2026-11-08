import { WALL_SIDES } from './constants'
import { baseWallId } from './elementFolders'
import { structureSurfaceElementId } from './elementIds'
import { hiddenWallsForView } from './geometry'
import type { RoomState } from '../state/types'

type PlacementState = Pick<RoomState, 'view' | 'isoOrientation' | 'wallView' | 'freeAzimuth' | 'hiddenElementIds' | 'lockedElementIds' | 'activeRoomId' | 'structurePacks'>

/** Visible usable walls first; camera-hidden walls are only a fallback. */
export function windowPlacementWalls(state: PlacementState) {
  const pack = state.structurePacks.find((item) => item.id === state.activeRoomId && item.id.startsWith('floor-pack-'))
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
