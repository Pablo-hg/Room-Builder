/**
 * Estado de la tecla Alt durante un arrastre (#37). Vive fuera del store: es información de
 * sesión que nunca se guarda ni entra en el historial. Alt suspende el magnetismo solo mientras
 * está pulsada; al soltarla (o al perder el foco de la ventana) el magnetismo vuelve.
 */
let altHeld = false

export const isMagnetSuspended = () => altHeld
/** Para pruebas y para limpiar el estado cuando termina un gesto. */
export function setMagnetSuspended(value: boolean) { altHeld = value }

/** Conecta los avisos del navegador. Devuelve la función que los retira. */
export function trackDragModifiers(target: Window = window): () => void {
  const sync = (event: KeyboardEvent | PointerEvent | MouseEvent) => { altHeld = event.altKey }
  const reset = () => { altHeld = false }
  target.addEventListener('keydown', sync, true)
  target.addEventListener('keyup', sync, true)
  target.addEventListener('pointermove', sync, true)
  target.addEventListener('pointerdown', sync, true)
  target.addEventListener('blur', reset)
  return () => {
    target.removeEventListener('keydown', sync, true)
    target.removeEventListener('keyup', sync, true)
    target.removeEventListener('pointermove', sync, true)
    target.removeEventListener('pointerdown', sync, true)
    target.removeEventListener('blur', reset)
    altHeld = false
  }
}
