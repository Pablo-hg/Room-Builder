import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { AxisLocks, PositionAxis } from '../domain/types'
import { moveFromOrigin } from '../domain/measurements'
import { useRoomStore } from '../state/useRoomStore'
import { useHistoryGesture } from '../state/useHistoryGesture'
import { releasePointer, usePointerCancellation } from './usePointerCancellation'
import { AXIS_COLORS } from './axisColors'
import { axisControlScale } from './axisSizing'

type Point = { x: number; y: number; z: number }
const vectors = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }
/** Estas flechas llegan a 0,68 (cono incluido) y las de los muebles a 0,5: misma medida en pantalla. */
const SCALE_TO_FURNITURE_ARROWS = 0.5 / 0.68

/** World axes stay mounted while a window detaches or changes owning room. */
export function WallObjectGizmo({ id, position, anchor = position, height, locks }: { id: string; position: Point; anchor?: Point; height: number; locks?: AxisLocks }) {
  const { camera, size } = useThree()
  const move = useRoomStore((state) => state.moveWallObject)
  // Como `AxisAnchor`: tamaño constante en pantalla al acercar o alejar la cámara.
  const scaled = useRef<THREE.Group>(null)
  const world = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const group = scaled.current
    if (!group || size.height <= 0) return
    group.getWorldPosition(world)
    group.scale.setScalar(axisControlScale(camera, size.height, world) * SCALE_TO_FURNITURE_ARROWS)
  })
  const gesture = useHistoryGesture(id)
  const drag = useRef<{ axis: PositionAxis; origin: number; point: THREE.Vector3; plane: THREE.Plane } | null>(null)
  // Igual que el gizmo de los muebles: la flecha se ilumina al pasar el ratón y mientras se arrastra.
  const [hoveredAxis, setHoveredAxis] = useState<PositionAxis | null>(null)
  const [draggingAxis, setDraggingAxis] = useState<PositionAxis | null>(null)
  const end = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    drag.current = null
    setDraggingAxis(null)
    gesture.commit()
    if (!hoveredAxis) document.body.classList.remove('can-grab')
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
    setDraggingAxis(axis)
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
  const axisColor = (axis: PositionAxis) => hoveredAxis === axis || draggingAxis === axis ? AXIS_COLORS[axis].active : AXIS_COLORS[axis].normal
  return <group position={[anchor.x, anchor.y + height / 2, anchor.z]} userData={{ selectionGizmo: true }}>
    <group ref={scaled}>
    {(['x', 'y', 'z'] as const).filter((axis) => !locks?.[axis] && Math.abs(direction.dot(vectors[axis])) < 0.98).map((axis) =>
      <group
        key={axis}
        onPointerDown={(event) => start(axis, event)}
        onPointerMove={moving}
        onPointerUp={end}
        onPointerCancel={(event) => { gesture.cancel(); end(event) }}
        onPointerOver={(event) => {
          event.stopPropagation()
          if (event.nativeEvent.buttons !== 0 && draggingAxis !== axis) return
          setHoveredAxis(axis)
          document.body.classList.add('can-grab')
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          setHoveredAxis((current) => current === axis ? null : current)
          if (!draggingAxis) document.body.classList.remove('can-grab')
        }}
      >
        {([-1, 1] as const).map((sign) => (
          <group key={sign}>
            <mesh position={vectors[axis].clone().multiplyScalar(sign * 0.3)} renderOrder={15}>
              <boxGeometry args={axis === 'x' ? [0.6, 0.025, 0.025] : axis === 'y' ? [0.025, 0.6, 0.025] : [0.025, 0.025, 0.6]} />
              <meshBasicMaterial color={axisColor(axis)} depthTest={false} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh
              position={vectors[axis].clone().multiplyScalar(sign * 0.6)}
              rotation={axis === 'x' ? [0, 0, -sign * Math.PI / 2] : axis === 'z' ? [sign * Math.PI / 2, 0, 0] : sign === 1 ? [0, 0, 0] : [Math.PI, 0, 0]}
              renderOrder={15}
            >
              <coneGeometry args={[0.07, 0.16, 12]} />
              <meshBasicMaterial color={axisColor(axis)} depthTest={false} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={vectors[axis].clone().multiplyScalar(sign * 0.35)}>
              <boxGeometry args={axis === 'x' ? [0.7, 0.16, 0.16] : axis === 'y' ? [0.16, 0.7, 0.16] : [0.16, 0.16, 0.7]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        ))}
      </group>)}
    </group>
  </group>
}
