import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEFAULT_WALL_COLOR } from '../domain/constants'
import { buildWallSegments, isWallMountedDecoration, openingsForWall, wallLength } from '../domain/geometry'
import type { RoomConfig, WallOpening, WallSide } from '../domain/types'
import { clipPolygonToWall, openingPolygon } from './wallGeometry'
import { useRoomStore } from '../state/useRoomStore'
import { OpeningDetail } from './Openings'
import { WallGrid } from './WallGrid'
import { recordSceneInteraction, selectSceneObject } from './sceneInteraction'
import { baseWallId } from '../domain/elementFolders'
import { SelectionBounds } from './SelectionBounds'

export const wallPlacement: Record<WallSide, (room: RoomConfig) => { position: [number, number, number]; rotation: [number, number, number] }> = {
  north: (room) => ({ position: [0, 0, -room.depth / 2], rotation: [0, 0, 0] }),
  south: (room) => ({ position: [0, 0, room.depth / 2], rotation: [0, Math.PI, 0] }),
  east: (room) => ({ position: [room.width / 2, 0, 0], rotation: [0, -Math.PI / 2, 0] }),
  west: (room) => ({ position: [-room.width / 2, 0, 0], rotation: [0, Math.PI / 2, 0] }),
}

export function WallBody({ length, height, openings, color, onPointerDown, depth = 0.12 }: { length: number; height: number; openings: WallOpening[]; color: string; onPointerDown: (event: ThreeEvent<PointerEvent>) => void; depth?: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-length / 2, 0)
    shape.lineTo(length / 2, 0)
    shape.lineTo(length / 2, height)
    shape.lineTo(-length / 2, height)
    shape.closePath()
    openings.filter((opening) => !isWallMountedDecoration(opening.shape)).forEach((opening) => {
      const polygon = clipPolygonToWall(openingPolygon(opening), length, height)
      if (polygon.length < 3) return
      const hole = new THREE.Path()
      hole.moveTo(polygon[0][0], polygon[0][1])
      polygon.slice(1).forEach(([x, y]) => hole.lineTo(x, y))
      hole.closePath()
      shape.holes.push(hole)
    })
    return new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    })
  }, [height, length, openings, depth])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} position={[0, 0, -depth / 2]} castShadow receiveShadow userData={{ freeOrbitSurface: true }} onPointerDown={onPointerDown}>
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  )
}

export function SoftWall({ room, wall, hidden, showOpeningDetails, showGrid, exportMode, groupSelected, collisionIds }: { room: RoomConfig; wall: WallSide; hidden: boolean; showOpeningDetails: boolean; showGrid: boolean; exportMode: boolean; groupSelected: boolean; collisionIds: ReadonlySet<string> }) {
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const lockedElementIds = useRoomStore((state) => state.lockedElementIds)
  const selectedId = useRoomStore((state) => state.selectedId)
  const selectedIds = useRoomStore((state) => state.selectedIds)
  const length = wallLength(room, wall)
  const openings = useMemo(() => openingsForWall(room, wall), [room.door, room.extraDoors, room.windows, wall])
  const placement = wallPlacement[wall](room)

  return (
    <group position={placement.position} rotation={placement.rotation}>
      {!hidden && <group>
        <WallBody length={length} height={room.height} openings={openings} color={room.wallColors?.[wall] ?? room.wallColor ?? DEFAULT_WALL_COLOR} onPointerDown={(event) => {
          event.stopPropagation()
          recordSceneInteraction('background.pointer-down', { target: 'wall', wall })
          selectSceneObject(baseWallId(wall), event.nativeEvent)
        }} />
        {buildWallSegments(length, 0.11, openings.filter((opening) => opening.kind === 'door')).map((segment, index) => <mesh key={index} position={[segment.center[0], segment.center[1], 0.075]} userData={{ freeOrbitSurface: true }} onPointerDown={(event) => {
          event.stopPropagation()
          recordSceneInteraction('background.pointer-down', { target: 'baseboard', wall })
          selectSceneObject(baseWallId(wall), event.nativeEvent)
        }}>
          <boxGeometry args={[segment.size[0], segment.size[1], 0.07]} />
          <meshStandardMaterial color="#d5a86e" />
        </mesh>)}
        {showGrid && <WallGrid length={length} height={room.height} openings={openings} />}
        {!exportMode && selectedIds.includes(baseWallId(wall)) && <group position={[0, room.height / 2, 0]}><SelectionBounds width={length} height={room.height} depth={0.12} /></group>}
      </group>}
      {openings.map((opening) => (
        <group key={opening.id} visible={showOpeningDetails && !hiddenElementIds.includes(opening.id)}>
          <OpeningDetail room={room} wall={wall} opening={opening} selected={!exportMode && selectedId === opening.id} locked={lockedElementIds.includes(opening.id)} />
          {!exportMode && ((selectedIds.includes(opening.id) && !groupSelected) || collisionIds.has(opening.id)) && <group position={[opening.offset, opening.bottom + opening.height / 2, opening.shape === 'wallShelf' ? 0.2 : 0.05]} rotation={[0, 0, opening.rotation]}>
            <SelectionBounds width={opening.width} height={opening.height} depth={opening.shape === 'wallShelf' ? 0.3 : 0.18} collision={collisionIds.has(opening.id)} />
          </group>}
        </group>
      ))}
    </group>
  )
}
