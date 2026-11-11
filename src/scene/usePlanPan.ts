import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useRoomStore } from '../state/useRoomStore'
import { releasePointer, usePointerCancellation } from './usePointerCancellation'

interface PanDrag {
  pointerId: number
  x: number
  y: number
  cameraX: number
  cameraZ: number
  right: THREE.Vector3
  up: THREE.Vector3
  scale: number
}

/** Cursor de mano abierta sobre un suelo desplazable del Plano. */
const PAN_READY_CLASS = 'plan-pan-ready'
/** Cursor de mano cerrada mientras se desplaza el Plano. */
const PANNING_CLASS = 'plan-panning'

const clearPanCursor = () => document.body.classList.remove(PAN_READY_CLASS, PANNING_CLASS)

/**
 * Desplazamiento libre de la cámara en Plano al arrastrar un suelo.
 * Se comparte entre el suelo de la habitación raíz y los suelos de las
 * habitaciones adicionales: solo mueve la cámara de sesión, nunca el diseño.
 * Igual que la órbita isométrica, el cursor indica que se puede arrastrar
 * (mano abierta) y que se está desplazando (mano cerrada).
 */
export function usePlanPan() {
  const { camera, size } = useThree()
  const view = useRoomStore((state) => state.view)
  const pan = useRef<PanDrag | null>(null)
  const stopPan = () => {
    pan.current = null
    document.body.classList.remove(PANNING_CLASS)
  }
  const capturePan = usePointerCancellation(stopPan)
  // Al salir de Plano o desmontar el suelo no debe quedar un cursor de arrastre.
  useEffect(() => { if (view !== 'top') clearPanCursor() }, [view])
  useEffect(() => clearPanCursor, [])
  const hoverPan = () => { if (useRoomStore.getState().view === 'top') document.body.classList.add(PAN_READY_CLASS) }
  const leavePan = () => { if (!pan.current) document.body.classList.remove(PAN_READY_CLASS) }
  /**
   * Mano abierta solo si lo primero bajo el puntero permite desplazar el
   * plano (fondo, plataforma o suelo de una habitación, `userData.planPannable`).
   * Sobre muebles, paredes o puertas se mantiene su propio cursor.
   */
  const updatePanCursor = (event: ThreeEvent<PointerEvent>) => {
    const pannable = useRoomStore.getState().view === 'top' && !!event.intersections[0]?.object.userData.planPannable
    document.body.classList.toggle(PAN_READY_CLASS, pannable || !!pan.current)
  }
  /** Devuelve `true` si ha empezado a desplazar el plano. */
  const startPan = (event: ThreeEvent<PointerEvent>) => {
    const state = useRoomStore.getState()
    if (state.view !== 'top' || event.button !== 0 || !(camera instanceof THREE.OrthographicCamera)) return false
    pan.current = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      cameraX: state.topCameraX, cameraZ: state.topCameraZ,
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion),
      scale: (camera.right - camera.left) / camera.zoom / Math.max(size.width, 1),
    }
    capturePan(event)
    document.body.classList.add(PANNING_CLASS)
    return true
  }
  const movePan = (event: ThreeEvent<PointerEvent>) => {
    const drag = pan.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.stopPropagation()
    const dx = (event.clientX - drag.x) * drag.scale
    const dy = (event.clientY - drag.y) * drag.scale
    useRoomStore.getState().setTopCameraPosition(drag.cameraX - dx * drag.right.x + dy * drag.up.x, drag.cameraZ - dx * drag.right.z + dy * drag.up.z)
  }
  const endPan = (event: ThreeEvent<PointerEvent>) => {
    if (pan.current?.pointerId !== event.pointerId) return
    stopPan()
    event.stopPropagation()
    releasePointer(event)
  }
  const lostPan = stopPan
  return { startPan, movePan, endPan, lostPan, hoverPan, leavePan, updatePanCursor }
}
