import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { isWallMountedDecoration } from '../domain/geometry'
import type { RoomConfig, WallOpening, WallSide } from '../domain/types'
import { clipPolygonToWall, openingPolygon } from './wallGeometry'

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
