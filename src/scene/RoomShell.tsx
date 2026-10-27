import type { ReactNode, RefObject } from 'react'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEFAULT_FLOOR_COLOR, WALL_LABELS } from '../domain/constants'
import type { RoomConfig, ViewMode, WallSide } from '../domain/types'
import { useRoomStore } from '../state/useRoomStore'
import { FloorGrid } from './FloorGrid'
import { recordSceneInteraction } from './sceneInteraction'

export function RoomShell({ room, modelRootRef, showFloorGrid, children }: {
  room: RoomConfig
  modelRootRef: RefObject<THREE.Group | null>
  showFloorGrid: boolean
  children: ReactNode
}) {
  const selectElement = useRoomStore((state) => state.selectElement)
  return (
    <group ref={modelRootRef}>
      <mesh receiveShadow userData={{ freeOrbitSurface: true }} onPointerDown={(event) => {
        event.stopPropagation()
        recordSceneInteraction('background.pointer-down', { target: 'floor' })
        selectElement(null)
      }}>
        <boxGeometry args={[room.width, 0.08, room.depth]} />
        <meshStandardMaterial color={room.floorColor ?? DEFAULT_FLOOR_COLOR} roughness={0.94} />
      </mesh>
      <FloorGrid room={room} visible={showFloorGrid} />
      {children}
      <mesh position={[0, -0.11, 0]} receiveShadow userData={{ freeOrbitSurface: true }} onPointerDown={(event) => {
        event.stopPropagation()
        recordSceneInteraction('background.pointer-down', { target: 'platform' })
        selectElement(null)
      }}>
        <boxGeometry args={[room.width + 0.28, 0.14, room.depth + 0.28]} />
        <meshStandardMaterial color="#b7835d" roughness={0.9} />
      </mesh>
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

