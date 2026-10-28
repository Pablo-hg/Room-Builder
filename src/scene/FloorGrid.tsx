import { useMemo } from 'react'
import { ROOM_LIMITS } from '../domain/constants'
import type { RoomConfig } from '../domain/types'

export function FloorGrid({ room, visible }: { room: RoomConfig; visible: boolean }) {
  const positions = useMemo(() => {
    const lines: number[] = []
    const step = ROOM_LIMITS.gridSize
    for (let x = -room.width / 2; x <= room.width / 2 + 0.001; x += step) {
      lines.push(x, 0.046, -room.depth / 2, x, 0.046, room.depth / 2)
    }
    for (let z = -room.depth / 2; z <= room.depth / 2 + 0.001; z += step) {
      lines.push(-room.width / 2, 0.046, z, room.width / 2, 0.046, z)
    }
    return new Float32Array(lines)
  }, [room.depth, room.width])

  if (!visible) return null
  return (
    <lineSegments raycast={() => undefined}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#aa9a87" transparent opacity={0.48} depthWrite={false} />
    </lineSegments>
  )
}
