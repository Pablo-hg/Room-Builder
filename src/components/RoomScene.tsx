import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { WALL_LABELS, WALL_SIDES } from '../domain/constants'
import { openingsForWall } from '../domain/geometry'
import type { WallSide } from '../domain/types'
import { useRoomStore } from '../state/useRoomStore'
import { CameraRig } from '../scene/CameraRig'
import type { SceneProps } from '../scene/types'
import { wallVisibility } from '../scene/wallVisibility'
import { SoftWall } from '../scene/Walls'
import { RoomShell, StudioLight, WallIdentityLabel } from '../scene/RoomShell'
import { recordSceneInteraction } from '../scene/sceneInteraction'
import { PlanOpening } from '../scene/Openings'
import { FurnitureObject } from '../scene/FurnitureObject'
import { StructureSurfaceObject } from '../scene/StructureSurface'

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
