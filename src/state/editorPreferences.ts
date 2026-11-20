/**
 * Preferencias de edición del navegador (#37). No forman parte del diseño: no viajan en el JSON,
 * no versionan el formato y no entran en el historial. Cualquier fallo de almacenamiento
 * (modo privado, datos bloqueados, entorno de pruebas) devuelve los valores por defecto.
 */
import type { LengthUnit } from '../domain/lengthUnit'

export interface EditorPreferences { magnetism: boolean; guides: boolean; lengthUnit: LengthUnit }
export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = { magnetism: true, guides: true, lengthUnit: 'm' }
export const EDITOR_PREFERENCES_KEY = 'room-builder:v0.2:editor-preferences'

export function loadEditorPreferences(): EditorPreferences {
  try {
    const raw = globalThis.localStorage?.getItem(EDITOR_PREFERENCES_KEY)
    if (!raw) return { ...DEFAULT_EDITOR_PREFERENCES }
    const parsed = JSON.parse(raw) as Partial<EditorPreferences> | null
    return {
      magnetism: typeof parsed?.magnetism === 'boolean' ? parsed.magnetism : DEFAULT_EDITOR_PREFERENCES.magnetism,
      guides: typeof parsed?.guides === 'boolean' ? parsed.guides : DEFAULT_EDITOR_PREFERENCES.guides,
      lengthUnit: parsed?.lengthUnit === 'cm' ? 'cm' : 'm',
    }
  } catch { return { ...DEFAULT_EDITOR_PREFERENCES } }
}

export function saveEditorPreferences(preferences: EditorPreferences) {
  try { globalThis.localStorage?.setItem(EDITOR_PREFERENCES_KEY, JSON.stringify(preferences)) } catch { /* sin almacenamiento: la preferencia dura la sesión */ }
}
