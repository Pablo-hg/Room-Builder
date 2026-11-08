import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { canElevateFurniture, furnitureVisualYOffset, hasUsefulFurnitureRotation, isWallPictureKind } from '../domain/objectCatalog'
import type { FurnitureItem, WallSide } from '../domain/types'
import { useHistoryGesture } from '../state/useHistoryGesture'
import { useRoomStore } from '../state/useRoomStore'
import { recordSceneInteraction, selectSceneObject } from './sceneInteraction'
import { releasePointer, usePointerCancellation } from './usePointerCancellation'

import { moveFromOrigin, snapMovement } from '../domain/measurements'
import { FurnitureModel } from './FurnitureModels'
import { AxisMoveGizmo, FrontAxisMoveGizmo, RotationHandle, FrontRotationHandle } from './FurnitureGizmos'
import { SelectionBounds } from './SelectionBounds'
import { furnitureHasSpatialWarning } from '../domain/structureCollisions'
import { cameraAwareShiftDrag } from './cameraAwareShiftDrag'

export function FurnitureObject({ item, selected, outlined, canDrag, planView, frontWall, showCollision = true, colliding = false }: { item: FurnitureItem; selected: boolean; outlined: boolean; canDrag: boolean; planView: boolean; frontWall: WallSide | null; showCollision?: boolean; colliding?: boolean }) {
  const gesture = useHistoryGesture(item.id)
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const moveFurnitureVertically = useRoomStore((state) => state.moveFurnitureVertically)
  const spatialWarning = useRoomStore((state) => showCollision && furnitureHasSpatialWarning(state, item))
  const collision = spatialWarning || colliding
  const { camera, size } = useThree()
  const [dragging, setDragging] = useState(false)
  const canMoveVertically = canElevateFurniture(item)
  const room = useRoomStore((state) => state.room)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const visualY = item.y + furnitureVisualYOffset(item, { room, structurePacks })
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -visualY), [visualY])
  const point = useMemo(() => new THREE.Vector3(), [])
  const dragOffset = useRef({ x: 0, z: 0 })
  const dragOrigin = useRef({ x: item.x, z: item.z })
  const shiftClickPending = useRef(false)
  const frontDragStart = useRef({ clientX: 0, clientY: 0, x: item.x, y: item.y, z: item.z })

  const cancelDrag = () => {
    if (dragging) {
      recordSceneInteraction('furniture.drag-cancel', { id: item.id, name: item.name })
      gesture.cancel()
    }
    shiftClickPending.current = false
    setDragging(false)
  }

  const capturePointer = usePointerCancellation(cancelDrag)

  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    recordSceneInteraction('furniture.pointer-down', {
      id: item.id,
      kind: item.kind,
      name: item.name,
      canDrag,
      selectedBefore: selected,
      pointerId: event.pointerId,
      intersectionCount: event.intersections.length,
      hitObjectType: event.object.type,
      x: Math.round(event.nativeEvent.clientX),
      y: Math.round(event.nativeEvent.clientY),
    })
    shiftClickPending.current = event.nativeEvent.shiftKey && !event.nativeEvent.ctrlKey && !event.nativeEvent.metaKey
    if (!shiftClickPending.current && selectSceneObject(item.id, event.nativeEvent)) return
    if (!canDrag) {
      if (shiftClickPending.current) selectSceneObject(item.id, event.nativeEvent)
      shiftClickPending.current = false
      return
    }
    frontDragStart.current = { clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY, x: item.x, y: item.y, z: item.z }
    if (frontWall !== null) {
      frontDragStart.current = {
        clientX: event.nativeEvent.clientX,
        clientY: event.nativeEvent.clientY,
        x: item.x,
        y: item.y,
        z: item.z,
      }
      gesture.begin()
      setDragging(true)
      capturePointer(event)
      return
    }
    const intersectsFloor = event.ray.intersectPlane(floorPlane, point) !== null
    if (!intersectsFloor && !shiftClickPending.current) return
    dragOffset.current = intersectsFloor ? { x: point.x - item.x, z: point.z - item.z } : { x: 0, z: 0 }
    dragOrigin.current = { x: item.x, z: item.z }
    gesture.begin()
    setDragging(true)
    capturePointer(event)
  }
  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging || !canDrag || !gesture.isActive()) return
    event.stopPropagation()
    if (shiftClickPending.current) {
      const start = frontDragStart.current
      if (Math.hypot(event.nativeEvent.clientX - start.clientX, event.nativeEvent.clientY - start.clientY) < 4) return
      shiftClickPending.current = false
      useRoomStore.getState().selectElement(item.id)
    }
    if (event.nativeEvent.shiftKey) {
      const start = frontDragStart.current
      const projected = cameraAwareShiftDrag(camera, size, { clientX: start.clientX, clientY: start.clientY, position: { x: start.x, y: start.y, z: start.z } }, event.nativeEvent)
      moveFurniture(item.id, moveFromOrigin(projected.x, start.x), moveFromOrigin(projected.z, start.z))
      if (canMoveVertically) moveFurnitureVertically(item.id, moveFromOrigin(projected.y, start.y))
      return
    }
    if (frontWall !== null) {
      const worldPerPixel = camera instanceof THREE.OrthographicCamera
        ? (camera.right - camera.left) / camera.zoom / Math.max(size.width, 1)
        : 0.01
      const horizontalAxis = frontWall === 'north' || frontWall === 'south' ? 'x' : 'z'
      const horizontalSign = frontWall === 'south' || frontWall === 'west' ? -1 : 1
      const horizontalDelta = snapMovement((event.nativeEvent.clientX - frontDragStart.current.clientX) * worldPerPixel * horizontalSign)
      moveFurniture(
        item.id,
        horizontalAxis === 'x' ? frontDragStart.current.x + horizontalDelta : frontDragStart.current.x,
        horizontalAxis === 'z' ? frontDragStart.current.z + horizontalDelta : frontDragStart.current.z,
      )
      if (canMoveVertically) {
        moveFurnitureVertically(
          item.id,
          frontDragStart.current.y + snapMovement(-(event.nativeEvent.clientY - frontDragStart.current.clientY) * worldPerPixel),
        )
      }
      return
    }
    if (event.ray.intersectPlane(floorPlane, point)) {
      moveFurniture(item.id, moveFromOrigin(point.x - dragOffset.current.x, dragOrigin.current.x), moveFromOrigin(point.z - dragOffset.current.z, dragOrigin.current.z))
    }
  }
  const handleUp = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    event.stopPropagation()
    const shiftClick = shiftClickPending.current
    shiftClickPending.current = false
    if (shiftClick) useRoomStore.getState().selectSceneListItem(item.id, 'toggle', [item.id])
    const finalItem = useRoomStore.getState().furniture.find((candidate) => candidate.id === item.id)
    recordSceneInteraction('furniture.drag-end', {
      id: item.id,
      name: item.name,
      mode: frontWall ? 'front' : planView ? 'top' : undefined,
      x: finalItem?.x,
      y: finalItem?.y,
      z: finalItem?.z,
    })
    gesture.commit()
    setDragging(false)
    releasePointer(event)
  }

  return (
    <group position={[item.x, visualY, item.z]}>
      <group
        rotation={[0, item.rotation, 0]}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={cancelDrag}
        onPointerOver={() => { if (canDrag) document.body.classList.add('can-grab') }}
        onPointerOut={() => document.body.classList.remove('can-grab')}
      >
        <mesh position={[0, item.height / 2, 0]}>
          <boxGeometry args={[item.width, item.height, item.depth]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
        <FurnitureModel item={item} />
        {(outlined || collision) && <group position={[0, item.height / 2, 0]}><SelectionBounds width={item.width} height={item.height} depth={item.depth} collision={collision} /></group>}
      </group>
      {selected && canDrag && !isWallPictureKind(item.kind) && (
        <>
          {frontWall
            ? <FrontAxisMoveGizmo item={item} wall={frontWall} />
            : <AxisMoveGizmo item={item} groundLevel={!canMoveVertically} canMoveVertically={canMoveVertically} hideAxis={planView ? 'y' : null} />}
          {hasUsefulFurnitureRotation(item.kind, item) && (frontWall ? <FrontRotationHandle item={item} wall={frontWall} /> : <RotationHandle item={item} />)}
        </>
      )}
    </group>
  )
}
