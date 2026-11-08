import { WALL_SIDES } from '../domain/constants'
import { hiddenWallsForView, sideWallsForFrontView } from '../domain/geometry'
import type { ViewMode, WallSide } from '../domain/types'

interface WallVisibilityInput {
  view: ViewMode
  orientation: number
  wallView: WallSide | null
  freeAzimuth: number
  exportMode: boolean
}

export function wallVisibility(props: WallVisibilityInput) {
  const hidden = hiddenWallsForView(props.view, props.orientation, props.wallView, props.freeAzimuth, props.exportMode)
  const frontSideWalls = sideWallsForFrontView(props.wallView ?? 'north')
  const frontWalls = [props.wallView ?? 'north', frontSideWalls.left, frontSideWalls.right]
  const labeledWalls = props.exportMode ? [] : props.view === 'front'
    ? frontWalls
    : props.view === 'isometric' || props.view === 'free'
      ? WALL_SIDES.filter((wall) => !hidden.includes(wall))
      : WALL_SIDES
  const gridWalls = props.exportMode
    ? []
    : props.view === 'front'
      ? frontWalls
      : props.view === 'isometric' || props.view === 'free'
        ? WALL_SIDES.filter((wall) => !hidden.includes(wall))
        : []

  return { hidden, labeledWalls, gridWalls }
}
