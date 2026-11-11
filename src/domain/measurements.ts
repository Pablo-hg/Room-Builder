/** Unidad de edición espacial. Las coordenadas persistidas siguen expresadas en metros. */
export const MEASUREMENT_STEP = 0.01
export const MOVEMENT_STEP = 0.05

export const MEASUREMENT_STEP_NOTICE = 'Usa centímetros enteros, por ejemplo 0,13 m (13 cm).'
export const MEASUREMENT_INVALID_NOTICE = 'Escribe un número en metros o centímetros, por ejemplo 4,37 m o 437 cm.'

export function parseMeasurement(text: string): number {
  const match = text.trim().match(/^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))\s*(cm|m)?$/i)
  if (!match) return NaN
  const number = Number(match[1].replace(',', '.'))
  return match[2]?.toLowerCase() === 'cm' ? number / 100 : number
}

export function isMeasurementStep(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7
}

export function snapMeasurement(value: number): number {
  return Math.round(value * 100) / 100
}

export function snapMovement(delta: number): number {
  return Math.round(delta * 20) / 20
}

export function moveFromOrigin(value: number, origin: number): number {
  const displacement = snapMovement(value - origin)
  return displacement === 0 ? origin : snapMeasurement(origin + displacement)
}

export function measurementCentimetres(value: number): string {
  return Math.round(value * 100).toLocaleString('es-ES', { maximumFractionDigits: 0 })
}

export function measurementMetres(value: number): string {
  return isMeasurementStep(value) ? value.toFixed(2) : String(Number(value.toFixed(6)))
}

export function nextMeasurement(value: number, direction: -1 | 1): number {
  return snapMeasurement(value + direction * MOVEMENT_STEP)
}

/**
 * Paso fino de 1 cm. Los valores antiguos que no están en centímetros enteros
 * avanzan al siguiente centímetro sin migrar el dato original.
 */
export function stepMeasurement(value: number, direction: -1 | 1): number {
  const centimetres = value * 100
  const target = direction > 0
    ? Math.floor(centimetres + 1e-7) + 1
    : Math.ceil(centimetres - 1e-7) - 1
  return snapMeasurement(target / 100)
}
