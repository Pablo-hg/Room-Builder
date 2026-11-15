import { useEffect, useState, type FormEvent } from 'react'
import { MEASUREMENT_INVALID_NOTICE, parseMeasurement } from '../../domain/measurements'
import { describeMeasure, MEASURE_NAME_LIMIT, type PlanMeasure } from '../../domain/planMeasures'
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

type Fields = { name: string; x1: string; z1: string; x2: string; z2: string }
const metres = (value: number) => String(Number(value.toFixed(3))).replace('.', ',')
const fieldsOf = (measure: PlanMeasure): Fields => ({ name: measure.name ?? '', x1: metres(measure.start.x), z1: metres(measure.start.z), x2: metres(measure.end.x), z2: metres(measure.end.z) })
const EMPTY: Fields = { name: '', x1: '', z1: '', x2: '', z2: '' }

/** Formulario de coordenadas: alta por teclado y edición de una cota guardada (los extremos quedan fijos). */
function MeasureForm({ initial, submitLabel, onSubmit, idPrefix }: { initial: Fields; submitLabel: string; idPrefix: string; onSubmit: (values: { name: string; start: { x: number; z: number }; end: { x: number; z: number } }) => boolean }) {
  const [fields, setFields] = useState(initial)
  const [error, setError] = useState('')
  const set = (key: keyof Fields) => (event: FormEvent<HTMLInputElement>) => {
    // El valor se lee antes de encolar la actualización: `currentTarget` ya no existe cuando React la ejecuta.
    const value = event.currentTarget.value
    setFields((current) => ({ ...current, [key]: value }))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const [x1, z1, x2, z2] = [fields.x1, fields.z1, fields.x2, fields.z2].map(parseMeasurement)
    if (![x1, z1, x2, z2].every(Number.isFinite)) { setError(MEASUREMENT_INVALID_NOTICE); return }
    setError('')
    if (onSubmit({ name: fields.name, start: { x: x1, z: z1 }, end: { x: x2, z: z2 } })) setFields(initial.name || initial.x1 ? fields : EMPTY)
  }
  const field = (key: Exclude<keyof Fields, 'name'>, label: string) => <label className="measure-form__field">
    <span>{label}</span><input id={`${idPrefix}-${key}`} inputMode="decimal" autoComplete="off" value={fields[key]} onChange={set(key)} />
  </label>
  return <form className="measure-form" onSubmit={submit} noValidate>
    <label className="measure-form__field measure-form__field--wide"><span>Nombre (opcional)</span>
      <input maxLength={MEASURE_NAME_LIMIT} value={fields.name} onChange={set('name')} autoComplete="off" /></label>
    <fieldset><legend>Punto A (m)</legend>{field('x1', 'X')}{field('z1', 'Z')}</fieldset>
    <fieldset><legend>Punto B (m)</legend>{field('x2', 'X')}{field('z2', 'Z')}</fieldset>
    {error && <p className="measure-form__error" role="alert">{error}</p>}
    <button type="submit">{submitLabel}</button>
  </form>
}

function MeasureRow({ measure, index }: { measure: PlanMeasure; index: number }) {
  const update = useRoomStore((state) => state.updateMeasure)
  const remove = useRoomStore((state) => state.removeMeasure)
  const acknowledge = useRoomStore((state) => state.acknowledgeMeasure)
  const [editing, setEditing] = useState(false)
  const { label, detail } = describeMeasure(measure.start, measure.end)
  const title = measure.name ?? `Cota ${index + 1}`
  const anchored = !!measure.start.anchor || !!measure.end.anchor
  return <li className={`measure-row${measure.hidden ? ' is-hidden' : ''}${measure.stale ? ' is-stale' : ''}`} data-testid="measure-row">
    <div className="measure-row__main">
      <span className="measure-row__title"><strong>{title}</strong> · {label}{detail ? ` (${detail})` : ''}</span>
      <small>{measure.hidden ? 'Oculta' : 'Visible con «Mostrar detalles»'}{anchored ? ' · sigue a su referente' : ' · fija'}</small>
      {measure.stale && <p className="measure-row__warning" role="alert">⚠ Un referente desapareció: la cota quedó fija en su última posición.
        <button type="button" onClick={() => acknowledge(measure.id)}>Aceptar</button></p>}
    </div>
    <div className="measure-row__actions">
      <button type="button" aria-pressed={!measure.hidden} aria-label={`${measure.hidden ? 'Mostrar' : 'Ocultar'} ${title}`} onClick={() => update(measure.id, { hidden: !measure.hidden })}>{measure.hidden ? 'Mostrar' : 'Ocultar'}</button>
      <button type="button" aria-expanded={editing} aria-label={`Editar ${title}`} onClick={() => setEditing(!editing)}>Editar</button>
      <button type="button" aria-label={`Eliminar ${title}`} onClick={() => remove(measure.id)}>Eliminar</button>
    </div>
    {editing && <MeasureForm idPrefix={`edit-${measure.id}`} initial={fieldsOf(measure)} submitLabel="Aplicar cambios"
      onSubmit={(values) => {
        update(measure.id, { name: values.name, start: values.start, end: values.end })
        setEditing(false)
        return true
      }} />}
  </li>
}

/** Lista de cotas guardadas: ocultar, editar, eliminar y alta por coordenadas (vía de teclado). */
export function MeasureListSection() {
  const measurements = useRoomStore((state) => state.measurements)
  const detailsVisible = useRoomStore((state) => state.planDetailsVisible)
  const addMeasure = useRoomStore((state) => state.addMeasure)
  return <section className="panel-section measure-section" aria-labelledby="measure-heading">
    <h3 id="measure-heading" className="measure-section__heading">Cotas guardadas <span>({measurements.length})</span></h3>
    {measurements.length === 0
      ? <p className="section-copy">Sin cotas. Usa «Medir» en el Plano y pulsa «Guardar cota», o añade una por coordenadas.</p>
      : <>
        {!detailsVisible && <p className="section-copy">Se ven en el Plano al activar «Mostrar detalles».</p>}
        <ul className="measure-list">{measurements.map((measure, index) => <MeasureRow key={measure.id} measure={measure} index={index} />)}</ul>
      </>}
    <details className="measure-add">
      <summary>Añadir por coordenadas</summary>
      <MeasureForm idPrefix="add-measure" initial={EMPTY} submitLabel="Guardar cota"
        onSubmit={(values) => addMeasure({ ...values.start }, { ...values.end }, values.name) !== null} />
    </details>
  </section>
}
