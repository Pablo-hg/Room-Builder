/** Agrupa alturas que difieren menos de 1 mm en la misma planta. */
export const roundFloorLevel = (y: number) => Math.round(y * 1000) / 1000

export interface FloorLevel {
  /** Altura de la planta en metros (redondeada a 1 mm). */
  y: number
  /** Número de planta: 0 la de la habitación raíz, 1, 2… arriba y −1, −2… abajo. */
  number: number
  /** «Planta 0», «Planta 1», «Planta -1»… */
  name: string
}

/**
 * Plantas de la vivienda a partir de las alturas de sus habitaciones, como en
 * un edificio: la planta de la habitación raíz es la 0, las superiores se
 * numeran 1, 2… y las inferiores −1, −2… Ordenadas de abajo arriba.
 */
export function floorLevels(heights: readonly number[]): FloorLevel[] {
  const levels = [...new Set([0, ...heights.map(roundFloorLevel)])].sort((a, b) => a - b)
  const ground = levels.indexOf(0)
  return levels.map((y, index) => {
    const number = index - ground
    return { y, number, name: `Planta ${number}` }
  })
}
