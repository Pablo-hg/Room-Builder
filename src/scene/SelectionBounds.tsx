import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { useRoomStore } from '../state/useRoomStore'

/** A non-interactive outline in the selected element's local coordinates. */
export function SelectionBounds({ width, height, depth, collision = false }: { width: number; height: number; depth: number; collision?: boolean }) {
  const visible = useRoomStore((state) => state.showSelectionBounds)
  const line = useMemo(() => {
    const box = new THREE.BoxGeometry(width, height, depth)
    const edges = new THREE.EdgesGeometry(box)
    const geometry = new LineSegmentsGeometry().fromEdgesGeometry(edges)
    box.dispose()
    edges.dispose()
    const material = new LineMaterial({ color: collision ? '#e04444' : '#588b79', linewidth: 2.5, depthTest: false, depthWrite: false, toneMapped: false })
    const result = new LineSegments2(geometry, material)
    result.raycast = () => undefined
    result.renderOrder = 8
    return result
  }, [width, height, depth, collision])
  useEffect(() => () => { line.geometry.dispose(); line.material.dispose() }, [line])

  return visible || collision ? <primitive object={line} /> : null
}
