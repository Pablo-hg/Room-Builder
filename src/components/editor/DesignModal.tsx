import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function DesignModal({ titleId, descriptionId, onClose, children }: {
  titleId: string
  descriptionId?: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ref.current?.querySelector<HTMLElement>('[data-modal-initial], button:not(:disabled), input:not(:disabled)')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); return }
      if (event.key === 'Tab') {
        const focusable = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])
        if (!focusable.length) { event.preventDefault(); return }
        const index = focusable.indexOf(document.activeElement as HTMLElement)
        if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length - 1].focus() }
        else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) { event.preventDefault(); focusable[0].focus() }
      }
      // Los atajos del editor no deben actuar detrás de la confirmación.
      if ((event.ctrlKey || event.metaKey) && ['g', 'z', 'y', 'd'].includes(event.key.toLowerCase())) { event.preventDefault(); event.stopPropagation() }
    }
    document.addEventListener('keydown', keydown, true)
    return () => {
      document.removeEventListener('keydown', keydown, true)
      if (previous?.isConnected) previous.focus()
      else document.querySelector<HTMLElement>('[aria-label="Seleccionar diseño guardado"]')?.focus()
    }
  }, [])
  return createPortal(<div className="design-modal-backdrop" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose() }}>
    <div ref={ref} className="design-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      {children}
    </div>
  </div>, document.body)
}
