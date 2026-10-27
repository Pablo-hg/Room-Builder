import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { isCeilingMountedFurniture, isFloorBoundFurniture, isWallPictureKind } from '../domain/objectCatalog'
import type { FurnitureItem, WallSide } from '../domain/types'
import { useRoomStore } from '../state/useRoomStore'
import { recordSceneInteraction } from './sceneInteraction'
import { usePointerCancellation } from './usePointerCancellation'

import { FurnitureModel } from './FurnitureModels'
import { AxisMoveGizmo, FrontAxisMoveGizmo, RotationHandle, FrontRotationHandle } from './FurnitureGizmos'

export function FurnitureObject({ item, selected, canDrag, planView, frontWall }: { item: FurnitureItem; selected: boolean; canDrag: boolean; planView: boolean; frontWall: WallSide | null }) {
  const selectElement = useRoomStore((state) => state.selectElement)
  const beginFurnitureMove = useRoomStore((state) => state.beginFurnitureMove)
  const endFurnitureMove = useRoomStore((state) => state.endFurnitureMove)
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const moveFurnitureVertically = useRoomStore((state) => state.moveFurnitureVertically)
  const { camera, size } = useThree()
  const [dragging, setDragging] = useState(false)
  const canMoveVertically = !isFloorBoundFurniture(item.kind)
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const point = useMemo(() => new THREE.Vector3(), [])
  const dragOffset = useRef({ x: 0, z: 0 })
  const frontDragStart = useRef({ clientX: 0, clientY: 0, x: item.x, y: item.y, z: item.z })

  const cancelDrag = () => {
    if (dragging) {
      recordSceneInteraction('furniture.drag-cancel', { id: item.id, name: item.name })
      endFurnitureMove()
    }
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
    selectElement(item.id)
    if (!canDrag) return
    if (frontWall !== null) {
      frontDragStart.current = {
        clientX: event.nativeEvent.clientX,
        clientY: event.nativeEvent.clientY,
        x: item.x,
        y: item.y,
        z: item.z,
      }
      beginFurnitureMove()
      setDragging(true)
      capturePointer(event)
      return
    }
    if (!event.ray.intersectPlane(floorPlane, point)) return
    dragOffset.current = { x: point.x - item.x, z: point.z - item.z }
    beginFurnitureMove()
    setDragging(true)
    capturePointer(event)
  }
  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging || !canDrag) return
    event.stopPropagation()
    if (frontWall !== null) {
      const worldPerPixel = camera instanceof THREE.OrthographicCamera
        ? (camera.right - camera.left) / camera.zoom / Math.max(size.width, 1)
        : 0.01
      const horizontalAxis = frontWall === 'north' || frontWall === 'south' ? 'x' : 'z'
      const horizontalSign = frontWall === 'south' || frontWall === 'west' ? -1 : 1
      const horizontalDelta = (event.nativeEvent.clientX - frontDragStart.current.clientX) * worldPerPixel * horizontalSign
      moveFurniture(
        item.id,
        horizontalAxis === 'x' ? frontDragStart.current.x + horizontalDelta : frontDragStart.current.x,
        horizontalAxis === 'z' ? frontDragStart.current.z + horizontalDelta : frontDragStart.current.z,
      )
      if (canMoveVertically && !isCeilingMountedFurniture(item.kind)) {
        moveFurnitureVertically(
          item.id,
          frontDragStart.current.y - (event.nativeEvent.clientY - frontDragStart.current.clientY) * worldPerPixel,
        )
      }
      return
    }
    if (event.ray.intersectPlane(floorPlane, point)) {
      moveFurniture(item.id, point.x - dragOffset.current.x, point.z - dragOffset.current.z)
    }
  }
  const handleUp = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    event.stopPropagation()
    const finalItem = useRoomStore.getState().furniture.find((candidate) => candidate.id === item.id)
    recordSceneInteraction('furniture.drag-end', {
      id: item.id,
      name: item.name,
      mode: frontWall ? 'front' : planView ? 'top' : undefined,
      x: finalItem?.x,
      y: finalItem?.y,
      z: finalItem?.z,
    })
    endFurnitureMove()
    setDragging(false)
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
  }

  return (
    <group position={[item.x, item.y + 0.02, item.z]}>
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
      </group>
      {selected && canDrag && !isWallPictureKind(item.kind) && (
        <>
          {frontWall
            ? <FrontAxisMoveGizmo item={item} wall={frontWall} />
            : <AxisMoveGizmo item={item} groundLevel={!canMoveVertically} canMoveVertically={canMoveVertically} />}
          {frontWall ? <FrontRotationHandle item={item} wall={frontWall} /> : <RotationHandle item={item} />}
        </>
      )}
    </group>
  )
}
