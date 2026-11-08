import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEFAULT_WALL_COLOR } from '../domain/constants'
import { isWallMountedDecoration, wallLength } from '../domain/geometry'
import type { RoomConfig, WallOpening, WallSide } from '../domain/types'
import { openingPolygon } from './wallGeometry'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { uncoveredPolygons, wallRectangle } from '../domain/connectedWallGeometry'
import { physicalWalls, wallDerivedOpenings, type ConnectedWall } from '../domain/wallConnections'
import type { WallFace } from '../domain/wallSolidGeometry'
import { wallMeshGeometry } from './wallMeshGeometry'
import { useRoomStore } from '../state/useRoomStore'
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

export function WallBody({ length, height, openings, color, onPointerDown, depth = 0.12, wallId = '', skinFaces, frame }: { length: number; height: number; openings: WallOpening[]; color: string; onPointerDown: (event: ThreeEvent<PointerEvent>) => void; depth?: number; wallId?: string; skinFaces?: readonly WallFace[]; frame?: ConnectedWall }) {
  const geometry = useMemo(() => {
    if (skinFaces && frame) return wallMeshGeometry(skinFaces, frame)
    const pieces = uncoveredPolygons(wallRectangle(-length / 2, length / 2, 0, height),
      openings.filter((opening) => !isWallMountedDecoration(opening.shape)).map(openingPolygon))
    const geometries = pieces.map((polygon) => {
      const shape = new THREE.Shape(polygon.map(([x, y]) => new THREE.Vector2(x, y)))
      shape.closePath()
      return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1, steps: 1 })
    })
    const merged = geometries.length ? mergeGeometries(geometries) : new THREE.BufferGeometry()
    geometries.forEach((part) => part.dispose())
    return merged ?? new THREE.BufferGeometry()
  }, [height, length, openings, depth, skinFaces, frame])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} position={[0, 0, skinFaces && frame ? 0 : -depth / 2]} castShadow receiveShadow userData={{ wallId }} onPointerDown={onPointerDown}>
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  )
}

export function SoftWall({ room, wall, hidden, showGrid, exportMode, skinFaces }: { room: RoomConfig; wall: WallSide; hidden: boolean; showOpeningDetails: boolean; showGrid: boolean; exportMode: boolean; groupSelected: boolean; collisionIds: ReadonlySet<string>; skinFaces?: readonly WallFace[] }) {
  const packs = useRoomStore((state) => state.structurePacks)
  const selectedIds = useRoomStore((state) => state.selectedIds)
  const length = wallLength(room, wall)
  const openings = useMemo(() => {
    const world = { room, structurePacks: packs }
    return wallDerivedOpenings(world, physicalWalls(world).find((item) => item.id === baseWallId(wall))!)
  }, [room, packs, wall])
  const placement = wallPlacement[wall](room)
  const frame = physicalWalls({ room, structurePacks: packs }).find((item) => item.id === baseWallId(wall))

  return (
    <group position={placement.position} rotation={placement.rotation}>
      {!hidden && <group>
        <WallBody wallId={baseWallId(wall)} skinFaces={skinFaces} frame={frame} length={length} height={room.height} openings={openings} color={room.wallColors?.[wall] ?? room.wallColor ?? DEFAULT_WALL_COLOR} onPointerDown={(event) => {
          event.stopPropagation()
          recordSceneInteraction('background.pointer-down', { target: 'wall', wall })
          selectSceneObject(baseWallId(wall), event.nativeEvent)
        }} />
        <group position={[0, 0, 0.075]}><WallBody wallId={`${baseWallId(wall)}:baseboard`} length={length} height={0.11} depth={0.07} openings={openings} color="#d5a86e" onPointerDown={(event) => {
          event.stopPropagation()
          recordSceneInteraction('background.pointer-down', { target: 'baseboard', wall })
          selectSceneObject(baseWallId(wall), event.nativeEvent)
        }} /></group>
        {showGrid && <WallGrid length={length} height={room.height} openings={openings} />}
        {!exportMode && selectedIds.includes(baseWallId(wall)) && <group position={[0, room.height / 2, 0]}><SelectionBounds width={length} height={room.height} depth={0.12} /></group>}
      </group>}
    </group>
  )
}
