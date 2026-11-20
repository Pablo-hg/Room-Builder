import { useEffect } from 'react'
import { MaterialFields } from './MaterialControl'
import { MaterialPreview } from './MaterialSwatch'
import { paintTargetLabel } from '../../domain/paintTool'
import { useRoomStore } from '../../state/useRoomStore'

/** Botón de la cabecera de la escena que activa o desactiva la herramienta Pintar. */
export function PaintToolToggle() {
  const active = useRoomStore((state) => state.paintTool !== null)
  const start = useRoomStore((state) => state.startPaintTool)
  const stop = useRoomStore((state) => state.stopPaintTool)
  const measureActive = useRoomStore((state) => state.measureToolActive)
  const setMeasureActive = useRoomStore((state) => state.setMeasureToolActive)
  return <button
    type="button"
    className={`editor-tool${active ? ' is-active' : ''}`}
    aria-pressed={active}
    title="Pintar: aplica un acabado haciendo clic sobre paredes, suelos y muebles (Esc para terminar)"
    onClick={() => {
      if (active) { stop(); return }
      if (measureActive) setMeasureActive(false) // las dos herramientas no conviven
      start()
    }}
  ><span aria-hidden="true">🖌</span> Pintar</button>
}

/**
 * Pintar como constructor de material: se elige familia, acabado y patrón (igual que en el inspector), se ajustan color,
 * escala y orientación viendo una muestra grande en vivo, y ese material se aplica pulsando elementos o a toda la selección
 * de una vez. El cuentagotas copia el material de un elemento al pincel.
 */
export function PaintToolPanel() {
  const tool = useRoomStore((state) => state.paintTool)
  const hover = useRoomStore((state) => state.paintHoverId ? paintTargetLabel(state, state.paintHoverId) : null)
  const selectedIds = useRoomStore((state) => state.selectedIds)
  const selectedId = useRoomStore((state) => state.selectedId)
  const selectedLabel = useRoomStore((state) => state.selectedId ? paintTargetLabel(state, state.selectedId) : null)
  const setMode = useRoomStore((state) => state.setPaintMode)
  const setFinish = useRoomStore((state) => state.setPaintFinish)
  const applyMany = useRoomStore((state) => state.applyPaintToMany)
  const sample = useRoomStore((state) => state.samplePaint)
  const stop = useRoomStore((state) => state.stopPaintTool)
  const active = tool !== null

  // Esc termina la herramienta (cancelación); lo ya pintado se deshace con Deshacer.
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); stop() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, stop])

  if (!tool) return null
  const { finish, mode } = tool
  const targets = selectedIds.length ? selectedIds : selectedId ? [selectedId] : []
  const reading = hover
    ? (mode === 'eyedropper' ? `Se copiará el material de: ${hover}` : `Se pintará: ${hover}`)
    : (mode === 'eyedropper' ? 'Pulsa un elemento para copiar su material.' : 'Pulsa un elemento para pintarlo.')

  return <section className="measure-panel paint-panel" aria-label="Herramienta Pintar">
    <div className="measure-panel__head">
      <strong>Pintar</strong>
      <button type="button" className="measure-panel__close" onClick={stop} aria-label="Terminar la herramienta Pintar">×</button>
    </div>
    <div className="paint-panel__modes" role="group" aria-label="Modo">
      <button type="button" aria-pressed={mode === 'paint'} className={mode === 'paint' ? 'is-active' : ''} onClick={() => setMode('paint')}>Pincel</button>
      <button type="button" aria-pressed={mode === 'eyedropper'} className={mode === 'eyedropper' ? 'is-active' : ''} onClick={() => setMode('eyedropper')}>Cuentagotas</button>
    </div>
    <div className="material-control paint-panel__material" role="group" aria-label="Material del pincel">
      <MaterialFields finish={finish} color={finish.color} allowOriginal={false} suffix=" del pincel" onChange={(next) => { if (next) setFinish(next) }} />
    </div>
    <p className="measure-panel__reading" role="status" aria-live="polite" data-testid="paint-reading">{reading}</p>
    <div className="measure-panel__actions">
      <button type="button" disabled={!targets.length} onClick={() => applyMany(targets)}>
        {targets.length > 1 ? `Pintar la selección (${targets.length})` : selectedLabel ? `Pintar «${selectedLabel}»` : 'Pintar la selección'}
      </button>
      <button type="button" disabled={!selectedId || !selectedLabel} onClick={() => selectedId && sample(selectedId)}>Copiar del seleccionado</button>
    </div>
    <small>Pulsa o toca elementos para pintarlos uno a uno, o selecciona varios y píntalos de golpe. Los gestos de cámara siguen en el fondo · Esc termina · Deshacer revierte la última pincelada.</small>
    <MaterialPreview finish={finish} />
  </section>
}
