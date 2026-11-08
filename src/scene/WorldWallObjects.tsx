import { useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { wallObjectAvailableAxes, wallObjectBox, wallObjectPosition, wallObjectSelectionFrame, wallObjects } from '../domain/wallObjectPlacement'
import { boxOutsideBuilding } from '../domain/buildingVolume'
import { structureSurfaceElementId } from '../domain/elementIds'
import type { RoomConfig, StructurePack, WindowConfig } from '../domain/types'
import { moveFromOrigin } from '../domain/measurements'
import { useRoomStore } from '../state/useRoomStore'
import { OpeningDetail } from './Openings'
import { SelectionBounds } from './SelectionBounds'
import { WallObjectGizmo } from './WallObjectGizmo'
import { useHistoryGesture } from '../state/useHistoryGesture'
import { releasePointer, usePointerCancellation } from './usePointerCancellation'
import { selectSceneObject } from './sceneInteraction'

function WorldWallObject({ room, packs, window, pack, collision, exportMode }: { room: RoomConfig; packs: StructurePack[]; window: WindowConfig; pack?: StructurePack; collision: boolean; exportMode: boolean }) {
  const selected = useRoomStore((state) => state.selectedIds.includes(window.id))
  const multiple = useRoomStore((state) => state.selectedIds.length > 1)
  const locked = useRoomStore((state) => state.lockedElementIds.includes(window.id) || !!pack && state.lockedElementIds.includes(pack.id))
  const view = useRoomStore((state) => state.view)
  const move = useRoomStore((state) => state.moveWallObject)
  const { camera } = useThree()
  const gesture = useHistoryGesture(window.id)
  const selectionFrame = wallObjectSelectionFrame(room, window, pack)
  const position = selectionFrame.position
  const availableAxes = wallObjectAvailableAxes(room, window, pack)
  const movementLocks = { x: !availableAxes.x || !!window.axisLocks?.x, y: !availableAxes.y || !!window.axisLocks?.y, z: !availableAxes.z || !!window.axisLocks?.z }
  const drag = useRef<{ point: THREE.Vector3; plane: THREE.Plane; origin: typeof position; offset: number; sill: number; vertical: boolean } | null>(null)
  const end = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    drag.current = null
    gesture.commit()
    document.body.classList.remove('can-grab')
    releasePointer(event)
  }
  const capture = usePointerCancellation((event) => { gesture.cancel(); end(event) })
  const start = (event: ThreeEvent<PointerEvent>) => {
    if (exportMode) return
    event.stopPropagation()
    if (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey || event.nativeEvent.shiftKey && !selected) { selectSceneObject(window.id, event.nativeEvent); return }
    if (!selected) { useRoomStore.getState().selectElement(window.id); return }
    if (multiple) { useRoomStore.getState().selectElement(window.id); return }
    if (locked || view === 'pov' || event.button !== 0) return
    const vertical = event.nativeEvent.shiftKey
    const normal = vertical || view === 'front' ? camera.getWorldDirection(new THREE.Vector3()) : new THREE.Vector3(0, 1, 0)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(position.x, position.y + window.height / 2, position.z))
    const point = event.ray.intersectPlane(plane, new THREE.Vector3())
    if (!point) return
    drag.current = { point, plane, origin: position, offset: window.offset, sill: window.sill, vertical }
    gesture.begin()
    capture(event)
    document.body.classList.add('can-grab')
  }
  const moving = (event: ThreeEvent<PointerEvent>) => {
    const current = drag.current
    if (!current || !gesture.isActive()) return
    event.stopPropagation()
    const point = event.ray.intersectPlane(current.plane, new THREE.Vector3())
    if (!point) return
    const delta = point.sub(current.point)
    if (!window.freePosition && !availableAxes.x && !availableAxes.z) {
      useRoomStore.getState().updateWindow(window.id, {
        ...(!current.vertical ? { offset: moveFromOrigin(current.offset + delta.x * Math.cos(current.origin.yaw) - delta.z * Math.sin(current.origin.yaw), current.offset) } : {}),
        ...(current.vertical || view === 'front' ? { sill: moveFromOrigin(current.sill + delta.y, current.sill) } : {}),
      })
      return
    }
    for (const axis of ['x', 'y', 'z'] as const) {
      if (!availableAxes[axis]) continue
      if (current.vertical && axis !== 'y') continue
      if (!current.vertical && view !== 'front' && axis === 'y') continue
      move(window.id, axis, moveFromOrigin(current.origin[axis] + delta[axis], current.origin[axis]))
    }
  }
  const outside = !!window.freePosition && boxOutsideBuilding({ room, structurePacks: packs }, wallObjectBox(room, window, pack))
  return <>
    <group position={[position.x, position.y, position.z]} rotation={[0, position.yaw, 0]} onPointerDown={start} onPointerMove={moving} onPointerUp={end} onPointerCancel={(event) => { gesture.cancel(); end(event) }}>
      {view === 'top' && !exportMode ? <mesh position={[0, window.height / 2, 0.05]}><boxGeometry args={[window.width, 0.04, window.shape === 'wallShelf' ? 0.3 : 0.18]} /><meshBasicMaterial color={window.color ?? '#c88f58'} /></mesh>
        : <OpeningDetail room={room} opening={{ ...window, kind: 'window', offset: 0, bottom: 0, color: window.color ?? '#c88f58' }} wall={window.wall} selected={false} locked interactive={false} />}
      {!exportMode && (selected || collision || outside) && <group position={selectionFrame.localCenter} rotation={[0, 0, window.rotation]}><SelectionBounds width={window.width} height={window.height} depth={selectionFrame.depth} collision={collision || outside} /></group>}
    </group>
    {!exportMode && selected && !multiple && !locked && view !== 'pov' && <WallObjectGizmo id={window.id} position={position} anchor={selectionFrame.handleBase} height={window.height} locks={movementLocks} />}
  </>
}

export function WorldWallObjects({ room, structurePacks, collisionIds, exportMode, level, levelHeight, focusedView }: { room: RoomConfig; structurePacks: StructurePack[]; collisionIds: ReadonlySet<string>; exportMode: boolean; level: number; levelHeight: number; focusedView: boolean }) {
  const hidden = useRoomStore((state) => state.hiddenElementIds)
  const selected = useRoomStore((state) => state.selectedIds)
  return <>{wallObjects({ room, structurePacks }).filter(({ window, pack }) => {
    if (hidden.includes(window.id) || pack && hidden.includes(pack.id)) return false
    if (!window.freePosition && hidden.includes(pack ? structureSurfaceElementId(pack.id, `wall-${window.wall}`) : `room-wall:${window.wall}`)) return false
    const position = wallObjectPosition(room, window, pack)
    return !focusedView || selected.includes(window.id) || position.y + window.height > level - 0.01 && position.y < level + levelHeight
  }).map(({ window, pack }) => <WorldWallObject key={window.id} room={room} packs={structurePacks} window={window} pack={pack} collision={collisionIds.has(window.id)} exportMode={exportMode} />)}</>
}
