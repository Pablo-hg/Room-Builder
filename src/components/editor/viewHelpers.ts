import { orientationForAzimuth, visibleWallsForOrientation } from '../../domain/geometry'
import type { ViewMode, WallSide } from '../../domain/types'

export function visibleWallsForView(view: ViewMode, orientation: number, wallView: WallSide | null, freeAzimuth: number): WallSide[] {
  if (view === 'isometric') return visibleWallsForOrientation(orientation)
  if (view === 'free') return visibleWallsForOrientation(orientationForAzimuth(freeAzimuth))
  if (view === 'front') return [wallView ?? 'north']
  if (view === 'top') return []
  return []
}

