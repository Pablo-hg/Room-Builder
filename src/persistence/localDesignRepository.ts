import { isPersistedDesign, type SavedDesign } from '../domain/designV1'
import { makeId } from '../domain/elementIds'
import { migrateLegacyDesign } from './designMigrations'

export const STORAGE_KEY = 'room-builder:v0.1:design'
export const SAVED_DESIGNS_KEY = 'room-builder:v0.1:designs'
export const MAX_SAVED_DESIGNS = 5

export type DesignStorage = Pick<Storage, 'getItem' | 'setItem'>

export class DesignStorageConflictError extends Error {
  constructor() { super('La biblioteca ha cambiado en otra pestaña o no se ha podido cargar de forma segura.') }
}

export interface DesignRepository {
  read: () => SavedDesign[]
  write: (designs: SavedDesign[]) => void
}

// Resolve storage on each operation so module import remains safe without a browser.
export function createLocalDesignRepository(getStorage: () => DesignStorage = () => localStorage): DesignRepository {
  // Comparar el contenido exacto evita sobrescrituras sin cambiar la clave ni el formato.
  // undefined significa que todavía no se ha validado una lectura de esta biblioteca.
  let expectedRaw: string | null | undefined
  function read(): SavedDesign[] {
    const storage = getStorage()
    const rawDesigns = storage.getItem(SAVED_DESIGNS_KEY)
    if (rawDesigns !== null) {
      const parsed: unknown = JSON.parse(rawDesigns)
      if (!Array.isArray(parsed)) throw new Error('invalid saved designs')
      const designs = parsed.slice(0, MAX_SAVED_DESIGNS).map((entry: unknown) => {
        if (!entry || typeof entry !== 'object') throw new Error('invalid saved design')
        const saved = entry as Partial<SavedDesign>
        if (
          typeof saved.id !== 'string'
          || typeof saved.name !== 'string'
          || typeof saved.savedAt !== 'string'
          || !isPersistedDesign(saved.data)
        ) throw new Error('invalid saved design')
        return saved as SavedDesign
      })
      expectedRaw = rawDesigns
      return designs
    }

    const legacyDesign = storage.getItem(STORAGE_KEY)
    if (!legacyDesign) { expectedRaw = null; return [] }
    const data: unknown = JSON.parse(legacyDesign)
    if (!isPersistedDesign(data)) throw new Error('invalid saved design')
    const migrated = migrateLegacyDesign(data, makeId('design'), new Date().toISOString())
    expectedRaw = null
    write(migrated)
    return migrated
  }

  function write(designs: SavedDesign[]) {
    if (designs.length > MAX_SAVED_DESIGNS) throw new Error('La biblioteca no admite más de cinco diseños.')
    const storage = getStorage()
    const currentRaw = storage.getItem(SAVED_DESIGNS_KEY)
    if ((expectedRaw === undefined && currentRaw !== null)
      || (expectedRaw !== undefined && currentRaw !== expectedRaw)) throw new DesignStorageConflictError()
    const nextRaw = JSON.stringify(designs)
    storage.setItem(SAVED_DESIGNS_KEY, nextRaw)
    // Solo avanzamos la revisión conocida tras una escritura satisfactoria.
    expectedRaw = nextRaw
  }

  return { read, write }
}
