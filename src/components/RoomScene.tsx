import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { FURNITURE_PRESETS } from '../domain/constants'
import { buildWallSegments, doorWorldPosition, hiddenWallsForOrientation, inwardDirection, openingsForWall, wallLength } from '../domain/geometry'
import type { FurnitureItem, RoomConfig, ViewMode, WallOpening, WallSide } from '../domain/types'
import { useRoomStore } from '../state/useRoomStore'

interface SceneProps {
  room: RoomConfig
  view: ViewMode
  orientation: number
  povYaw: number
  gridSnap: boolean
  furniture: FurnitureItem[]
}

const wallPlacement: Record<WallSide, (room: RoomConfig) => { position: [number, number, number]; rotation: [number, number, number] }> = {
  north: (room) => ({ position: [0, 0, -room.depth / 2], rotation: [0, 0, 0] }),
  south: (room) => ({ position: [0, 0, room.depth / 2], rotation: [0, Math.PI, 0] }),
  east: (room) => ({ position: [room.width / 2, 0, 0], rotation: [0, -Math.PI / 2, 0] }),
  west: (room) => ({ position: [-room.width / 2, 0, 0], rotation: [0, Math.PI / 2, 0] }),
}

function CameraRig({ room, view, orientation, povYaw }: Pick<SceneProps, 'room' | 'view' | 'orientation' | 'povYaw'>) {
  const { camera, size } = useThree()

  useEffect(() => {
    if (view === 'pov') {
      const position = doorWorldPosition(room, room.door)
      const direction = new THREE.Vector3(...inwardDirection(room.door.wall))
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(povYaw))
      camera.position.set(...position)
      camera.up.set(0, 1, 0)
      camera.lookAt(position[0] + direction.x, position[1] - 0.04, position[2] + direction.z)
    } else if (view === 'top') {
      const ortho = camera as THREE.OrthographicCamera
      const zoom = Math.min(size.width / (room.width + 1.1), size.height / (room.depth + 1.1))
      camera.position.set(0, 12, 0.001)
      camera.up.set(0, 0, -1)
      camera.lookAt(0, 0, 0)
      ortho.zoom = Math.max(36, zoom)
    } else {
      const positions = [
        [8, 7, 8],
        [-8, 7, 8],
        [-8, 7, -8],
        [8, 7, -8],
      ] as const
      const [x, y, z] = positions[((orientation % 4) + 4) % 4]
      camera.position.set(x, y, z)
      camera.up.set(0, 1, 0)
      camera.lookAt(0, 0.45, 0)
      const ortho = camera as THREE.OrthographicCamera
      ortho.zoom = Math.max(38, Math.min(size.width / (room.width + room.depth + 1) * 1.15, size.height / (room.height + room.depth + 1) * 1.25))
    }
    camera.updateProjectionMatrix()
  }, [camera, orientation, povYaw, room, size, view])

  return null
}

function SoftWall({ room, wall, hidden }: { room: RoomConfig; wall: WallSide; hidden: boolean }) {
  const length = wallLength(room, wall)
  const openings = openingsForWall(room, wall)
  const segments = buildWallSegments(length, room.height, openings)
  const placement = wallPlacement[wall](room)

  return (
    <group position={placement.position} rotation={placement.rotation} visible={!hidden}>
      {segments.map((segment, index) => (
        <mesh key={`${wall}-${index}`} position={[segment.center[0], segment.center[1], 0]} castShadow receiveShadow>
          <boxGeometry args={[segment.size[0], segment.size[1], 0.12]} />
          <meshStandardMaterial color="#f5eadb" roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[0, 0.055, 0.075]}>
        <boxGeometry args={[length, 0.11, 0.07]} />
        <meshStandardMaterial color="#d5a86e" />
      </mesh>
      {openings.map((opening) => <OpeningDetail key={opening.id} opening={opening} />)}
    </group>
  )
}

function OpeningDetail({ opening }: { opening: WallOpening }) {
  if (opening.kind === 'door') {
    return (
      <group position={[opening.offset, 0, 0.02]}>
        <mesh position={[-opening.width / 2, opening.height / 2, 0.05]}>
          <boxGeometry args={[0.07, opening.height, 0.16]} />
          <meshStandardMaterial color="#ac704b" />
        </mesh>
        <mesh position={[opening.width / 2, opening.height / 2, 0.05]}>
          <boxGeometry args={[0.07, opening.height, 0.16]} />
          <meshStandardMaterial color="#ac704b" />
        </mesh>
        <mesh position={[0, opening.height, 0.05]}>
          <boxGeometry args={[opening.width + 0.07, 0.08, 0.16]} />
          <meshStandardMaterial color="#ac704b" />
        </mesh>
      </group>
    )
  }

  return (
    <group position={[opening.offset, opening.bottom + opening.height / 2, 0.01]}>
      <mesh>
        <boxGeometry args={[opening.width - 0.08, opening.height - 0.08, 0.035]} />
        <meshStandardMaterial color="#a9d9df" transparent opacity={0.62} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0, 0.026]}>
        <boxGeometry args={[0.055, opening.height, 0.07]} />
        <meshStandardMaterial color="#f0c58d" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * opening.width / 2, 0, 0.035]}>
          <boxGeometry args={[0.07, opening.height + 0.08, 0.09]} />
          <meshStandardMaterial color="#c88f58" />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, side * opening.height / 2, 0.035]}>
          <boxGeometry args={[opening.width + 0.08, 0.07, 0.09]} />
          <meshStandardMaterial color="#c88f58" />
        </mesh>
      ))}
    </group>
  )
}

function PlanOpening({ room, opening, wall }: { room: RoomConfig; opening: WallOpening; wall: WallSide }) {
  const horizontal = wall === 'north' || wall === 'south'
  const color = opening.kind === 'door' ? '#e9895b' : '#65b7c2'
  let position: [number, number, number]
  if (wall === 'north') position = [opening.offset, 0.035, -room.depth / 2]
  else if (wall === 'south') position = [opening.offset, 0.035, room.depth / 2]
  else if (wall === 'east') position = [room.width / 2, 0.035, opening.offset]
  else position = [-room.width / 2, 0.035, opening.offset]
  return (
    <mesh position={position}>
      <boxGeometry args={horizontal ? [opening.width, 0.055, 0.1] : [0.1, 0.055, opening.width]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

function FloorGrid({ room, visible }: { room: RoomConfig; visible: boolean }) {
  const positions = useMemo(() => {
    const lines: number[] = []
    const step = 0.25
    for (let x = -room.width / 2; x <= room.width / 2 + 0.001; x += step) {
      lines.push(x, 0.013, -room.depth / 2, x, 0.013, room.depth / 2)
    }
    for (let z = -room.depth / 2; z <= room.depth / 2 + 0.001; z += step) {
      lines.push(-room.width / 2, 0.013, z, room.width / 2, 0.013, z)
    }
    return new Float32Array(lines)
  }, [room.depth, room.width])

  if (!visible) return null
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#cdbfae" transparent opacity={0.34} />
    </lineSegments>
  )
}

function FurnitureModel({ item }: { item: FurnitureItem }) {
  const material = <meshStandardMaterial color={item.color} roughness={0.78} />
  if (item.kind === 'armchair') {
    return (
      <group>
        <mesh position={[0, 0.34, 0]} castShadow><boxGeometry args={[item.width * 0.74, 0.32, item.depth * 0.68]} />{material}</mesh>
        <mesh position={[0, 0.65, item.depth * 0.32]} rotation={[-0.12, 0, 0]} castShadow><boxGeometry args={[item.width, 0.55, 0.18]} />{material}</mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * item.width * 0.43, 0.46, 0]} castShadow><boxGeometry args={[0.15, 0.42, item.depth * 0.78]} />{material}</mesh>)}
        {[-1, 1].map((side) => <mesh key={`leg-${side}`} position={[side * item.width * 0.32, 0.11, -item.depth * 0.2]}><boxGeometry args={[0.08, 0.22, 0.08]} /><meshStandardMaterial color="#795641" /></mesh>)}
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
  return (
    <group>
      <mesh position={[0, item.height / 2, 0]} castShadow>{material}<boxGeometry args={[item.width, item.height, item.depth]} /></mesh>
      <mesh position={[0, item.height / 2, -item.depth / 2 - 0.006]}><boxGeometry args={[0.035, item.height * 0.86, 0.02]} /><meshStandardMaterial color="#506b63" /></mesh>
      {[-0.15, 0.15].map((x) => <mesh key={x} position={[x, item.height / 2, -item.depth / 2 - 0.03]}><sphereGeometry args={[0.027, 12, 12]} /><meshStandardMaterial color="#e9c079" metalness={0.25} /></mesh>)}
      {[-1, 1].map((x) => <mesh key={x} position={[x * item.width * 0.38, 0.06, 0]}><boxGeometry args={[0.09, 0.12, item.depth * 0.72]} /><meshStandardMaterial color="#40584f" /></mesh>)}
    </group>
  )
}

function FurnitureObject({ item, selected, canDrag }: { item: FurnitureItem; selected: boolean; canDrag: boolean }) {
  const selectFurniture = useRoomStore((state) => state.selectFurniture)
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const [dragging, setDragging] = useState(false)
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const point = useMemo(() => new THREE.Vector3(), [])

  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    selectFurniture(item.id)
    if (!canDrag) return
    setDragging(true)
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
  }
  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging || !canDrag) return
    event.stopPropagation()
    if (event.ray.intersectPlane(floorPlane, point)) moveFurniture(item.id, point.x, point.z)
  }
  const handleUp = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return
    event.stopPropagation()
    setDragging(false)
    ;(event.target as Element | null)?.releasePointerCapture(event.pointerId)
  }

  return (
    <group
      position={[item.x, 0.02, item.z]}
      rotation={[0, item.rotation, 0]}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={() => setDragging(false)}
      onPointerOver={() => { if (canDrag) document.body.classList.add('can-grab') }}
      onPointerOut={() => document.body.classList.remove('can-grab')}
    >
      {selected && (
        <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(item.width, item.depth) * 0.61, Math.max(item.width, item.depth) * 0.69, 32]} />
          <meshBasicMaterial color="#ea6f4c" side={THREE.DoubleSide} />
        </mesh>
      )}
      <FurnitureModel item={item} />
    </group>
  )
}

function RoomWorld(props: SceneProps) {
  const selectedId = useRoomStore((state) => state.selectedId)
  const selectFurniture = useRoomStore((state) => state.selectFurniture)
  const hidden = props.view === 'top' ? ['north', 'east', 'south', 'west'] : props.view === 'isometric' ? hiddenWallsForOrientation(props.orientation) : []

  return (
    <>
      <CameraRig room={props.room} view={props.view} orientation={props.orientation} povYaw={props.povYaw} />
      <color attach="background" args={['#e8dfd3']} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[5, 8, 4]} intensity={2.1} color="#fff2dc" castShadow shadow-mapSize={[1024, 1024]} />
      <hemisphereLight args={['#ddecf0', '#bd9170', 0.75]} />

      <mesh receiveShadow onPointerDown={() => selectFurniture(null)}>
        <boxGeometry args={[props.room.width, 0.08, props.room.depth]} />
        <meshStandardMaterial color="#dcc3a3" roughness={0.94} />
      </mesh>
      <FloorGrid room={props.room} visible={props.gridSnap && props.view !== 'pov'} />
      {(['north', 'east', 'south', 'west'] as WallSide[]).map((wall) => (
        <SoftWall key={wall} room={props.room} wall={wall} hidden={hidden.includes(wall)} />
      ))}
      {props.view === 'top' && (['north', 'east', 'south', 'west'] as WallSide[]).flatMap((wall) =>
        openingsForWall(props.room, wall).map((opening) => <PlanOpening key={`${wall}-${opening.id}`} room={props.room} opening={opening} wall={wall} />),
      )}
      {props.furniture.map((item) => (
        <FurnitureObject key={item.id} item={item} selected={item.id === selectedId} canDrag={props.view !== 'pov'} />
      ))}
      <mesh position={[0, -0.11, 0]} receiveShadow>
        <boxGeometry args={[props.room.width + 0.28, 0.14, props.room.depth + 0.28]} />
        <meshStandardMaterial color="#b7835d" roughness={0.9} />
      </mesh>
    </>
  )
}

export default function RoomScene(props: SceneProps) {
  const perspective = props.view === 'pov'
  return (
    <Canvas
      key={perspective ? 'perspective' : 'orthographic'}
      orthographic={!perspective}
      camera={perspective ? { fov: 62, near: 0.05, far: 80 } : { near: 0.1, far: 80, zoom: 55 }}
      shadows
      dpr={[1, 1.7]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <RoomWorld {...props} />
    </Canvas>
  )
}

export function FurnitureSwatch({ kind }: { kind: keyof typeof FURNITURE_PRESETS }) {
  return <span className={`furniture-swatch furniture-swatch--${kind}`} aria-hidden="true" />
}
