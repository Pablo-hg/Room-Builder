import { WALL_SIDES } from '../domain/constants'
import { hiddenWallForCardinalTarget, hiddenWallsForOrientation, orientationForAzimuth, sideWallsForFrontView } from '../domain/geometry'
import type { ViewMode, WallSide } from '../domain/types'

interface WallVisibilityInput {
  view: ViewMode
  orientation: number
  wallView: WallSide | null
  freeAzimuth: number
  exportMode: boolean
}

export function wallVisibility(props: WallVisibilityInput) {
  let hidden: WallSide[] = []
  if (props.exportMode) hidden = []
  else if (props.view === 'top') hidden = ['north', 'east', 'south', 'west']
  else if (props.view === 'front') hidden = [hiddenWallForCardinalTarget(props.wallView ?? 'north')]
  else if (props.view === 'isometric') hidden = hiddenWallsForOrientation(props.orientation)
  else if (props.view === 'free') hidden = hiddenWallsForOrientation(orientationForAzimuth(props.freeAzimuth))
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
