import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { MARQUEE_MIN_DRAG, marqueeHits, normalizedRect } from '../domain/marqueeSelection'
import { selectableItems } from '../domain/multiSelection'
import { useRoomStore } from '../state/useRoomStore'
import { selectSceneObject } from './sceneInteraction'

/** Primer objeto bajo el puntero es fondo: suelo, plataforma, plano de arrastre o nada. */
function startsOnBackground(first: THREE.Intersection | undefined) {
  if (!first) return true
  let background = false
  for (let current: THREE.Object3D | null = first.object; current; current = current.parent) {
    if (typeof current.userData.wallId === 'string' || current.userData.selectionGizmo || current.userData.structureSurfaceGizmo) return false
    if (current.userData.freeOrbitSurface === true || current.userData.planPannable === true) background = true
  }
  return background
}

/**
 * Selección por área: Mayús + arrastrar sobre el fondo, o la herramienta «Selección por área»
 * (para pantallas táctiles). Solo cambia la selección de sesión, nunca el diseño.
 */
export function MarqueeSelection({ enabled, onRightHeld }: { enabled: boolean; onRightHeld: (held: boolean) => void }) {
  const { camera, gl, scene } = useThree()
  useEffect(() => {
    if (!enabled) return
    const canvas = gl.domElement
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const box = document.createElement('div')
    box.className = 'marquee-box'
    box.hidden = true
    canvas.parentElement?.appendChild(box)
    let drag: { pointerId: number; x: number; y: number; additive: boolean; moved: boolean; right: boolean; clickId?: string } | null = null
    const local = (event: PointerEvent) => { const bounds = canvas.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top, bounds } }
    const finish = () => {
      const current = drag
      drag = null
      box.hidden = true
      if (current?.right) onRightHeld(false)
      if (current && canvas.hasPointerCapture(current.pointerId)) canvas.releasePointerCapture(current.pointerId)
    }

    const onDown = (event: PointerEvent) => {
      const state = useRoomStore.getState()
      if ((event.button !== 0 && event.button !== 2) || state.view === 'pov') return
      const right = event.button === 2 && event.pointerType === 'mouse'
      const modifierDrag = event.shiftKey && !event.ctrlKey && !event.metaKey
      if (!right && !modifierDrag && !state.areaSelect) return
      const { x, y, bounds } = local(event)
      pointer.set((x / bounds.width) * 2 - 1, -(y / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const first = raycaster.intersectObjects(scene.children, true).find(({ object }) => !(object instanceof THREE.Line))
      if (!right && !startsOnBackground(first)) return
      let clickId: string | undefined
      if (right && first) {
        for (let object: THREE.Object3D | null = first.object; object; object = object.parent) {
          const id = object.userData.elementId ?? object.userData.structureSurfaceId ?? object.userData.wallId
          if (typeof id === 'string' && id) { clickId = id.replace(/:baseboard$/, ''); break }
        }
      }
      drag = { pointerId: event.pointerId, x, y, additive: modifierDrag, moved: false, right, clickId }
      if (right) onRightHeld(true)
      event.preventDefault()
      event.stopImmediatePropagation()
      canvas.setPointerCapture(event.pointerId)
    }
    const onMove = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const { x, y } = local(event)
      if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) < MARQUEE_MIN_DRAG) return
      drag.moved = true
      const rect = normalizedRect(drag, { x, y })
      Object.assign(box.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.right - rect.left}px`, height: `${rect.bottom - rect.top}px` })
      box.hidden = false
    }
    const onUp = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return
      event.stopImmediatePropagation()
      const current = drag
      const { x, y, bounds } = local(event)
      finish()
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      const state = useRoomStore.getState()
      if (!current.moved) {
        if (current.right && current.clickId) selectSceneObject(current.clickId, event)
        else if (!current.additive) state.selectElement(null)
        return
      }
      const candidates = selectableItems(state)
      const project = (point: { x: number; y: number; z: number }) => {
        const projected = new THREE.Vector3(point.x, point.y, point.z).project(camera)
        return projected.z > 1 ? null : { x: (projected.x + 1) / 2 * bounds.width, y: (1 - projected.y) / 2 * bounds.height }
      }
      state.selectElements(marqueeHits(candidates, project, normalizedRect(current, { x, y })), current.additive)
    }
    const onCancel = (event: PointerEvent) => { if (drag?.pointerId === event.pointerId) finish() }
    canvas.addEventListener('pointerdown', onDown, true)
    canvas.addEventListener('pointermove', onMove, true)
    canvas.addEventListener('pointerup', onUp, true)
    canvas.addEventListener('pointercancel', onCancel, true)
    canvas.addEventListener('lostpointercapture', onCancel, true)
    window.addEventListener('blur', finish)
    return () => {
      canvas.removeEventListener('pointerdown', onDown, true)
      canvas.removeEventListener('pointermove', onMove, true)
      canvas.removeEventListener('pointerup', onUp, true)
      canvas.removeEventListener('pointercancel', onCancel, true)
      canvas.removeEventListener('lostpointercapture', onCancel, true)
      window.removeEventListener('blur', finish)
      finish()
      box.remove()
    }
  }, [camera, enabled, gl, scene, onRightHeld])
  return null
}
