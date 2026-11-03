import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { axisControlScale } from './axisSizing'

/** Keeps controls near the projected centre, on the camera-facing side of the bounds. */
export function AxisAnchor({ center, dimensions, children }: { center: readonly [number, number, number]; dimensions: readonly [number, number, number]; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const { camera, size } = useThree()
  const work = useMemo(() => ({ camera: new THREE.Vector3(), center: new THREE.Vector3(), point: new THREE.Vector3(), direction: new THREE.Vector3(), world: new THREE.Vector3(), box: new THREE.Box3(), ray: new THREE.Ray() }), [])
  useFrame(() => {
    const group = ref.current
    const parent = group?.parent
    if (!group || !parent || size.height <= 0) return
    parent.updateWorldMatrix(true, false)
    camera.getWorldPosition(work.camera)
    parent.worldToLocal(work.camera)
    work.center.set(...center)
    work.box.setFromCenterAndSize(work.center, work.point.set(...dimensions))
    work.direction.copy(work.center).sub(work.camera).normalize()
    work.ray.set(work.camera, work.direction)
    if (!work.box.containsPoint(work.camera) && work.ray.intersectBox(work.box, work.point)) {
      group.position.copy(work.point).addScaledVector(work.direction, -0.08)
    } else group.position.copy(work.center)
    group.getWorldPosition(work.world)
    group.scale.setScalar(axisControlScale(camera, size.height, work.world))
  })
  return <group ref={ref} userData={{ selectionGizmo: true }}>{children}</group>
}
