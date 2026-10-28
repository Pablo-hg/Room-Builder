import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { StructureSurface } from '../domain/types'
import { useHistoryGesture } from '../state/useHistoryGesture'
import { releasePointer, usePointerCancellation } from './usePointerCancellation'
import { useRoomStore } from '../state/useRoomStore'
import { structureSurfaceElementId } from '../domain/elementIds'
import { recordSceneInteraction } from './sceneInteraction'

export function StructureSurfaceTransformGizmo({
  packId,
  name,
  surface,
  position,
  move,
  rotate,
}: {
  packId: string
  name: string
  surface: StructureSurface
  position: [number, number, number]
  move: (packId: string, surfaceId: StructureSurface['id'], axis: 'x' | 'y' | 'z', value: number) => void
  rotate: (packId: string, surfaceId: StructureSurface['id'], rotation: number) => void
}) {
  const gesture = useHistoryGesture(structureSurfaceElementId(packId, surface.id))
  const selectElement = useRoomStore((state) => state.selectElement)
  const [draggingAxis, setDraggingAxis] = useState<'x' | 'y' | 'z' | null>(null)
  const [hoveredAxis, setHoveredAxis] = useState<'x' | 'y' | 'z' | null>(null)
  const [rotating, setRotating] = useState(false)
  const [ringHovered, setRingHovered] = useState(false)
  const pointerPoint = useMemo(() => new THREE.Vector3(), [])
  const dragPlane = useMemo(() => new THREE.Plane(), [])
  const startPoint = useRef(new THREE.Vector3())
  const startingPosition = useRef({ x: 0, y: 0, z: 0 })
  const lastRingAngle = useRef(0)
  const startingRotation = useRef(surface.rotation)
  const radius = Math.max(0.65, Math.min(1.6, Math.hypot(surface.width, surface.depth) / 2 + 0.28))
  const coneHeight = 0.22
  const coneCenter = radius - coneHeight / 2
  const shaftLength = Math.max(0.1, radius - coneHeight)
  const gizmoHeight = surface.kind === 'floor' ? 0.18 : 0

  const startDrag = (axis: 'x' | 'y' | 'z', event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    selectElement(structureSurfaceElementId(packId, surface.id))
    const axisPlaneNormal = axis === 'y'
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0)
    dragPlane.setFromNormalAndCoplanarPoint(axisPlaneNormal, new THREE.Vector3(...position))
    if (!event.ray.intersectPlane(dragPlane, pointerPoint)) return
    startPoint.current.copy(pointerPoint)
    startingPosition.current = { x: surface.x, y: surface.y, z: surface.z }
    gesture.begin()
    setDraggingAxis(axis)
    document.body.classList.add('can-grab')
    capturePointer(event)
    recordSceneInteraction('structure-surface.axis-drag-start', { packId, surfaceId: surface.id, name, axis })
  }

  const drag = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingAxis || !gesture.isActive()) return
    event.stopPropagation()
    if (!event.ray.intersectPlane(dragPlane, pointerPoint)) return
    const delta = draggingAxis === 'x'
      ? pointerPoint.x - startPoint.current.x
      : draggingAxis === 'y'
        ? pointerPoint.y - startPoint.current.y
        : pointerPoint.z - startPoint.current.z
    move(packId, surface.id, draggingAxis, startingPosition.current[draggingAxis] + delta)
  }

  const stopDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingAxis) return
    event.stopPropagation()
    gesture.commit()
    setDraggingAxis(null)
    document.body.classList.remove('can-grab')
    releasePointer(event)
    recordSceneInteraction('structure-surface.axis-drag-end', { packId, surfaceId: surface.id, name, axis: draggingAxis })
  }

  const axisEvents = (axis: 'x' | 'y' | 'z') => ({
    onPointerDown: (event: ThreeEvent<PointerEvent>) => startDrag(axis, event),
    onPointerMove: drag,
    onPointerUp: stopDrag,
    onPointerCancel: (event: ThreeEvent<PointerEvent>) => { gesture.cancel(); stopDrag(event) },
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
  const axisMaterial = (axis: 'x' | 'y' | 'z') => {
    const colors = { x: ['#d85243', '#ff6a54'], y: ['#4d75d8', '#7197ff'], z: ['#34876f', '#46b98f'] }
    const [normal, active] = colors[axis]
    return <meshBasicMaterial color={hoveredAxis === axis || draggingAxis === axis ? active : normal} depthTest={false} depthWrite={false} toneMapped={false} />
  }
  const rotateFromPointer = (event: ThreeEvent<PointerEvent>) => {
    if (!event.ray.intersectPlane(dragPlane, pointerPoint)) return
    const angle = Math.atan2(pointerPoint.z - position[2], pointerPoint.x - position[0])
    const delta = Math.atan2(Math.sin(angle - lastRingAngle.current), Math.cos(angle - lastRingAngle.current))
    rotate(packId, surface.id, startingRotation.current + delta)
    lastRingAngle.current = angle
    startingRotation.current += delta
  }
  const ringEvents = {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...position))
      if (!event.ray.intersectPlane(dragPlane, pointerPoint)) return
      lastRingAngle.current = Math.atan2(pointerPoint.z - position[2], pointerPoint.x - position[0])
      startingRotation.current = surface.rotation
      gesture.begin()
      setRotating(true)
      document.body.classList.add('can-grab')
      capturePointer(event)
      recordSceneInteraction('structure-surface.rotation-start', { packId, surfaceId: surface.id, name, rotation: surface.rotation })
    },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      if (!rotating || !gesture.isActive()) return
      event.stopPropagation()
      rotateFromPointer(event)
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => {
      if (!rotating) return
      event.stopPropagation()
      gesture.commit()
      setRotating(false)
      document.body.classList.remove('can-grab')
      releasePointer(event)
      recordSceneInteraction('structure-surface.rotation-end', { packId, surfaceId: surface.id, name, rotation: useRoomStore.getState().structurePacks.find((pack) => pack.id === packId)?.surfaces.find((candidate) => candidate.id === surface.id)?.rotation })
    },
    onPointerCancel: (event: ThreeEvent<PointerEvent>) => {
      if (!rotating) return
      event.stopPropagation()
      gesture.cancel()
      setRotating(false)
      document.body.classList.remove('can-grab')
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setRingHovered(true)
      document.body.classList.add('can-grab')
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setRingHovered(false)
      if (!rotating) document.body.classList.remove('can-grab')
    },
  }

  const capturePointer = usePointerCancellation((event) => { gesture.cancel(); stopDrag(event); ringEvents.onPointerCancel(event) })

  return (
    <group position={[position[0], position[1] + gizmoHeight, position[2]]} renderOrder={8}>
      {(['x', 'y', 'z'] as const).map((axis) => {
        const direction: [number, number, number] = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]
        return (
          <group key={axis} {...axisEvents(axis)}>
            {([-1, 1] as const).map((side) => (
              <group key={side}>
                <mesh position={[direction[0] * side * shaftLength / 2, direction[1] * side * shaftLength / 2, direction[2] * side * shaftLength / 2]} renderOrder={8}>
                  <boxGeometry args={axis === 'x' ? [shaftLength, 0.045, 0.045] : axis === 'y' ? [0.045, shaftLength, 0.045] : [0.045, 0.045, shaftLength]} />
                  {axisMaterial(axis)}
                </mesh>
                <mesh
                  position={[direction[0] * side * coneCenter, direction[1] * side * coneCenter, direction[2] * side * coneCenter]}
                  rotation={axis === 'x'
                    ? [0, 0, -Math.PI / 2 * side]
                    : axis === 'y'
                      ? side === 1 ? [0, 0, 0] : [Math.PI, 0, 0]
                      : [Math.PI / 2 * side, 0, 0]}
                  renderOrder={8}
                >
                  <coneGeometry args={[0.09, coneHeight, 16]} />
                  {axisMaterial(axis)}
                </mesh>
              </group>
            ))}
          </group>
        )
      })}
      {surface.kind === 'wall' && (
        <group
          position={[0, 0.035, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          {...ringEvents}
        >
          <mesh renderOrder={7}>
            <ringGeometry args={[radius - 0.035, radius + 0.035, 64]} />
            <meshBasicMaterial color={rotating ? '#c63d2c' : ringHovered ? '#ff8a63' : '#ea6f4c'} side={THREE.DoubleSide} depthTest={false} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh renderOrder={6}>
            <ringGeometry args={[radius - 0.11, radius + 0.11, 64]} />
            <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthTest={false} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  )
}
