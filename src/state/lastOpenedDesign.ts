/**
 * Último diseño abierto en este navegador. Como las preferencias de edición (`editorPreferences.ts`), no forma parte del
 * diseño: no viaja en el JSON, no cambia el formato ni entra en el historial. Cualquier fallo de almacenamiento
 * (modo privado, datos bloqueados, entorno de pruebas) se ignora y se abre el primer diseño de la lista.
 */
export const LAST_OPENED_DESIGN_KEY = 'room-builder:v0.2:last-opened-design'

export function loadLastOpenedDesignId(): string | null {
  try {
    const id = globalThis.localStorage?.getItem(LAST_OPENED_DESIGN_KEY)
    return typeof id === 'string' && id ? id : null
  } catch { return null }
}

export function saveLastOpenedDesignId(id: string) {
  if (!id) return
  try { globalThis.localStorage?.setItem(LAST_OPENED_DESIGN_KEY, id) } catch { /* sin almacenamiento: se abrirá el primero */ }
}

/** Diseño que debe abrirse al arrancar: el recordado si sigue existiendo y, si no, el primero. */
export function designToOpenOnStart<T extends { id: string }>(designs: readonly T[], rememberedId: string | null): T | undefined {
  return designs.find((design) => design.id === rememberedId) ?? designs[0]
}
