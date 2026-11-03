import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from '../../domain/constants'
import type { StructureSurface, WallSide } from '../../domain/types'
import { structureDimensionMinimum } from '../../domain/structureRules'
import { OpeningIcon } from '../iconCatalog'
import { useRoomStore } from '../../state/useRoomStore'

export function DimensionControl({ field, label }: { field: 'width' | 'depth' | 'height'; label: string }) {
  const room = useRoomStore((state) => state.room)
  const setDimension = useRoomStore((state) => state.setDimension)
  return (
    <label className="range-control">
      <span><span>{label}</span><strong>{room[field].toFixed(1)} m</strong></span>
      <input
        type="range"
        min={field === 'width' ? ROOM_LIMITS.minWidth : field === 'depth' ? ROOM_LIMITS.minDepth : ROOM_LIMITS.minHeight}
        max={field === 'width' ? ROOM_LIMITS.maxWidth : field === 'depth' ? ROOM_LIMITS.maxDepth : ROOM_LIMITS.maxHeight}
        step="0.25"
        value={room[field]}
        onChange={(event) => setDimension(field, Number(event.target.value))}
      />
    </label>
  )
}

export function ColorControl({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (color: string) => void; disabled?: boolean }) {
  return (
    <label className="color-control">
      <span>{label}</span>
      <span className="color-control__input">
        <input type="color" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-label={label} />
        <small>{value.toUpperCase()}</small>
      </span>
    </label>
  )
}

const formatPosition = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000
  const decimals = rounded.toFixed(3).replace(/0+$/, '').split('.')[1]?.length ?? 0
  return rounded.toFixed(Math.max(2, decimals))
}

export function PositionControl({ label, value, min, max, step, disabled = false, onChange }: { label: string; value: number; min: number; max: number; step: number; disabled?: boolean; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(formatPosition(value))
  const skipBlur = useRef(false)
  const inputLabel = `Introducir ${label.replace(/^Posición /, '').replace(/^Desplazamiento /, '').replace(/^Mover pack /, '')} en metros`
  useEffect(() => setDraft(formatPosition(value)), [value])
  const commit = () => {
    const text = draft.trim().replace(',', '.')
    const candidate = text === '' ? NaN : Number(text)
    setDraft(formatPosition(value))
    if (Number.isFinite(candidate) && candidate >= min && candidate <= max && candidate !== value) onChange(candidate)
  }
  return <div className="range-control compact">
    <span><span>{label}</span><span className="position-number"><input type="text" inputMode="decimal" aria-label={inputLabel} value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit() } else if (event.key === 'Escape') { event.preventDefault(); skipBlur.current = true; setDraft(formatPosition(value)); event.currentTarget.blur() } }} onBlur={() => { if (skipBlur.current) skipBlur.current = false; else commit() }} /><span aria-hidden="true">m</span></span></span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
  </div>
}

export function StructurePositionControls({
  label,
  position,
  onChange,
  disabled = false,
}: {
  label: string
  position: { x: number; y: number; z: number }
  onChange: (axis: 'x' | 'y' | 'z', value: number) => void
  disabled?: boolean
}) {
  return (
    <>
      {(['x', 'y', 'z'] as const).map((axis) => {
        const step = ROOM_LIMITS.placementStep
        return <PositionControl key={axis} label={`${label} ${axis.toUpperCase()}`} min={Math.floor(Math.min(-10, position[axis]) / step) * step} max={Math.ceil(Math.max(10, position[axis]) / step) * step} step={step} value={position[axis]} disabled={disabled} onChange={(value) => onChange(axis, value)} />
      })}
    </>
  )
}

const surfaceDimensionLabel = (kind: StructureSurface['kind'], dimension: 'width' | 'height' | 'depth') => {
  if (dimension === 'width') return 'Anchura'
  if ((kind === 'wall' && dimension === 'depth') || (kind !== 'wall' && dimension === 'height')) return 'Grosor'
  return kind === 'wall' ? 'Altura' : 'Profundidad'
}

export function StructureSizeControls({
  surface,
  onChange,
  disabled = false,
}: {
  surface: Pick<StructureSurface, 'kind' | 'width' | 'height' | 'depth'>
  onChange: (dimension: 'width' | 'height' | 'depth', value: number) => void
  disabled?: boolean
}) {
  const dimensions = surface.kind === 'wall'
    ? (['width', 'height', 'depth'] as const)
    : (['width', 'depth', 'height'] as const)
  const step = ROOM_LIMITS.placementStep
  return (
    <>
      {dimensions.map((dimension) => (
        <PositionControl
          key={dimension}
          label={surfaceDimensionLabel(surface.kind, dimension)}
          min={structureDimensionMinimum(surface.kind, dimension)}
          max={Math.max(10, Math.ceil(surface[dimension] / step) * step)}
          step={step}
          value={surface[dimension]}
          disabled={disabled}
          onChange={(value) => onChange(dimension, value)}
        />
      ))}
    </>
  )
}

export function WallPicker({ value, onChange, label, disabled = false }: { value: WallSide; onChange: (wall: WallSide) => void; label: string; disabled?: boolean }) {
  return (
    <fieldset className="wall-picker" disabled={disabled}>
      <legend>{label}</legend>
      <div>
        {WALL_SIDES.map((wall) => (
          <button key={wall} type="button" className={value === wall ? 'active' : ''} onClick={() => onChange(wall)} aria-pressed={value === wall}>
            {WALL_LABELS[wall]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function OpeningSwatch({ kind, color }: { kind: 'door' | 'window' | 'circularWindow' | 'wallShelf' | 'mirrorRectangular' | 'mirrorCircular' | 'wallSconce'; color?: string }) {
  return <OpeningIcon kind={kind} color={color} />
}

function rotationDegrees(rotation: number) {
  const degrees = Math.round(rotation * 180 / Math.PI)
  return ((degrees + 180) % 360 + 360) % 360 - 180
}

function RotationDial({ rotation, onChange, disabled = false }: { rotation: number; onChange: (rotation: number) => void; disabled?: boolean }) {
  const dragging = useRef(false)
  const indicatorX = 50 + Math.sin(rotation) * 34
  const indicatorY = 50 - Math.cos(rotation) * 34

  const setRotationFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return
    const x = (event.clientX - bounds.left) / bounds.width * 100 - 50
    const y = (event.clientY - bounds.top) / bounds.height * 100 - 50
    if (Math.hypot(x, y) < 4) return
    onChange(Math.atan2(x, -y))
  }

  const stopDragging = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <svg
      className="rotation-dial"
      viewBox="0 0 100 100"
      role="slider"
      aria-label="Giro del mueble"
      aria-valuemin={-180}
      aria-valuemax={180}
      aria-valuenow={rotationDegrees(rotation)}
      aria-valuetext={`${rotationDegrees(rotation)} grados`}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={(event) => {
        if (disabled) return
        event.preventDefault()
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        setRotationFromPointer(event)
      }}
      onPointerMove={(event) => {
        if (dragging.current) setRotationFromPointer(event)
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onKeyDown={(event) => {
        if (disabled) return
        const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
            ? -1
            : 0
        if (direction) {
          event.preventDefault()
          onChange(rotation + direction * Math.PI / 36)
        } else if (event.key === 'Home') {
          event.preventDefault()
          onChange(0)
        } else if (event.key === 'End') {
          event.preventDefault()
          onChange(Math.PI)
        }
      }}
    >
      <circle className="rotation-dial__track" cx="50" cy="50" r="39" />
      <line className="rotation-dial__indicator" x1="50" y1="50" x2={indicatorX} y2={indicatorY} />
      <circle className="rotation-dial__center" cx="50" cy="50" r="3" />
    </svg>
  )
}

export function RotationControl({ rotation, onChange, disabled = false }: { rotation: number; onChange: (rotation: number) => void; disabled?: boolean }) {
  return (
    <div className={`rotation-control${disabled ? ' rotation-control--disabled' : ''}`}>
      <label className="property-angle">
        <small>Giro</small>
        <span>
          <input
            type="number"
            min={-180}
            max={180}
            step={1}
            value={rotationDegrees(rotation)}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value) * Math.PI / 180)}
          />
          <b>°</b>
        </span>
      </label>
      <div className="rotation-dial-card">
        <small>Ajustar giro</small>
        <RotationDial rotation={rotation} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  )
}

