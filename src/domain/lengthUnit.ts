/**
 * Unidad con la que se MUESTRAN las medidas (metros o centímetros). Los datos siempre se guardan en metros: esto solo
 * cambia cómo se escriben y cómo se interpretan los números que escribe el usuario. Es una preferencia del navegador
 * (no viaja en el diseño ni en el JSON); el estado vive en el store y este módulo guarda la copia que leen los
 * formateadores puros del dominio.
 */
export type LengthUnit = 'm' | 'cm'

let current: LengthUnit = 'm'
export const setDisplayLengthUnit = (unit: LengthUnit) => { current = unit }
export const getDisplayLengthUnit = (): LengthUnit => current

/** Todo se mide en centímetros enteros: nunca hay más precisión que 0,01 m. */
export const roundToCentimetre = (metres: number) => Math.round(metres * 100) / 100

const METRES = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
const CENTIMETRES = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: false })

/** «4,00» en metros o «400» en centímetros. */
export function formatLengthValue(metres: number, unit: LengthUnit = current): string {
  return unit === 'cm' ? CENTIMETRES.format(Math.round(metres * 100)) : METRES.format(roundToCentimetre(metres))
}

/** «4,00 m» o «400 cm». */
export function formatLength(metres: number, unit: LengthUnit = current): string {
  return `${formatLengthValue(metres, unit)} ${unit}`
}

/** Medida equivalente en la otra unidad, para mostrarla como apoyo («261 cm» o «2,61 m»). */
export const formatLengthOtherUnit = (metres: number, unit: LengthUnit = current): string =>
  formatLength(metres, unit === 'cm' ? 'm' : 'cm')

/** Coordenada de un punto en la unidad elegida, a centímetro: «3,52» en metros o «352» en centímetros. */
export function formatCoordinate(metres: number, unit: LengthUnit = current): string {
  return unit === 'cm' ? String(Math.round(metres * 100)) : roundToCentimetre(metres).toFixed(2).replace('.', ',')
}

/** «3,52 ; 8,25 m» o «352 ; 825 cm»: las dos coordenadas de un punto con su unidad. */
export function formatCoordinatePair(x: number, z: number, unit: LengthUnit = current): string {
  return `${formatCoordinate(x, unit)} ; ${formatCoordinate(z, unit)} ${unit}`
}

/** Texto de un campo editable: en metros con punto decimal (como siempre) y en centímetros, enteros. */
export function lengthInputText(metres: number, unit: LengthUnit = current): string {
  return unit === 'cm' ? String(Math.round(metres * 100)) : (Math.round(metres * 100) / 100).toFixed(2)
}

/**
 * Medida de los paneles y rótulos de la interfaz: en metros mantiene el formato de siempre (punto decimal y los
 * decimales que ya usaba cada rótulo) y en centímetros muestra enteros.
 */
export function formatPanelLength(metres: number, decimals = 2, unit: LengthUnit = current): string {
  return unit === 'cm' ? `${Math.round(metres * 100)} cm` : `${metres.toFixed(decimals)} m`
}
