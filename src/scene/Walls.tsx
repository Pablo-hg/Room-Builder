import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEFAULT_WALL_COLOR } from '../domain/constants'
import { isWallMountedDecoration, openingsForWall, wallLength } from '../domain/geometry'
import type { RoomConfig, WallOpening, WallSide } from '../domain/types'
import { clipPolygonToWall, openingPolygon } from './wallGeometry'
import { useRoomStore } from '../state/useRoomStore'
import { OpeningDetail } from './Openings'
import { WallGrid } from './WallGrid'
import { recordSceneInteraction } from './sceneInteraction'
import { SelectionBounds } from './SelectionBounds'

export const wallPlacement: Record<WallSide, (room: RoomConfig) => { position: [number, number, number]; rotation: [number, number, number] }> = {
  north: (room) => ({ position: [0, 0, -room.depth / 2], rotation: [0, 0, 0] }),
  south: (room) => ({ position: [0, 0, room.depth / 2], rotation: [0, Math.PI, 0] }),
  east: (room) => ({ position: [room.width / 2, 0, 0], rotation: [0, -Math.PI / 2, 0] }),
  west: (room) => ({ position: [-room.width / 2, 0, 0], rotation: [0, Math.PI / 2, 0] }),
}

export function WallBody({ length, height, openings, color, onPointerDown }: { length: number; height: number; openings: WallOpening[]; color: string; onPointerDown: (event: ThreeEvent<PointerEvent>) => void }) {
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
      depth: 0.12,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    })
  }, [height, length, openings])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} position={[0, 0, -0.06]} castShadow receiveShadow userData={{ freeOrbitSurface: true }} onPointerDown={onPointerDown}>
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  )
}

export function SoftWall({ room, wall, hidden, showOpeningDetails, showGrid, exportMode, groupSelected }: { room: RoomConfig; wall: WallSide; hidden: boolean; showOpeningDetails: boolean; showGrid: boolean; exportMode: boolean; groupSelected: boolean }) {
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const lockedElementIds = useRoomStore((state) => state.lockedElementIds)
  const selectedId = useRoomStore((state) => state.selectedId)
  const selectedIds = useRoomStore((state) => state.selectedIds)
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
          <OpeningDetail room={room} wall={wall} opening={opening} selected={!exportMode && selectedId === opening.id} locked={lockedElementIds.includes(opening.id)} />
          {!exportMode && !groupSelected && selectedIds.includes(opening.id) && <group position={[opening.offset, opening.bottom + opening.height / 2, opening.shape === 'wallShelf' ? 0.2 : 0.05]} rotation={[0, 0, opening.rotation]}>
            <SelectionBounds width={opening.width} height={opening.height} depth={opening.shape === 'wallShelf' ? 0.3 : 0.18} />
          </group>}
        </group>
      ))}
    </group>
  )
}
