import { isPersistedDesign, type SavedDesign } from '../domain/designV1'
import { makeId } from '../domain/elementIds'
import { migrateLegacyDesign } from './designMigrations'
import { validateLayouts } from '../domain/designLayouts'

function assertLayoutMirror(value: unknown) {
  if (value && typeof value === 'object' && (value as { version?: unknown }).version === 5) {
    const errors = validateLayouts(value)
    const mirrorError = errors.find((error) => error.includes('no coincide'))
    if (mirrorError) throw new Error(mirrorError)
  }
}

export const STORAGE_KEY = 'room-builder:v0.1:design'
export const SAVED_DESIGNS_KEY = 'room-builder:v0.1:designs'
export const MAX_SAVED_DESIGNS = 5

export type DesignStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface DesignRepository {
  read: () => SavedDesign[]
  write: (designs: SavedDesign[]) => void
}

// Resolve storage on each operation so module import remains safe without a browser.
export function createLocalDesignRepository(getStorage: () => DesignStorage = () => localStorage): DesignRepository {
  function read(): SavedDesign[] {
    const storage = getStorage()
    const rawDesigns = storage.getItem(SAVED_DESIGNS_KEY)
    if (rawDesigns !== null) {
      const parsed: unknown = JSON.parse(rawDesigns)
      if (!Array.isArray(parsed)) throw new Error('invalid saved designs')
      return parsed.slice(0, MAX_SAVED_DESIGNS).map((entry: unknown) => {
        if (!entry || typeof entry !== 'object') throw new Error('invalid saved design')
        const saved = entry as Partial<SavedDesign>
        assertLayoutMirror(saved.data)
        if (
          typeof saved.id !== 'string'
          || typeof saved.name !== 'string'
          || typeof saved.savedAt !== 'string'
          || !isPersistedDesign(saved.data)
        ) throw new Error('invalid saved design')
        return saved as SavedDesign
      })
    }

    const legacyDesign = storage.getItem(STORAGE_KEY)
    if (!legacyDesign) return []
    const data: unknown = JSON.parse(legacyDesign)
    assertLayoutMirror(data)
    if (!isPersistedDesign(data)) throw new Error('invalid saved design')
    const migrated = migrateLegacyDesign(data, makeId('design'), new Date().toISOString())
    write(migrated)
    return migrated
  }

  function write(designs: SavedDesign[]) {
    getStorage().setItem(SAVED_DESIGNS_KEY, JSON.stringify(designs))
  }

  return { read, write }
}
