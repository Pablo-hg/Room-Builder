import type { FurnitureDimension, ResizeCapability } from '../../domain/resizeCapabilities'
import { MeasurementControl } from './MeasurementControl'

export function ResizeControls({ capability, value, disabled, onChange }: {
  capability?: ResizeCapability
  value: { width: number; height: number; depth?: number }
  disabled?: boolean
  onChange: (dimension: FurnitureDimension, value: number) => void
}) {
  if (!capability) return null
  const labels: Record<FurnitureDimension, string> = { width: 'Anchura', depth: 'Fondo', height: 'Altura' }
  return <div className="resize-controls" aria-label="Tamaño del objeto">
    {(['width', 'depth', 'height'] as const).map((dimension) => {
      const range = capability.dimensions[dimension]
      const current = value[dimension]
      if (!range || current === undefined || (capability.diameter?.[1] === dimension)) return null
      const label = capability.diameter?.[0] === dimension ? 'Diámetro' : labels[dimension]
      return <MeasurementControl key={dimension} label={`${label} del objeto`} value={current} min={range.min} max={range.max} disabled={disabled} onChange={(next) => onChange(dimension, next)} />
    })}
  </div>
}
