import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { moveFromOrigin } from '../domain/measurements'
import { snapFurnitureRotation } from '../domain/geometry'
import { isWallMirrorShape, openingCapabilities, OPENING_CATALOG, openingKindForShape } from '../domain/objectCatalog'
import type { RoomConfig, WallOpening, WallSide } from '../domain/types'
import { useHistoryGesture } from '../state/useHistoryGesture'
import { releasePointer, usePointerCancellation } from './usePointerCancellation'
import { useRoomStore } from '../state/useRoomStore'
import { recordSceneInteraction, selectSceneObject } from './sceneInteraction'
import { colorTone } from './colorTone'
import { SelectionBounds } from './SelectionBounds'
import { AXIS_COLORS } from './axisColors'
import { AxisAnchor } from './AxisAnchor'

function openingName(opening: WallOpening) {
  return opening.kind === 'door'
    ? 'Puerta'
    : OPENING_CATALOG[openingKindForShape(opening.shape ?? 'rectangular')].name
}

function useOpeningInteraction(room: RoomConfig, opening: WallOpening, wall: WallSide, planView: boolean, locked: boolean) {
  const gesture = useHistoryGesture(opening.id)
  const setDoor = useRoomStore((state) => state.setDoor)
  const setStructureDoor = useRoomStore((state) => state.setStructureDoor)
  const updateWindow = useRoomStore((state) => state.updateWindow)
  const [dragging, setDragging] = useState(false)
  const capabilities = openingCapabilities(opening.kind)
  const canMoveHorizontal = capabilities.translation.includes('wall-horizontal')
  const canMoveVertical = capabilities.translation.includes('wall-vertical')
  const dragAxis = useRef<'free' | 'horizontal' | 'vertical'>('free')
  const dragOffset = useRef(0)
  const dragSill = useRef(0)
  const dragOrigin = useRef({ offset: opening.offset, sill: opening.bottom })
  const point = useMemo(() => new THREE.Vector3(), [])
  const plane = useMemo(() => {
    if (planView) return new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.035)
    if (wall === 'north') return new THREE.Plane(new THREE.Vector3(0, 0, 1), room.depth / 2)
    if (wall === 'south') return new THREE.Plane(new THREE.Vector3(0, 0, 1), -room.depth / 2)
    if (wall === 'east') return new THREE.Plane(new THREE.Vector3(1, 0, 0), -room.width / 2)
    return new THREE.Plane(new THREE.Vector3(1, 0, 0), room.width / 2)
  }, [planView, room.depth, room.width, wall])

  const offsetAtPoint = (position: THREE.Vector3) => {
    if (wall === 'north') return position.x
    if (wall === 'south') return planView ? position.x : -position.x
    if (wall === 'east') return position.z
    return planView ? position.z : -position.z
  }

  const move = (offset: number, sill?: number) => {
    if (opening.kind === 'door') { if (opening.id === 'door') setDoor({ offset }); else setStructureDoor(opening.id, { offset }) }
    else updateWindow(opening.id, { offset, ...(sill === undefined ? {} : { sill }) })
  }

  const startDrag = (event: ThreeEvent<PointerEvent>, axis: 'free' | 'horizontal' | 'vertical' = 'free') => {
    event.stopPropagation()
    if ((axis === 'horizontal' && !canMoveHorizontal) || (axis === 'vertical' && !canMoveVertical)) return
    recordSceneInteraction('opening.pointer-down', {
      id: opening.id,
      kind: opening.kind,
      name: openingName(opening),
      wall,
      axis,
      pointerId: event.pointerId,
      intersectionCount: event.intersections.length,
    })
    if (axis === 'free') {
      if (selectSceneObject(opening.id, event.nativeEvent)) return
    } else useRoomStore.getState().selectElement(opening.id)
    if (locked) return
    if (!event.ray.intersectPlane(plane, point)) return
    dragOrigin.current = { offset: opening.offset, sill: opening.bottom }
    dragAxis.current = axis
    dragOffset.current = offsetAtPoint(point) - opening.offset
    dragSill.current = point.y - opening.bottom
    gesture.begin()
    setDragging(true)
    document.body.classList.add('can-grab')
    capturePointer(event)
  }
  const drag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging || !gesture.isActive()) return
    event.stopPropagation()
    if (event.ray.intersectPlane(plane, point)) {
      const axis = dragAxis.current
      move(
        axis === 'vertical' || !canMoveHorizontal ? opening.offset : moveFromOrigin(offsetAtPoint(point) - dragOffset.current, dragOrigin.current.offset),
        opening.kind === 'window' && canMoveVertical && !planView && axis !== 'horizontal'
          ? moveFromOrigin(point.y - dragSill.current, dragOrigin.current.sill)
          : undefined,
      )
    }
  }
  const stopDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    event.stopPropagation()
    const latest = useRoomStore.getState().room
    const finalOpening = opening.kind === 'door'
      ? opening.id === 'door' ? latest.door : latest.extraDoors?.find((door) => door.id === opening.id)
      : latest.windows.find((candidate) => candidate.id === opening.id)
    recordSceneInteraction('opening.drag-end', {
      id: opening.id,
      kind: opening.kind,
      name: openingName(opening),
      wall: finalOpening?.wall,
      axis: dragAxis.current,
      offset: finalOpening?.offset,
      sill: finalOpening && 'sill' in finalOpening ? finalOpening.sill : undefined,
    })
    gesture.commit()
    setDragging(false)
    document.body.classList.remove('can-grab')
    releasePointer(event)
  }

  const capturePointer = usePointerCancellation((event) => { gesture.cancel(); stopDrag(event) })

  const hoverEvents = {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      if (!locked) document.body.classList.add('can-grab')
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      document.body.classList.remove('can-grab')
    },
  }

  return {
    events: {
      onPointerDown: (event: ThreeEvent<PointerEvent>) => startDrag(event, 'free'),
      onPointerMove: drag,
      onPointerUp: stopDrag,
      onPointerCancel: (event: ThreeEvent<PointerEvent>) => { gesture.cancel(); stopDrag(event) },
      ...hoverEvents,
    },
    dragEventsForAxis: (axis: 'horizontal' | 'vertical') => ({
      onPointerDown: (event: ThreeEvent<PointerEvent>) => startDrag(event, axis),
      onPointerMove: drag,
      onPointerUp: stopDrag,
      onPointerCancel: (event: ThreeEvent<PointerEvent>) => { gesture.cancel(); stopDrag(event) },
      ...hoverEvents,
    }),
  }
}

const openingRingRadius = (opening: WallOpening, planView: boolean) => planView
  ? opening.width / 2 + 0.22
  : Math.hypot(opening.width, opening.height) / 2 + 0.18

function OpeningMoveGizmo({ opening, dragEventsForAxis, horizontal = true, planView = false, vertical = false }: { opening: WallOpening; dragEventsForAxis: ReturnType<typeof useOpeningInteraction>['dragEventsForAxis']; horizontal?: boolean; planView?: boolean; vertical?: boolean }) {
  const [hoveredAxis, setHoveredAxis] = useState<'horizontal' | 'vertical' | null>(null)
  const [activeAxis, setActiveAxis] = useState<'horizontal' | 'vertical' | null>(null)
  const wall = useRoomStore((state) => opening.kind === 'door' ? state.room.door.wall : state.room.windows.find((item) => item.id === opening.id)?.wall ?? 'north')
  const coneHeight = 0.15
  const tipDistance = 0.5
  const coneCenter = tipDistance - coneHeight / 2
  const shaftLength = Math.max(0.08, tipDistance - coneHeight)
  const axisMaterial = (axis: 'horizontal' | 'vertical') => {
    const active = hoveredAxis === axis || activeAxis === axis
    const colors = AXIS_COLORS[axis === 'vertical' ? 'y' : wall === 'north' || wall === 'south' ? 'x' : 'z']
    const color = active ? colors.active : colors.normal
    return <meshBasicMaterial color={color} transparent depthTest={false} depthWrite={false} toneMapped={false} />
  }
  const axisEvents = (axis: 'horizontal' | 'vertical') => {
    const dragEvents = dragEventsForAxis(axis)
    return {
      onPointerDown: (event: ThreeEvent<PointerEvent>) => {
        setActiveAxis(axis)
        dragEvents.onPointerDown(event)
      },
      onPointerMove: dragEvents.onPointerMove,
      onPointerUp: (event: ThreeEvent<PointerEvent>) => {
        setActiveAxis(null)
        dragEvents.onPointerUp(event)
      },
      onPointerCancel: (event: ThreeEvent<PointerEvent>) => {
        setActiveAxis(null)
        dragEvents.onPointerCancel(event)
      },
      onPointerOver: (event: ThreeEvent<PointerEvent>) => {
        setHoveredAxis(axis)
        dragEvents.onPointerOver(event)
      },
      onPointerOut: (event: ThreeEvent<PointerEvent>) => {
        setHoveredAxis((current) => current === axis ? null : current)
        dragEvents.onPointerOut(event)
      },
    }
  }

  return (
    <AxisAnchor center={planView ? [0, 0.13, 0] : [0, 0, 0.12]} dimensions={planView ? [opening.width, 0.1, 0.16] : [opening.width, opening.height, 0.2]}>
      {horizontal && <group {...axisEvents('horizontal')}>
        {([-1, 1] as const).map((direction) => (
          <group key={`horizontal-${direction}`}>
          <mesh position={[direction * shaftLength / 2, 0, 0]} renderOrder={8}>
            <boxGeometry args={[shaftLength, 0.025, 0.025]} />
            {axisMaterial('horizontal')}
          </mesh>
          <mesh position={[direction * coneCenter, 0, 0]} rotation={[0, 0, direction * -Math.PI / 2]} renderOrder={8}>
            <coneGeometry args={[0.065, coneHeight, 20]} />
            {axisMaterial('horizontal')}
          </mesh>
          <mesh position={[direction * tipDistance / 2, 0, 0]}><boxGeometry args={[tipDistance, 0.18, 0.18]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
          </group>
        ))}
      </group>}
      {vertical && (
        <group {...axisEvents('vertical')}>
          {([-1, 1] as const).map((direction) => (
            <group key={`vertical-${direction}`}>
              <mesh position={[0, direction * shaftLength / 2, 0]} renderOrder={8}>
                <boxGeometry args={[0.025, shaftLength, 0.025]} />
                {axisMaterial('vertical')}
              </mesh>
              <mesh position={[0, direction * coneCenter, 0]} rotation={[0, 0, direction === 1 ? 0 : Math.PI]} renderOrder={8}>
                <coneGeometry args={[0.065, coneHeight, 20]} />
                {axisMaterial('vertical')}
              </mesh>
              <mesh position={[0, direction * tipDistance / 2, 0]}><boxGeometry args={[0.18, tipDistance, 0.18]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
            </group>
          ))}
        </group>
      )}
    </AxisAnchor>
  )
}

function OpeningSelectionRing({ opening, wall, centerY = 0, planView = false }: { opening: WallOpening; wall: WallSide; centerY?: number; planView?: boolean }) {
  const gesture = useHistoryGesture(opening.id)
  const updateWindow = useRoomStore((state) => state.updateWindow)
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)
  const ringRef = useRef<THREE.Group>(null)
  const pointerPoint = useMemo(() => new THREE.Vector3(), [])
  const ringCenter = useMemo(() => new THREE.Vector3(), [])
  const ringNormal = useMemo(() => new THREE.Vector3(), [])
  const ringQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const ringPlane = useMemo(() => new THREE.Plane(), [])
  const lastPointerAngle = useRef(0)
  const targetRotation = useRef(opening.rotation)
  const radius = openingRingRadius(opening, planView)
  const halfStroke = 0.015
  const color = active ? '#c63d2c' : hovered ? '#ff8a63' : '#ea6f4c'
  const indicatorX = Math.sin(opening.rotation) * radius
  const indicatorY = -Math.cos(opening.rotation) * radius
  const indicatorAngle = Math.atan2(indicatorX, indicatorY)

  const angleAtPointer = (event: ThreeEvent<PointerEvent>) => {
    const group = ringRef.current
    if (!group) return null
    group.getWorldPosition(ringCenter)
    group.getWorldQuaternion(ringQuaternion)
    ringNormal.set(0, 0, 1).applyQuaternion(ringQuaternion).normalize()
    ringPlane.setFromNormalAndCoplanarPoint(ringNormal, ringCenter)
    if (!event.ray.intersectPlane(ringPlane, pointerPoint)) return null
    group.worldToLocal(pointerPoint)
    return Math.atan2(pointerPoint.y, pointerPoint.x)
  }

  const startRotation = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    const angle = angleAtPointer(event)
    if (angle === null) return
    lastPointerAngle.current = angle
    targetRotation.current = opening.rotation
    gesture.begin()
    setActive(true)
    document.body.classList.add('can-grab')
    capturePointer(event)
    recordSceneInteraction('opening.rotation-start', {
      id: opening.id,
      kind: opening.kind,
      name: openingName(opening),
      wall,
      rotation: opening.rotation,
      shiftKey: event.nativeEvent.shiftKey,
    })
  }

  const rotate = (event: ThreeEvent<PointerEvent>) => {
    if (!active || !gesture.isActive()) return
    event.stopPropagation()
    const angle = angleAtPointer(event)
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
    if (opening.kind === 'window') updateWindow(opening.id, { rotation: nextRotation })
  }

  const stopRotation = (event: ThreeEvent<PointerEvent>) => {
    if (!active) return
    event.stopPropagation()
    const latestRoom = useRoomStore.getState().room
    const finalRotation = latestRoom.windows.find((candidate) => candidate.id === opening.id)?.rotation
    recordSceneInteraction('opening.rotation-end', {
      id: opening.id,
      kind: opening.kind,
      name: openingName(opening),
      wall,
      rotation: finalRotation,
    })
    gesture.commit()
    setActive(false)
    document.body.classList.remove('can-grab')
    releasePointer(event)
  }

  const capturePointer = usePointerCancellation((event) => { gesture.cancel(); stopRotation(event) })

  return (
    <group
      ref={ringRef}
      userData={{ selectionGizmo: true }}
      position={planView ? [0, 0.11, 0] : [0, centerY, 0.18]}
      rotation={planView ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
      onPointerDown={startRotation}
      onPointerMove={rotate}
      onPointerUp={stopRotation}
      onPointerCancel={(event) => { gesture.cancel(); stopRotation(event) }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
        document.body.classList.add('can-grab')
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        setHovered(false)
        if (!active) document.body.classList.remove('can-grab')
      }}
    >
      <mesh renderOrder={7}>
        <ringGeometry args={[radius - halfStroke, radius + halfStroke, 64]} />
        <meshBasicMaterial
          color={color}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {active && (
        <mesh renderOrder={6}>
          <ringGeometry args={[radius - 0.082, radius + 0.082, 64]} />
          <meshBasicMaterial color="#ff9b78" transparent opacity={0.3} side={THREE.DoubleSide} depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh renderOrder={6}>
        <ringGeometry args={[radius - 0.075, radius + 0.075, 64]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh
        position={[indicatorX, indicatorY, 0.03]}
        rotation={[0, 0, -indicatorAngle]}
        renderOrder={10}
        raycast={() => undefined}
      >
        <boxGeometry args={[0.055, 0.12, 0.04]} />
        <meshBasicMaterial color="#9f3f31" depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function OpeningDetail({ room, opening, wall, selected, locked }: { room: RoomConfig; opening: WallOpening; wall: WallSide; selected: boolean; locked: boolean }) {
  const interaction = useOpeningInteraction(room, opening, wall, false, locked)
  const capabilities = openingCapabilities(opening.kind)
  const canMoveHorizontal = capabilities.translation.includes('wall-horizontal')
  const canMoveVertical = capabilities.translation.includes('wall-vertical')
  const baseColor = opening.color ?? '#c88f58'
  const darkColor = colorTone(baseColor, -0.2)
  const lightColor = colorTone(baseColor, 0.32)
  if (opening.kind === 'door') {
    const frameWidth = 0.07
    return (
      <group position={[opening.offset, 0, 0.02]} {...interaction.events}>
        {selected && !locked && (
          <group position={[0, opening.height / 2, 0]}>
            <OpeningMoveGizmo
              opening={opening}
              dragEventsForAxis={interaction.dragEventsForAxis}
              horizontal={canMoveHorizontal}
            />
          </group>
        )}
        <group position={[0, opening.height / 2, 0]} rotation={[0, 0, opening.rotation]}>
          <mesh position={[-opening.width / 2 + frameWidth / 2, 0, 0.05]}>
            <boxGeometry args={[frameWidth, opening.height, 0.16]} />
            <meshStandardMaterial color={darkColor} />
          </mesh>
          <mesh position={[opening.width / 2 - frameWidth / 2, 0, 0.05]}>
            <boxGeometry args={[frameWidth, opening.height, 0.16]} />
            <meshStandardMaterial color={darkColor} />
          </mesh>
          <mesh position={[0, opening.height / 2, 0.05]}>
            <boxGeometry args={[opening.width, 0.08, 0.16]} />
            <meshStandardMaterial color={darkColor} />
          </mesh>
        </group>
      </group>
    )
  }

  const frameWidth = Math.min(0.07, opening.width * 0.12, opening.height * 0.12)
  if (opening.shape === 'wallShelf') {
    const shelfDepth = 0.25
    const shelfColor = baseColor
    return (
      <group position={[opening.offset, opening.bottom + opening.height / 2, 0.08]} {...interaction.events}>
        {selected && !locked && (
          <>
            {capabilities.rotation.enabled && <OpeningSelectionRing opening={opening} wall={wall} />}
            <OpeningMoveGizmo
              opening={opening}
              dragEventsForAxis={interaction.dragEventsForAxis}
              horizontal={canMoveHorizontal}
              vertical={canMoveVertical}
            />
          </>
        )}
        <group rotation={[0, 0, opening.rotation]}>
          <mesh position={[0, 0, 0.015]} castShadow><boxGeometry args={[opening.width, opening.height, 0.05]} /><meshStandardMaterial color={darkColor} roughness={0.88} /></mesh>
          {[-opening.height * 0.28, opening.height * 0.28].map((height) => (
            <mesh key={height} position={[0, height, shelfDepth / 2]} castShadow><boxGeometry args={[opening.width, Math.min(0.075, opening.height * 0.15), shelfDepth]} /><meshStandardMaterial color={shelfColor} roughness={0.78} /></mesh>
          ))}
          {[-1, 1].map((side) => <mesh key={side} position={[side * opening.width * 0.46, 0, shelfDepth / 2]} castShadow><boxGeometry args={[Math.min(0.065, opening.width * 0.08), opening.height, shelfDepth]} /><meshStandardMaterial color={shelfColor} roughness={0.78} /></mesh>)}
          {[-0.3, 0, 0.3].map((x, index) => <mesh key={x} position={[x * opening.width, opening.height * 0.25, shelfDepth * 0.5]} castShadow><boxGeometry args={[Math.min(0.11, opening.width * 0.15), Math.min(0.2 + index * 0.035, opening.height * 0.4), shelfDepth * 0.55]} /><meshStandardMaterial color={colorTone(baseColor, [-0.12, 0.22, -0.28][index])} /></mesh>)}
        </group>
      </group>
    )
  }
  if (opening.shape && isWallMirrorShape(opening.shape)) {
    const frameWidth = Math.min(0.065, opening.width * 0.12, opening.height * 0.12)
    const circular = opening.shape === 'mirrorCircular'
    const radius = Math.min(opening.width, opening.height) / 2
    return (
      <group position={[opening.offset, opening.bottom + opening.height / 2, 0.07]} {...interaction.events}>
        {selected && !locked && (
          <>
            {capabilities.rotation.enabled && <OpeningSelectionRing opening={opening} wall={wall} />}
            <OpeningMoveGizmo
              opening={opening}
              dragEventsForAxis={interaction.dragEventsForAxis}
              horizontal={canMoveHorizontal}
              vertical={canMoveVertical}
            />
          </>
        )}
        <group rotation={[0, 0, opening.rotation]}>
          {circular ? (
            <>
              <mesh castShadow><circleGeometry args={[radius, 48]} /><meshStandardMaterial color={darkColor} roughness={0.78} /></mesh>
              <mesh position={[0, 0, 0.018]}><circleGeometry args={[radius - frameWidth, 48]} /><meshStandardMaterial color="#dce7e4" metalness={0.18} roughness={0.28} /></mesh>
              <mesh position={[0, 0, 0.026]}><ringGeometry args={[radius - frameWidth, radius, 48]} /><meshStandardMaterial color={baseColor} roughness={0.8} /></mesh>
              <mesh position={[-radius * 0.2, radius * 0.12, 0.03]} rotation={[0, 0, -0.55]}><planeGeometry args={[frameWidth * 0.65, radius * 1.1]} /><meshStandardMaterial color="#fffdf9" transparent opacity={0.55} /></mesh>
            </>
          ) : (
            <>
              <mesh castShadow><boxGeometry args={[opening.width, opening.height, 0.06]} /><meshStandardMaterial color={darkColor} roughness={0.8} /></mesh>
              <mesh position={[0, 0, 0.034]}><boxGeometry args={[opening.width - frameWidth * 2, opening.height - frameWidth * 2, 0.012]} /><meshStandardMaterial color="#dce7e4" metalness={0.18} roughness={0.28} /></mesh>
              <mesh position={[-opening.width * 0.2, opening.height * 0.12, 0.043]} rotation={[0, 0, -0.55]}><planeGeometry args={[frameWidth * 0.65, opening.height * 0.62]} /><meshStandardMaterial color="#fffdf9" transparent opacity={0.55} /></mesh>
            </>
          )}
        </group>
      </group>
    )
  }
  if (opening.shape === 'wallSconce') {
    return (
      <group position={[opening.offset, opening.bottom + opening.height / 2, 0.075]} {...interaction.events}>
        {selected && !locked && (
          <>
            {capabilities.rotation.enabled && <OpeningSelectionRing opening={opening} wall={wall} />}
            <OpeningMoveGizmo
              opening={opening}
              dragEventsForAxis={interaction.dragEventsForAxis}
              horizontal={canMoveHorizontal}
              vertical={canMoveVertical}
            />
          </>
        )}
        <group rotation={[0, 0, opening.rotation]} scale={[opening.width / OPENING_CATALOG.wallSconce.width, opening.height / OPENING_CATALOG.wallSconce.height, 1]}>
          <mesh position={[0, 0, 0.015]} castShadow><boxGeometry args={[0.16, 0.26, 0.055]} /><meshStandardMaterial color={darkColor} roughness={0.8} /></mesh>
          <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, 0.12, 12]} /><meshStandardMaterial color={darkColor} metalness={0.2} roughness={0.55} /></mesh>
          <mesh position={[0, -0.035, 0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow><coneGeometry args={[0.16, 0.22, 24, 1, true]} /><meshStandardMaterial color={baseColor} side={THREE.DoubleSide} roughness={0.72} /></mesh>
          <mesh position={[0, -0.145, 0.16]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.135, 24]} /><meshStandardMaterial color={colorTone(baseColor, 0.38)} side={THREE.DoubleSide} emissive={colorTone(baseColor, 0.25)} emissiveIntensity={0.22} /></mesh>
          <pointLight position={[0, -0.18, 0.18]} color="#ffe0a6" intensity={0.25} distance={1.8} />
        </group>
      </group>
    )
  }
  if (opening.shape === 'pictureSmall' || opening.shape === 'pictureMedium' || opening.shape === 'pictureLarge') {
    const frameWidth = Math.min(0.07, opening.width * 0.12, opening.height * 0.12)
    const accent = colorTone(baseColor, -0.08)
    return (
      <group position={[opening.offset, opening.bottom + opening.height / 2, 0.07]} {...interaction.events}>
        {selected && !locked && (
          <>
            {capabilities.rotation.enabled && <OpeningSelectionRing opening={opening} wall={wall} />}
            <OpeningMoveGizmo
              opening={opening}
              dragEventsForAxis={interaction.dragEventsForAxis}
              horizontal={canMoveHorizontal}
              vertical={canMoveVertical}
            />
          </>
        )}
        <group rotation={[0, 0, opening.rotation]}>
          <mesh castShadow>
            <boxGeometry args={[opening.width, opening.height, 0.055]} />
            <meshStandardMaterial color={darkColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, 0, 0.034]}>
            <boxGeometry args={[opening.width - frameWidth * 2, opening.height - frameWidth * 2, 0.014]} />
            <meshStandardMaterial color={lightColor} roughness={0.92} />
          </mesh>
          <mesh position={[-opening.width * 0.2, opening.height * 0.16, 0.044]}>
            <circleGeometry args={[Math.min(opening.width, opening.height) * 0.17, 24]} />
            <meshStandardMaterial color={colorTone(baseColor, 0.42)} />
          </mesh>
          <mesh position={[opening.width * 0.13, -opening.height * 0.1, 0.045]} rotation={[0, 0, 0.2]}>
            <planeGeometry args={[opening.width * 0.42, opening.height * 0.28]} />
            <meshStandardMaterial color={accent} />
          </mesh>
          <mesh position={[-opening.width * 0.13, -opening.height * 0.22, 0.046]} rotation={[0, 0, -0.16]}>
            <planeGeometry args={[opening.width * 0.32, opening.height * 0.16]} />
            <meshStandardMaterial color={colorTone(baseColor, -0.3)} />
          </mesh>
        </group>
      </group>
    )
  }
  if (opening.shape === 'circular') {
    const radius = Math.min(opening.width, opening.height) / 2
    return (
      <group position={[opening.offset, opening.bottom + opening.height / 2, 0.01]} {...interaction.events}>
        {selected && !locked && (
          <>
            {capabilities.rotation.enabled && <OpeningSelectionRing opening={opening} wall={wall} />}
            <OpeningMoveGizmo
              opening={opening}
              dragEventsForAxis={interaction.dragEventsForAxis}
              horizontal={canMoveHorizontal}
              vertical={canMoveVertical}
            />
          </>
        )}
        <group rotation={[0, 0, opening.rotation]}>
          <mesh>
            <circleGeometry args={[radius - frameWidth, 64]} />
            <meshStandardMaterial color={lightColor} transparent opacity={0.62} roughness={0.15} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <ringGeometry args={[radius - frameWidth, radius, 64]} />
            <meshStandardMaterial color={baseColor} roughness={0.72} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[frameWidth * 0.72, (radius - frameWidth) * 2, 0.065]} />
            <meshStandardMaterial color={lightColor} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[(radius - frameWidth) * 2, frameWidth * 0.72, 0.065]} />
            <meshStandardMaterial color={lightColor} />
          </mesh>
        </group>
      </group>
    )
  }
  return (
    <group position={[opening.offset, opening.bottom + opening.height / 2, 0.01]} {...interaction.events}>
      {selected && !locked && (
        <>
          {capabilities.rotation.enabled && <OpeningSelectionRing opening={opening} wall={wall} />}
          <OpeningMoveGizmo
            opening={opening}
            dragEventsForAxis={interaction.dragEventsForAxis}
            horizontal={canMoveHorizontal}
            vertical={canMoveVertical}
          />
        </>
      )}
      <group rotation={[0, 0, opening.rotation]}>
        <mesh>
          <boxGeometry args={[opening.width - frameWidth * 2, opening.height - frameWidth * 2, 0.035]} />
          <meshStandardMaterial color={lightColor} transparent opacity={0.62} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0, 0.026]}>
          <boxGeometry args={[Math.min(0.055, opening.width * 0.12), opening.height, 0.07]} />
          <meshStandardMaterial color={lightColor} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (opening.width / 2 - frameWidth / 2), 0, 0.035]}>
            <boxGeometry args={[frameWidth, opening.height, 0.09]} />
            <meshStandardMaterial color={baseColor} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[0, side * (opening.height / 2 - frameWidth / 2), 0.035]}>
            <boxGeometry args={[opening.width, frameWidth, 0.09]} />
            <meshStandardMaterial color={baseColor} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function PlanOpening({ room, opening, wall, groupSelected = false }: { room: RoomConfig; opening: WallOpening; wall: WallSide; groupSelected?: boolean }) {
  const selectedId = useRoomStore((state) => state.selectedId)
  const outlined = useRoomStore((state) => state.selectedIds.includes(opening.id))
  const locked = useRoomStore((state) => state.lockedElementIds.includes(opening.id))
  const interaction = useOpeningInteraction(room, opening, wall, true, locked)
  const horizontal = wall === 'north' || wall === 'south'
  const selected = selectedId === opening.id
  const canMoveHorizontal = openingCapabilities(opening.kind).translation.includes('wall-horizontal')
  const color = selected ? '#ea6f4c' : opening.kind === 'door' ? '#e9895b' : '#65b7c2'
  let position: [number, number, number]
  if (wall === 'north') position = [opening.offset, 0.035, -room.depth / 2]
  else if (wall === 'south') position = [opening.offset, 0.035, room.depth / 2]
  else if (wall === 'east') position = [room.width / 2, 0.035, opening.offset]
  else position = [-room.width / 2, 0.035, opening.offset]
  return (
    <group position={position} rotation={horizontal ? [0, 0, 0] : [0, Math.PI / 2, 0]} {...interaction.events}>
      <mesh renderOrder={selected ? 6 : 0}>
        <boxGeometry args={[opening.width, selected ? 0.09 : 0.055, selected ? 0.16 : 0.1]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {outlined && !groupSelected && <SelectionBounds width={opening.width} height={selected ? 0.09 : 0.055} depth={selected ? 0.16 : 0.1} />}
      {selected && !locked && (
        <OpeningMoveGizmo opening={opening} dragEventsForAxis={interaction.dragEventsForAxis} horizontal={canMoveHorizontal} planView />
      )}
    </group>
  )
}
