/** Elige el siguiente elemento bajo el puntero al repetir Alt + clic; cicla y vuelve al de arriba. */
export function nextOverlappingId(idsFrontToBack: readonly string[], currentId: string | null) {
  const ids = [...new Set(idsFrontToBack)]
  if (ids.length < 2) return null
  const index = currentId ? ids.indexOf(currentId) : -1
  return ids[(index + 1) % ids.length]
}
