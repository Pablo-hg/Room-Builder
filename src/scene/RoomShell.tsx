import type { ReactNode, RefObject } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { DEFAULT_FLOOR_COLOR, WALL_LABELS } from '../domain/constants'
import type { RoomConfig, ViewMode, WallSide } from '../domain/types'
import { useRoomStore } from '../state/useRoomStore'
import { FloorGrid } from './FloorGrid'
import { recordSceneInteraction, selectSceneObject } from './sceneInteraction'
import { releasePointer, usePointerCancellation } from './usePointerCancellation'
import { BASE_FLOOR_ID } from '../domain/elementFolders'
import { SelectionBounds } from './SelectionBounds'

export function RoomShell({ room, modelRootRef, showFloorGrid, showBase = true, showSelection = true, children }: {
  room: RoomConfig
  modelRootRef: RefObject<THREE.Group | null>
  showFloorGrid: boolean
  showBase?: boolean
  showSelection?: boolean
  children: ReactNode
}) {
  const selectElement = useRoomStore((state) => state.selectElement)
  const view = useRoomStore((state) => state.view)
  const floorHidden = useRoomStore((state) => state.hiddenElementIds.includes(BASE_FLOOR_ID))
  const floorSelected = useRoomStore((state) => state.selectedIds.includes(BASE_FLOOR_ID))
  const { camera, size } = useThree()
  const pan = useRef<{ pointerId: number; x: number; y: number; cameraX: number; cameraZ: number; right: THREE.Vector3; up: THREE.Vector3; scale: number } | null>(null)
  const capturePan = usePointerCancellation(() => { pan.current = null })
  const startPan = (event: ThreeEvent<PointerEvent>) => {
    if (view !== 'top' || event.button !== 0 || !(camera instanceof THREE.OrthographicCamera)) return
    const state = useRoomStore.getState()
    pan.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cameraX: state.topCameraX, cameraZ: state.topCameraZ, right: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up: new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion), scale: (camera.right - camera.left) / camera.zoom / Math.max(size.width, 1) }
    capturePan(event)
  }
  const movePan = (event: ThreeEvent<PointerEvent>) => {
    const drag = pan.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.stopPropagation()
    const dx = (event.clientX - drag.x) * drag.scale
    const dy = (event.clientY - drag.y) * drag.scale
    useRoomStore.getState().setTopCameraPosition(drag.cameraX - dx * drag.right.x + dy * drag.up.x, drag.cameraZ - dx * drag.right.z + dy * drag.up.z)
  }
  const endPan = (event: ThreeEvent<PointerEvent>) => {
    if (pan.current?.pointerId !== event.pointerId) return
    pan.current = null
    event.stopPropagation()
    releasePointer(event)
  }
  return (
    <group ref={modelRootRef}>
      {showBase && !floorHidden && <mesh receiveShadow userData={{ freeOrbitSurface: true }} onPointerDown={(event) => {
        event.stopPropagation()
        recordSceneInteraction('background.pointer-down', { target: 'floor' })
        selectSceneObject(BASE_FLOOR_ID, event.nativeEvent)
        startPan(event)
      }} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onLostPointerCapture={() => { pan.current = null }}>
        <boxGeometry args={[room.width, 0.08, room.depth]} />
        <meshStandardMaterial color={room.floorColor ?? DEFAULT_FLOOR_COLOR} roughness={0.94} />
      </mesh>}
      {showBase && !floorHidden && showSelection && floorSelected && <SelectionBounds width={room.width} height={0.08} depth={room.depth} />}
      <FloorGrid room={room} visible={showBase && !floorHidden && showFloorGrid} />
      {children}
      {showBase && <mesh position={[0, -0.11, 0]} receiveShadow userData={{ freeOrbitSurface: true }} onPointerDown={(event) => {
        event.stopPropagation()
        recordSceneInteraction('background.pointer-down', { target: 'platform' })
        selectElement(null)
      }}>
        <boxGeometry args={[room.width + 0.28, 0.14, room.depth + 0.28]} />
        <meshStandardMaterial color="#b7835d" roughness={0.9} />
      </mesh>}
    </group>
  )
}

export function StudioLight({ room }: { room: RoomConfig }) {
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

export function WallIdentityLabel({ room, wall, view, wallView }: { room: RoomConfig; wall: WallSide; view: ViewMode; wallView: WallSide | null }) {
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

  const isFrontSideWall = view === 'front' && wall !== (wallView ?? 'north')
  const height = isFrontSideWall ? room.height / 2 : room.height + 0.44
  const wallOffset = 0.6
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
