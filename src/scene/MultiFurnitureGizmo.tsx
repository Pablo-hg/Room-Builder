import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { multiSelectionBounds, type MultiItem } from '../domain/multiSelection'
import type { WallSide } from '../domain/types'
import { useHistoryGesture } from '../state/useHistoryGesture'
import { useRoomStore } from '../state/useRoomStore'
import { SelectionBounds } from './SelectionBounds'
import { releasePointer, usePointerCancellation } from './usePointerCancellation'
import { AXIS_COLORS } from './axisColors'
import { AxisAnchor } from './AxisAnchor'

export function MultiFurnitureGizmo({ items, locked, view, wall }: { items: MultiItem[]; locked: boolean; view: string; wall: WallSide | null }) {
  const bounds = multiSelectionBounds(items)!
  const move = useRoomStore((state) => state.moveSelectedFurnitureGroup)
  const moveBy = useRoomStore((state) => state.moveSelectedFurnitureGroupBy)
  const gesture = useHistoryGesture(`multi:${items.map((item) => item.id).sort().join(',')}`)
  const { camera, size } = useThree()
  const [axis, setAxis] = useState<'x' | 'y' | 'z' | null>(null)
  const [hoveredAxis, setHoveredAxis] = useState<'x' | 'y' | 'z' | null>(null)
  const [draggingBody, setDraggingBody] = useState(false)
  const start = useRef({ x: 0, y: 0, applied: 0 })
  const bodyStart = useRef(new THREE.Vector3())
  const bodyApplied = useRef({ x: 0, y: 0, z: 0 })
  const point = useMemo(() => new THREE.Vector3(), [])
  const plane = useMemo(() => new THREE.Plane(), [])
  const capture = usePointerCancellation(() => { gesture.cancel(); setAxis(null); setDraggingBody(false); document.body.classList.remove('can-grab') })
  useEffect(() => () => document.body.classList.remove('can-grab'), [])
  const scale = camera instanceof THREE.OrthographicCamera ? (camera.right - camera.left) / camera.zoom / size.width : 0.01
  const dimensions = [bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z] as const
  const center = [bounds.center.x, bounds.center.y, bounds.center.z] as const
  const modified = (event: PointerEvent | MouseEvent) => event.ctrlKey || event.metaKey || event.shiftKey
  return <group>
    <group position={center}><SelectionBounds width={dimensions[0]} height={dimensions[1]} depth={dimensions[2]} /></group>
    <mesh position={center}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        if (modified(event.nativeEvent)) return
        event.stopPropagation()
        if (locked || view === 'pov') return
        const normal = view === 'front' ? new THREE.Vector3(...(wall === 'east' || wall === 'west' ? [1, 0, 0] as const : [0, 0, 1] as const)) : new THREE.Vector3(0, 1, 0)
        plane.setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(...center))
        if (!event.ray.intersectPlane(plane, point)) return
        bodyStart.current.copy(point)
        bodyApplied.current = { x: 0, y: 0, z: 0 }
        gesture.begin()
        setDraggingBody(true)
        capture(event)
      }}
      onPointerMove={(event: ThreeEvent<PointerEvent>) => {
        if (!draggingBody || !gesture.isActive()) return
        event.stopPropagation()
        if (!event.ray.intersectPlane(plane, point)) return
        const snap = useRoomStore.getState().gridSnap
        const desired = { x: 0, y: 0, z: 0 }
        for (const value of ['x', 'y', 'z'] as const) {
          if (!items.every((item) => item.axes.includes(value))) continue
          const displacement = point[value] - bodyStart.current[value]
          desired[value] = snap ? Math.round(displacement / 0.125) * 0.125 : displacement
        }
        const delta = { x: desired.x - bodyApplied.current.x, y: desired.y - bodyApplied.current.y, z: desired.z - bodyApplied.current.z }
        const before = useRoomStore.getState()
        moveBy(delta)
        const after = useRoomStore.getState()
        if (before.room !== after.room || before.furniture !== after.furniture || before.structurePacks !== after.structurePacks) bodyApplied.current = desired
      }}
      onPointerUp={(event: ThreeEvent<PointerEvent>) => { if (!draggingBody) return; event.stopPropagation(); gesture.commit(); setDraggingBody(false); releasePointer(event) }}
      onPointerCancel={() => { gesture.cancel(); setDraggingBody(false) }}
      onClick={(event) => { if (!modified(event.nativeEvent)) event.stopPropagation() }}>
      <boxGeometry args={dimensions} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
    </mesh>
    {!locked && view !== 'pov' && <AxisAnchor center={center} dimensions={dimensions}>{(['x', 'y', 'z'] as const).filter((value) => {
      if (!items.every((item) => item.axes.includes(value))) return false
      if (value === 'y' && view === 'top') return false
      if (view === 'front' && value === ((wall === 'east' || wall === 'west') ? 'x' : 'z')) return false
      return true
    }).map((value) => {
      const dir = value === 'x' ? new THREE.Vector3(1, 0, 0) : value === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
      const screen = dir.clone().project(camera).sub(new THREE.Vector3(0, 0, 0).project(camera))
      const screenLength = Math.hypot(screen.x * size.width, screen.y * size.height)
      const axisX = screenLength > 1e-6 ? screen.x * size.width / screenLength : 0
      const axisY = screenLength > 1e-6 ? -screen.y * size.height / screenLength : -1
      const color = axis === value || hoveredAxis === value ? AXIS_COLORS[value].active : AXIS_COLORS[value].normal
      return <group key={value}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => { if (modified(event.nativeEvent)) return; event.stopPropagation(); start.current = { x: event.clientX, y: event.clientY, applied: 0 }; gesture.begin(); setAxis(value); document.body.classList.add('can-grab'); capture(event) }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => { if (axis !== value || !gesture.isActive()) return; event.stopPropagation(); const delta = ((event.clientX - start.current.x) * axisX + (event.clientY - start.current.y) * axisY) * scale; const snapped = Math.round(delta / 0.125) * 0.125; if (snapped !== start.current.applied) { const before = useRoomStore.getState(); move(value, snapped - start.current.applied); if (before.room !== useRoomStore.getState().room || before.furniture !== useRoomStore.getState().furniture || before.structurePacks !== useRoomStore.getState().structurePacks) start.current.applied = snapped } }}
        onPointerUp={(event: ThreeEvent<PointerEvent>) => { if (axis !== value) return; event.stopPropagation(); gesture.commit(); setAxis(null); document.body.classList.remove('can-grab'); releasePointer(event) }}
        onPointerCancel={() => { gesture.cancel(); setAxis(null); document.body.classList.remove('can-grab') }}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); setHoveredAxis(value); document.body.classList.add('can-grab') }}
        onPointerOut={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); setHoveredAxis((current) => current === value ? null : current); if (!axis) document.body.classList.remove('can-grab') }}>
        <group rotation={value === 'x' ? [0, 0, -Math.PI / 2] : value === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
          <mesh><boxGeometry args={[0.2, 1, 0.2]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
          <mesh renderOrder={10}><cylinderGeometry args={[0.018, 0.018, 0.7, 12]} /><meshBasicMaterial color={color} depthTest={false} toneMapped={false} /></mesh>
          {([-1, 1] as const).map((side) => <mesh key={side} position={[0, side * 0.425, 0]} rotation={[side < 0 ? Math.PI : 0, 0, 0]} renderOrder={10}><coneGeometry args={[0.07, 0.15, 16]} /><meshBasicMaterial color={color} depthTest={false} toneMapped={false} /></mesh>)}
        </group>
      </group>
    })}</AxisAnchor>}
  </group>
}
