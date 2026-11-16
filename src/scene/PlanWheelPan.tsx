import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { useRoomStore } from '../state/useRoomStore'

/** Mismo cursor de mano cerrada que al arrastrar el suelo del Plano. */
const PANNING_CLASS = 'plan-panning'
const MIDDLE_BUTTON = 1

/**
 * Desplazamiento del Plano manteniendo pulsada la rueda del ratón (botón central), desde cualquier punto:
 * sobre el suelo, muebles, paredes o con la herramienta Medir activa. Solo mueve la cámara de sesión
 * (`topCameraX/Z`): nunca el diseño, la selección ni el historial.
 *
 * Se engancha a la ventana en fase de captura para adelantarse a los eventos de la escena: así el botón
 * central no selecciona, arrastra ni mide nada por debajo y el navegador no activa el desplazamiento
 * automático de la rueda.
 */
export function PlanWheelPan() {
  const { camera, gl, size } = useThree()
  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return
    const canvas = gl.domElement
    let drag: { pointerId: number; x: number; y: number; cameraX: number; cameraZ: number; right: THREE.Vector3; up: THREE.Vector3; scale: number } | null = null
    const stop = () => {
      if (!drag) return
      try { if (canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId) } catch { /* el puntero ya no existe */ }
      drag = null
      document.body.classList.remove(PANNING_CLASS)
    }
    const down = (event: PointerEvent) => {
      if (event.button !== MIDDLE_BUTTON || event.target !== canvas || useRoomStore.getState().view !== 'top') return
      event.preventDefault()
      event.stopPropagation()
      const state = useRoomStore.getState()
      drag = {
        pointerId: event.pointerId, x: event.clientX, y: event.clientY, cameraX: state.topCameraX, cameraZ: state.topCameraZ,
        right: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
        up: new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion),
        scale: (camera.right - camera.left) / camera.zoom / Math.max(size.width, 1),
      }
      try { canvas.setPointerCapture(event.pointerId) } catch { /* sin captura el movimiento sigue llegando a la ventana */ }
      document.body.classList.add(PANNING_CLASS)
    }
    const move = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      // Si el botón central se soltó fuera de la ventana, no seguir desplazando.
      if (!(event.buttons & 4)) { stop(); return }
      event.stopPropagation()
      const dx = (event.clientX - drag.x) * drag.scale
      const dy = (event.clientY - drag.y) * drag.scale
      useRoomStore.getState().setTopCameraPosition(drag.cameraX - dx * drag.right.x + dy * drag.up.x, drag.cameraZ - dx * drag.right.z + dy * drag.up.z)
    }
    const up = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      event.stopPropagation()
      stop()
    }
    // Evita el desplazamiento automático de la rueda y el clic auxiliar del navegador.
    const suppress = (event: MouseEvent) => { if (event.button === MIDDLE_BUTTON && event.target === canvas) event.preventDefault() }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    window.addEventListener('mousedown', suppress, true)
    window.addEventListener('auxclick', suppress, true)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
      window.removeEventListener('mousedown', suppress, true)
      window.removeEventListener('auxclick', suppress, true)
      window.removeEventListener('blur', stop)
      stop()
    }
  }, [camera, gl, size.width])
  return null
}
