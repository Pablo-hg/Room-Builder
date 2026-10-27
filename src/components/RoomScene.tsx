import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { DEFAULT_WALL_COLOR, ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from '../domain/constants'
import { openingsForWall, snapFurnitureRotation, wallLength } from '../domain/geometry'
import { isCeilingMountedFurniture, isFloorBoundFurniture, isWallMirrorShape, isWallPictureKind, openingCapabilities, OPENING_CATALOG, openingKindForShape } from '../domain/objectCatalog'
import type { FurnitureItem, RoomConfig, StructureSurface, WallOpening, WallSide } from '../domain/types'
import { structureSurfaceElementId, useRoomStore } from '../state/useRoomStore'
import { CameraRig } from '../scene/CameraRig'
import type { SceneProps } from '../scene/types'
import { wallVisibility } from '../scene/wallVisibility'
import { WallBody, wallPlacement } from '../scene/Walls'
import { WallGrid } from '../scene/WallGrid'
import { RoomShell, StudioLight, WallIdentityLabel } from '../scene/RoomShell'
import { recordSceneInteraction } from '../scene/sceneInteraction'

function colorTone(color: string, lightnessOffset: number) {
  const tone = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  tone.getHSL(hsl)
  tone.setHSL(hsl.h, hsl.s, Math.max(0.08, Math.min(0.94, hsl.l + lightnessOffset)))
  return `#${tone.getHexString()}`
}

function openingName(opening: WallOpening) {
  return opening.kind === 'door'
    ? 'Puerta'
    : OPENING_CATALOG[openingKindForShape(opening.shape ?? 'rectangular')].name
}

function SoftWall({ room, wall, hidden, showOpeningDetails, showGrid, exportMode }: { room: RoomConfig; wall: WallSide; hidden: boolean; showOpeningDetails: boolean; showGrid: boolean; exportMode: boolean }) {
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const selectedId = useRoomStore((state) => state.selectedId)
  const selectElement = useRoomStore((state) => state.selectElement)
  const length = wallLength(room, wall)
  const openings = useMemo(() => openingsForWall(room, wall), [room.door, room.windows, wall])
  const placement = wallPlacement[wall](room)

  return (
    <group position={placement.position} rotation={placement.rotation}>
      {!hidden && <group>
        <WallBody length={length} height={room.height} openings={openings} color={room.wallColors?.[wall] ?? room.wallColor ?? DEFAULT_WALL_COLOR} onPointerDown={(event) => {
          event.stopPropagation()
          recordSceneInteraction('background.pointer-down', { target: 'wall', wall })
          selectElement(null)
        }} />
        <mesh position={[0, 0.055, 0.075]} userData={{ freeOrbitSurface: true }} onPointerDown={(event) => {
          event.stopPropagation()
          recordSceneInteraction('background.pointer-down', { target: 'baseboard', wall })
          selectElement(null)
        }}>
          <boxGeometry args={[length, 0.11, 0.07]} />
          <meshStandardMaterial color="#d5a86e" />
        </mesh>
        {showGrid && <WallGrid length={length} height={room.height} openings={openings} />}
      </group>}
      {openings.map((opening) => (
        <group key={opening.id} visible={showOpeningDetails && !hiddenElementIds.includes(opening.id)}>
          <OpeningDetail room={room} wall={wall} opening={opening} selected={!exportMode && selectedId === opening.id} />
        </group>
      ))}
    </group>
  )
}

function StructureSurfaceObject({
  room,
  packId,
  packName,
  surface,
  hidden,
  selected,
  onSelect,
}: {
  room: RoomConfig
  packName: string
  surface: StructureSurface
  hidden: boolean
  selected: boolean
  onSelect: () => void
  packId: string
}) {
  if (hidden) return null
  const wall = surface.wall ?? 'north'
  const position = structureSurfacePosition(room, surface)
  const baseRotation = wall === 'north' ? 0 : wall === 'east' ? -Math.PI / 2 : wall === 'south' ? Math.PI : Math.PI / 2
  const beginStructureMove = useRoomStore((state) => state.beginStructureMove)
  const endStructureMove = useRoomStore((state) => state.endStructureMove)
  const moveStructureSurface = useRoomStore((state) => state.moveStructureSurface)
  const setStructureSurfaceRotation = useRoomStore((state) => state.setStructureSurfaceRotation)
  const surfaceId = structureSurfaceElementId(packId, surface.id)
  const selectSurface = (event: { stopPropagation: () => void; object: THREE.Object3D }) => {
    event.stopPropagation()
    const clickedId = event.object.userData.structureSurfaceId
    const clickedSurfaceId = typeof clickedId === 'string' ? clickedId : surfaceId
    const selectedBefore = useRoomStore.getState().selectedId === clickedSurfaceId
    recordSceneInteraction('structure-surface.pointer-down', {
      surfaceId: clickedSurfaceId,
      name: packName,
      kind: surface.kind,
      selectedBefore,
    })
    if (!selectedBefore) onSelect()
  }
  return (
    <>
      <mesh
        position={position}
        rotation={surface.kind === 'wall' ? [0, baseRotation + surface.rotation, 0] : [0, 0, 0]}
        userData={{ freeOrbitSurface: true, structureSurfaceId: surfaceId }}
        onPointerDown={selectSurface}
        onClick={selectSurface}
      >
        <boxGeometry args={[surface.width, surface.height, surface.depth]} />
        <meshStandardMaterial
          color={surface.color}
          emissive={selected ? '#dba771' : '#000000'}
          emissiveIntensity={selected ? 0.14 : 0}
          roughness={0.9}
        />
      </mesh>
      {selected && (
        <StructureSurfaceTransformGizmo
          packId={packId}
          name={packName}
          surface={surface}
          position={position}
          beginMove={beginStructureMove}
          endMove={endStructureMove}
          move={moveStructureSurface}
          rotate={setStructureSurfaceRotation}
        />
      )}
    </>
  )
}

function structureSurfacePosition(room: RoomConfig, surface: StructureSurface): [number, number, number] {
  if (surface.kind !== 'wall') {
    return [surface.x, (surface.kind === 'ceiling' ? room.height : 0) + surface.y, surface.z]
  }
  const wall = surface.wall ?? 'north'
  if (wall === 'north') return [surface.x, room.height / 2 + surface.y, -room.depth / 2 + surface.z]
  if (wall === 'south') return [surface.x, room.height / 2 + surface.y, room.depth / 2 + surface.z]
  if (wall === 'east') return [room.width / 2 + surface.x, room.height / 2 + surface.y, surface.z]
  return [-room.width / 2 + surface.x, room.height / 2 + surface.y, surface.z]
}

function StructureSurfaceTransformGizmo({
  packId,
  name,
  surface,
  position,
  beginMove,
  endMove,
  move,
  rotate,
}: {
  packId: string
  name: string
  surface: StructureSurface
  position: [number, number, number]
  beginMove: () => void
  endMove: () => void
  move: (packId: string, surfaceId: StructureSurface['id'], axis: 'x' | 'y' | 'z', value: number) => void
  rotate: (packId: string, surfaceId: StructureSurface['id'], rotation: number) => void
}) {
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
    beginMove()
    setDraggingAxis(axis)
    document.body.classList.add('can-grab')
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
    recordSceneInteraction('structure-surface.axis-drag-start', { packId, surfaceId: surface.id, name, axis })
  }

  const drag = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingAxis) return
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
    endMove()
    setDraggingAxis(null)
    document.body.classList.remove('can-grab')
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
    recordSceneInteraction('structure-surface.axis-drag-end', { packId, surfaceId: surface.id, name, axis: draggingAxis })
  }

  const axisEvents = (axis: 'x' | 'y' | 'z') => ({
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
      setRotating(true)
      document.body.classList.add('can-grab')
      ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
      recordSceneInteraction('structure-surface.rotation-start', { packId, surfaceId: surface.id, name, rotation: surface.rotation })
    },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      if (!rotating) return
      event.stopPropagation()
      rotateFromPointer(event)
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => {
      if (!rotating) return
      event.stopPropagation()
      setRotating(false)
      document.body.classList.remove('can-grab')
      ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
      recordSceneInteraction('structure-surface.rotation-end', { packId, surfaceId: surface.id, name, rotation: useRoomStore.getState().structurePacks.find((pack) => pack.id === packId)?.surfaces.find((candidate) => candidate.id === surface.id)?.rotation })
    },
    onPointerCancel: (event: ThreeEvent<PointerEvent>) => {
      if (!rotating) return
      event.stopPropagation()
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

function useOpeningInteraction(room: RoomConfig, opening: WallOpening, wall: WallSide, planView: boolean) {
  const selectElement = useRoomStore((state) => state.selectElement)
  const setDoor = useRoomStore((state) => state.setDoor)
  const updateWindow = useRoomStore((state) => state.updateWindow)
  const [dragging, setDragging] = useState(false)
  const capabilities = openingCapabilities(opening.kind)
  const canMoveHorizontal = capabilities.translation.includes('wall-horizontal')
  const canMoveVertical = capabilities.translation.includes('wall-vertical')
  const dragAxis = useRef<'free' | 'horizontal' | 'vertical'>('free')
  const dragOffset = useRef(0)
  const dragSill = useRef(0)
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
    if (opening.kind === 'door') setDoor({ offset })
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
    selectElement(opening.id)
    if (!event.ray.intersectPlane(plane, point)) return
    dragAxis.current = axis
    dragOffset.current = offsetAtPoint(point) - opening.offset
    dragSill.current = point.y - opening.bottom
    setDragging(true)
    document.body.classList.add('can-grab')
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
  }
  const drag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    event.stopPropagation()
    if (event.ray.intersectPlane(plane, point)) {
      const axis = dragAxis.current
      move(
        axis === 'vertical' || !canMoveHorizontal ? opening.offset : offsetAtPoint(point) - dragOffset.current,
        opening.kind === 'window' && canMoveVertical && !planView && axis !== 'horizontal'
          ? point.y - dragSill.current
          : undefined,
      )
    }
  }
  const stopDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    event.stopPropagation()
    const latest = useRoomStore.getState().room
    const finalOpening = opening.kind === 'door'
      ? latest.door
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
    setDragging(false)
    document.body.classList.remove('can-grab')
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
  }

  const hoverEvents = {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      document.body.classList.add('can-grab')
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      if (!dragging) document.body.classList.remove('can-grab')
    },
  }

  return {
    events: {
      onPointerDown: (event: ThreeEvent<PointerEvent>) => startDrag(event, 'free'),
      onPointerMove: drag,
      onPointerUp: stopDrag,
      onPointerCancel: stopDrag,
      ...hoverEvents,
    },
    dragEventsForAxis: (axis: 'horizontal' | 'vertical') => ({
      onPointerDown: (event: ThreeEvent<PointerEvent>) => startDrag(event, axis),
      onPointerMove: drag,
      onPointerUp: stopDrag,
      onPointerCancel: stopDrag,
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
  const ringRadius = openingRingRadius(opening, planView)
  const coneHeight = 0.24
  const tipDistance = ringRadius - 0.055
  const coneCenter = tipDistance - coneHeight / 2
  const shaftLength = Math.max(0.08, tipDistance - coneHeight)
  const axisMaterial = (axis: 'horizontal' | 'vertical') => {
    const active = hoveredAxis === axis || activeAxis === axis
    const color = axis === 'horizontal'
      ? active ? '#ff6a54' : '#d85243'
      : active ? '#46b98f' : '#2d987f'
    return <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
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
    <group position={[0, planView ? 0.13 : 0, planView ? 0 : 0.2]} renderOrder={8}>
      {horizontal && <group {...axisEvents('horizontal')}>
        {([-1, 1] as const).map((direction) => (
          <group key={`horizontal-${direction}`}>
          <mesh position={[direction * shaftLength / 2, 0, 0]} renderOrder={8}>
            <boxGeometry args={[shaftLength, 0.055, 0.055]} />
            {axisMaterial('horizontal')}
          </mesh>
          <mesh position={[direction * coneCenter, 0, 0]} rotation={[0, 0, direction * -Math.PI / 2]} renderOrder={8}>
            <coneGeometry args={[0.11, coneHeight, 20]} />
            {axisMaterial('horizontal')}
          </mesh>
          </group>
        ))}
      </group>}
      {vertical && (
        <group {...axisEvents('vertical')}>
          {([-1, 1] as const).map((direction) => (
            <group key={`vertical-${direction}`}>
              <mesh position={[0, direction * shaftLength / 2, 0]} renderOrder={8}>
                <boxGeometry args={[0.055, shaftLength, 0.055]} />
                {axisMaterial('vertical')}
              </mesh>
              <mesh position={[0, direction * coneCenter, 0]} rotation={[0, 0, direction === 1 ? 0 : Math.PI]} renderOrder={8}>
                <coneGeometry args={[0.11, coneHeight, 20]} />
                {axisMaterial('vertical')}
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

function OpeningSelectionRing({ opening, wall, centerY = 0, planView = false }: { opening: WallOpening; wall: WallSide; centerY?: number; planView?: boolean }) {
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
  const halfStroke = 0.042
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
    setActive(true)
    document.body.classList.add('can-grab')
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
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
    if (!active) return
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
    setActive(false)
    document.body.classList.remove('can-grab')
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
  }

  return (
    <group
      ref={ringRef}
      position={planView ? [0, 0.11, 0] : [0, centerY, 0.18]}
      rotation={planView ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
      onPointerDown={startRotation}
      onPointerMove={rotate}
      onPointerUp={stopRotation}
      onPointerCancel={stopRotation}
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
        <boxGeometry args={[0.045, 0.2, 0.04]} />
        <meshBasicMaterial color="#9f3f31" depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

function OpeningDetail({ room, opening, wall, selected }: { room: RoomConfig; opening: WallOpening; wall: WallSide; selected: boolean }) {
  const interaction = useOpeningInteraction(room, opening, wall, false)
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
        {selected && (
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

  const frameWidth = 0.07
  if (opening.shape === 'wallShelf') {
    const shelfDepth = 0.25
    const shelfColor = baseColor
    return (
      <group position={[opening.offset, opening.bottom + opening.height / 2, 0.08]} {...interaction.events}>
        {selected && (
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
            <mesh key={height} position={[0, height, shelfDepth / 2]} castShadow><boxGeometry args={[opening.width, 0.075, shelfDepth]} /><meshStandardMaterial color={shelfColor} roughness={0.78} /></mesh>
          ))}
          {[-1, 1].map((side) => <mesh key={side} position={[side * opening.width * 0.46, 0, shelfDepth / 2]} castShadow><boxGeometry args={[0.065, opening.height, shelfDepth]} /><meshStandardMaterial color={shelfColor} roughness={0.78} /></mesh>)}
          {[-0.3, 0, 0.3].map((x, index) => <mesh key={x} position={[x * opening.width, opening.height * 0.42, shelfDepth * 0.5]} castShadow><boxGeometry args={[0.11, 0.2 + index * 0.035, shelfDepth * 0.55]} /><meshStandardMaterial color={colorTone(baseColor, [-0.12, 0.22, -0.28][index])} /></mesh>)}
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
        {selected && (
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
        {selected && (
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
        {selected && (
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
        {selected && (
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
      {selected && (
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
          <boxGeometry args={[0.055, opening.height, 0.07]} />
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

function PlanOpening({ room, opening, wall }: { room: RoomConfig; opening: WallOpening; wall: WallSide }) {
  const selectedId = useRoomStore((state) => state.selectedId)
  const interaction = useOpeningInteraction(room, opening, wall, true)
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
      {selected && (
        <OpeningMoveGizmo opening={opening} dragEventsForAxis={interaction.dragEventsForAxis} horizontal={canMoveHorizontal} planView />
      )}
    </group>
  )
}

function FurnitureModel({ item }: { item: FurnitureItem }) {
  const material = <meshStandardMaterial color={item.color} roughness={0.78} />
  const darkColor = colorTone(item.color, -0.2)
  const deeperColor = colorTone(item.color, -0.34)
  const lightColor = colorTone(item.color, 0.28)
  const paleColor = colorTone(item.color, 0.42)
  if (item.kind === 'armchair') {
    const armWidth = 0.15
    const backDepth = 0.16
    return (
      <group>
        <mesh position={[0, 0.34, 0]} castShadow><boxGeometry args={[item.width * 0.74, 0.32, item.depth * 0.68]} />{material}</mesh>
        <mesh position={[0, 0.65, -item.depth / 2 + backDepth / 2]} castShadow><boxGeometry args={[item.width, 0.55, backDepth]} />{material}</mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * (item.width - armWidth) / 2, 0.46, 0]} castShadow><boxGeometry args={[armWidth, 0.42, item.depth]} />{material}</mesh>)}
        {[-1, 1].map((side) => <mesh key={`leg-${side}`} position={[side * item.width * 0.32, 0.11, -item.depth * 0.2]}><boxGeometry args={[0.08, 0.22, 0.08]} /><meshStandardMaterial color={darkColor} /></mesh>)}
      </group>
    )
  }
  if (item.kind === 'sofa') {
    const armWidth = 0.14
    return (
      <group>
        <mesh position={[0, 0.34, 0]} castShadow><boxGeometry args={[item.width * 0.86, 0.3, item.depth * 0.72]} />{material}</mesh>
        <mesh position={[0, 0.64, -item.depth / 2 + 0.09]} castShadow><boxGeometry args={[item.width, 0.54, 0.18]} />{material}</mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * (item.width - armWidth) / 2, 0.45, 0]} castShadow><boxGeometry args={[armWidth, 0.4, item.depth]} />{material}</mesh>)}
        <mesh position={[0, 0.5, -0.03]} castShadow><boxGeometry args={[0.045, 0.3, item.depth * 0.56]} /><meshStandardMaterial color={darkColor} roughness={0.82} /></mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * item.width * 0.4, 0.09, z * item.depth * 0.28]}><boxGeometry args={[0.08, 0.18, 0.08]} /><meshStandardMaterial color={deeperColor} /></mesh>))}
      </group>
    )
  }
  if (item.kind === 'table') {
    return (
      <group>
        <mesh position={[0, item.height - 0.08, 0]} castShadow><boxGeometry args={[item.width, 0.16, item.depth]} />{material}</mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
          <mesh key={`${x}-${z}`} position={[x * item.width * 0.38, item.height / 2 - 0.08, z * item.depth * 0.34]} castShadow>
            <boxGeometry args={[0.1, item.height - 0.16, 0.1]} /><meshStandardMaterial color={darkColor} />
          </mesh>
        )))}
      </group>
    )
  }
  if (item.kind === 'coffeeTable') {
    return (
      <group>
        <mesh position={[0, item.height - 0.06, 0]} castShadow><boxGeometry args={[item.width, 0.12, item.depth]} />{material}</mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
          <mesh key={`${x}-${z}`} position={[x * item.width * 0.4, item.height / 2 - 0.06, z * item.depth * 0.36]} castShadow>
            <boxGeometry args={[0.07, item.height - 0.12, 0.07]} /><meshStandardMaterial color={darkColor} />
          </mesh>
        )))}
      </group>
    )
  }
  if (item.kind === 'desk') {
    return (
      <group>
        <mesh position={[0, item.height - 0.06, 0]} castShadow><boxGeometry args={[item.width, 0.12, item.depth]} />{material}</mesh>
        <mesh position={[-item.width * 0.29, item.height * 0.47, 0]} castShadow><boxGeometry args={[item.width * 0.32, item.height * 0.65, item.depth * 0.72]} /><meshStandardMaterial color={darkColor} /></mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * item.width * 0.42, item.height / 2 - 0.06, 0]} castShadow><boxGeometry args={[0.07, item.height - 0.12, item.depth * 0.84]} /><meshStandardMaterial color={deeperColor} /></mesh>)}
        <mesh position={[-item.width * 0.29, item.height * 0.47, item.depth * 0.38]}><boxGeometry args={[item.width * 0.25, item.height * 0.21, 0.025]} /><meshStandardMaterial color={lightColor} /></mesh>
      </group>
    )
  }
  if (item.kind === 'deskChair') {
    const casterAngles = Array.from({ length: 5 }, (_, index) => index * Math.PI * 2 / 5)
    return (
      <group>
        <mesh position={[0, 0.47, 0.03]} castShadow><cylinderGeometry args={[item.width * 0.39, item.width * 0.39, 0.12, 28]} />{material}</mesh>
        <mesh position={[0, 0.66, -item.depth * 0.35]} castShadow><boxGeometry args={[item.width * 0.82, 0.36, 0.1]} />{material}</mesh>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.035, 0.045, 0.32, 16]} /><meshStandardMaterial color={darkColor} metalness={0.25} roughness={0.5} /></mesh>
        <mesh position={[0, 0.08, 0]} castShadow><cylinderGeometry args={[0.065, 0.065, 0.07, 20]} /><meshStandardMaterial color={deeperColor} metalness={0.2} roughness={0.55} /></mesh>
        {casterAngles.map((angle) => (
          <group key={angle} rotation={[0, angle, 0]}>
            <mesh position={[0, 0.075, 0.1]} castShadow><boxGeometry args={[0.045, 0.04, 0.2]} /><meshStandardMaterial color={deeperColor} /></mesh>
            <mesh position={[0, 0.045, 0.21]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.04, 0.04, 0.035, 16]} /><meshStandardMaterial color={darkColor} /></mesh>
          </group>
        ))}
      </group>
    )
  }
  if (item.kind === 'vase') {
    return (
      <group>
        <mesh position={[0, item.height * 0.45, 0]} castShadow><latheGeometry args={[[[0.1, 0], [0.16, 0.04], [0.22, 0.14], [0.25, 0.28], [0.22, 0.38], [0.12, 0.44], [0.1, 0.5]].map(([radius, height]) => new THREE.Vector2(radius, height))]} />{material}</mesh>
        <mesh position={[0, item.height * 0.95, 0]}><cylinderGeometry args={[0.1, 0.1, 0.035, 24]} /><meshStandardMaterial color={darkColor} roughness={0.8} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, item.height * 0.55, item.depth * 0.22]}><torusGeometry args={[0.16, 0.012, 8, 32]} /><meshStandardMaterial color={lightColor} roughness={0.8} /></mesh>
      </group>
    )
  }
  if (item.kind === 'tableLamp') {
    return (
      <group>
        <mesh position={[0, 0.035, 0]} castShadow><cylinderGeometry args={[0.19, 0.22, 0.07, 24]} /><meshStandardMaterial color={darkColor} metalness={0.2} roughness={0.55} /></mesh>
        <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.025, 0.035, 0.32, 16]} /><meshStandardMaterial color={deeperColor} metalness={0.25} roughness={0.5} /></mesh>
        <mesh position={[0, 0.44, 0]} castShadow><cylinderGeometry args={[0.11, 0.24, 0.3, 28, 1, true]} />{material}</mesh>
        <mesh position={[0, 0.29, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.11, 24]} /><meshStandardMaterial color={lightColor} emissive={lightColor} emissiveIntensity={0.12} side={THREE.DoubleSide} /></mesh>
        <pointLight position={[0, 0.3, 0]} color="#ffe0a6" intensity={0.18} distance={1.5} />
      </group>
    )
  }
  if (item.kind === 'ceilingLamp') {
    return (
      <group>
        <mesh position={[0, item.height - 0.025, 0]} castShadow><cylinderGeometry args={[0.18, 0.18, 0.05, 24]} /><meshStandardMaterial color={darkColor} metalness={0.2} roughness={0.55} /></mesh>
        <mesh position={[0, item.height * 0.58, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, item.height * 0.78, 12]} /><meshStandardMaterial color={deeperColor} metalness={0.25} roughness={0.5} /></mesh>
        <mesh position={[0, item.height * 0.2, 0]} castShadow><cylinderGeometry args={[0.13, 0.27, item.height * 0.38, 28, 1, true]} />{material}</mesh>
        <mesh position={[0, item.height * 0.01, 0]}><circleGeometry args={[0.13, 24]} /><meshStandardMaterial color={lightColor} emissive={lightColor} emissiveIntensity={0.2} side={THREE.DoubleSide} /></mesh>
        <pointLight position={[0, 0, 0]} color="#ffe0a6" intensity={0.45} distance={3} />
      </group>
    )
  }
  if (item.kind === 'tvStand') {
    return (
      <group>
        <mesh position={[0, item.height * 0.48, 0]} castShadow><boxGeometry args={[item.width * 0.96, item.height * 0.72, item.depth * 0.88]} />{material}</mesh>
        <mesh position={[0, item.height - 0.04, 0]} castShadow><boxGeometry args={[item.width, 0.08, item.depth]} /><meshStandardMaterial color={darkColor} /></mesh>
        <mesh position={[0, item.height * 0.43, item.depth * 0.45]}><boxGeometry args={[item.width * 0.035, item.height * 0.55, 0.025]} /><meshStandardMaterial color={darkColor} /></mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * item.width * 0.34, item.height * 0.48, item.depth * 0.46]}><boxGeometry args={[item.width * 0.24, item.height * 0.38, 0.025]} /><meshStandardMaterial color={lightColor} /></mesh>)}
        {[-1, 1].map((side) => <mesh key={`leg-${side}`} position={[side * item.width * 0.4, 0.055, 0]}><boxGeometry args={[0.08, 0.11, item.depth * 0.75]} /><meshStandardMaterial color={deeperColor} /></mesh>)}
      </group>
    )
  }
  if (item.kind === 'television') {
    return (
      <group>
        <mesh position={[0, item.height * 0.58, 0]} castShadow><boxGeometry args={[item.width, item.height * 0.78, 0.07]} /><meshStandardMaterial color={deeperColor} roughness={0.48} /></mesh>
        <mesh position={[0, item.height * 0.58, 0.041]}><boxGeometry args={[item.width * 0.91, item.height * 0.68, 0.012]} /><meshStandardMaterial color={darkColor} roughness={0.32} metalness={0.12} /></mesh>
        <mesh position={[0, item.height * 0.12, 0]}><boxGeometry args={[0.07, item.height * 0.24, 0.07]} /><meshStandardMaterial color={deeperColor} /></mesh>
        <mesh position={[0, item.height * 0.025, 0.015]}><boxGeometry args={[item.width * 0.34, 0.035, item.depth * 0.68]} /><meshStandardMaterial color={darkColor} /></mesh>
      </group>
    )
  }
  if (item.kind === 'rug') {
    return (
      <group>
        <mesh position={[0, 0.012, 0]} receiveShadow><boxGeometry args={[item.width, 0.02, item.depth]} /><meshStandardMaterial color={darkColor} roughness={0.96} /></mesh>
        <mesh position={[0, 0.024, 0]} receiveShadow><boxGeometry args={[item.width * 0.96, 0.004, item.depth * 0.96]} />{material}</mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * item.width * 0.28, 0.027, 0]}><boxGeometry args={[0.035, 0.002, item.depth * 0.72]} /><meshStandardMaterial color={paleColor} roughness={0.95} /></mesh>)}
        <mesh position={[0, 0.027, 0]}><boxGeometry args={[item.width * 0.62, 0.002, 0.035]} /><meshStandardMaterial color={paleColor} roughness={0.95} /></mesh>
      </group>
    )
  }
  if (item.kind === 'circularRug') {
    const radius = Math.min(item.width, item.depth) / 2
    return (
      <group>
        <mesh position={[0, 0.031, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[radius, 64]} />
          {material}
        </mesh>
        <mesh position={[0, 0.033, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 0.68, radius * 0.72, 64]} />
          <meshStandardMaterial color={paleColor} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.033, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 0.28, radius * 0.32, 48]} />
          <meshStandardMaterial color={paleColor} roughness={0.95} />
        </mesh>
      </group>
    )
  }
  if (item.kind === 'plant') {
    return (
      <group>
        <mesh position={[0, 0.16, 0]} castShadow><cylinderGeometry args={[item.width * 0.36, item.width * 0.28, 0.32, 24]} /><meshStandardMaterial color={darkColor} roughness={0.82} /></mesh>
        <mesh position={[0, 0.325, 0]}><cylinderGeometry args={[item.width * 0.36, item.width * 0.36, 0.035, 24]} /><meshStandardMaterial color={deeperColor} /></mesh>
        <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[item.width * 0.3, item.width * 0.3, 0.02, 24]} /><meshStandardMaterial color="#59493c" roughness={1} /></mesh>
        <mesh position={[0, 0.71, 0]} castShadow><cylinderGeometry args={[0.018, 0.025, 0.72, 10]} /><meshStandardMaterial color={deeperColor} /></mesh>
        {[[-0.1, 0.68, 0], [0.1, 0.76, 0.02], [0, 0.88, 0.02], [-0.08, 0.91, 0.01], [0.09, 0.59, 0.02]].map(([x, y, z], index) => (
          <mesh key={index} position={[x, y, z]} rotation={[0.2, index * 0.7, (index % 2 ? 1 : -1) * 0.3]} castShadow>
            <sphereGeometry args={[0.15, 16, 12]} /><meshStandardMaterial color={index % 2 ? lightColor : item.color} roughness={0.9} />
          </mesh>
        ))}
      </group>
    )
  }
  if (item.kind === 'bedsideTable') {
    return (
      <group>
        <mesh position={[0, 0.325, 0]} castShadow><boxGeometry args={[item.width * 0.9, 0.38, item.depth * 0.9]} />{material}</mesh>
        {[0.41, 0.25].map((drawerY) => (
          <group key={drawerY}>
            <mesh position={[0, drawerY, item.depth * 0.46]} castShadow><boxGeometry args={[item.width * 0.78, 0.13, 0.035]} /><meshStandardMaterial color={darkColor} /></mesh>
            <mesh position={[0, drawerY, item.depth * 0.5 + 0.02]}><sphereGeometry args={[0.025, 12, 12]} /><meshStandardMaterial color={paleColor} metalness={0.35} /></mesh>
          </group>
        ))}
        <mesh position={[0, item.height - 0.035, 0]} castShadow><boxGeometry args={[item.width, 0.07, item.depth]} /><meshStandardMaterial color={darkColor} /></mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * item.width * 0.4, 0.06, z * item.depth * 0.4]}><boxGeometry args={[0.055, 0.12, 0.055]} /><meshStandardMaterial color={deeperColor} /></mesh>))}
      </group>
    )
  }
  if (item.kind === 'chair') {
    return (
      <group>
        <mesh position={[0, 0.46, 0]} castShadow><boxGeometry args={[item.width, 0.1, item.depth]} />{material}</mesh>
        <mesh position={[0, 0.64, -item.depth / 2 + 0.045]} castShadow><boxGeometry args={[item.width, 0.42, 0.09]} />{material}</mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
          <mesh key={`${x}-${z}`} position={[x * item.width * 0.38, 0.22, z * item.depth * 0.36]} castShadow>
            <boxGeometry args={[0.055, 0.44, 0.055]} /><meshStandardMaterial color={darkColor} />
          </mesh>
        )))}
      </group>
    )
  }
  if (item.kind === 'bed' || item.kind === 'singleBed') {
    return (
      <group>
        <mesh position={[0, 0.13, 0]} castShadow><boxGeometry args={[item.width, 0.26, item.depth]} /><meshStandardMaterial color={deeperColor} roughness={0.86} /></mesh>
        <mesh position={[0, 0.34, -item.depth * 0.03]} castShadow><boxGeometry args={[item.width * 0.94, 0.22, item.depth * 0.88]} />{material}</mesh>
        <mesh position={[0, 0.46, -item.depth * 0.28]} castShadow><boxGeometry args={[item.width * 0.72, 0.14, item.depth * 0.22]} /><meshStandardMaterial color={paleColor} roughness={0.95} /></mesh>
        <mesh position={[0, item.height * 0.62, -item.depth / 2 + 0.055]} castShadow><boxGeometry args={[item.width, item.height * 1.05, 0.11]} /><meshStandardMaterial color={darkColor} roughness={0.82} /></mesh>
      </group>
    )
  }
  if (item.kind === 'wardrobe') {
    return (
      <group>
        <mesh position={[0, item.height / 2, 0]} castShadow><boxGeometry args={[item.width, item.height, item.depth]} />{material}</mesh>
        <mesh position={[0, item.height / 2, item.depth / 2 + 0.012]}><boxGeometry args={[0.045, item.height * 0.91, 0.025]} /><meshStandardMaterial color={darkColor} /></mesh>
        <mesh position={[0, item.height - 0.09, item.depth / 2 + 0.014]}><boxGeometry args={[item.width * 0.9, 0.06, 0.03]} /><meshStandardMaterial color={lightColor} /></mesh>
        {[-0.12, 0.12].map((x) => <mesh key={x} position={[x, item.height * 0.52, item.depth / 2 + 0.04]}><capsuleGeometry args={[0.018, 0.11, 6, 10]} /><meshStandardMaterial color={paleColor} metalness={0.4} roughness={0.4} /></mesh>)}
        <mesh position={[0, 0.055, 0]}><boxGeometry args={[item.width * 0.94, 0.11, item.depth * 0.9]} /><meshStandardMaterial color={deeperColor} /></mesh>
      </group>
    )
  }
  if (item.kind === 'bookshelf') {
    const board = 0.07
    return (
      <group>
        <mesh position={[0, item.height / 2, -item.depth / 2 + 0.035]} castShadow><boxGeometry args={[item.width, item.height, 0.07]} /><meshStandardMaterial color={deeperColor} roughness={0.88} /></mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * (item.width - board) / 2, item.height / 2, 0]} castShadow><boxGeometry args={[board, item.height, item.depth]} />{material}</mesh>)}
        {[0.05, 0.47, 0.89, 1.31, 1.73].map((height) => <mesh key={height} position={[0, Math.min(height, item.height - board / 2), 0]} castShadow><boxGeometry args={[item.width, board, item.depth]} />{material}</mesh>)}
      </group>
    )
  }
  if (item.kind === 'wastebasket') {
    const topRadius = item.width * 0.43
    return (
      <group>
        <mesh position={[0, item.height / 2, 0]} castShadow><cylinderGeometry args={[topRadius, item.width * 0.35, item.height, 28, 1, true]} /><meshStandardMaterial color={item.color} roughness={0.78} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, 0.025, 0]}><cylinderGeometry args={[item.width * 0.35, item.width * 0.35, 0.05, 28]} /><meshStandardMaterial color={darkColor} /></mesh>
        <mesh position={[0, item.height - 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[topRadius - 0.025, 32]} /><meshStandardMaterial color={deeperColor} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, item.height + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[topRadius - 0.028, topRadius, 32]} /><meshStandardMaterial color={darkColor} side={THREE.DoubleSide} /></mesh>
      </group>
    )
  }
  if (item.kind === 'pictureSmall' || item.kind === 'pictureMedium' || item.kind === 'pictureLarge') {
    const centerY = 1.4
    const frame = 0.065
    return (
      <group position={[0, centerY, 0]}>
        <mesh castShadow><boxGeometry args={[item.width, item.height, 0.07]} /><meshStandardMaterial color={darkColor} roughness={0.85} /></mesh>
        <mesh position={[0, 0, 0.045]}><boxGeometry args={[item.width - frame * 2, item.height - frame * 2, 0.035]} /><meshStandardMaterial color={lightColor} roughness={0.72} /></mesh>
        <mesh position={[-item.width * 0.2, item.height * 0.13, 0.068]} rotation={[0, 0, -0.28]}><circleGeometry args={[Math.min(item.width, item.height) * 0.16, 24]} /><meshStandardMaterial color={paleColor} /></mesh>
        <mesh position={[item.width * 0.14, -item.height * 0.11, 0.069]} rotation={[0, 0, 0.24]}><planeGeometry args={[item.width * 0.46, item.height * 0.23]} /><meshStandardMaterial color={item.color} /></mesh>
        <mesh position={[-item.width * 0.14, -item.height * 0.2, 0.07]} rotation={[0, 0, -0.18]}><planeGeometry args={[item.width * 0.34, item.height * 0.16]} /><meshStandardMaterial color={deeperColor} /></mesh>
      </group>
    )
  }
  if (item.kind === 'lamp') {
    return (
      <group>
        <mesh position={[0, 0.055, 0]} castShadow><cylinderGeometry args={[0.22, 0.25, 0.11, 28]} /><meshStandardMaterial color={darkColor} metalness={0.25} roughness={0.55} /></mesh>
        <mesh position={[0, item.height * 0.48, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, item.height * 0.88, 16]} /><meshStandardMaterial color={deeperColor} metalness={0.35} roughness={0.45} /></mesh>
        <mesh position={[0, item.height * 0.88, 0]} castShadow><coneGeometry args={[0.28, 0.42, 28, 1, true]} />{material}</mesh>
        <pointLight position={[0, item.height * 0.82, 0]} intensity={0.35} distance={2.2} color="#ffd891" />
      </group>
    )
  }
  return (
    <group>
      <mesh position={[0, item.height / 2, 0]} castShadow>{material}<boxGeometry args={[item.width, item.height, item.depth]} /></mesh>
      <mesh position={[0, item.height / 2, item.depth / 2 + 0.012]}><boxGeometry args={[0.035, item.height * 0.86, 0.02]} /><meshStandardMaterial color={darkColor} /></mesh>
      {[-0.15, 0.15].map((x) => <mesh key={x} position={[x, item.height / 2, item.depth / 2 + 0.028]}><sphereGeometry args={[0.027, 12, 12]} /><meshStandardMaterial color={paleColor} metalness={0.25} /></mesh>)}
      {[-1, 1].map((x) => <mesh key={x} position={[x * item.width * 0.38, 0.06, 0]}><boxGeometry args={[0.09, 0.12, item.depth * 0.72]} /><meshStandardMaterial color={deeperColor} /></mesh>)}
    </group>
  )
}

type FloorMoveAxis = 'x' | 'y' | 'z'

function RotationHandle({ item }: { item: FurnitureItem }) {
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

function FrontRotationHandle({ item, wall }: { item: FurnitureItem; wall: WallSide }) {
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

function AxisMoveGizmo({ item, groundLevel = false, hideAxis = null, canMoveVertically = true }: { item: FurnitureItem; groundLevel?: boolean; hideAxis?: FloorMoveAxis | null; canMoveVertically?: boolean }) {
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

function FrontAxisMoveGizmo({ item, wall }: { item: FurnitureItem; wall: WallSide }) {
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

function FurnitureObject({ item, selected, canDrag, planView, frontWall }: { item: FurnitureItem; selected: boolean; canDrag: boolean; planView: boolean; frontWall: WallSide | null }) {
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
      ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
      return
    }
    if (!event.ray.intersectPlane(floorPlane, point)) return
    dragOffset.current = { x: point.x - item.x, z: point.z - item.z }
    beginFurnitureMove()
    setDragging(true)
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
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
        onPointerCancel={() => {
          if (dragging) {
            recordSceneInteraction('furniture.drag-cancel', { id: item.id, name: item.name })
            endFurnitureMove()
          }
          setDragging(false)
        }}
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

function RoomWorld({ modelRootRef, ...props }: SceneProps & { modelRootRef: RefObject<THREE.Group | null> }) {
  const selectedId = useRoomStore((state) => state.selectedId)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const selectElement = useRoomStore((state) => state.selectElement)
  const cameraRoom = {
    ...props.room,
    height: Math.max(props.room.height, ...props.structurePacks.map((pack) => pack.y + props.room.height)),
  }
  const { hidden, labeledWalls, gridWalls } = wallVisibility(props)

  return (
    <>
      <CameraRig room={cameraRoom} view={props.view} orientation={props.orientation} isoAngle={props.isoAngle} isIsoOrbitDragging={props.isIsoOrbitDragging} freeAzimuth={props.freeAzimuth} freeElevation={props.freeElevation} isFreeOrbitDragging={props.isFreeOrbitDragging} cameraZoom={props.cameraZoom} wallView={props.wallView} frontCameraHeight={props.frontCameraHeight} povYaw={props.povYaw} />
      <color attach="background" args={['#e8dfd3']} />
      <ambientLight intensity={1.35} />
      <StudioLight room={props.room} />
      <hemisphereLight args={['#ddecf0', '#bd9170', 0.75]} />

      <RoomShell room={props.room} modelRootRef={modelRootRef} showFloorGrid={!props.exportMode && props.gridVisibility.floor}>
        {WALL_SIDES.map((wall) => (
          <SoftWall
            key={wall}
            room={props.room}
            wall={wall}
            hidden={hidden.includes(wall)}
            showOpeningDetails={props.exportMode || props.view !== 'top'}
            showGrid={gridWalls.includes(wall) && props.gridVisibility[wall]}
            exportMode={props.exportMode}
          />
        ))}
        {labeledWalls.map((wall) => <WallIdentityLabel key={`label-${wall}`} room={props.room} wall={wall} view={props.view} wallView={props.wallView} />)}
        {props.structurePacks.map((pack) => (
          <group key={pack.id} position={[pack.x, pack.y, pack.z]} visible={!hiddenElementIds.includes(pack.id)}>
            {pack.surfaces.map((surface) => {
              const surfaceId = `structure-surface:${pack.id}:${surface.id}`
              const independentSurface = pack.id.startsWith('floor-object-') || pack.id.startsWith('wall-object-')
              return (
                <StructureSurfaceObject
                  key={surface.id}
                  room={props.room}
                  packId={pack.id}
                  packName={pack.name}
                  surface={surface}
                  hidden={hiddenElementIds.includes(surfaceId) || (!independentSurface && surface.kind === 'wall' && surface.wall !== undefined && hidden.includes(surface.wall))}
                  selected={!props.exportMode && selectedId === surfaceId}
                  onSelect={() => selectElement(surfaceId)}
                />
              )
            })}
          </group>
        ))}
        {!props.exportMode && props.view === 'top' && WALL_SIDES.flatMap((wall) =>
          openingsForWall(props.room, wall)
            .filter((opening) => !hiddenElementIds.includes(opening.id))
            .map((opening) => <PlanOpening key={`${wall}-${opening.id}`} room={props.room} opening={opening} wall={wall} />),
        )}
        {props.furniture.filter((item) => !hiddenElementIds.includes(item.id)).map((item) => (
          <FurnitureObject
            key={item.id}
            item={item}
            selected={!props.exportMode && item.id === selectedId}
            canDrag={props.view !== 'pov'}
            planView={props.view === 'top'}
            frontWall={props.view === 'front' ? props.wallView ?? 'north' : null}
          />
        ))}
      </RoomShell>
    </>
  )
}

const compassFace = (wall: WallSide, visibleWalls: WallSide[]) => visibleWalls.includes(wall)
  ? { color: '#67a47b', opacity: 0.74 }
  : { color: '#dfe6e1', opacity: 0.18 }

function CompassFaceMaterial({ attach, wall, visibleWalls, hovered }: { attach: string; wall: WallSide; visibleWalls: WallSide[]; hovered: boolean }) {
  const face = compassFace(wall, visibleWalls)
  return (
    <meshStandardMaterial
      attach={attach}
      color={hovered ? '#e9a866' : face.color}
      opacity={hovered ? 0.88 : face.opacity}
      transparent
      depthWrite={false}
      roughness={0.68}
      side={THREE.DoubleSide}
    />
  )
}

function CompassWallMarker({
  wall,
  position,
  active,
  onClick,
}: {
  wall: WallSide
  position: [number, number, number]
  active: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (context) {
      context.shadowColor = 'rgba(42, 57, 48, 0.2)'
      context.shadowBlur = 12
      context.shadowOffsetY = 5
      context.beginPath()
      context.arc(64, 60, 49, 0, Math.PI * 2)
      context.fillStyle = hovered ? '#e9a866' : active ? '#52705d' : '#fffdf9'
      context.fill()
      context.shadowColor = 'transparent'
      context.lineWidth = 5
      context.strokeStyle = hovered ? '#b87337' : active ? '#405748' : '#829087'
      context.stroke()
      context.font = '900 54px Arial, sans-serif'
      context.fillStyle = hovered || active ? '#fffdf9' : '#405748'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(WALL_LABELS[wall], 64, 63)
    }
    const nextTexture = new THREE.CanvasTexture(canvas)
    nextTexture.colorSpace = THREE.SRGBColorSpace
    return nextTexture
  }, [active, hovered, wall])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite
      position={position}
      scale={hovered ? [0.67, 0.67, 0.67] : [0.6, 0.6, 0.6]}
      renderOrder={12}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onClick()
      }}
      onPointerEnter={() => {
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerLeave={() => {
        setHovered(false)
        document.body.style.cursor = ''
      }}
    >
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

function CompassIsoMarker({
  walls,
  position,
  active,
  onClick,
}: {
  walls: [WallSide, WallSide]
  position: [number, number, number]
  active: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const label = walls.map((wall) => WALL_LABELS[wall]).join('+')
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (context) {
      context.shadowColor = 'rgba(42, 57, 48, 0.18)'
      context.shadowBlur = 12
      context.shadowOffsetY = 5
      context.beginPath()
      context.roundRect(10, 27, 108, 66, 24)
      context.fillStyle = hovered ? '#e9a866' : active ? '#52705d' : '#fffdf9'
      context.fill()
      context.shadowColor = 'transparent'
      context.lineWidth = 5
      context.strokeStyle = hovered ? '#b87337' : active ? '#405748' : '#a3aca5'
      context.stroke()

      context.font = '900 38px Arial, sans-serif'
      context.fillStyle = hovered || active ? '#fffdf9' : '#405748'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(label, 64, 61)
    }
    const nextTexture = new THREE.CanvasTexture(canvas)
    nextTexture.colorSpace = THREE.SRGBColorSpace
    return nextTexture
  }, [active, hovered, label])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite
      position={position}
      scale={hovered ? [0.98, 0.8, 0.8] : [0.88, 0.72, 0.72]}
      renderOrder={13}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onClick()
      }}
      onPointerEnter={() => {
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerLeave={() => {
        setHovered(false)
        document.body.style.cursor = ''
      }}
    >
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

function CompassAxisLabel({
  label,
  color,
  position,
  onClick,
}: {
  label: string
  color: string
  position: [number, number, number]
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (context) {
      context.beginPath()
      context.arc(64, 64, 51, 0, Math.PI * 2)
      context.fillStyle = color
      context.fill()
      context.lineWidth = 5
      context.strokeStyle = hovered ? '#fffdf9' : 'rgba(31, 39, 33, 0.22)'
      context.stroke()
      context.font = '900 60px Arial, sans-serif'
      context.fillStyle = '#fffdf9'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(label, 64, 66)
    }
    const nextTexture = new THREE.CanvasTexture(canvas)
    nextTexture.colorSpace = THREE.SRGBColorSpace
    return nextTexture
  }, [color, hovered, label])
  useEffect(() => () => texture.dispose(), [texture])

  return (
    <sprite
      position={position}
      scale={hovered ? [0.48, 0.48, 0.48] : [0.42, 0.42, 0.42]}
      renderOrder={14}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onClick()
      }}
      onPointerEnter={() => {
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerLeave={() => {
        setHovered(false)
        document.body.style.cursor = ''
      }}
    >
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

function CompassAxisDot({
  color,
  position,
  onClick,
}: {
  color: string
  position: [number, number, number]
  onClick: () => void
}) {
  return (
    <mesh
      position={position}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onClick()
      }}
      onPointerEnter={() => { document.body.style.cursor = 'pointer' }}
      onPointerLeave={() => { document.body.style.cursor = '' }}
    >
      <sphereGeometry args={[0.09, 16, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

export function FreeCameraCompass3D({
  azimuth,
  elevation,
  onOrientationSelect,
}: {
  azimuth: number
  elevation: number
  onOrientationSelect: (azimuth: number, elevation: number) => void
}) {
  const cameraRotation = useMemo(() => {
    const orientation = new THREE.Object3D()
    const horizontal = Math.cos(elevation)
    orientation.position.set(
      Math.cos(azimuth) * horizontal,
      Math.sin(elevation),
      Math.sin(azimuth) * horizontal,
    )
    orientation.lookAt(0, 0, 0)
    return orientation.quaternion.clone().invert()
  }, [azimuth, elevation])

  return (
    <Canvas
      className="compass-3d-scene"
      orthographic
      camera={{ position: [0, 0, 5], zoom: 45, near: 0.1, far: 20 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={1.8} />
      <group quaternion={cameraRotation} scale={1.4}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 1.35, 8]} />
          <meshBasicMaterial color="#ef476f" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.35, 8]} />
          <meshBasicMaterial color="#2476d2" />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.025, 0.025, 1.35, 8]} />
          <meshBasicMaterial color="#1ab978" />
        </mesh>
        <CompassAxisDot color="#bc174d" position={[-0.77, 0, 0]} onClick={() => onOrientationSelect(Math.PI, 0)} />
        <CompassAxisLabel label="X" color="#f52260" position={[0.83, 0, 0]} onClick={() => onOrientationSelect(0, 0)} />
        <CompassAxisDot color="#1457a4" position={[0, 0, -0.77]} onClick={() => onOrientationSelect(-Math.PI / 2, 0)} />
        <CompassAxisLabel label="Z" color="#2476d2" position={[0, 0, 0.83]} onClick={() => onOrientationSelect(Math.PI / 2, 0)} />
        <CompassAxisDot color="#11915c" position={[0, -0.77, 0]} onClick={() => onOrientationSelect(azimuth, -1.42)} />
        <CompassAxisLabel label="Y" color="#1ab978" position={[0, 0.83, 0]} onClick={() => onOrientationSelect(azimuth, 1.42)} />
      </group>
    </Canvas>
  )
}

interface RoomCompass3DProps {
  visibleWalls: WallSide[]
  highlightTop: boolean
  activeOrientation: number | null
  onOrientationSelect: (orientation: number) => void
  onTopView: () => void
  onWallView: (wall: WallSide) => void
}

export function RoomCompass3D({ visibleWalls, highlightTop, activeOrientation, onOrientationSelect, onTopView, onWallView }: RoomCompass3DProps) {
  const [hoveredFace, setHoveredFace] = useState<number | null>(null)
  const cubeRotation: [number, number, number] = [0.48, -0.62, 0]
  const cubeSize = 0.72
  const wallMarkerPositions: Record<WallSide, [number, number, number]> = {
    north: [1.02, 1.02, 1.6],
    east: [1.02, -1.02, 1.6],
    south: [-1.02, -1.02, 1.6],
    west: [-1.02, 1.02, 1.6],
  }
  const isoMarkers: { orientation: number; walls: [WallSide, WallSide]; position: [number, number, number] }[] = [
    { orientation: 0, walls: ['west', 'north'], position: [0, 1.42, 1.6] },
    { orientation: 1, walls: ['north', 'east'], position: [1.42, 0, 1.6] },
    { orientation: 2, walls: ['east', 'south'], position: [0, -1.42, 1.6] },
    { orientation: 3, walls: ['south', 'west'], position: [-1.42, 0, 1.6] },
  ]
  const handleCubeFaceClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    const materialIndex = event.face?.materialIndex
    if (materialIndex === 2 || materialIndex === 3) onTopView()
    else if (materialIndex === 0) onWallView('west')
    else if (materialIndex === 1) onWallView('east')
    else if (materialIndex === 4) onWallView('north')
    else if (materialIndex === 5) onWallView('south')
  }
  return (
    <Canvas
      className="compass-3d-scene"
      orthographic
      camera={{ position: [0, 0, 5], zoom: 45, near: 0.1, far: 20 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={1.8} />
      <directionalLight position={[-3, 5, 6]} intensity={2.4} color="#fff7eb" />
      <group rotation={cubeRotation}>
        <mesh
          onClick={handleCubeFaceClick}
          onPointerMove={(event) => {
            event.stopPropagation()
            setHoveredFace(event.face?.materialIndex ?? null)
          }}
          onPointerEnter={() => { document.body.style.cursor = 'pointer' }}
          onPointerLeave={() => {
            setHoveredFace(null)
            document.body.style.cursor = ''
          }}
        >
          <boxGeometry args={[cubeSize, cubeSize, cubeSize]} />
          <CompassFaceMaterial attach="material-0" wall="east" visibleWalls={visibleWalls} hovered={hoveredFace === 0} />
          <CompassFaceMaterial attach="material-1" wall="west" visibleWalls={visibleWalls} hovered={hoveredFace === 1} />
          <meshStandardMaterial attach="material-2" color={hoveredFace === 2 ? '#e9a866' : highlightTop ? '#67a47b' : '#f2f5f2'} opacity={hoveredFace === 2 ? 0.88 : highlightTop ? 0.78 : 0.22} transparent depthWrite={false} roughness={0.68} />
          <meshStandardMaterial attach="material-3" color={hoveredFace === 3 ? '#e9a866' : '#bfc9c1'} opacity={hoveredFace === 3 ? 0.88 : 0.14} transparent depthWrite={false} roughness={0.8} />
          <CompassFaceMaterial attach="material-4" wall="south" visibleWalls={visibleWalls} hovered={hoveredFace === 4} />
          <CompassFaceMaterial attach="material-5" wall="north" visibleWalls={visibleWalls} hovered={hoveredFace === 5} />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)]} />
          <lineBasicMaterial color="#68776c" transparent opacity={0.62} />
        </lineSegments>
      </group>
      {WALL_SIDES.map((wall) => (
        <CompassWallMarker
          key={wall}
          wall={wall}
          position={wallMarkerPositions[wall]}
          active={visibleWalls.includes(wall)}
          onClick={() => onWallView(wall)}
        />
      ))}
      {isoMarkers.map((marker) => (
        <CompassIsoMarker
          key={marker.orientation}
          walls={marker.walls}
          position={marker.position}
          active={activeOrientation === marker.orientation}
          onClick={() => onOrientationSelect(marker.orientation)}
        />
      ))}
    </Canvas>
  )
}

export default function RoomScene(props: SceneProps) {
  const perspective = props.view === 'pov' || props.view === 'free'
  const selectElement = useRoomStore((state) => state.selectElement)
  const modelRootRef = useRef<THREE.Group>(null)
  return (
    <Canvas
      key={perspective ? 'perspective' : 'orthographic'}
      className={props.view === 'isometric' || props.view === 'free' ? 'room-scene-canvas--orbit' : 'room-scene-canvas'}
      orthographic={!perspective}
      camera={perspective ? { fov: 62, near: 0.05, far: 80 } : { near: 0.1, far: 80, zoom: 55 }}
      shadows
      dpr={[1, 1.7]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onPointerMissed={(event) => {
        recordSceneInteraction('pointer-missed', {
          target: event.target instanceof Element ? event.target.tagName.toLowerCase() : 'canvas',
          x: Math.round(event.clientX),
          y: Math.round(event.clientY),
        })
        selectElement(null)
      }}
    >
      <RoomWorld {...props} modelRootRef={modelRootRef} />
      <OrbitPointerController view={props.view === 'isometric' || props.view === 'free' ? props.view : null} />
      <SceneExportController
        modelRootRef={modelRootRef}
        exportRequest={props.exportRequest}
        exportDesignName={props.exportDesignName}
        onExportComplete={props.onExportComplete}
      />
    </Canvas>
  )
}

function OrbitPointerController({ view }: { view: 'isometric' | 'free' | null }) {
  const { camera, gl, scene } = useThree()

  useEffect(() => {
    if (!view) return

    const canvas = gl.domElement
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let drag: { pointerId: number; startX: number; startY: number; angle: number; elevation: number } | null = null

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const bounds = canvas.getBoundingClientRect()
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const firstVisibleHit = raycaster
        .intersectObjects(scene.children, true)
        .find(({ object }) => !(object instanceof THREE.Line))
      let hitOrbitSurface = firstVisibleHit?.object.userData.freeOrbitSurface === true
      firstVisibleHit?.object.traverseAncestors((ancestor) => {
        if (ancestor.userData.freeOrbitSurface === true) hitOrbitSurface = true
      })
      if (firstVisibleHit && !hitOrbitSurface) return

      const state = useRoomStore.getState()
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        angle: view === 'isometric' ? state.isoAngle : state.freeAzimuth,
        elevation: state.freeElevation,
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      canvas.setPointerCapture(event.pointerId)
      state.selectElement(null)
      if (view === 'isometric') state.setIsoOrbitDragging(true)
      else state.setFreeOrbitDragging(true)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const state = useRoomStore.getState()
      if (view === 'isometric') {
        state.setIsoAngle(drag.angle + (event.clientX - drag.startX) * 0.009)
      } else {
        state.setFreeOrbit(
          drag.angle + (event.clientX - drag.startX) * 0.009,
          drag.elevation + (event.clientY - drag.startY) * 0.009,
        )
      }
    }

    const finishDrag = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return
      event.stopImmediatePropagation()
      drag = null
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      const state = useRoomStore.getState()
      if (view === 'isometric') state.setIsoOrbitDragging(false)
      else state.setFreeOrbitDragging(false)
    }

    canvas.addEventListener('pointerdown', onPointerDown, true)
    canvas.addEventListener('pointermove', onPointerMove, true)
    canvas.addEventListener('pointerup', finishDrag, true)
    canvas.addEventListener('pointercancel', finishDrag, true)
    canvas.addEventListener('lostpointercapture', finishDrag, true)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown, true)
      canvas.removeEventListener('pointermove', onPointerMove, true)
      canvas.removeEventListener('pointerup', finishDrag, true)
      canvas.removeEventListener('pointercancel', finishDrag, true)
      canvas.removeEventListener('lostpointercapture', finishDrag, true)
      if (drag) {
        const state = useRoomStore.getState()
        if (view === 'isometric') state.setIsoOrbitDragging(false)
        else state.setFreeOrbitDragging(false)
      }
    }
  }, [camera, gl, scene, view])

  return null
}

function SceneExportController({
  modelRootRef,
  exportRequest,
  exportDesignName,
  onExportComplete,
}: {
  modelRootRef: RefObject<THREE.Group | null>
  exportRequest: number
  exportDesignName: string
  onExportComplete: (error?: Error) => void
}) {
  useEffect(() => {
    if (exportRequest === 0) return
    const root = modelRootRef.current
    if (!root) {
      onExportComplete(new Error('La escena 3D todavía no está lista.'))
      return
    }

    const exportRoot = root.clone(true)
    exportRoot.visible = true
    exportRoot.updateMatrixWorld(true)
    const removeFromExport: THREE.Object3D[] = []
    exportRoot.traverse((object) => {
      const invisibleHitArea = object instanceof THREE.Mesh
        && (Array.isArray(object.material) ? object.material : [object.material]).some((material) => !material.colorWrite)
      if (
        object instanceof THREE.Line
        || object instanceof THREE.Sprite
        || object instanceof THREE.Camera
        || object instanceof THREE.Light
        || invisibleHitArea
      ) {
        removeFromExport.push(object)
      }
    })
    removeFromExport.forEach((object) => object.parent?.remove(object))

    try {
      new GLTFExporter().parse(
        exportRoot,
        (result) => {
          if (!(result instanceof ArrayBuffer)) {
            onExportComplete(new Error('No se pudo crear el archivo GLB.'))
            return
          }
          const url = URL.createObjectURL(new Blob([result], { type: 'model/gltf-binary' }))
          const link = document.createElement('a')
          link.href = url
          link.download = `${exportDesignName}-${new Date().toISOString().slice(0, 10)}.glb`
          link.click()
          window.setTimeout(() => URL.revokeObjectURL(url), 1000)
          recordSceneInteraction('model.exported', { format: 'glb' })
          onExportComplete()
        },
        (error) => {
          recordSceneInteraction('model.export-failed', {
            message: error instanceof Error ? error.message : 'Error al exportar el modelo 3D.',
          })
          onExportComplete(error instanceof Error ? error : new Error('Error al exportar el modelo 3D.'))
        },
        { binary: true, onlyVisible: true },
      )
    } catch (error) {
      const exportError = error instanceof Error ? error : new Error('Error al exportar el modelo 3D.')
      recordSceneInteraction('model.export-failed', { message: exportError.message })
      onExportComplete(exportError)
    }
  }, [exportDesignName, exportRequest, modelRootRef, onExportComplete])

  return null
}
