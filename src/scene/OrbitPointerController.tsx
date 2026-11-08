import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { useRoomStore } from '../state/useRoomStore'

export function OrbitPointerController({ view }: { view: 'isometric' | 'free' | null }) {
  const { camera, gl, scene } = useThree()

  useEffect(() => {
    if (!view) return

    const canvas = gl.domElement
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let drag: { pointerId: number; startX: number; startY: number; angle: number; elevation: number } | null = null

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const bounds = canvas.getBoundingClientRect()
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const firstVisibleHit = raycaster
        .intersectObjects(scene.children, true)
        .find(({ object }) => !(object instanceof THREE.Line))
      let hitOrbitSurface = firstVisibleHit?.object.userData.freeOrbitSurface === true
      let hitWall = typeof firstVisibleHit?.object.userData.wallId === 'string'
      firstVisibleHit?.object.traverseAncestors((ancestor) => {
        if (ancestor.userData.freeOrbitSurface === true) hitOrbitSurface = true
        if (typeof ancestor.userData.wallId === 'string') hitWall = true
      })
      // Wall interaction always wins over camera orbit, even on long press.
      if (hitWall || (firstVisibleHit && !hitOrbitSurface)) return

      const state = useRoomStore.getState()
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        angle: view === 'isometric' ? state.isoAngle : state.freeAzimuth,
        elevation: state.freeElevation,
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      canvas.setPointerCapture(event.pointerId)
      state.selectElement(null)
      if (view === 'isometric') state.setIsoOrbitDragging(true)
      else state.setFreeOrbitDragging(true)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const state = useRoomStore.getState()
      if (view === 'isometric') {
        state.setIsoAngle(drag.angle + (event.clientX - drag.startX) * 0.009)
      } else {
        state.setFreeOrbit(
          drag.angle + (event.clientX - drag.startX) * 0.009,
          drag.elevation + (event.clientY - drag.startY) * 0.009,
        )
      }
    }

    const finishDrag = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return
      event.stopImmediatePropagation()
      drag = null
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      const state = useRoomStore.getState()
      if (view === 'isometric') state.setIsoOrbitDragging(false)
      else state.setFreeOrbitDragging(false)
    }

    canvas.addEventListener('pointerdown', onPointerDown, true)
    canvas.addEventListener('pointermove', onPointerMove, true)
    canvas.addEventListener('pointerup', finishDrag, true)
    canvas.addEventListener('pointercancel', finishDrag, true)
    canvas.addEventListener('lostpointercapture', finishDrag, true)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown, true)
      canvas.removeEventListener('pointermove', onPointerMove, true)
      canvas.removeEventListener('pointerup', finishDrag, true)
      canvas.removeEventListener('pointercancel', finishDrag, true)
      canvas.removeEventListener('lostpointercapture', finishDrag, true)
      if (drag) {
        const state = useRoomStore.getState()
        if (view === 'isometric') state.setIsoOrbitDragging(false)
        else state.setFreeOrbitDragging(false)
      }
    }
  }, [camera, gl, scene, view])

  return null
}
