import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from '../../domain/constants'
import type { WallSide } from '../../domain/types'
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

export function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  return (
    <label className="color-control">
      <span>{label}</span>
      <span className="color-control__input">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
        <small>{value.toUpperCase()}</small>
      </span>
    </label>
  )
}

export function StructurePositionControls({
  label,
  position,
  onChange,
}: {
  label: string
  position: { x: number; y: number; z: number }
  onChange: (axis: 'x' | 'y' | 'z', value: number) => void
}) {
  return (
    <>
      {(['x', 'y', 'z'] as const).map((axis) => (
        <label className="range-control compact" key={axis}>
          <span><span>{label} {axis.toUpperCase()}</span><strong>{position[axis].toFixed(2)} m</strong></span>
          <input
            type="range"
            min={Math.floor(Math.min(-10, position[axis]) / 0.05) * 0.05}
            max={Math.ceil(Math.max(10, position[axis]) / 0.05) * 0.05}
            step="0.05"
            value={position[axis]}
            onChange={(event) => onChange(axis, Number(event.target.value))}
          />
        </label>
      ))}
    </>
  )
}

export function StructureSizeControls({
  surface,
  onChange,
}: {
  surface: { width: number; height: number; depth: number }
  onChange: (dimension: 'width' | 'height' | 'depth', value: number) => void
}) {
  return (
    <>
      {(['width', 'height', 'depth'] as const).map((dimension) => {
        const label = dimension === 'width' ? 'Anchura' : dimension === 'height' ? 'Altura' : 'Fondo'
        return (
          <label className="range-control compact" key={dimension}>
            <span><span>{label}</span><strong>{surface[dimension].toFixed(2)} m</strong></span>
            <input
              type="range"
              min="0.25"
              max={Math.max(10, Math.ceil(surface[dimension] * 4) / 4)}
              step="0.25"
              value={surface[dimension]}
              onChange={(event) => onChange(dimension, Number(event.target.value))}
            />
          </label>
        )
      })}
    </>
  )
}

export function WallPicker({ value, onChange, label }: { value: WallSide; onChange: (wall: WallSide) => void; label: string }) {
  return (
    <fieldset className="wall-picker">
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

function RotationDial({ rotation, onChange }: { rotation: number; onChange: (rotation: number) => void }) {
  const dragging = useRef(false)
  const indicatorX = 50 + Math.sin(rotation) * 34
  const indicatorY = 50 - Math.cos(rotation) * 34

  const setRotationFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
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
      tabIndex={0}
      onPointerDown={(event) => {
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

export function RotationControl({ rotation, onChange }: { rotation: number; onChange: (rotation: number) => void }) {
  return (
    <div className="rotation-control">
      <label className="property-angle">
        <small>Giro</small>
        <span>
          <input
            type="number"
            min={-180}
            max={180}
            step={1}
            value={rotationDegrees(rotation)}
            onChange={(event) => onChange(Number(event.target.value) * Math.PI / 180)}
          />
          <b>°</b>
        </span>
      </label>
      <div className="rotation-dial-card">
        <small>Ajustar giro</small>
        <RotationDial rotation={rotation} onChange={onChange} />
      </div>
    </div>
  )
}

