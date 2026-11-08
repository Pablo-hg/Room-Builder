import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { MeasurementControl } from './MeasurementControl'
import { ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from '../../domain/constants'
import type { AxisLocks, PositionAxis, StructureSurface, WallSide } from '../../domain/types'
import { structureDimensionMinimum } from '../../domain/structureRules'
import { OpeningIcon } from '../iconCatalog'
import { useRoomStore } from '../../state/useRoomStore'
import { focusedRoom } from '../../domain/roomEditing'
import { AXIS_COLORS } from '../../scene/axisColors'

export function DimensionControl({ field, label }: { field: 'width' | 'depth' | 'height'; label: string }) {
  const state = useRoomStore()
  const target = focusedRoom(state)
  return <MeasurementControl label={label} value={target.size[field]} disabled={!target.editable} min={field === 'width' ? ROOM_LIMITS.minWidth : field === 'depth' ? ROOM_LIMITS.minDepth : ROOM_LIMITS.minHeight} max={field === 'width' ? ROOM_LIMITS.maxWidth : field === 'depth' ? ROOM_LIMITS.maxDepth : ROOM_LIMITS.maxHeight} onChange={(value) => state.setFocusedRoomDimension(field, value)} />
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

export function PositionControl({ label, value, min, max, disabled = false, onChange, axis }: { label: string; value: number; min: number; max: number; step: number; disabled?: boolean; axis?: PositionAxis; onChange: (value: number) => void }) {
  const inputLabel = `Introducir ${label.replace(/^Posición /, '').replace(/^Desplazamiento /, '').replace(/^Mover pack /, '')} en metros`
  return <MeasurementControl label={label} inputLabel={inputLabel} value={value} min={min} max={max} disabled={disabled} onChange={onChange} textColor={axis ? AXIS_COLORS[axis].normal : undefined} />
}

export function AxisPositionControl({ id, axis, locked, disabled = false, unavailable = false, ...props }: {
  id: string; axis: PositionAxis; locked: boolean; disabled?: boolean; unavailable?: boolean
  label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void
}) {
  const setElementAxisLock = useRoomStore((state) => state.setElementAxisLock)
  return <div className="axis-position-control">
    <label className="axis-position-lock" style={{ color: AXIS_COLORS[axis].normal }}><input type="checkbox" style={{ accentColor: AXIS_COLORS[axis].normal }} aria-label={`Bloquear eje ${axis.toUpperCase()}`} checked={locked || unavailable} disabled={disabled || unavailable} onChange={(event) => setElementAxisLock(id, axis, event.target.checked)} /> Bloquear {axis.toUpperCase()}</label>
    <PositionControl {...props} axis={axis} disabled={disabled || locked || unavailable} />
  </div>
}

export function StructurePositionControls({
  label,
  position,
  onChange,
  disabled = false,
  elementId,
  axisLocks,
}: {
  label: string
  position: { x: number; y: number; z: number }
  onChange: (axis: 'x' | 'y' | 'z', value: number) => void
  disabled?: boolean
  elementId?: string
  axisLocks?: AxisLocks
}) {
  return (
    <>
      {(['x', 'y', 'z'] as const).map((axis) => {
        const step = ROOM_LIMITS.placementStep
        const props = { label: `${label} ${axis.toUpperCase()}`, min: Math.floor(Math.min(-10, position[axis]) / step) * step, max: Math.ceil(Math.max(10, position[axis]) / step) * step, step, value: position[axis], disabled, onChange: (value: number) => onChange(axis, value) }
        return elementId ? <AxisPositionControl key={axis} {...props} id={elementId} axis={axis} locked={axisLocks?.[axis] ?? false} /> : <PositionControl key={axis} {...props} axis={axis} />
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

