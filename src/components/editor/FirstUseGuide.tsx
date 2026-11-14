import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

const GUIDE_KEY = 'room-builder:first-use-guide:v1'

/** Los usuarios con proyectos existentes no reciben un tutorial inesperado. */
export function shouldOfferFirstUseGuide(): boolean {
  try {
    if (localStorage.getItem(GUIDE_KEY)) return false
    if (localStorage.getItem('room-builder:v0.1:design')) return false
    const saved = localStorage.getItem('room-builder:v0.1:designs')
    return saved === null || saved.trim() === '[]'
  } catch {
    // Si el almacenamiento está bloqueado, el editor debe seguir funcionando.
    return false
  }
}

export function rememberFirstUseGuide(): void {
  try { localStorage.setItem(GUIDE_KEY, 'seen') } catch { /* Uso privado o almacenamiento bloqueado. */ }
}

type GuideStep = {
  title: string
  description: string
  target: string
  fallback?: string
  cardPlacement?: 'left' | 'right'
}

const steps: GuideStep[] = [
  {
    title: 'Empieza por las medidas',
    description: 'Aquí ajustas la anchura, la profundidad y la altura de la habitación.',
    target: '[data-tour="room-dimensions"]',
    fallback: '.room-section__toggle',
    cardPlacement: 'left',
  },
  {
    title: 'Explora el catálogo',
    description: 'Despliega una categoría y pulsa Añadir. En Construcción y Aperturas tienes paredes, puertas y ventanas; el resto son muebles y decoración.',
    target: '[data-tour="catalog"]',
    fallback: '.catalog-heading',
    cardPlacement: 'right',
  },
  {
    title: 'Organiza la escena',
    description: 'En Escena puedes consultar y seleccionar los elementos, organizarlos en carpetas y controlar su visibilidad o bloqueo.',
    target: '[data-tour="scene"]',
    fallback: '.elements-section',
    cardPlacement: 'right',
  },
  {
    title: 'Edita lo que selecciones',
    description: 'Cuando selecciones un objeto, aquí aparecerán sus medidas, posición y propiedades para ajustarlos.',
    target: '.selection-section--inspector',
    fallback: '#settings-panel',
  },
  {
    title: 'Explora las distintas vistas',
    description: 'Plano es la más cómoda para colocar con precisión e Isométrica, para ver el conjunto. Frontal, POV y Libre sirven para explorar el diseño.',
    target: '.view-switcher',
  },
  {
    title: 'Guarda tu diseño',
    description: 'Pulsa Guardar para conservarlo en este navegador; verás Guardado cuando no queden cambios. En Diseños abres tus proyectos o los exportas a JSON, y Deshacer corrige el último cambio. Puedes repetir esta guía desde el panel derecho.',
    target: '.save-actions',
  },
]

type Spotlight = { left: number; top: number; width: number; height: number }
type Style = CSSProperties

export function FirstUseInvitation({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  const invitationRef = useRef<HTMLElement>(null)
  // La invitación no debe bloquear el uso del editor: cualquier interacción
  // fuera de ella la descarta y conserva el clic original.
  useEffect(() => {
    const dismissOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !invitationRef.current?.contains(event.target)) onDismiss()
    }
    document.addEventListener('pointerdown', dismissOnOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', dismissOnOutsidePointer, true)
  }, [onDismiss])
  return (
    <aside ref={invitationRef} className="first-use-invitation" aria-label="Invitación a la guía de primer uso">
      <strong>¿Es tu primera vez en Room Builder?</strong>
      <p>Descubre el editor con una guía visual de {steps.length} pasos. Puedes saltártela y abrirla después desde el panel derecho.</p>
      <div className="first-use-invitation__actions">
        <button type="button" className="first-use-invitation__primary" onClick={onStart}>Empezar guía</button>
        <button type="button" onClick={onDismiss}>Ahora no</button>
      </div>
    </aside>
  )
}

export function FirstUseGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null)
  const [viewport, setViewport] = useState({ width: 1024, height: 768 })
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const [cardHeight, setCardHeight] = useState(250)

  useEffect(() => {
    if (!open) { setStepIndex(0); return }
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      if (returnFocus.current?.isConnected) returnFocus.current.focus()
      else document.querySelector<HTMLButtonElement>('.first-use-restart')?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const step = steps[stepIndex]
    if (stepIndex === 0) {
      const roomToggle = document.querySelector<HTMLButtonElement>('.room-section__toggle')
      if (roomToggle?.getAttribute('aria-expanded') === 'false') roomToggle.click()
    }
    // El paso 2 muestra todo Catálogo y el paso 3 muestra Escena.
    // Si estaban minimizados, los despliega antes de calcular el foco.
    const ensureStepSectionExpanded = () => {
      if (stepIndex === 1) {
        const catalogToggle = document.querySelector<HTMLButtonElement>('.catalog-heading .catalog-toggle-all')
        if (catalogToggle?.getAttribute('aria-expanded') === 'false') catalogToggle.click()
      }
      if (stepIndex === 2) {
        const sceneToggle = document.querySelector<HTMLButtonElement>('.scene-section__heading .catalog-toggle-all')
        if (sceneToggle?.getAttribute('aria-expanded') === 'false') sceneToggle.click()
      }
    }
    const target = document.querySelector<HTMLElement>(step.target)
      ?? (step.fallback ? document.querySelector<HTMLElement>(step.fallback) : null)
    const update = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      const element = document.querySelector<HTMLElement>(step.target)
        ?? (step.fallback ? document.querySelector<HTMLElement>(step.fallback) : null)
      if (!element) { setSpotlight(null); return }
      const rect = element.getBoundingClientRect()
      const left = Math.max(8, rect.left - 7)
      const top = Math.max(8, rect.top - 7)
      const right = Math.min(window.innerWidth - 8, rect.right + 7)
      const bottom = Math.min(window.innerHeight - 8, rect.bottom + 7)
      setSpotlight(right > left && bottom > top && rect.width > 0 && rect.height > 0
        ? { left, top, width: right - left, height: bottom - top } : null)
    }
    const frame = window.requestAnimationFrame(() => {
      const currentTarget = document.querySelector<HTMLElement>(step.target)
        ?? (step.fallback ? document.querySelector<HTMLElement>(step.fallback) : null)
      currentTarget?.scrollIntoView({ block: stepIndex === 0 ? 'center' : 'nearest', inline: 'nearest', behavior: 'auto' })
      update()
    })
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (target) observer?.observe(target)
    const leftPanel = document.querySelector('#objects-panel')
    const sectionObserver = stepIndex === 1 || stepIndex === 2
      ? new MutationObserver(() => {
        ensureStepSectionExpanded()
        update()
      })
      : null
    if (leftPanel) sectionObserver?.observe(leftPanel, { childList: true, subtree: true })
    // Instalar el observador antes de desplegar: así detecta también el montaje
    // del contenido de Catálogo al desplegarlo.
    ensureStepSectionExpanded()
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      observer?.disconnect()
      sectionObserver?.disconnect()
    }
  }, [open, stepIndex])

  useEffect(() => { if (open) dialogRef.current?.focus() }, [open, stepIndex])

  // La tarjeta crece con el texto: se mide para no depender de una altura fija.
  useEffect(() => {
    if (open && dialogRef.current) setCardHeight(dialogRef.current.offsetHeight)
  }, [open, stepIndex, viewport.width, spotlight?.width])

  useEffect(() => {
    if (!open) return
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
      if (event.key === 'Tab') {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
        if (!buttons.length) { event.preventDefault(); return }
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        if (event.shiftKey && index <= 0) { event.preventDefault(); buttons[buttons.length - 1].focus() }
        else if (!event.shiftKey && (index === -1 || index === buttons.length - 1)) { event.preventDefault(); buttons[0].focus() }
      }
      // Evita activar los atajos del editor mientras se está viendo la guía.
      if ((event.ctrlKey || event.metaKey) && ['g', 'z', 'y', 'd', 'c', 'v'].includes(event.key.toLowerCase())) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener('keydown', keydown, true)
    return () => document.removeEventListener('keydown', keydown, true)
  }, [open, onClose])

  if (!open) return null

  const step = steps[stepIndex]
  const isMobile = viewport.width < 700
  const sideAvailableWidth = spotlight
    ? viewport.width - (spotlight.left + spotlight.width) - 24
    : 0
  // En los pasos 2 y 3 la tarjeta ocupa solo el espacio de la vista 3D,
  // a la derecha del panel resaltado, sin tapar sus categorías ni elementos.
  const sideCard = step.cardPlacement === 'right' && sideAvailableWidth >= 120
  const cardWidth = sideCard
    ? Math.min(360, sideAvailableWidth)
    : Math.min(360, viewport.width - 32)
  const cardLeft = sideCard
    ? spotlight!.left + spotlight!.width + 16
    : spotlight
      ? step.cardPlacement === 'left'
        ? Math.max(16, spotlight.left - cardWidth - 16)
        : Math.max(16, Math.min(viewport.width - cardWidth - 16, spotlight.left + spotlight.width / 2 - cardWidth / 2))
      : Math.max(16, (viewport.width - cardWidth) / 2)
  // La tarjeta lateral se alinea con el foco sin salirse de la pantalla.
  const cardTop = sideCard
    ? Math.max(16, Math.min(spotlight!.top, viewport.height - cardHeight - 16))
    : spotlight
      ? step.cardPlacement === 'left'
        ? Math.max(cardHeight / 2 + 16, Math.min(viewport.height - cardHeight / 2 - 16, spotlight.top + spotlight.height / 2))
        : spotlight.top + spotlight.height + cardHeight + 28 < viewport.height
          ? spotlight.top + spotlight.height + 14
          : Math.max(16, spotlight.top - cardHeight - 14)
      : Math.max(16, (viewport.height - 240) / 2)
  const cardStyle: CSSProperties | undefined = sideCard
    ? { left: cardLeft, top: cardTop, bottom: 'auto', width: cardWidth }
    : isMobile
      ? undefined
      : { left: cardLeft, top: cardTop, width: cardWidth, ...(step.cardPlacement === 'left' ? { transform: 'translateY(-50%)' } : {}) }
  const backdrop = (style: Style, key: string) => <div key={key} className="first-use-guide__shade" style={style} />

  return createPortal(
    <div className="first-use-guide">
      {spotlight ? <>
        {backdrop({ top: 0, left: 0, width: '100%', height: spotlight.top }, 'top')}
        {backdrop({ top: spotlight.top, left: 0, width: spotlight.left, height: spotlight.height }, 'left')}
        {backdrop({ top: spotlight.top, left: spotlight.left + spotlight.width, right: 0, height: spotlight.height }, 'right')}
        {backdrop({ top: spotlight.top + spotlight.height, left: 0, right: 0, bottom: 0 }, 'bottom')}
        <div className="first-use-guide__spotlight" style={{ left: spotlight.left, top: spotlight.top, width: spotlight.width, height: spotlight.height }} aria-hidden="true" />
      </> : backdrop({ inset: 0 }, 'all')}
      <div
        ref={dialogRef}
        className={`first-use-guide__card${sideCard ? ' first-use-guide__card--side' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-use-guide-title"
        aria-describedby="first-use-guide-description"
        tabIndex={-1}
        style={cardStyle}
      >
        <div className="first-use-guide__heading">
          <span>Guía de inicio · {stepIndex + 1} de {steps.length}</span>
          <button type="button" onClick={onClose} aria-label="Cerrar la guía" title="Cerrar la guía">×</button>
        </div>
        <h2 id="first-use-guide-title">{step.title}</h2>
        <p id="first-use-guide-description">{step.description}</p>
        <div className="first-use-guide__progress" aria-label={`Paso ${stepIndex + 1} de ${steps.length}`}>
          {steps.map((_, index) => <span key={index} className={index <= stepIndex ? 'active' : ''} />)}
        </div>
        <div className="first-use-guide__actions">
          <button type="button" onClick={onClose}>Saltar guía</button>
          <div>
            {stepIndex > 0 && <button type="button" onClick={() => setStepIndex((index) => index - 1)}>Anterior</button>}
            <button type="button" className="first-use-guide__next" onClick={() => {
              if (stepIndex === steps.length - 1) onClose()
              else setStepIndex((index) => index + 1)
            }}>{stepIndex === steps.length - 1 ? 'Finalizar' : 'Siguiente'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
