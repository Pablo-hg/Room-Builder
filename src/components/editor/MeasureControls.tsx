import { useEffect, useState } from 'react'
import { MEASUREMENT_INVALID_NOTICE, parseMeasurement } from '../../domain/measurements'
import { formatCoordinate, roundToCentimetre } from '../../domain/lengthUnit'
import { describeMeasure, MEASURE_NAME_LIMIT, type MeasureAnchor, type PlanMeasure } from '../../domain/planMeasures'
import { useRoomStore } from '../../state/useRoomStore'

/** Botón «Medir» de la barra del Plano. Activar la herramienta no cambia de vista, cámara ni selección. */
export function MeasureToggle() {
  const active = useRoomStore((state) => state.measureToolActive)
  const setActive = useRoomStore((state) => state.setMeasureToolActive)
  return <button type="button" className={`measure-toggle${active ? ' is-active' : ''}`} aria-pressed={active}
    title="Mide la distancia entre dos puntos del plano. Funciona con «Mostrar detalles» activado o no."
    onClick={() => setActive(!active)}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2" /></svg>
    <span>Medir</span>
  </button>
}

const AXES = [['free', 'Libre'], ['horizontal', 'Horizontal'], ['vertical', 'Vertical']] as const

/** Panel flotante de la herramienta: ayudas de eje, imán, lectura de la distancia y guardar/descartar. */
export function MeasureToolPanel() {
  useRoomStore((state) => state.lengthUnit) // las medidas se redibujan al cambiar de unidad
  const active = useRoomStore((state) => state.measureToolActive && state.view === 'top')
  const axis = useRoomStore((state) => state.measureAxis)
  const snap = useRoomStore((state) => state.measureSnap)
  const draft = useRoomStore((state) => state.measureDraft)
  const setAxis = useRoomStore((state) => state.setMeasureAxis)
  const setSnap = useRoomStore((state) => state.setMeasureSnap)
  const setDraft = useRoomStore((state) => state.setMeasureDraft)
  const save = useRoomStore((state) => state.saveMeasureDraft)
  const setActive = useRoomStore((state) => state.setMeasureToolActive)
  const toolActive = useRoomStore((state) => state.measureToolActive)
  const view = useRoomStore((state) => state.view)
  // La herramienta solo existe en Plano: al salir de él se desactiva para no reaparecer «sola» al volver.
  useEffect(() => { if (view !== 'top' && toolActive) setActive(false) }, [view, toolActive, setActive])
  if (!active) return null
  const reading = !draft ? 'Marca el primer punto en el plano.'
    : !draft.end ? 'Marca el segundo punto.'
      : (() => { const { label, detail } = describeMeasure(draft.start, draft.end); return `Distancia: ${label}${detail ? ` (${detail})` : ''}` })()
  return <section className="measure-panel" aria-label="Herramienta Medir">
    <div className="measure-panel__head">
      <strong>Medir</strong>
      <button type="button" className="measure-panel__close" onClick={() => setActive(false)} aria-label="Cerrar la herramienta Medir">×</button>
    </div>
    <div className="measure-panel__axes" role="group" aria-label="Ayuda de eje">
      {AXES.map(([value, label]) => <button key={value} type="button" aria-pressed={axis === value} className={axis === value ? 'is-active' : ''} onClick={() => setAxis(value)}>{label}</button>)}
    </div>
    <label className="measure-panel__snap">
      <input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} />
      <span>Imán a esquinas y bordes</span>
    </label>
    <p className="measure-panel__reading" role="status" aria-live="polite" data-testid="measure-reading">{reading}</p>
    <div className="measure-panel__actions">
      <button type="button" className="measure-panel__save" disabled={!draft?.end} onClick={() => save()}>Guardar cota</button>
      <button type="button" disabled={!draft} onClick={() => setDraft(null)}>Descartar</button>
    </div>
    <small>Clic o toque en dos puntos, o arrastra. Mayús fija horizontal · Esc descarta · Intro guarda.</small>
  </section>
}

const POINT_NAMES: Record<string, string> = { center: 'el centro', c0: 'una esquina', c1: 'una esquina', c2: 'una esquina', c3: 'una esquina', m0: 'el punto medio de un lado', m1: 'el punto medio de un lado', m2: 'el punto medio de un lado', m3: 'el punto medio de un lado' }
/** «la esquina de Silla»: qué sigue un extremo anclado (o `undefined` si es libre). */
function anchorText(anchor: MeasureAnchor | undefined, furniture: readonly { id: string; name: string }[]) {
  if (!anchor) return undefined
  if (anchor.kind === 'wall') return 'una esquina de pared'
  return `${POINT_NAMES[anchor.point]} de «${furniture.find((item) => item.id === anchor.id)?.name ?? 'un mueble'}»`
}

/**
 * Una coordenada del punto: `←  valor  →`. Las flechas la mueven 1 cm (Mayús, 10 cm) y el número se corrige a mano
 * (en la unidad elegida, o con «m» / «cm»). Intro o salir del campo lo aplica; Esc lo restablece. Siempre a centímetro.
 */
function CoordinateRow({ axis, point, letter, value, onChange }: { axis: 'X' | 'Z'; point: string; letter: 'A' | 'B'; value: number; onChange: (value: number) => void }) {
  const unit = useRoomStore((state) => state.lengthUnit)
  const shown = formatCoordinate(value, unit)
  const [text, setText] = useState(shown)
  const [invalid, setInvalid] = useState(false)
  useEffect(() => { setText(shown); setInvalid(false) }, [shown])
  const commit = () => {
    const parsed = parseMeasurement(text, unit)
    if (!Number.isFinite(parsed)) { setInvalid(true); useRoomStore.setState({ notice: MEASUREMENT_INVALID_NOTICE }); return }
    setInvalid(false)
    const next = roundToCentimetre(parsed)
    if (Math.abs(next - roundToCentimetre(value)) >= 5e-4) onChange(next); else setText(shown)
  }
  const nudge = (direction: -1 | 1) => (event: { shiftKey: boolean }) => onChange(roundToCentimetre(value + direction * (event.shiftKey ? 0.1 : 0.01)))
  const arrow = (direction: -1 | 1) => <button type="button" className={`measure-coordinate__${direction < 0 ? 'less' : 'more'}`}
    aria-label={`Mover el punto ${letter} 1 cm hacia ${direction < 0 ? '−' : '+'}${axis} (Mayús, 10 cm)`} onClick={nudge(direction)}>{direction < 0 ? '←' : '→'}</button>
  return <div className="measure-coordinate">
    <span className="measure-coordinate__axis" aria-hidden="true">{axis}</span>
    {arrow(-1)}
    <input
      inputMode="decimal"
      autoComplete="off"
      aria-label={`Coordenada ${axis} del punto ${letter}, en ${unit === 'cm' ? 'centímetros' : 'metros'}`}
      aria-invalid={invalid || undefined}
      value={text}
      onChange={(event) => { const next = event.currentTarget.value; setText(next); setInvalid(false) }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); commit() }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setText(shown); setInvalid(false) }
      }}
    />
    {arrow(1)}
  </div>
}

function PointControls({ measure, side, furniture }: { measure: PlanMeasure; side: 'start' | 'end'; furniture: readonly { id: string; name: string }[] }) {
  const update = useRoomStore((state) => state.updateMeasure)
  const point = measure[side]
  const letter = side === 'start' ? 'A' : 'B'
  const follows = anchorText(point.anchor, furniture)
  return <div className="measure-edit__point" role="group" aria-label={`Mover el punto ${letter}`}>
    <span>Punto {letter}{follows ? ` · sigue a ${follows}` : ''}</span>
    <CoordinateRow axis="X" letter={letter} point={side} value={point.x} onChange={(x) => update(measure.id, { [side]: { x, z: point.z } })} />
    <CoordinateRow axis="Z" letter={letter} point={side} value={point.z} onChange={(z) => update(measure.id, { [side]: { x: point.x, z } })} />
  </div>
}

function MeasureRow({ measure, index }: { measure: PlanMeasure; index: number }) {
  useRoomStore((state) => state.lengthUnit) // las medidas se redibujan al cambiar de unidad
  const update = useRoomStore((state) => state.updateMeasure)
  const remove = useRoomStore((state) => state.removeMeasure)
  const acknowledge = useRoomStore((state) => state.acknowledgeMeasure)
  const editing = useRoomStore((state) => state.measureEditId === measure.id)
  const setEditId = useRoomStore((state) => state.setMeasureEditId)
  const setView = useRoomStore((state) => state.setView)
  const { label, detail } = describeMeasure(measure.start, measure.end)
  const title = measure.name ?? `Cota ${index + 1}`
  const anchored = !!measure.start.anchor || !!measure.end.anchor
  const toggleEdit = () => {
    if (editing) { setEditId(null); return }
    // Los puntos se mueven en el Plano: se pasa a esa vista y se deja la herramienta Medir. El editor aparece en el
    // panel de edición de la selección (derecha), como el de cualquier otro elemento.
    if (useRoomStore.getState().view !== 'top') setView('top')
    setEditId(measure.id)
  }
  return <li className={`measure-row${measure.hidden ? ' is-hidden' : ''}${measure.stale ? ' is-stale' : ''}${editing ? ' is-editing' : ''}`} data-testid="measure-row">
    <div className="measure-row__main">
      <span className="measure-row__title"><strong>{title}</strong> · {label}{detail ? ` (${detail})` : ''}</span>
      <small>{measure.hidden ? 'Oculta' : 'Visible con «Mostrar detalles»'}{anchored ? ' · sigue a su referente' : ' · fija'}</small>
      {measure.stale && <p className="measure-row__warning" role="alert">⚠ Un referente desapareció: la cota quedó fija en su última posición.
        <button type="button" onClick={() => acknowledge(measure.id)}>Aceptar</button></p>}
    </div>
    {editing
      ? <p className="measure-row__editing" role="status">Editando en el panel de la derecha.</p>
      : <div className="measure-row__actions">
        <button type="button" aria-pressed={!measure.hidden} aria-label={`${measure.hidden ? 'Mostrar' : 'Ocultar'} ${title}`} onClick={() => update(measure.id, { hidden: !measure.hidden })}>{measure.hidden ? 'Mostrar' : 'Ocultar'}</button>
        <button type="button" aria-label={`Editar ${title}`} onClick={toggleEdit}>Editar</button>
        <button type="button" aria-label={`Eliminar ${title}`} onClick={() => remove(measure.id)}>Eliminar</button>
      </div>}
  </li>
}

/**
 * Editor de la cota en edición. Vive en el panel de edición de la selección (derecha), como el de un mueble o una pared,
 * y solo existe en Plano, donde se arrastran sus puntos.
 */
export function MeasureInspector() {
  useRoomStore((state) => state.lengthUnit) // las medidas se redibujan al cambiar de unidad
  const measure = useRoomStore((state) => state.measurements.find((candidate) => candidate.id === state.measureEditId))
  const index = useRoomStore((state) => state.measurements.findIndex((candidate) => candidate.id === state.measureEditId))
  const update = useRoomStore((state) => state.updateMeasure)
  const remove = useRoomStore((state) => state.removeMeasure)
  const setEditId = useRoomStore((state) => state.setMeasureEditId)
  const snap = useRoomStore((state) => state.measureSnap)
  const setSnap = useRoomStore((state) => state.setMeasureSnap)
  const furniture = useRoomStore((state) => state.furniture)
  const [name, setName] = useState(measure?.name ?? '')
  useEffect(() => { setName(measure?.name ?? '') }, [measure?.id, measure?.name])
  if (!measure) return null
  const { label, detail } = describeMeasure(measure.start, measure.end)
  const title = measure.name ?? `Cota ${index + 1}`
  const anchored = !!measure.start.anchor || !!measure.end.anchor
  const saveName = () => { if ((measure.name ?? '') !== name.trim()) update(measure.id, { name }) }
  return <section className="panel-section selection-section selection-section--inspector measure-inspector" aria-label="Cota en edición">
    <span className="eyebrow">Cota guardada</span>
    <h2>{title}</h2>
    <p className="section-copy">{label}{detail ? ` (${detail})` : ''} · {measure.hidden ? 'Oculta' : 'Visible con «Mostrar detalles»'}{anchored ? ' · sigue a su referente' : ' · fija'}</p>
    <div className="measure-row__actions">
      <button type="button" aria-pressed={!measure.hidden} aria-label={`${measure.hidden ? 'Mostrar' : 'Ocultar'} ${title}`} onClick={() => update(measure.id, { hidden: !measure.hidden })}>{measure.hidden ? 'Mostrar' : 'Ocultar'}</button>
      <button type="button" aria-label={`Cerrar la edición de ${title}`} onClick={() => setEditId(null)}>Listo</button>
      <button type="button" aria-label={`Eliminar ${title}`} onClick={() => remove(measure.id)}>Eliminar</button>
    </div>
    <div className="measure-edit">
      <p className="measure-edit__hint">Arrastra los puntos <b>A</b> y <b>B</b> en el plano. Mayús fija horizontal · Esc termina.</p>
      <label className="measure-form__field"><span>Nombre (opcional)</span>
        <input maxLength={MEASURE_NAME_LIMIT} value={name} autoComplete="off" onChange={(event) => { const value = event.currentTarget.value; setName(value) }}
          onBlur={saveName} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveName() } }} /></label>
      <label className="measure-panel__snap"><input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} /><span>Imán a esquinas y bordes</span></label>
      <PointControls measure={measure} side="start" furniture={furniture} />
      <PointControls measure={measure} side="end" furniture={furniture} />
    </div>
  </section>
}

/** Lista de cotas guardadas: mostrar u ocultar, editar y eliminar. Las cotas se crean con «Medir» en el Plano. */
export function MeasureListSection() {
  const measurements = useRoomStore((state) => state.measurements)
  const detailsVisible = useRoomStore((state) => state.planDetailsVisible)
  return <section className="panel-section measure-section" aria-labelledby="measure-heading">
    <h3 id="measure-heading" className="measure-section__heading">Cotas guardadas <span>({measurements.length})</span></h3>
    {measurements.length === 0
      ? <p className="section-copy">Sin cotas. Usa «Medir» en el Plano y pulsa «Guardar cota».</p>
      : <>
        {!detailsVisible && <p className="section-copy">Se ven en el Plano al activar «Mostrar detalles».</p>}
        <ul className="measure-list">{measurements.map((measure, index) => <MeasureRow key={measure.id} measure={measure} index={index} />)}</ul>
      </>}
  </section>
}
