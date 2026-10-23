import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { FURNITURE_PRESETS, ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from '../domain/constants'
import { buildWallSegments, doorWorldPosition, hiddenWallForCardinalTarget, hiddenWallsForOrientation, inwardDirection, openingsForWall, shortestAngleDelta, snapFurnitureRotation, wallLength } from '../domain/geometry'
import type { FurnitureItem, GridSurface, RoomConfig, ViewMode, WallOpening, WallSide } from '../domain/types'
import { recordInteraction, type InteractionDetails } from '../debug/interactionLog'
import { useRoomStore } from '../state/useRoomStore'

function recordSceneInteraction(action: string, details?: InteractionDetails) {
  const state = useRoomStore.getState()
  recordInteraction(`scene.${action}`, {
    view: state.view,
    selectedId: state.selectedId,
    details,
  })
}

interface SceneProps {
  room: RoomConfig
  view: ViewMode
  orientation: number
  isoAngle: number
  isIsoOrbitDragging: boolean
  cameraZoom: number
  wallView: WallSide | null
  frontCameraHeight: number
  povYaw: number
  gridSnap: boolean
  gridVisibility: Record<GridSurface, boolean>
  furniture: FurnitureItem[]
}

const wallPlacement: Record<WallSide, (room: RoomConfig) => { position: [number, number, number]; rotation: [number, number, number] }> = {
  north: (room) => ({ position: [0, 0, -room.depth / 2], rotation: [0, 0, 0] }),
  south: (room) => ({ position: [0, 0, room.depth / 2], rotation: [0, Math.PI, 0] }),
  east: (room) => ({ position: [room.width / 2, 0, 0], rotation: [0, -Math.PI / 2, 0] }),
  west: (room) => ({ position: [-room.width / 2, 0, 0], rotation: [0, Math.PI / 2, 0] }),
}

function CameraRig({ room, view, isoAngle, isIsoOrbitDragging, cameraZoom, wallView, frontCameraHeight, povYaw }: Pick<SceneProps, 'room' | 'view' | 'isoAngle' | 'isIsoOrbitDragging' | 'cameraZoom' | 'wallView' | 'frontCameraHeight' | 'povYaw'>) {
  const { camera, size } = useThree()
  const initialized = useRef(false)
  const previousMode = useRef({ view, wallView })
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const animation = useRef<{
    active: boolean
    elapsed: number
    duration: number
    fromPosition: THREE.Vector3
    toPosition: THREE.Vector3
    fromQuaternion: THREE.Quaternion
    toQuaternion: THREE.Quaternion
    fromZoom: number
    toZoom: number
    orbit: null | {
      center: THREE.Vector3
      fromAngle: number
      toAngle: number
      fromRadius: number
      toRadius: number
      fromHeight: number
      toHeight: number
    }
    spatialOrbit: null | {
      fromCenter: THREE.Vector3
      toCenter: THREE.Vector3
      fromRadius: number
      toRadius: number
      fromPhi: number
      toPhi: number
      fromTheta: number
      toTheta: number
    }
  }>({
    active: false,
    elapsed: 0,
    duration: 0.55,
    fromPosition: new THREE.Vector3(),
    toPosition: new THREE.Vector3(),
    fromQuaternion: new THREE.Quaternion(),
    toQuaternion: new THREE.Quaternion(),
    fromZoom: 1,
    toZoom: 1,
    orbit: null,
    spatialOrbit: null,
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReduceMotion(media.matches)
    media.addEventListener('change', updatePreference)
    return () => media.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    const previous = previousMode.current
    previousMode.current = { view, wallView }
    const targetCamera = camera.clone()
    const frontLookHeight = room.height / 2
    let targetZoom = 1

    if (view === 'pov') {
      const position = doorWorldPosition(room, room.door)
      const direction = new THREE.Vector3(...inwardDirection(room.door.wall))
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(povYaw))
      targetCamera.position.set(...position)
      targetCamera.up.set(0, 1, 0)
      targetCamera.lookAt(position[0] + direction.x, position[1] - 0.04, position[2] + direction.z)
      if (targetCamera instanceof THREE.PerspectiveCamera) targetCamera.aspect = size.width / Math.max(size.height, 1)
    } else if (view === 'top') {
      const zoom = Math.min(size.width / (room.width + 2.2), size.height / (room.depth + 2.2))
      targetCamera.position.set(0, 12, 0.001)
      targetCamera.up.set(0, 0, -1)
      targetCamera.lookAt(0, 0, 0)
      targetZoom = Math.max(36, zoom)
    } else if (view === 'front') {
      const targetWall = wallView ?? 'north'
      const distance = Math.max(room.width, room.depth) * 3 + 10
      const elevation = frontCameraHeight
      const positions: Record<WallSide, [number, number, number]> = {
        north: [0, elevation, distance],
        east: [-distance, elevation, 0],
        south: [0, elevation, -distance],
        west: [distance, elevation, 0],
      }
      const across = targetWall === 'north' || targetWall === 'south' ? room.width : room.depth
      const projectedHeight = room.height + Math.abs(frontCameraHeight - frontLookHeight) * 0.35
      targetCamera.position.set(...positions[targetWall])
      targetCamera.up.set(0, 1, 0)
      targetCamera.lookAt(0, frontLookHeight, 0)
      targetZoom = Math.max(38, Math.min(
        size.width / (across + 1.2),
        size.height / (projectedHeight + 2.5),
      ))
    } else {
      const radius = Math.sqrt(8 ** 2 + 8 ** 2)
      targetCamera.position.set(Math.cos(isoAngle) * radius, 7, Math.sin(isoAngle) * radius)
      targetCamera.up.set(0, 1, 0)
      targetCamera.lookAt(0, 0.45, 0)
      targetZoom = Math.max(38, Math.min(size.width / (room.width + room.depth + 1) * 1.15, size.height / (room.height + room.depth + 1.8) * 1.25))
    }

    targetZoom *= cameraZoom
    if (targetCamera instanceof THREE.OrthographicCamera || targetCamera instanceof THREE.PerspectiveCamera) targetCamera.zoom = targetZoom
    targetCamera.updateProjectionMatrix()
    const currentZoom = 'zoom' in camera ? camera.zoom : 1

    if (!initialized.current || reduceMotion || (view === 'isometric' && isIsoOrbitDragging)) {
      camera.position.copy(targetCamera.position)
      camera.quaternion.copy(targetCamera.quaternion)
      if (camera instanceof THREE.OrthographicCamera || camera instanceof THREE.PerspectiveCamera) camera.zoom = targetZoom
      if (camera instanceof THREE.PerspectiveCamera && targetCamera instanceof THREE.PerspectiveCamera) camera.aspect = targetCamera.aspect
      camera.updateProjectionMatrix()
      animation.current.active = false
      initialized.current = true
      return
    }

    const shouldOrbitAroundRoom = (
      view === 'isometric'
      && wallView === null
      && previous.view === 'isometric'
      && previous.wallView === null
    ) || (
      view === 'front'
      && previous.view === 'front'
    )
    const orbitCenter = new THREE.Vector3(0, view === 'front' ? frontLookHeight : 0.45, 0)
    const fromAngle = Math.atan2(camera.position.z, camera.position.x)
    const targetAngle = Math.atan2(targetCamera.position.z, targetCamera.position.x)
    const orbit = shouldOrbitAroundRoom ? {
      center: orbitCenter,
      fromAngle,
      toAngle: fromAngle + shortestAngleDelta(fromAngle, targetAngle),
      fromRadius: Math.hypot(camera.position.x, camera.position.z),
      toRadius: Math.hypot(targetCamera.position.x, targetCamera.position.z),
      fromHeight: camera.position.y,
      toHeight: targetCamera.position.y,
    } : null
    const elevatedRoomView = (mode: ViewMode) => mode === 'front' || mode === 'isometric'
    const shouldOrbitBetweenRoomAndTop = (
      view === 'top' && elevatedRoomView(previous.view)
    ) || (
      elevatedRoomView(view) && previous.view === 'top'
    )
    const orbitHeightForView = (mode: ViewMode) => {
      if (mode === 'front') return frontLookHeight
      if (mode === 'isometric') return 0.45
      return 0
    }
    const fromCenter = new THREE.Vector3(0, orbitHeightForView(previous.view), 0)
    const toCenter = new THREE.Vector3(0, orbitHeightForView(view), 0)
    const fromSpherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(fromCenter))
    const toSpherical = new THREE.Spherical().setFromVector3(targetCamera.position.clone().sub(toCenter))
    const spatialOrbit = shouldOrbitBetweenRoomAndTop ? {
      fromCenter,
      toCenter,
      fromRadius: fromSpherical.radius,
      toRadius: toSpherical.radius,
      fromPhi: fromSpherical.phi,
      toPhi: toSpherical.phi,
      fromTheta: fromSpherical.theta,
      toTheta: fromSpherical.theta + shortestAngleDelta(fromSpherical.theta, toSpherical.theta),
    } : null

    animation.current = {
      active: true,
      elapsed: 0,
      duration: spatialOrbit ? 0.75 : 0.55,
      fromPosition: camera.position.clone(),
      toPosition: targetCamera.position.clone(),
      fromQuaternion: camera.quaternion.clone(),
      toQuaternion: targetCamera.quaternion.clone(),
      fromZoom: currentZoom,
      toZoom: targetZoom,
      orbit,
      spatialOrbit,
    }
    if (camera instanceof THREE.PerspectiveCamera && targetCamera instanceof THREE.PerspectiveCamera) {
      camera.aspect = targetCamera.aspect
      camera.updateProjectionMatrix()
    }
  }, [camera, cameraZoom, frontCameraHeight, isoAngle, isIsoOrbitDragging, povYaw, reduceMotion, room, size, view, wallView])

  useFrame((_, delta) => {
    const transition = animation.current
    if (!transition.active) return

    transition.elapsed = Math.min(transition.elapsed + delta, transition.duration)
    const progress = transition.elapsed / transition.duration
    const eased = 1 - Math.pow(1 - progress, 3)
    if (transition.spatialOrbit) {
      const center = new THREE.Vector3().lerpVectors(transition.spatialOrbit.fromCenter, transition.spatialOrbit.toCenter, eased)
      const spherical = new THREE.Spherical(
        THREE.MathUtils.lerp(transition.spatialOrbit.fromRadius, transition.spatialOrbit.toRadius, eased),
        THREE.MathUtils.lerp(transition.spatialOrbit.fromPhi, transition.spatialOrbit.toPhi, eased),
        THREE.MathUtils.lerp(transition.spatialOrbit.fromTheta, transition.spatialOrbit.toTheta, eased),
      )
      camera.position.setFromSpherical(spherical).add(center)
      camera.quaternion.slerpQuaternions(transition.fromQuaternion, transition.toQuaternion, eased)
    } else if (transition.orbit) {
      const angle = THREE.MathUtils.lerp(transition.orbit.fromAngle, transition.orbit.toAngle, eased)
      const radius = THREE.MathUtils.lerp(transition.orbit.fromRadius, transition.orbit.toRadius, eased)
      const height = THREE.MathUtils.lerp(transition.orbit.fromHeight, transition.orbit.toHeight, eased)
      camera.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius)
      camera.up.set(0, 1, 0)
      camera.lookAt(transition.orbit.center)
    } else {
      camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased)
      camera.quaternion.slerpQuaternions(transition.fromQuaternion, transition.toQuaternion, eased)
    }
    if (camera instanceof THREE.OrthographicCamera || camera instanceof THREE.PerspectiveCamera) {
      camera.zoom = THREE.MathUtils.lerp(transition.fromZoom, transition.toZoom, eased)
      camera.updateProjectionMatrix()
    }
    if (progress >= 1) {
      camera.position.copy(transition.toPosition)
      camera.quaternion.copy(transition.toQuaternion)
      if (camera instanceof THREE.OrthographicCamera || camera instanceof THREE.PerspectiveCamera) {
        camera.zoom = transition.toZoom
        camera.updateProjectionMatrix()
      }
      transition.active = false
    }
  })

  return null
}

function WallGrid({ segments }: { segments: ReturnType<typeof buildWallSegments> }) {
  const positions = useMemo(() => {
    const lines: number[] = []
    const step = ROOM_LIMITS.gridSize
    const epsilon = 0.001
    segments.forEach((segment) => {
      const left = segment.center[0] - segment.size[0] / 2
      const right = segment.center[0] + segment.size[0] / 2
      const bottom = segment.center[1] - segment.size[1] / 2
      const top = segment.center[1] + segment.size[1] / 2

      for (let x = Math.ceil((left - epsilon) / step) * step; x <= right + epsilon; x += step) {
        lines.push(x, bottom, 0.066, x, top, 0.066)
      }
      for (let y = Math.ceil((bottom - epsilon) / step) * step; y <= top + epsilon; y += step) {
        lines.push(left, y, 0.066, right, y, 0.066)
      }
    })
    return new Float32Array(lines)
  }, [segments])

  return (
    <lineSegments renderOrder={2} raycast={() => undefined}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#8b8176" transparent opacity={0.44} depthWrite={false} />
    </lineSegments>
  )
}

function SoftWall({ room, wall, hidden, showOpeningDetails, showGrid }: { room: RoomConfig; wall: WallSide; hidden: boolean; showOpeningDetails: boolean; showGrid: boolean }) {
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const selectedId = useRoomStore((state) => state.selectedId)
  const selectElement = useRoomStore((state) => state.selectElement)
  const length = wallLength(room, wall)
  const openings = openingsForWall(room, wall)
  const segments = buildWallSegments(length, room.height, openings)
  const placement = wallPlacement[wall](room)

  return (
    <group position={placement.position} rotation={placement.rotation}>
      {!hidden && <group>
        {segments.map((segment, index) => (
          <mesh
            key={`${wall}-${index}`}
            position={[segment.center[0], segment.center[1], 0]}
            castShadow
            receiveShadow
            onPointerDown={(event) => {
              event.stopPropagation()
              recordSceneInteraction('background.pointer-down', { target: 'wall', wall, segment: index })
              selectElement(null)
            }}
          >
            <boxGeometry args={[segment.size[0], segment.size[1], 0.12]} />
            <meshStandardMaterial color="#f5eadb" roughness={0.92} />
          </mesh>
        ))}
        <mesh position={[0, 0.055, 0.075]} onPointerDown={(event) => {
          event.stopPropagation()
          recordSceneInteraction('background.pointer-down', { target: 'baseboard', wall })
          selectElement(null)
        }}>
          <boxGeometry args={[length, 0.11, 0.07]} />
          <meshStandardMaterial color="#d5a86e" />
        </mesh>
        {showGrid && <WallGrid segments={segments} />}
      </group>}
      {openings.map((opening) => (
        <group key={opening.id} visible={showOpeningDetails && !hiddenElementIds.includes(opening.id)}>
          <OpeningDetail room={room} wall={wall} opening={opening} selected={selectedId === opening.id} />
        </group>
      ))}
    </group>
  )
}

function useOpeningInteraction(room: RoomConfig, opening: WallOpening, wall: WallSide, planView: boolean) {
  const selectElement = useRoomStore((state) => state.selectElement)
  const setDoor = useRoomStore((state) => state.setDoor)
  const updateWindow = useRoomStore((state) => state.updateWindow)
  const [dragging, setDragging] = useState(false)
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

  const startDrag = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    recordSceneInteraction('opening.pointer-down', {
      id: opening.id,
      kind: opening.kind,
      name: opening.kind === 'door' ? 'Puerta' : 'Ventana',
      wall,
      pointerId: event.pointerId,
      intersectionCount: event.intersections.length,
    })
    selectElement(opening.id)
    if (!event.ray.intersectPlane(plane, point)) return
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
      move(
        offsetAtPoint(point) - dragOffset.current,
        opening.kind === 'window' && !planView ? point.y - dragSill.current : undefined,
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
      name: opening.kind === 'door' ? 'Puerta' : 'Ventana',
      wall: finalOpening?.wall,
      offset: finalOpening?.offset,
      sill: finalOpening && 'sill' in finalOpening ? finalOpening.sill : undefined,
    })
    setDragging(false)
    document.body.classList.remove('can-grab')
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
  }

  return {
    onPointerDown: startDrag,
    onPointerMove: drag,
    onPointerUp: stopDrag,
    onPointerCancel: stopDrag,
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      document.body.classList.add('can-grab')
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      if (!dragging) document.body.classList.remove('can-grab')
    },
  }
}

const openingRingRadius = (opening: WallOpening, planView: boolean) => planView
  ? opening.width / 2 + 0.22
  : Math.hypot(opening.width, opening.height) / 2 + 0.18

function OpeningMoveGizmo({ opening, planView = false, vertical = false }: { opening: WallOpening; planView?: boolean; vertical?: boolean }) {
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
  const axisEvents = (axis: 'horizontal' | 'vertical') => ({
    onPointerDown: () => setActiveAxis(axis),
    onPointerUp: () => setActiveAxis(null),
    onPointerCancel: () => setActiveAxis(null),
    onPointerOver: () => setHoveredAxis(axis),
    onPointerOut: () => {
      setHoveredAxis((current) => current === axis ? null : current)
    },
  })

  return (
    <group position={[0, planView ? 0.13 : 0, planView ? 0 : 0.2]} renderOrder={8}>
      <group {...axisEvents('horizontal')}>
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
      </group>
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
  const setDoor = useRoomStore((state) => state.setDoor)
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
      name: opening.kind === 'door' ? 'Puerta' : 'Ventana',
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
    if (opening.kind === 'door') setDoor({ rotation: nextRotation })
    else updateWindow(opening.id, { rotation: nextRotation })
  }

  const stopRotation = (event: ThreeEvent<PointerEvent>) => {
    if (!active) return
    event.stopPropagation()
    const latestRoom = useRoomStore.getState().room
    const finalRotation = opening.kind === 'door'
      ? latestRoom.door.rotation
      : latestRoom.windows.find((candidate) => candidate.id === opening.id)?.rotation
    recordSceneInteraction('opening.rotation-end', {
      id: opening.id,
      kind: opening.kind,
      name: opening.kind === 'door' ? 'Puerta' : 'Ventana',
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
    </group>
  )
}

function OpeningDetail({ room, opening, wall, selected }: { room: RoomConfig; opening: WallOpening; wall: WallSide; selected: boolean }) {
  const interaction = useOpeningInteraction(room, opening, wall, false)
  if (opening.kind === 'door') {
    const frameWidth = 0.07
    return (
      <group position={[opening.offset, 0, 0.02]} {...interaction}>
        {selected && (
          <>
            <OpeningSelectionRing opening={opening} wall={wall} centerY={opening.height / 2} />
            <group position={[0, opening.height / 2, 0]}>
              <OpeningMoveGizmo opening={opening} />
            </group>
          </>
        )}
        <mesh position={[-opening.width / 2 + frameWidth / 2, opening.height / 2, 0.05]}>
          <boxGeometry args={[frameWidth, opening.height, 0.16]} />
          <meshStandardMaterial color="#ac704b" />
        </mesh>
        <mesh position={[opening.width / 2 - frameWidth / 2, opening.height / 2, 0.05]}>
          <boxGeometry args={[frameWidth, opening.height, 0.16]} />
          <meshStandardMaterial color="#ac704b" />
        </mesh>
        <mesh position={[0, opening.height, 0.05]}>
          <boxGeometry args={[opening.width, 0.08, 0.16]} />
          <meshStandardMaterial color="#ac704b" />
        </mesh>
      </group>
    )
  }

  const frameWidth = 0.07
  return (
    <group position={[opening.offset, opening.bottom + opening.height / 2, 0.01]} {...interaction}>
      {selected && (
        <>
          <OpeningSelectionRing opening={opening} wall={wall} />
          <OpeningMoveGizmo opening={opening} vertical />
        </>
      )}
      <mesh>
        <boxGeometry args={[opening.width - frameWidth * 2, opening.height - frameWidth * 2, 0.035]} />
        <meshStandardMaterial color="#a9d9df" transparent opacity={0.62} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0, 0.026]}>
        <boxGeometry args={[0.055, opening.height, 0.07]} />
        <meshStandardMaterial color="#f0c58d" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (opening.width / 2 - frameWidth / 2), 0, 0.035]}>
          <boxGeometry args={[frameWidth, opening.height, 0.09]} />
          <meshStandardMaterial color="#c88f58" />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, side * (opening.height / 2 - frameWidth / 2), 0.035]}>
          <boxGeometry args={[opening.width, frameWidth, 0.09]} />
          <meshStandardMaterial color="#c88f58" />
        </mesh>
      ))}
    </group>
  )
}

function PlanOpening({ room, opening, wall }: { room: RoomConfig; opening: WallOpening; wall: WallSide }) {
  const selectedId = useRoomStore((state) => state.selectedId)
  const interaction = useOpeningInteraction(room, opening, wall, true)
  const horizontal = wall === 'north' || wall === 'south'
  const selected = selectedId === opening.id
  const color = selected ? '#ea6f4c' : opening.kind === 'door' ? '#e9895b' : '#65b7c2'
  let position: [number, number, number]
  if (wall === 'north') position = [opening.offset, 0.035, -room.depth / 2]
  else if (wall === 'south') position = [opening.offset, 0.035, room.depth / 2]
  else if (wall === 'east') position = [room.width / 2, 0.035, opening.offset]
  else position = [-room.width / 2, 0.035, opening.offset]
  return (
    <group position={position} rotation={horizontal ? [0, 0, 0] : [0, Math.PI / 2, 0]} {...interaction}>
      <mesh renderOrder={selected ? 6 : 0}>
        <boxGeometry args={[opening.width, selected ? 0.09 : 0.055, selected ? 0.16 : 0.1]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {selected && (
        <OpeningMoveGizmo opening={opening} planView />
      )}
    </group>
  )
}

function FloorGrid({ room, visible }: { room: RoomConfig; visible: boolean }) {
  const positions = useMemo(() => {
    const lines: number[] = []
    const step = ROOM_LIMITS.gridSize
    for (let x = -room.width / 2; x <= room.width / 2 + 0.001; x += step) {
      lines.push(x, 0.046, -room.depth / 2, x, 0.046, room.depth / 2)
    }
    for (let z = -room.depth / 2; z <= room.depth / 2 + 0.001; z += step) {
      lines.push(-room.width / 2, 0.046, z, room.width / 2, 0.046, z)
    }
    return new Float32Array(lines)
  }, [room.depth, room.width])

  if (!visible) return null
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#aa9a87" transparent opacity={0.48} depthWrite={false} />
    </lineSegments>
  )
}

function FurnitureModel({ item }: { item: FurnitureItem }) {
  const material = <meshStandardMaterial color={item.color} roughness={0.78} />
  if (item.kind === 'armchair') {
    const armWidth = 0.15
    const backDepth = 0.16
    return (
      <group>
        <mesh position={[0, 0.34, 0]} castShadow><boxGeometry args={[item.width * 0.74, 0.32, item.depth * 0.68]} />{material}</mesh>
        <mesh position={[0, 0.65, item.depth / 2 - backDepth / 2]} castShadow><boxGeometry args={[item.width, 0.55, backDepth]} />{material}</mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * (item.width - armWidth) / 2, 0.46, 0]} castShadow><boxGeometry args={[armWidth, 0.42, item.depth]} />{material}</mesh>)}
        {[-1, 1].map((side) => <mesh key={`leg-${side}`} position={[side * item.width * 0.32, 0.11, -item.depth * 0.2]}><boxGeometry args={[0.08, 0.22, 0.08]} /><meshStandardMaterial color="#795641" /></mesh>)}
      </group>
    )
  }
  if (item.kind === 'sofa') {
    const armWidth = 0.14
    return (
      <group>
        <mesh position={[0, 0.34, 0]} castShadow><boxGeometry args={[item.width * 0.86, 0.3, item.depth * 0.72]} />{material}</mesh>
        <mesh position={[0, 0.64, item.depth / 2 - 0.09]} castShadow><boxGeometry args={[item.width, 0.54, 0.18]} />{material}</mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * (item.width - armWidth) / 2, 0.45, 0]} castShadow><boxGeometry args={[armWidth, 0.4, item.depth]} />{material}</mesh>)}
        <mesh position={[0, 0.5, -0.03]} castShadow><boxGeometry args={[0.045, 0.3, item.depth * 0.56]} /><meshStandardMaterial color="#9e594d" roughness={0.82} /></mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * item.width * 0.4, 0.09, z * item.depth * 0.28]}><boxGeometry args={[0.08, 0.18, 0.08]} /><meshStandardMaterial color="#72503d" /></mesh>))}
      </group>
    )
  }
  if (item.kind === 'table') {
    return (
      <group>
        <mesh position={[0, item.height - 0.08, 0]} castShadow><boxGeometry args={[item.width, 0.16, item.depth]} />{material}</mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
          <mesh key={`${x}-${z}`} position={[x * item.width * 0.38, item.height / 2 - 0.08, z * item.depth * 0.34]} castShadow>
            <boxGeometry args={[0.1, item.height - 0.16, 0.1]} /><meshStandardMaterial color="#8f6545" />
          </mesh>
        )))}
      </group>
    )
  }
  if (item.kind === 'chair') {
    return (
      <group>
        <mesh position={[0, 0.46, 0]} castShadow><boxGeometry args={[item.width, 0.1, item.depth]} />{material}</mesh>
        <mesh position={[0, 0.67, item.depth / 2 - 0.045]} castShadow><boxGeometry args={[item.width, 0.42, 0.09]} />{material}</mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
          <mesh key={`${x}-${z}`} position={[x * item.width * 0.38, 0.22, z * item.depth * 0.36]} castShadow>
            <boxGeometry args={[0.055, 0.44, 0.055]} /><meshStandardMaterial color="#8f6545" />
          </mesh>
        )))}
      </group>
    )
  }
  if (item.kind === 'bed') {
    return (
      <group>
        <mesh position={[0, 0.13, 0]} castShadow><boxGeometry args={[item.width, 0.26, item.depth]} /><meshStandardMaterial color="#876650" roughness={0.86} /></mesh>
        <mesh position={[0, 0.34, -item.depth * 0.03]} castShadow><boxGeometry args={[item.width * 0.94, 0.22, item.depth * 0.88]} />{material}</mesh>
        <mesh position={[0, 0.46, item.depth * 0.28]} castShadow><boxGeometry args={[item.width * 0.72, 0.14, item.depth * 0.22]} /><meshStandardMaterial color="#eee3ce" roughness={0.95} /></mesh>
        <mesh position={[0, item.height * 0.62, item.depth / 2 - 0.055]} castShadow><boxGeometry args={[item.width, item.height * 1.05, 0.11]} /><meshStandardMaterial color="#6f8d88" roughness={0.82} /></mesh>
      </group>
    )
  }
  if (item.kind === 'bookshelf') {
    const board = 0.07
    return (
      <group>
        <mesh position={[0, item.height / 2, item.depth / 2 - 0.035]} castShadow><boxGeometry args={[item.width, item.height, 0.07]} /><meshStandardMaterial color="#76543d" roughness={0.88} /></mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * (item.width - board) / 2, item.height / 2, 0]} castShadow><boxGeometry args={[board, item.height, item.depth]} />{material}</mesh>)}
        {[0.05, 0.47, 0.89, 1.31, 1.73].map((height) => <mesh key={height} position={[0, Math.min(height, item.height - board / 2), 0]} castShadow><boxGeometry args={[item.width, board, item.depth]} />{material}</mesh>)}
      </group>
    )
  }
  if (item.kind === 'lamp') {
    return (
      <group>
        <mesh position={[0, 0.055, 0]} castShadow><cylinderGeometry args={[0.22, 0.25, 0.11, 28]} /><meshStandardMaterial color="#665a4d" metalness={0.25} roughness={0.55} /></mesh>
        <mesh position={[0, item.height * 0.48, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, item.height * 0.88, 16]} /><meshStandardMaterial color="#776a59" metalness={0.35} roughness={0.45} /></mesh>
        <mesh position={[0, item.height * 0.88, 0]} castShadow><coneGeometry args={[0.28, 0.42, 28, 1, true]} />{material}</mesh>
        <pointLight position={[0, item.height * 0.82, 0]} intensity={0.35} distance={2.2} color="#ffd891" />
      </group>
    )
  }
  return (
    <group>
      <mesh position={[0, item.height / 2, 0]} castShadow>{material}<boxGeometry args={[item.width, item.height, item.depth]} /></mesh>
      <mesh position={[0, item.height / 2, -item.depth / 2 + 0.012]}><boxGeometry args={[0.035, item.height * 0.86, 0.02]} /><meshStandardMaterial color="#506b63" /></mesh>
      {[-0.15, 0.15].map((x) => <mesh key={x} position={[x, item.height / 2, -item.depth / 2 + 0.028]}><sphereGeometry args={[0.027, 12, 12]} /><meshStandardMaterial color="#e9c079" metalness={0.25} /></mesh>)}
      {[-1, 1].map((x) => <mesh key={x} position={[x * item.width * 0.38, 0.06, 0]}><boxGeometry args={[0.09, 0.12, item.depth * 0.72]} /><meshStandardMaterial color="#40584f" /></mesh>)}
    </group>
  )
}

type FloorMoveAxis = 'x' | 'z'

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
    </group>
  )
}

function FrontRotationHandle({ item, wall }: { item: FurnitureItem; wall: WallSide }) {
  const setFurnitureRotation = useRoomStore((state) => state.setFurnitureRotation)
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const point = useMemo(() => new THREE.Vector3(), [])
  const center = useMemo(() => new THREE.Vector3(item.x, item.height / 2 + 0.02, item.z), [item.height, item.x, item.z])
  const plane = useMemo(() => {
    const normal = wall === 'north' || wall === 'south'
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(1, 0, 0)
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center)
  }, [center, wall])
  const lastPointerAngle = useRef(0)
  const targetRotation = useRef(item.rotation)
  const radius = Math.max(Math.hypot(item.width, item.depth) / 2, item.height / 2) + 0.18
  const halfStroke = 0.042
  const ringRotation: [number, number, number] = wall === 'east' || wall === 'west' ? [0, Math.PI / 2, 0] : [0, 0, 0]

  const pointerAngle = (event: ThreeEvent<PointerEvent>) => {
    if (!event.ray.intersectPlane(plane, point)) return null
    const screenX = wall === 'north'
      ? point.x - item.x
      : wall === 'south'
        ? item.x - point.x
        : wall === 'east'
          ? point.z - item.z
          : item.z - point.z
    return Math.atan2(point.y - center.y, screenX)
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
    setFurnitureRotation(
      item.id,
      event.nativeEvent.shiftKey ? targetRotation.current : snapFurnitureRotation(targetRotation.current),
    )
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
    <group {...events} position={[0, item.height / 2, 0]} rotation={ringRotation}>
      <mesh renderOrder={9}>
        <ringGeometry args={[radius - halfStroke, radius + halfStroke, 64]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {dragging && (
        <mesh renderOrder={8}>
          <ringGeometry args={[radius - 0.082, radius + 0.082, 64]} />
          <meshBasicMaterial color="#ff9b78" transparent opacity={0.3} side={THREE.DoubleSide} depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh renderOrder={8}>
        <ringGeometry args={[radius - 0.075, radius + 0.075, 64]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function AxisMoveGizmo({ item }: { item: FurnitureItem }) {
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const [draggingAxis, setDraggingAxis] = useState<FloorMoveAxis | null>(null)
  const [hoveredAxis, setHoveredAxis] = useState<FloorMoveAxis | null>(null)
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const point = useMemo(() => new THREE.Vector3(), [])
  const dragOffset = useRef(0)
  const ringRadius = Math.hypot(item.width, item.depth) / 2 + 0.12
  const coneHeight = 0.24
  const tipDistance = ringRadius - 0.055
  const coneCenter = tipDistance - coneHeight / 2
  const shaftLength = Math.max(0.08, tipDistance - coneHeight)

  const startDrag = (axis: FloorMoveAxis, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (!event.ray.intersectPlane(floorPlane, point)) return
    recordSceneInteraction('furniture.axis-drag-start', { id: item.id, name: item.name, axis, x: item.x, z: item.z })
    dragOffset.current = axis === 'x' ? point.x - item.x : point.z - item.z
    setDraggingAxis(axis)
    document.body.classList.add('can-grab')
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
  }

  const drag = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingAxis) return
    event.stopPropagation()
    if (!event.ray.intersectPlane(floorPlane, point)) return
    if (draggingAxis === 'x') moveFurniture(item.id, point.x - dragOffset.current, item.z)
    else moveFurniture(item.id, item.x, point.z - dragOffset.current)
  }

  const stopDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingAxis) return
    event.stopPropagation()
    const finalItem = useRoomStore.getState().furniture.find((candidate) => candidate.id === item.id)
    recordSceneInteraction('furniture.axis-drag-end', { id: item.id, name: item.name, axis: draggingAxis, x: finalItem?.x, z: finalItem?.z })
    setDraggingAxis(null)
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
    <group position={[0, item.height + 0.2, 0]}>
      <group {...axisEvents('x')}>
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
      </group>
      <group {...axisEvents('z')}>
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
      </group>
    </group>
  )
}

function FurnitureObject({ item, selected, canDrag, planView, frontWall }: { item: FurnitureItem; selected: boolean; canDrag: boolean; planView: boolean; frontWall: WallSide | null }) {
  const selectElement = useRoomStore((state) => state.selectElement)
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const [dragging, setDragging] = useState(false)
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const point = useMemo(() => new THREE.Vector3(), [])
  const dragOffset = useRef({ x: 0, z: 0 })

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
    if (!event.ray.intersectPlane(floorPlane, point)) return
    dragOffset.current = { x: point.x - item.x, z: point.z - item.z }
    setDragging(true)
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
  }
  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging || !canDrag) return
    event.stopPropagation()
    if (event.ray.intersectPlane(floorPlane, point)) {
      moveFurniture(item.id, point.x - dragOffset.current.x, point.z - dragOffset.current.z)
    }
  }
  const handleUp = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    event.stopPropagation()
    const finalItem = useRoomStore.getState().furniture.find((candidate) => candidate.id === item.id)
    recordSceneInteraction('furniture.drag-end', { id: item.id, name: item.name, x: finalItem?.x, z: finalItem?.z })
    setDragging(false)
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
  }

  return (
    <group position={[item.x, 0.02, item.z]}>
      <group
        rotation={[0, item.rotation, 0]}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={() => {
          if (dragging) recordSceneInteraction('furniture.drag-cancel', { id: item.id, name: item.name })
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
      {selected && canDrag && (
        <>
          <AxisMoveGizmo item={item} />
          {frontWall ? <FrontRotationHandle item={item} wall={frontWall} /> : <RotationHandle item={item} />}
        </>
      )}
    </group>
  )
}

function StudioLight({ room }: { room: RoomConfig }) {
  const shadowExtent = Math.max(room.width, room.depth) / 2 + 1
  return (
    <directionalLight
      position={[0.01, 14, 0.01]}
      intensity={2.1}
      color="#fff2dc"
      castShadow
      shadow-mapSize={[1536, 1536]}
      shadow-camera-near={1}
      shadow-camera-far={30}
      shadow-camera-left={-shadowExtent}
      shadow-camera-right={shadowExtent}
      shadow-camera-top={shadowExtent}
      shadow-camera-bottom={-shadowExtent}
      shadow-bias={-0.00035}
      shadow-normalBias={0.02}
      shadow-radius={4}
    />
  )
}

function WallIdentityLabel({ room, wall, view }: { room: RoomConfig; wall: WallSide; view: ViewMode }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 192
    const context = canvas.getContext('2d')
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height)

      context.save()
      context.shadowColor = 'rgba(42, 57, 48, 0.16)'
      context.shadowBlur = 10
      context.shadowOffsetY = 5
      context.beginPath()
      context.roundRect(16, 10, 224, 168, 26)
      context.fillStyle = 'rgba(255, 253, 249, 0.98)'
      context.fill()
      context.restore()

      context.save()
      context.beginPath()
      context.roundRect(16, 10, 224, 168, 26)
      context.clip()
      context.fillStyle = '#52705d'
      context.fillRect(16, 10, 224, 56)
      context.restore()

      context.beginPath()
      context.roundRect(16, 10, 224, 168, 26)
      context.lineWidth = 4
      context.strokeStyle = 'rgba(64, 87, 72, 0.38)'
      context.stroke()

      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#fffdf9'
      context.font = '800 22px Arial, sans-serif'
      context.fillText('PARED', 128, 38)
      context.fillStyle = '#405748'
      context.font = '900 78px Arial, sans-serif'
      context.fillText(WALL_LABELS[wall], 128, 123)
    }
    const nextTexture = new THREE.CanvasTexture(canvas)
    nextTexture.colorSpace = THREE.SRGBColorSpace
    nextTexture.minFilter = THREE.LinearFilter
    return nextTexture
  }, [wall])
  useEffect(() => () => texture.dispose(), [texture])

  const height = room.height + (view === 'front' ? 0.95 : 0.44)
  const wallOffset = view === 'top' ? 0.65 : 0.04
  const position: [number, number, number] = wall === 'north'
    ? [0, height, -room.depth / 2 - wallOffset]
    : wall === 'south'
      ? [0, height, room.depth / 2 + wallOffset]
      : wall === 'east'
        ? [room.width / 2 + wallOffset, height, 0]
        : [-room.width / 2 - wallOffset, height, 0]

  return (
    <sprite position={position} scale={[0.69, 0.52, 1]} renderOrder={30} raycast={() => undefined}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

function RoomWorld(props: SceneProps) {
  const selectedId = useRoomStore((state) => state.selectedId)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const selectElement = useRoomStore((state) => state.selectElement)
  let hidden: WallSide[] = []
  if (props.view === 'top') hidden = ['north', 'east', 'south', 'west']
  else if (props.view === 'front') hidden = [hiddenWallForCardinalTarget(props.wallView ?? 'north')]
  else if (props.view === 'isometric') hidden = hiddenWallsForOrientation(props.orientation)
  const labeledWalls = props.view === 'front'
    ? [props.wallView ?? 'north']
    : props.view === 'isometric'
      ? WALL_SIDES.filter((wall) => !hidden.includes(wall))
      : WALL_SIDES
  const gridWalls = props.view === 'front'
    ? [props.wallView ?? 'north']
    : props.view === 'isometric'
      ? WALL_SIDES.filter((wall) => !hidden.includes(wall))
      : []

  return (
    <>
      <CameraRig room={props.room} view={props.view} isoAngle={props.isoAngle} isIsoOrbitDragging={props.isIsoOrbitDragging} cameraZoom={props.cameraZoom} wallView={props.wallView} frontCameraHeight={props.frontCameraHeight} povYaw={props.povYaw} />
      <color attach="background" args={['#e8dfd3']} />
      <ambientLight intensity={1.35} />
      <StudioLight room={props.room} />
      <hemisphereLight args={['#ddecf0', '#bd9170', 0.75]} />

      <group>
        <mesh receiveShadow onPointerDown={(event) => {
          event.stopPropagation()
          recordSceneInteraction('background.pointer-down', { target: 'floor' })
          selectElement(null)
        }}>
          <boxGeometry args={[props.room.width, 0.08, props.room.depth]} />
          <meshStandardMaterial color="#dcc3a3" roughness={0.94} />
        </mesh>
        <FloorGrid room={props.room} visible={props.gridVisibility.floor} />
        {WALL_SIDES.map((wall) => (
          <SoftWall
            key={wall}
            room={props.room}
            wall={wall}
            hidden={hidden.includes(wall)}
            showOpeningDetails={props.view !== 'top'}
            showGrid={gridWalls.includes(wall) && props.gridVisibility[wall]}
          />
        ))}
        {labeledWalls.map((wall) => <WallIdentityLabel key={`label-${wall}`} room={props.room} wall={wall} view={props.view} />)}
        {props.view === 'top' && WALL_SIDES.flatMap((wall) =>
          openingsForWall(props.room, wall)
            .filter((opening) => !hiddenElementIds.includes(opening.id))
            .map((opening) => <PlanOpening key={`${wall}-${opening.id}`} room={props.room} opening={opening} wall={wall} />),
        )}
        {props.furniture.filter((item) => !hiddenElementIds.includes(item.id)).map((item) => (
          <FurnitureObject
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            canDrag={props.view !== 'pov'}
            planView={props.view === 'top'}
            frontWall={props.view === 'front' ? props.wallView ?? 'north' : null}
          />
        ))}
        <mesh position={[0, -0.11, 0]} receiveShadow onPointerDown={(event) => {
          event.stopPropagation()
          recordSceneInteraction('background.pointer-down', { target: 'platform' })
          selectElement(null)
        }}>
          <boxGeometry args={[props.room.width + 0.28, 0.14, props.room.depth + 0.28]} />
          <meshStandardMaterial color="#b7835d" roughness={0.9} />
        </mesh>
      </group>
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
    north: [0, 1.42, 1.6],
    east: [1.42, 0, 1.6],
    south: [0, -1.42, 1.6],
    west: [-1.42, 0, 1.6],
  }
  const isoMarkers: { orientation: number; walls: [WallSide, WallSide]; position: [number, number, number] }[] = [
    { orientation: 1, walls: ['north', 'east'], position: [1.02, 1.02, 1.6] },
    { orientation: 2, walls: ['east', 'south'], position: [1.02, -1.02, 1.6] },
    { orientation: 3, walls: ['south', 'west'], position: [-1.02, -1.02, 1.6] },
    { orientation: 0, walls: ['west', 'north'], position: [-1.02, 1.02, 1.6] },
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
  const perspective = props.view === 'pov'
  const selectElement = useRoomStore((state) => state.selectElement)
  return (
    <Canvas
      key={perspective ? 'perspective' : 'orthographic'}
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
      <RoomWorld {...props} />
    </Canvas>
  )
}

export function FurnitureSwatch({ kind }: { kind: keyof typeof FURNITURE_PRESETS }) {
  return <span className={`furniture-swatch furniture-swatch--${kind}`} aria-hidden="true"><i /></span>
}
