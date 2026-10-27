import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

/** Puente para Fiber 9.8.2, que no despacha onPointerCancel al objeto capturador. */
export function usePointerCancellation(onCancel: (event: ThreeEvent<PointerEvent>) => void) {
  const { gl } = useThree()
  const activePointer = useRef<ThreeEvent<PointerEvent> | null>(null)
  const cancel = useRef(onCancel)
  cancel.current = onCancel

  useEffect(() => {
    const canvas = gl.domElement
    const finishPointer = (event: PointerEvent) => {
      const captured = activePointer.current
      if (captured?.pointerId !== event.pointerId) return
      activePointer.current = null
      // Los handlers existentes utilizan el id y el target de captura para cerrar el gesto.
      if (event.type === 'pointercancel') cancel.current(captured)
    }
    canvas.addEventListener('pointercancel', finishPointer)
    canvas.addEventListener('pointerup', finishPointer)
    return () => {
      canvas.removeEventListener('pointercancel', finishPointer)
      canvas.removeEventListener('pointerup', finishPointer)
    }
  }, [gl])

  return (event: ThreeEvent<PointerEvent>) => {
    activePointer.current = event
    ;(event.target as Element | null)?.setPointerCapture(event.pointerId)
  }
}
