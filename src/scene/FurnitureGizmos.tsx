import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { snapFurnitureRotation } from '../domain/geometry'
import { isCeilingMountedFurniture, isFloorBoundFurniture } from '../domain/objectCatalog'
import type { FurnitureItem, WallSide } from '../domain/types'
import { useRoomStore } from '../state/useRoomStore'
import { recordSceneInteraction } from './sceneInteraction'

type FloorMoveAxis = 'x' | 'y' | 'z'

export function RotationHandle({ item }: { item: FurnitureItem }) {
  const setFurnitureRotation = useRoomStore((state) => state.setFurnitureRotation)
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const point = useMemo(() => new THREE.Vector3(), [])
  const lastPointerAngle = useRef(0)
  const targetRotation = useRef(item.rotation)
  const radius = Math.hypot(item.width, item.depth) / 2 + 0.12
  const halfStroke = 0.042

  const pointerAngle = (event: ThreeEvent<PointerEvent>) => {
    if (!event.ray.intersectPlane(floorPlane, point)) return null
    return Math.atan2(point.x - item.x, point.z - item.z)
  }

  const startRotation = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    const angle = pointerAngle(event)
    if (angle === null) return
    recordSceneInteraction('furniture.rotation-start', { id: item.id, name: item.name, mode: 'floor', rotation: item.rotation, shiftKey: event.nativeEvent.shiftKey })
    lastPointerAngle.current = angle
    targetRotation.current = item.rotation
    setDragging(true)
    document.body.classList.add('can-grab')
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
  }

  const rotate = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    event.stopPropagation()
    const angle = pointerAngle(event)
    if (angle === null) return
    const delta = Math.atan2(
      Math.sin(angle - lastPointerAngle.current),
      Math.cos(angle - lastPointerAngle.current),
    )
    targetRotation.current += delta
    lastPointerAngle.current = angle
    const nextRotation = event.nativeEvent.shiftKey
      ? targetRotation.current
      : snapFurnitureRotation(targetRotation.current)
    setFurnitureRotation(item.id, nextRotation)
  }

  const stopRotation = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    event.stopPropagation()
    const finalItem = useRoomStore.getState().furniture.find((candidate) => candidate.id === item.id)
    recordSceneInteraction('furniture.rotation-end', { id: item.id, name: item.name, mode: 'floor', rotation: finalItem?.rotation })
    setDragging(false)
    document.body.classList.remove('can-grab')
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
  }

  const events = {
    onPointerDown: startRotation,
    onPointerMove: rotate,
    onPointerUp: stopRotation,
    onPointerCancel: stopRotation,
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setHovered(true)
      document.body.classList.add('can-grab')
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setHovered(false)
      if (!dragging) document.body.classList.remove('can-grab')
    },
  }
  const color = dragging ? '#c63d2c' : hovered ? '#ff8a63' : '#ea6f4c'
  const indicatorX = Math.sin(item.rotation) * radius
  const indicatorY = -Math.cos(item.rotation) * radius
  const indicatorAngle = Math.atan2(indicatorX, indicatorY)

  return (
    <group {...events} position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh renderOrder={4}>
        <ringGeometry args={[radius - halfStroke, radius + halfStroke, 64]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} depthTest depthWrite={false} toneMapped={false} />
      </mesh>
      {dragging && (
        <mesh renderOrder={3}>
          <ringGeometry args={[radius - 0.082, radius + 0.082, 64]} />
          <meshBasicMaterial color="#ff9b78" transparent opacity={0.3} side={THREE.DoubleSide} depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh renderOrder={3}>
        <ringGeometry args={[radius - 0.075, radius + 0.075, 64]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[indicatorX, indicatorY, 0.018]} rotation={[0, 0, -indicatorAngle]} renderOrder={6}>
        <boxGeometry args={[0.045, 0.2, 0.04]} />
        <meshBasicMaterial color="#9f3f31" depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function FrontRotationHandle({ item, wall }: { item: FurnitureItem; wall: WallSide }) {
  const setFurnitureRotation = useRoomStore((state) => state.setFurnitureRotation)
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const point = useMemo(() => new THREE.Vector3(), [])
  const wheelHeight = -0.42
  const center = useMemo(() => new THREE.Vector3(item.x, wheelHeight, item.z), [item.x, item.z, wheelHeight])
  const plane = useMemo(() => {
    const normal = wall === 'north' || wall === 'south'
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(1, 0, 0)
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center)
  }, [center, wall])
  const lastPointerAngle = useRef(0)
  const targetRotation = useRef(item.rotation)
  const radius = 0.46
  const wheelScaleY = 0.38
  const halfStroke = 0.042
  const ringRotation: [number, number, number] = wall === 'east' || wall === 'west' ? [0, Math.PI / 2, 0] : [0, 0, 0]
  const indicatorRadius = radius - 0.025
  const indicatorX = Math.sin(item.rotation) * indicatorRadius
  const indicatorY = Math.cos(item.rotation) * indicatorRadius * wheelScaleY
  const indicatorLength = Math.hypot(indicatorX, indicatorY)
  const indicatorAngle = Math.atan2(indicatorX, indicatorY)

  const pointerAngle = (event: ThreeEvent<PointerEvent>) => {
    if (!event.ray.intersectPlane(plane, point)) return null
    const screenX = wall === 'north'
      ? point.x - item.x
      : wall === 'south'
        ? item.x - point.x
        : wall === 'east'
          ? point.z - item.z
          : item.z - point.z
    return Math.atan2(screenX, (point.y - center.y) / wheelScaleY)
  }

  const startRotation = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    const angle = pointerAngle(event)
    if (angle === null) return
    recordSceneInteraction('furniture.rotation-start', { id: item.id, name: item.name, mode: 'front', wall, rotation: item.rotation, shiftKey: event.nativeEvent.shiftKey })
    lastPointerAngle.current = angle
    targetRotation.current = item.rotation
    setDragging(true)
    document.body.classList.add('can-grab')
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
  }

  const rotate = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    event.stopPropagation()
    const angle = pointerAngle(event)
    if (angle === null) return
    const delta = Math.atan2(
      Math.sin(angle - lastPointerAngle.current),
      Math.cos(angle - lastPointerAngle.current),
    )
    targetRotation.current += delta
    lastPointerAngle.current = angle
    setFurnitureRotation(item.id, targetRotation.current)
  }

  const stopRotation = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    event.stopPropagation()
    const finalItem = useRoomStore.getState().furniture.find((candidate) => candidate.id === item.id)
    recordSceneInteraction('furniture.rotation-end', { id: item.id, name: item.name, mode: 'front', wall, rotation: finalItem?.rotation })
    setDragging(false)
    document.body.classList.remove('can-grab')
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
  }

  const events = {
    onPointerDown: startRotation,
    onPointerMove: rotate,
    onPointerUp: stopRotation,
    onPointerCancel: stopRotation,
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setHovered(true)
      document.body.classList.add('can-grab')
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setHovered(false)
      if (!dragging) document.body.classList.remove('can-grab')
    },
  }
  const color = dragging ? '#c63d2c' : hovered ? '#ff8a63' : '#ea6f4c'

  return (
    <group {...events} position={[0, wheelHeight, 0]} rotation={ringRotation}>
      <mesh renderOrder={9} scale={[1, wheelScaleY, 1]}>
        <ringGeometry args={[radius - halfStroke, radius + halfStroke, 64]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {dragging && (
        <mesh renderOrder={8} scale={[1, wheelScaleY, 1]}>
          <ringGeometry args={[radius - 0.082, radius + 0.082, 64]} />
          <meshBasicMaterial color="#ff9b78" transparent opacity={0.3} side={THREE.DoubleSide} depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh renderOrder={8} scale={[1, wheelScaleY, 1]}>
        <ringGeometry args={[radius - 0.075, radius + 0.075, 64]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh
        position={[indicatorX / 2, indicatorY / 2, 0.018]}
        rotation={[0, 0, -indicatorAngle]}
        renderOrder={11}
      >
        <boxGeometry args={[0.045, indicatorLength, 0.035]} />
        <meshBasicMaterial color="#9f3f31" depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function AxisMoveGizmo({ item, groundLevel = false, hideAxis = null, canMoveVertically = true }: { item: FurnitureItem; groundLevel?: boolean; hideAxis?: FloorMoveAxis | null; canMoveVertically?: boolean }) {
  const beginFurnitureMove = useRoomStore((state) => state.beginFurnitureMove)
  const endFurnitureMove = useRoomStore((state) => state.endFurnitureMove)
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const moveFurnitureVertically = useRoomStore((state) => state.moveFurnitureVertically)
  const { camera, size } = useThree()
  const [draggingAxis, setDraggingAxis] = useState<FloorMoveAxis | null>(null)
  const [hoveredAxis, setHoveredAxis] = useState<FloorMoveAxis | null>(null)
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const point = useMemo(() => new THREE.Vector3(), [])
  const dragOffset = useRef(0)
  const screenDrag = useRef<{ axis: FloorMoveAxis; clientX: number; clientY: number; x: number; y: number; z: number } | null>(null)
  const ringRadius = Math.hypot(item.width, item.depth) / 2 + 0.12
  const coneHeight = 0.24
  const tipDistance = ringRadius - 0.055
  const coneCenter = tipDistance - coneHeight / 2
  const shaftLength = Math.max(0.08, tipDistance - coneHeight)

  const startDrag = (axis: FloorMoveAxis, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (axis === 'y') {
      screenDrag.current = {
        axis,
        clientX: event.nativeEvent.clientX,
        clientY: event.nativeEvent.clientY,
        x: item.x,
        y: item.y,
        z: item.z,
      }
    } else if (!event.ray.intersectPlane(floorPlane, point)) {
      if (!groundLevel) return
      screenDrag.current = {
        axis,
        clientX: event.nativeEvent.clientX,
        clientY: event.nativeEvent.clientY,
        x: item.x,
        y: item.y,
        z: item.z,
      }
    } else {
      screenDrag.current = null
      dragOffset.current = axis === 'x' ? point.x - item.x : point.z - item.z
    }
    recordSceneInteraction('furniture.axis-drag-start', { id: item.id, name: item.name, axis, x: item.x, y: item.y, z: item.z })
    beginFurnitureMove()
    setDraggingAxis(axis)
    document.body.classList.add('can-grab')
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
  }

  const drag = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingAxis) return
    event.stopPropagation()
    const fallback = screenDrag.current
    if (fallback) {
      const worldPerPixel = camera instanceof THREE.OrthographicCamera
        ? (camera.right - camera.left) / camera.zoom / Math.max(size.width, 1)
        : 0.01
      const pixels = fallback.axis === 'x'
        ? event.nativeEvent.clientX - fallback.clientX
        : fallback.clientY - event.nativeEvent.clientY
      const delta = pixels * worldPerPixel
      if (fallback.axis === 'x') moveFurniture(item.id, fallback.x + delta, fallback.z)
      else if (fallback.axis === 'y') moveFurnitureVertically(item.id, fallback.y + delta)
      else moveFurniture(item.id, fallback.x, fallback.z + delta)
      return
    }
    if (!event.ray.intersectPlane(floorPlane, point)) return
    if (draggingAxis === 'x') moveFurniture(item.id, point.x - dragOffset.current, item.z)
    else if (draggingAxis === 'z') moveFurniture(item.id, item.x, point.z - dragOffset.current)
  }

  const stopDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingAxis) return
    event.stopPropagation()
    const finalItem = useRoomStore.getState().furniture.find((candidate) => candidate.id === item.id)
    recordSceneInteraction('furniture.axis-drag-end', { id: item.id, name: item.name, axis: draggingAxis, x: finalItem?.x, y: finalItem?.y, z: finalItem?.z })
    endFurnitureMove()
    setDraggingAxis(null)
    screenDrag.current = null
    document.body.classList.remove('can-grab')
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
  }

  const axisMaterial = (axis: FloorMoveAxis, color: string, activeColor: string) => (
    <meshBasicMaterial
      color={hoveredAxis === axis || draggingAxis === axis ? activeColor : color}
      depthTest={false}
      depthWrite={false}
      toneMapped={false}
    />
  )

  const axisEvents = (axis: FloorMoveAxis) => ({
    onPointerDown: (event: ThreeEvent<PointerEvent>) => startDrag(axis, event),
    onPointerMove: drag,
    onPointerUp: stopDrag,
    onPointerCancel: stopDrag,
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setHoveredAxis(axis)
      document.body.classList.add('can-grab')
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setHoveredAxis((current) => current === axis ? null : current)
      if (!draggingAxis) document.body.classList.remove('can-grab')
    },
  })

  return (
    <group position={[0, groundLevel ? 0.085 : item.height + 0.2, 0]}>
      {hideAxis !== 'x' && <group {...axisEvents('x')}>
        {([-1, 1] as const).map((direction) => (
          <group key={direction}>
            <mesh position={[direction * shaftLength / 2, 0, 0]} renderOrder={8}>
              <boxGeometry args={[shaftLength, 0.055, 0.055]} />
              {axisMaterial('x', '#d85243', '#ff6a54')}
            </mesh>
            <mesh
              position={[direction * coneCenter, 0, 0]}
              rotation={[0, 0, direction * -Math.PI / 2]}
              renderOrder={8}
            >
              <coneGeometry args={[0.115, coneHeight, 20]} />
              {axisMaterial('x', '#d85243', '#ff6a54')}
            </mesh>
          </group>
        ))}
      </group>}
      {hideAxis !== 'z' && <group {...axisEvents('z')}>
        {([-1, 1] as const).map((direction) => (
          <group key={direction}>
            <mesh position={[0, 0, direction * shaftLength / 2]} renderOrder={8}>
              <boxGeometry args={[0.055, 0.055, shaftLength]} />
              {axisMaterial('z', '#34876f', '#46b98f')}
            </mesh>
            <mesh
              position={[0, 0, direction * coneCenter]}
              rotation={[direction * Math.PI / 2, 0, 0]}
              renderOrder={8}
            >
              <coneGeometry args={[0.115, coneHeight, 20]} />
              {axisMaterial('z', '#34876f', '#46b98f')}
            </mesh>
          </group>
        ))}
      </group>}
      {hideAxis !== 'y' && canMoveVertically && <group {...axisEvents('y')}>
        {([-1, 1] as const).map((direction) => (
          <group key={direction}>
            <mesh position={[0, direction * shaftLength / 2, 0]} renderOrder={8}>
              <boxGeometry args={[0.055, shaftLength, 0.055]} />
              {axisMaterial('y', '#4d75d8', '#7197ff')}
            </mesh>
            <mesh
              position={[0, direction * coneCenter, 0]}
              rotation={[direction < 0 ? Math.PI : 0, 0, 0]}
              renderOrder={8}
            >
              <coneGeometry args={[0.115, coneHeight, 20]} />
              {axisMaterial('y', '#4d75d8', '#7197ff')}
            </mesh>
          </group>
        ))}
      </group>}
    </group>
  )
}

export function FrontAxisMoveGizmo({ item, wall }: { item: FurnitureItem; wall: WallSide }) {
  const beginFurnitureMove = useRoomStore((state) => state.beginFurnitureMove)
  const endFurnitureMove = useRoomStore((state) => state.endFurnitureMove)
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const moveFurnitureVertically = useRoomStore((state) => state.moveFurnitureVertically)
  const { camera, size } = useThree()
  const [draggingAxis, setDraggingAxis] = useState<'horizontal' | 'vertical' | null>(null)
  const [hoveredAxis, setHoveredAxis] = useState<'horizontal' | 'vertical' | null>(null)
  const canMoveVertically = !isFloorBoundFurniture(item.kind) && !isCeilingMountedFurniture(item.kind)
  const dragStart = useRef({ clientX: 0, clientY: 0, x: item.x, y: item.y, z: item.z })
  const horizontalAxis = wall === 'north' || wall === 'south' ? 'x' : 'z'
  const horizontalSign = wall === 'south' || wall === 'west' ? -1 : 1
  const planeRotation: [number, number, number] = wall === 'north'
    ? [0, 0, 0]
    : wall === 'south'
      ? [0, Math.PI, 0]
      : wall === 'east'
        ? [0, -Math.PI / 2, 0]
        : [0, Math.PI / 2, 0]
  const coneHeight = 0.3
  const axisLength = Math.max(0.72, Math.min(1.05, Math.hypot(item.width, item.depth) / 2 + 0.22))
  const shaftLength = Math.max(0.28, axisLength - coneHeight)
  const coneCenter = axisLength - coneHeight / 2

  const worldPerPixel = () => camera instanceof THREE.OrthographicCamera
    ? (camera.right - camera.left) / camera.zoom / Math.max(size.width, 1)
    : 0.01

  const startDrag = (axis: 'horizontal' | 'vertical', event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    dragStart.current = {
      clientX: event.nativeEvent.clientX,
      clientY: event.nativeEvent.clientY,
      x: item.x,
      y: item.y,
      z: item.z,
    }
    recordSceneInteraction('furniture.axis-drag-start', {
      id: item.id,
      name: item.name,
      axis: axis === 'horizontal' ? horizontalAxis : 'y',
      mode: 'front',
      wall,
      x: item.x,
      y: item.y,
      z: item.z,
    })
    beginFurnitureMove()
    setDraggingAxis(axis)
    document.body.classList.add('can-grab')
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
  }

  const drag = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingAxis) return
    event.stopPropagation()
    const deltaX = event.nativeEvent.clientX - dragStart.current.clientX
    const deltaY = event.nativeEvent.clientY - dragStart.current.clientY
    if (draggingAxis === 'horizontal') {
      const delta = deltaX * worldPerPixel() * horizontalSign
      moveFurniture(
        item.id,
        horizontalAxis === 'x' ? dragStart.current.x + delta : dragStart.current.x,
        horizontalAxis === 'z' ? dragStart.current.z + delta : dragStart.current.z,
      )
    } else {
      moveFurnitureVertically(item.id, dragStart.current.y - deltaY * worldPerPixel())
    }
  }

  const stopDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingAxis) return
    event.stopPropagation()
    const finalItem = useRoomStore.getState().furniture.find((candidate) => candidate.id === item.id)
    recordSceneInteraction('furniture.axis-drag-end', {
      id: item.id,
      name: item.name,
      axis: draggingAxis === 'horizontal' ? horizontalAxis : 'y',
      mode: 'front',
      wall,
      x: finalItem?.x,
      y: finalItem?.y,
      z: finalItem?.z,
    })
    endFurnitureMove()
    setDraggingAxis(null)
    document.body.classList.remove('can-grab')
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
  }

  const eventsForAxis = (axis: 'horizontal' | 'vertical') => ({
    onPointerDown: (event: ThreeEvent<PointerEvent>) => startDrag(axis, event),
    onPointerMove: drag,
    onPointerUp: stopDrag,
    onPointerCancel: stopDrag,
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setHoveredAxis(axis)
      document.body.classList.add('can-grab')
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setHoveredAxis((current) => current === axis ? null : current)
      if (!draggingAxis) document.body.classList.remove('can-grab')
    },
  })

  const renderAxis = (axis: 'horizontal' | 'vertical') => {
    const active = hoveredAxis === axis || draggingAxis === axis
    const color = axis === 'horizontal'
      ? active ? '#ff694f' : '#dd4f3f'
      : active ? '#7197ff' : '#4d75d8'
    return (
      <group {...eventsForAxis(axis)}>
        {([-1, 1] as const).map((direction) => (
          <group key={direction}>
            <mesh
              position={axis === 'horizontal' ? [direction * shaftLength / 2, 0, 0] : [0, direction * shaftLength / 2, 0]}
              renderOrder={11}
            >
              <boxGeometry args={axis === 'horizontal' ? [shaftLength, 0.075, 0.075] : [0.075, shaftLength, 0.075]} />
              <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh
              position={axis === 'horizontal' ? [direction * coneCenter, 0, 0] : [0, direction * coneCenter, 0]}
              rotation={axis === 'horizontal' ? [0, 0, direction * -Math.PI / 2] : [direction < 0 ? Math.PI : 0, 0, 0]}
              renderOrder={11}
            >
              <coneGeometry args={[0.15, coneHeight, 24]} />
              <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    )
  }

  return (
    <group position={[item.x, item.y + item.height / 2, item.z]} rotation={planeRotation}>
      {renderAxis('horizontal')}
      {canMoveVertically && renderAxis('vertical')}
    </group>
  )
}
