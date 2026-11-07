import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { WALL_LABELS, WALL_SIDES } from '../domain/constants'
import type { WallSide } from '../domain/types'

const compassFace = (wall: WallSide, visibleWalls: WallSide[]) => visibleWalls.includes(wall)
  ? { color: '#67a47b', opacity: 0.74 }
  : { color: '#dfe6e1', opacity: 0.18 }

/** Orthographic zoom is measured in pixels: fit the same world extent at every size. */
function CompassCameraFit() {
  const { camera, size, invalidate } = useThree()
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return
    camera.zoom = Math.min(size.width, size.height) * 45 / 168
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, size.width, size.height, invalidate])
  return null
}

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
      <CompassCameraFit />
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
      <CompassCameraFit />
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
