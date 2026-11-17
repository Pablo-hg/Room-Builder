import type { PointerEvent as ReactPointerEvent } from 'react'
import { exceedsDragThreshold, type CatalogDragItem } from '../../domain/catalogDrag'

/**
 * Sesión de arrastre desde una tarjeta del catálogo hacia la vista 3D.
 *
 * - Solo ratón y lápiz con el botón principal; en táctil la tarjeta sigue siendo un botón (decisión del
 *   propietario) para no romper el desplazamiento del panel.
 * - Por debajo del umbral es un clic normal y la tarjeta añade el objeto como siempre.
 * - La escena registra un destino (`CatalogDropController`), que es quien crea, mueve y confirma o revierte.
 */
export interface CatalogDropTarget {
  /** Crea o mueve el objeto bajo el cursor. Devuelve si el punto está sobre la vista. */
  move: (item: CatalogDragItem, clientX: number, clientY: number) => boolean
  /** Confirma (un único paso de deshacer) o revierte sin dejar rastro. */
  finish: (commit: boolean) => void
}

let target: CatalogDropTarget | null = null
let suppressClick = false

export function registerCatalogDropTarget(next: CatalogDropTarget): () => void {
  target = next
  return () => { if (target === next) target = null }
}

/** Tras un arrastre, el `click` que el navegador pueda emitir sobre la tarjeta no debe añadir otro objeto. */
export function consumeCatalogClickSuppression(): boolean {
  const suppressed = suppressClick
  suppressClick = false
  return suppressed
}

const DRAGGING_CLASS = 'catalog-dragging'

export function beginCatalogPointer(item: CatalogDragItem, event: ReactPointerEvent<HTMLElement>): void {
  if (event.button !== 0 || event.pointerType === 'touch' || !event.isPrimary) return
  const start = { x: event.clientX, y: event.clientY }
  const pointerId = event.pointerId
  let dragging = false
  let overView = false

  const cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey, true)
    document.body.classList.remove(DRAGGING_CLASS)
  }
  const finish = (commit: boolean) => {
    cleanup()
    if (!dragging) return
    target?.finish(commit && overView)
    // El `click` (si llega) se emite justo después de `pointerup`; se ignora solo ese.
    suppressClick = true
    window.setTimeout(() => { suppressClick = false }, 0)
  }
  function onMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) return
    if (!dragging) {
      if (!exceedsDragThreshold(start, { x: moveEvent.clientX, y: moveEvent.clientY })) return
      dragging = true
      document.body.classList.add(DRAGGING_CLASS)
    }
    moveEvent.preventDefault()
    overView = target?.move(item, moveEvent.clientX, moveEvent.clientY) ?? false
  }
  function onUp(upEvent: PointerEvent) { if (upEvent.pointerId === pointerId) finish(true) }
  function onCancel(cancelEvent: PointerEvent) { if (cancelEvent.pointerId === pointerId) finish(false) }
  function onKey(keyEvent: KeyboardEvent) {
    if (keyEvent.key !== 'Escape' || !dragging) return
    keyEvent.preventDefault()
    keyEvent.stopPropagation()
    overView = false
    finish(false)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey, true)
}
