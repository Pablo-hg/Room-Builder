import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { doorWorldPosition, inwardDirection, shortestAngleDelta, topViewWallForOrientation } from '../domain/geometry'
import type { ViewMode, WallSide } from '../domain/types'
import type { SceneProps } from './types'
import { useRoomStore } from '../state/useRoomStore'
import { shouldOrbitFront, spatialCameraOrbit, spatialCameraPosition } from './cameraTransitions'
import { packRoomBox, worldRoomBoxes } from '../domain/roomEditing'
import { cameraFarPlane } from './cameraClipping'

const ISOMETRIC_CAMERA_TARGET_HEIGHT = 0.8

export function CameraRig({ room, view, orientation, isoAngle, isIsoOrbitDragging, freeAzimuth, freeElevation, isFreeOrbitDragging, cameraZoom, wallView, frontCameraHeight, povYaw }: Pick<SceneProps, 'room' | 'view' | 'orientation' | 'isoAngle' | 'isIsoOrbitDragging' | 'freeAzimuth' | 'freeElevation' | 'isFreeOrbitDragging' | 'cameraZoom' | 'wallView' | 'frontCameraHeight' | 'povYaw'>) {
  const { camera, size } = useThree()
  const topCameraX = useRoomStore((state) => state.topCameraX)
  const topCameraZ = useRoomStore((state) => state.topCameraZ)
  const isoCameraHeight = useRoomStore((state) => state.isoCameraHeight)
  const freeCameraOffset = useRoomStore((state) => state.freeCameraOffset)
  const activeRoomId = useRoomStore((state) => state.activeRoomId)
  const activeRoom = useRoomStore((state) => state.structurePacks.find((pack) => pack.id === activeRoomId && pack.id.startsWith('floor-pack-')))
  const anchorRoom = useRoomStore((state) => state.room)
  const activeBox = activeRoom && packRoomBox(activeRoom, anchorRoom)
  const roomX = (activeRoom?.x ?? 0) + (activeBox?.x ?? 0)
  const roomY = (activeRoom?.y ?? 0) + (activeBox?.y ?? 0)
  const roomZ = (activeRoom?.z ?? 0) + (activeBox?.z ?? 0)
  const hasFloors = useRoomStore((state) => state.structurePacks.some((pack) => pack.id.startsWith('floor-pack-')))
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const initialized = useRef(false)
  const previousMode = useRef({ view, wallView, activeRoomId, roomX, roomY, roomZ, isoCameraHeight, topCameraX, topCameraZ, roomHeight: room.height })
  const previousFreeOffset = useRef(freeCameraOffset)
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

  useLayoutEffect(() => {
    const previous = previousMode.current
    const freeMoved = previousFreeOffset.current !== freeCameraOffset
    previousFreeOffset.current = freeCameraOffset
    previousMode.current = { view, wallView, activeRoomId, roomX, roomY, roomZ, isoCameraHeight, topCameraX, topCameraZ, roomHeight: room.height }
    const targetCamera = camera.clone()
    const frontLookHeight = roomY + room.height / 2
    let targetZoom = 1

    if (view === 'pov') {
      const position = doorWorldPosition(room, room.door)
      const direction = new THREE.Vector3(...inwardDirection(room.door.wall))
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(povYaw))
      targetCamera.position.set(position[0] + roomX, position[1] + roomY, position[2] + roomZ)
      if (activeRoom) targetCamera.position.addScaledVector(new THREE.Vector3(...inwardDirection(room.door.wall)), 0.16)
      targetCamera.up.set(0, 1, 0)
      targetCamera.lookAt(targetCamera.position.x + direction.x, targetCamera.position.y - 0.04, targetCamera.position.z + direction.z)
      if (targetCamera instanceof THREE.PerspectiveCamera) targetCamera.aspect = size.width / Math.max(size.height, 1)
    } else if (view === 'free') {
      const radius = Math.max(room.width, room.depth, room.height) * 2.6
      const horizontalRadius = Math.cos(freeElevation) * radius
      targetCamera.position.set(
        freeCameraOffset.x + Math.cos(freeAzimuth) * horizontalRadius,
        freeCameraOffset.y + 0.45 + Math.sin(freeElevation) * radius,
        freeCameraOffset.z + Math.sin(freeAzimuth) * horizontalRadius,
      )
      targetCamera.up.set(0, 1, 0)
      targetCamera.lookAt(freeCameraOffset.x, freeCameraOffset.y + 0.45, freeCameraOffset.z)
      if (targetCamera instanceof THREE.PerspectiveCamera) targetCamera.aspect = size.width / Math.max(size.height, 1)
    } else if (view === 'top') {
      const zoom = Math.min(size.width / (room.width + 2.2), size.height / (room.depth + 2.2))
      const topViewUp: Record<WallSide, [number, number, number]> = {
        north: [0, 0, -1],
        east: [1, 0, 0],
        south: [0, 0, 1],
        west: [-1, 0, 0],
      }
      targetCamera.position.set(roomX + topCameraX, roomY + Math.max(12, room.height + 5), roomZ + topCameraZ)
      targetCamera.up.set(...topViewUp[topViewWallForOrientation(orientation)])
      targetCamera.lookAt(roomX + topCameraX, roomY, roomZ + topCameraZ)
      targetZoom = Math.max(1, zoom)
    } else if (view === 'front') {
      const targetWall = wallView ?? 'north'
      const distance = Math.max(room.width, room.depth) * 3 + 10
      const elevation = roomY + frontCameraHeight
      const positions: Record<WallSide, [number, number, number]> = {
        north: [0, elevation, distance],
        east: [-distance, elevation, 0],
        south: [0, elevation, -distance],
        west: [distance, elevation, 0],
      }
      const across = targetWall === 'north' || targetWall === 'south' ? room.width : room.depth
      const projectedHeight = room.height * (hasFloors ? 3 : 1) + Math.abs(elevation - frontLookHeight) * 0.35
      targetCamera.position.set(...positions[targetWall])
      targetCamera.position.x += roomX
      targetCamera.position.z += roomZ
      targetCamera.up.set(0, 1, 0)
      targetCamera.lookAt(roomX, frontLookHeight, roomZ)
      targetZoom = Math.max(1, Math.min(
        size.width / (across + 1.2),
        size.height / (projectedHeight + 2.5),
      ))
    } else {
      const scale = Math.max(8, room.width, room.depth, room.height)
      const radius = Math.SQRT2 * scale
      const lookHeight = Math.max(ISOMETRIC_CAMERA_TARGET_HEIGHT, room.height > 10 ? room.height / 2 : ISOMETRIC_CAMERA_TARGET_HEIGHT)
      targetCamera.position.set(roomX + Math.cos(isoAngle) * radius, Math.max(7, scale * 0.8) + isoCameraHeight, roomZ + Math.sin(isoAngle) * radius)
      targetCamera.up.set(0, 1, 0)
      targetCamera.lookAt(roomX, lookHeight + isoCameraHeight, roomZ)
      targetZoom = Math.max(1, Math.min(size.width / (room.width + room.depth + 1) * 1.15, size.height / (room.height + room.depth + 1.8) * 1.25))
    }

    targetZoom *= cameraZoom
    if (targetCamera instanceof THREE.OrthographicCamera || targetCamera instanceof THREE.PerspectiveCamera) targetCamera.zoom = targetZoom
    // El plano lejano crece con la escena: evita que las habitaciones grandes
    // salgan cortadas. Cubre el origen y el destino de la transición.
    const far = cameraFarPlane([camera.position, targetCamera.position], worldRoomBoxes(anchorRoom, structurePacks))
    for (const candidate of [camera, targetCamera]) {
      if (candidate instanceof THREE.OrthographicCamera || candidate instanceof THREE.PerspectiveCamera) candidate.far = far
    }
    camera.updateProjectionMatrix()
    targetCamera.updateProjectionMatrix()
    const currentZoom = 'zoom' in camera ? camera.zoom : 1

    if (!initialized.current || reduceMotion || (view === 'top' && previous.view === 'top') || (view === 'isometric' && isIsoOrbitDragging) || (view === 'free' && (isFreeOrbitDragging || freeMoved))) {
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
      && previous.activeRoomId === activeRoomId
      && previous.roomX === roomX && previous.roomZ === roomZ && previous.isoCameraHeight === isoCameraHeight
    ) || (
      view === 'free'
      && previous.view === 'free'
    ) || shouldOrbitFront(previous, { view, wallView, activeRoomId, roomX, roomY, roomZ })
    const orbitCenter = new THREE.Vector3(view === 'free' ? freeCameraOffset.x : view === 'front' || view === 'isometric' ? roomX : 0, view === 'front' ? frontLookHeight : view === 'isometric' ? ISOMETRIC_CAMERA_TARGET_HEIGHT + isoCameraHeight : 0.45 + freeCameraOffset.y, view === 'free' ? freeCameraOffset.z : view === 'front' || view === 'isometric' ? roomZ : 0)
    const fromAngle = Math.atan2(camera.position.z - orbitCenter.z, camera.position.x - orbitCenter.x)
    const targetAngle = Math.atan2(targetCamera.position.z - orbitCenter.z, targetCamera.position.x - orbitCenter.x)
    const orbit = shouldOrbitAroundRoom ? {
      center: orbitCenter,
      fromAngle,
      toAngle: fromAngle + shortestAngleDelta(fromAngle, targetAngle),
      fromRadius: Math.hypot(camera.position.x - orbitCenter.x, camera.position.z - orbitCenter.z),
      toRadius: Math.hypot(targetCamera.position.x - orbitCenter.x, targetCamera.position.z - orbitCenter.z),
      fromHeight: camera.position.y,
      toHeight: targetCamera.position.y,
    } : null
    const elevatedRoomView = (mode: ViewMode) => mode === 'front' || mode === 'isometric' || mode === 'free'
    const shouldOrbitBetweenRoomAndTop = (
      view === 'top' && elevatedRoomView(previous.view)
    ) || (
      elevatedRoomView(view) && previous.view === 'top'
    )
    const fromRoomCenter = new THREE.Vector3(
      previous.roomX + (previous.view === 'top' ? previous.topCameraX : 0),
      previous.roomY + previous.roomHeight / 2,
      previous.roomZ + (previous.view === 'top' ? previous.topCameraZ : 0),
    )
    const toRoomCenter = new THREE.Vector3(
      roomX + (view === 'top' ? topCameraX : 0),
      roomY + room.height / 2,
      roomZ + (view === 'top' ? topCameraZ : 0),
    )
    const spatialOrbit = shouldOrbitBetweenRoomAndTop
      ? spatialCameraOrbit(camera.position, targetCamera.position, fromRoomCenter, toRoomCenter) : null

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
  }, [camera, cameraZoom, freeAzimuth, freeElevation, frontCameraHeight, isoAngle, isFreeOrbitDragging, isIsoOrbitDragging, orientation, povYaw, reduceMotion, room, size, view, wallView, topCameraX, topCameraZ, isoCameraHeight, freeCameraOffset, activeRoom, hasFloors, roomX, roomY, roomZ, anchorRoom, structurePacks])

  useFrame((_, delta) => {
    const transition = animation.current
    if (!transition.active) return

    transition.elapsed = Math.min(transition.elapsed + delta, transition.duration)
    const progress = transition.elapsed / transition.duration
    const eased = 1 - Math.pow(1 - progress, 3)
    if (transition.spatialOrbit) {
      camera.position.copy(spatialCameraPosition(transition.spatialOrbit, eased))
      camera.quaternion.slerpQuaternions(transition.fromQuaternion, transition.toQuaternion, eased)
    } else if (transition.orbit) {
      const angle = THREE.MathUtils.lerp(transition.orbit.fromAngle, transition.orbit.toAngle, eased)
      const radius = THREE.MathUtils.lerp(transition.orbit.fromRadius, transition.orbit.toRadius, eased)
      const height = THREE.MathUtils.lerp(transition.orbit.fromHeight, transition.orbit.toHeight, eased)
      camera.position.set(transition.orbit.center.x + Math.cos(angle) * radius, height, transition.orbit.center.z + Math.sin(angle) * radius)
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
