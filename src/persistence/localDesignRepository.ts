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
  write: (designs: SavedDesign[], previous?: SavedDesign[]) => void
}

// Resolve storage on each operation so module import remains safe without a browser.
export function createLocalDesignRepository(getStorage: () => DesignStorage = () => localStorage): DesignRepository {
  // Comparar el contenido exacto evita sobrescrituras sin cambiar la clave ni el formato.
  // undefined significa que todavía no se ha validado una lectura de esta biblioteca.
  let expectedRaw: string | null | undefined
  let readFailed = false
  function read(): SavedDesign[] {
    expectedRaw = undefined
    readFailed = true
    const designs = readValidated()
    readFailed = false
    return designs
  }
  function readValidated(): SavedDesign[] {
    const storage = getStorage()
    const rawDesigns = storage.getItem(SAVED_DESIGNS_KEY)
    if (rawDesigns !== null) {
      const parsed: unknown = JSON.parse(rawDesigns)
      if (!Array.isArray(parsed)) throw new Error('invalid saved designs')
      // Nunca ocultar entradas sobrantes: una escritura posterior las eliminaría.
      if (parsed.length > MAX_SAVED_DESIGNS) throw new Error('La biblioteca contiene más de cinco diseños. No se ha modificado.')
      const designs = parsed.map((entry: unknown) => {
        if (!entry || typeof entry !== 'object') throw new Error('invalid saved design')
        const saved = entry as Partial<SavedDesign>
        if (saved.data && typeof saved.data === 'object' && typeof saved.data.version === 'number' && saved.data.version > 15) {
          throw new Error('La biblioteca contiene diseños de una versión más reciente de Room Builder. Ábrelos con esa versión para conservarlos.')
        }
        if (
          typeof saved.id !== 'string'
          || typeof saved.name !== 'string'
          || typeof saved.savedAt !== 'string'
          || !isPersistedDesign(saved.data)
        ) throw new Error('invalid saved design')
        return saved as SavedDesign
      })
      if (new Set(designs.map((design) => design.id)).size !== designs.length) throw new Error('La biblioteca contiene IDs duplicados.')
      expectedRaw = rawDesigns
      return designs
    }

    const legacyDesign = storage.getItem(STORAGE_KEY)
    if (!legacyDesign) { expectedRaw = null; return [] }
    const data: unknown = JSON.parse(legacyDesign)
    if (!isPersistedDesign(data)) throw new Error('invalid saved design')
    const migrated = migrateLegacyDesign(data, makeId('design'), new Date().toISOString())
    expectedRaw = null
    write(migrated, undefined, true)
    return migrated
  }

  function write(designs: SavedDesign[], previous?: SavedDesign[], migrating = false) {
    if (designs.length > MAX_SAVED_DESIGNS) throw new Error('La biblioteca no admite más de cinco diseños.')
    if (new Set(designs.map((design) => design.id)).size !== designs.length) throw new Error('No se pueden guardar diseños con IDs duplicados.')
    const storage = getStorage()
    if (readFailed && !migrating) throw new DesignStorageConflictError()
    const currentRaw = storage.getItem(SAVED_DESIGNS_KEY)
    if (expectedRaw === undefined || currentRaw !== expectedRaw) {
      // La revisión puede perderse durante una actualización del entorno de
      // desarrollo. Solo aceptar la escritura si la biblioteca completa sigue
      // coincidiendo con la que el editor tiene cargada.
      let sameLibrary = false
      try {
        const current: unknown = currentRaw === null ? null : JSON.parse(currentRaw)
        sameLibrary = !readFailed && expectedRaw === undefined && previous !== undefined && Array.isArray(current)
          && JSON.stringify(current) === JSON.stringify(previous)
      } catch { /* Una biblioteca ilegible nunca se sobrescribe. */ }
      if (!sameLibrary) throw new DesignStorageConflictError()
    }
    const nextRaw = JSON.stringify(designs)
    storage.setItem(SAVED_DESIGNS_KEY, nextRaw)
    // Solo avanzamos la revisión conocida tras una escritura satisfactoria.
    expectedRaw = nextRaw
  }

  return { read, write }
}
