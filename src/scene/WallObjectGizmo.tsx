import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { AxisLocks, PositionAxis } from '../domain/types'
import { moveFromOrigin } from '../domain/measurements'
import { useRoomStore } from '../state/useRoomStore'
import { useHistoryGesture } from '../state/useHistoryGesture'
import { releasePointer, usePointerCancellation } from './usePointerCancellation'
import { AXIS_COLORS } from './axisColors'

type Point = { x: number; y: number; z: number }
const vectors = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }

/** World axes stay mounted while a window detaches or changes owning room. */
export function WallObjectGizmo({ id, position, anchor = position, height, locks }: { id: string; position: Point; anchor?: Point; height: number; locks?: AxisLocks }) {
  const { camera } = useThree()
  const move = useRoomStore((state) => state.moveWallObject)
  const gesture = useHistoryGesture(id)
  const drag = useRef<{ axis: PositionAxis; origin: number; point: THREE.Vector3; plane: THREE.Plane } | null>(null)
  const end = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    drag.current = null
    gesture.commit()
    document.body.classList.remove('can-grab')
    releasePointer(event)
  }
  const capture = usePointerCancellation((event) => { gesture.cancel(); end(event) })
  const start = (axis: PositionAxis, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (locks?.[axis]) return
    const normal = camera.getWorldDirection(new THREE.Vector3())
    normal.addScaledVector(vectors[axis], -normal.dot(vectors[axis]))
    if (normal.lengthSq() < 1e-6) return
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(), new THREE.Vector3(anchor.x, anchor.y + height / 2, anchor.z))
    const point = event.ray.intersectPlane(plane, new THREE.Vector3())
    if (!point) return
    drag.current = { axis, origin: position[axis], point, plane }
    gesture.begin()
    capture(event)
    document.body.classList.add('can-grab')
  }
  const moving = (event: ThreeEvent<PointerEvent>) => {
    const current = drag.current
    if (!current || !gesture.isActive()) return
    event.stopPropagation()
    const point = event.ray.intersectPlane(current.plane, new THREE.Vector3())
    if (point) move(id, current.axis, moveFromOrigin(current.origin + point.clone().sub(current.point).dot(vectors[current.axis]), current.origin))
  }
  const direction = camera.getWorldDirection(new THREE.Vector3())
  return <group position={[anchor.x, anchor.y + height / 2, anchor.z]} userData={{ selectionGizmo: true }}>
    {(['x', 'y', 'z'] as const).filter((axis) => !locks?.[axis] && Math.abs(direction.dot(vectors[axis])) < 0.98).map((axis) =>
      <group key={axis} onPointerDown={(event) => start(axis, event)} onPointerMove={moving} onPointerUp={end} onPointerCancel={(event) => { gesture.cancel(); end(event) }}>
        <mesh position={vectors[axis].clone().multiplyScalar(0.3)} renderOrder={8}>
          <boxGeometry args={axis === 'x' ? [0.6, 0.025, 0.025] : axis === 'y' ? [0.025, 0.6, 0.025] : [0.025, 0.025, 0.6]} />
          <meshBasicMaterial color={AXIS_COLORS[axis].normal} depthTest={false} depthWrite={false} />
        </mesh>
        <mesh position={vectors[axis].clone().multiplyScalar(0.6)} rotation={axis === 'x' ? [0, 0, -Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]} renderOrder={8}>
          <coneGeometry args={[0.07, 0.16, 12]} /><meshBasicMaterial color={AXIS_COLORS[axis].normal} depthTest={false} depthWrite={false} />
        </mesh>
        <mesh position={vectors[axis].clone().multiplyScalar(0.35)}>
          <boxGeometry args={axis === 'x' ? [0.7, 0.16, 0.16] : axis === 'y' ? [0.16, 0.7, 0.16] : [0.16, 0.16, 0.7]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>)}
  </group>
}
