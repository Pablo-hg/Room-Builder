import { useEffect, useRef, useState } from 'react'
import { isMeasurementStep, MEASUREMENT_STEP, MEASUREMENT_STEP_NOTICE, measurementCentimetres, measurementMetres, parseMeasurement, snapMeasurement, stepMeasurement } from '../../domain/measurements'
import { beginMeasurementLog, finishMeasurementLog } from '../../debug/interactionLog'
import { diagnostics } from '../../diagnostics/engine'
import { useHistoryGesture } from '../../state/useHistoryGesture'
import { useRoomStore } from '../../state/useRoomStore'

/** Primer retardo antes de repetir al mantener pulsado. */
const HOLD_DELAY_START = 220
/** Paso por repetición según el tiempo mantenido: acelera hasta 10 cm. */
const holdAmount = (elapsed: number) => elapsed >= 1600 ? 0.10 : elapsed >= 1000 ? 0.05 : elapsed >= 500 ? 0.02 : 0.01
/** Frecuencia de repetición: se acelera junto con el paso. */
const holdDelay = (elapsed: number) => elapsed >= 1600 ? 45 : elapsed >= 1000 ? 60 : elapsed >= 500 ? 90 : 140

/** Entrada exacta en cm enteros con paso fino y repetición acelerada. */
export function MeasurementControl({ label, inputLabel, value, min, max, onChange, disabled = false, textColor }: {
  label: string
  inputLabel?: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
  textColor?: string
}) {
  const [draft, setDraft] = useState(measurementMetres(value))
  const [error, setError] = useState('')
  const skipBlur = useRef(false)
  const draftRef = useRef(draft)
  const valueRef = useRef(value)
  const timerRef = useRef<number | null>(null)
  const holdRef = useRef<{ direction: -1 | 1; since: number } | null>(null)
  const suppressClickUntil = useRef(0)
  const selectedId = useRoomStore((state) => state.selectedId)
  const gesture = useHistoryGesture(selectedId ?? `measurement:${label}`)
  const editRef = useRef<{ before: number; after: number; log: symbol; selectedId: string | null } | null>(null)
  draftRef.current = draft
  valueRef.current = value
  const finishEdit = () => {
    const edit = editRef.current
    if (!edit) return
    editRef.current = null
    gesture.commit()
    const current = useRoomStore.getState()
    finishMeasurementLog(edit.log, { view: current.view, selectedId: edit.selectedId, details: { label, before: edit.before, after: edit.after } }, edit.before !== edit.after)
  }
  const ensureEdit = () => {
    if (editRef.current && gesture.isActive()) return
    if (editRef.current) finishEdit()
    const log = beginMeasurementLog(() => finishEdit())
    gesture.begin()
    editRef.current = { before: valueRef.current, after: valueRef.current, log, selectedId }
  }
  useEffect(() => { setDraft(measurementMetres(value)); setError('') }, [value])
  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  const stopHold = () => {
    clearTimer()
    if (holdRef.current) suppressClickUntil.current = performance.now() + 400
    holdRef.current = null
  }
  const finishRef = useRef(finishEdit)
  finishRef.current = finishEdit
  useEffect(() => () => finishRef.current(), [selectedId, label])
  useEffect(() => {
    const finish = () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); timerRef.current = null; holdRef.current = null; finishRef.current() }
    window.addEventListener('blur', finish)
    return () => { window.removeEventListener('blur', finish); finish() }
  }, [])
  useEffect(() => { if (disabled) { stopHold(); finishEdit() } }, [disabled])
  const clamp = (candidate: number) => snapMeasurement(Math.max(min, Math.min(max, candidate)))
  const baseValue = () => {
    const parsed = parseMeasurement(draftRef.current)
    return isMeasurementStep(parsed) && parsed >= min - 1e-9 && parsed <= max + 1e-9 ? parsed : valueRef.current
  }
  const apply = (next: number) => {
    setError('')
    draftRef.current = measurementMetres(next)
    setDraft(draftRef.current)
    ensureEdit()
    const before = useRoomStore.getState()
    onChange(next)
    const after = useRoomStore.getState()
    if (before.room !== after.room || before.furniture !== after.furniture || before.structurePacks !== after.structurePacks) {
      if (editRef.current) editRef.current.after = next
      valueRef.current = next
    } else {
      draftRef.current = measurementMetres(valueRef.current)
      setDraft(draftRef.current)
    }
  }
  /** Un paso de 1 cm desde el borrador válido o desde el valor aplicado. */
  const stepOnce = (direction: -1 | 1) => {
    if (disabled) return
    const next = clamp(stepMeasurement(baseValue(), direction))
    if (next === valueRef.current) { setDraft(measurementMetres(valueRef.current)); return }
    apply(next)
  }
  /** Paso de repetición; parte siempre del último valor aplicado para no desincronizarse. */
  const stepRepeated = (direction: -1 | 1, amount: number) => {
    const next = clamp(snapMeasurement(valueRef.current + direction * amount))
    if (next === valueRef.current) return
    apply(next)
  }
  /**
   * Mantener pulsado acelera: el paso y la frecuencia crecen con el tiempo.
   * Las flechas del teclado y los botones comparten el mismo temporizador.
   */
  const beginHold = (direction: -1 | 1, withTimer: boolean) => {
    if (disabled) return
    stepOnce(direction)
    holdRef.current = { direction, since: performance.now() }
    clearTimer()
    if (!withTimer) return
    const tick = () => {
      const hold = holdRef.current
      if (!hold) return
      const elapsed = performance.now() - hold.since
      stepRepeated(hold.direction, holdAmount(elapsed))
      timerRef.current = window.setTimeout(tick, holdDelay(elapsed))
    }
    timerRef.current = window.setTimeout(tick, HOLD_DELAY_START)
  }
  const commit = () => {
    const candidate = parseMeasurement(draftRef.current)
    draftRef.current = measurementMetres(valueRef.current)
    setDraft(draftRef.current)
    if (candidate === valueRef.current) { setError(''); return }
    if (!isMeasurementStep(candidate)) { diagnostics.emit({ action: 'measurement.input', level: 'warn', result: 'rejected', data: { reason: 'invalid-centimetre-step' } }); setError(MEASUREMENT_STEP_NOTICE); return }
    if (candidate < min - 1e-9 || candidate > max + 1e-9) {
      diagnostics.emit({ action: 'measurement.input', level: 'warn', result: 'rejected', data: { reason: 'measurement-out-of-range', min, max } })
      setError(`Introduce una medida entre ${min.toLocaleString('es-ES')} y ${max.toLocaleString('es-ES')} m.`)
      return
    }
    apply(candidate)
  }
  const stepper = (direction: -1 | 1) => (
    <button
      type="button"
      aria-label={`${direction > 0 ? 'Subir' : 'Bajar'} ${label.toLowerCase()} 1 cm`}
      title={`${direction > 0 ? 'Subir' : 'Bajar'} 1 cm (mantén para acelerar)`}
      disabled={disabled}
      onClick={() => {
        if (performance.now() < suppressClickUntil.current) return
        stepOnce(direction)
      }}
      onPointerDown={() => beginHold(direction, true)}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      onKeyDown={(event) => {
        if (![' ', 'Enter', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault()
        const keyDirection = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : direction
        if (!event.repeat) beginHold(keyDirection, true)
      }}
      onKeyUp={(event) => { if ([' ', 'Enter', 'ArrowUp', 'ArrowDown'].includes(event.key)) stopHold() }}
    >{direction > 0 ? '▲' : '▼'}</button>
  )
  return <div className="range-control compact measurement-control" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { stopHold(); finishEdit() }
  }} onKeyDownCapture={(event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    const key = event.key.toLowerCase()
    if (key !== 'z' && key !== 'y') return
    event.preventDefault()
    event.stopPropagation()
    stopHold()
    finishEdit()
    draftRef.current = measurementMetres(valueRef.current)
    setDraft(draftRef.current)
    const state = useRoomStore.getState()
    if (key === 'y' || event.shiftKey) state.redo()
    else state.undo()
  }}>
    <span><span style={{ color: textColor }}>{label}</span><span className="position-number" style={{ color: textColor }}>
      <input type="text" inputMode="decimal" style={{ color: textColor }} aria-label={inputLabel ?? `Introducir ${label.toLowerCase()} en metros`} aria-invalid={!!error}
        value={draft} disabled={disabled} onChange={(event) => { draftRef.current = event.target.value; setDraft(event.target.value); setError('') }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); stopHold(); commit(); finishEdit() }
          else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            const direction: -1 | 1 = event.key === 'ArrowUp' ? 1 : -1
            if (!event.repeat) beginHold(direction, true)
          }
          else if (event.key === 'Escape') { event.preventDefault(); stopHold(); skipBlur.current = true; draftRef.current = measurementMetres(valueRef.current); setDraft(draftRef.current); setError(''); event.currentTarget.blur() }
        }}
        onKeyUp={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') stopHold() }}
        onBlur={() => { stopHold(); if (skipBlur.current) skipBlur.current = false; else commit() }} />
      <span aria-hidden="true">m</span>
      <span className="measurement-stepper" role="group" aria-label={`Ajustar ${label.toLowerCase()} en pasos de 1 cm`}>
        {stepper(1)}
        {stepper(-1)}
      </span>
    </span></span>
      <input type="range" aria-label={label} min={Math.ceil((min - 1e-9) / MEASUREMENT_STEP) * MEASUREMENT_STEP}
      max={Math.floor((max + 1e-9) / MEASUREMENT_STEP) * MEASUREMENT_STEP} step={MEASUREMENT_STEP} value={value}
      disabled={disabled}
      onKeyDown={(event) => {
        const direction = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : null
        if (!direction) return
        event.preventDefault()
        if (!event.repeat) beginHold(direction, true)
      }}
      onKeyUp={(event) => { if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'].includes(event.key)) stopHold() }}
      onChange={(event) => {
        apply(clamp(Number(event.target.value)))
      }} />
    <small className="measurement-equivalent" style={{ color: textColor }}>{!isMeasurementStep(value) ? '≈ ' : ''}{measurementCentimetres(value)} cm{!isMeasurementStep(value) ? ' · valor anterior conservado' : ''}</small>
    {error && <small className="measurement-error" role="alert">{error}</small>}
  </div>
}
