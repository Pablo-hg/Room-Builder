import { DesignStorageConflictError, MAX_SAVED_DESIGNS } from '../../persistence/localDesignRepository'
import { normalizeDesign } from '../../persistence/designMigrations'
import { initialRoomFolder } from '../../domain/elementFolders'
import { DEFAULT_ROOM } from '../../domain/constants'
import { DEFAULT_GRID_VISIBILITY, persistedDesign, type SavedDesign } from '../../domain/designV1'
import { normalizeDesignPreferences } from '../../domain/normalizeDesignV1'
import { makeId } from '../../domain/elementIds'
import type { PersistedDesign } from '../../domain/types'
import { recordInteraction } from '../../debug/interactionLog'
import { failDiagnosticAction } from '../../diagnostics/actionScope'
import { cloneRoom } from '../defaults'
import type { RoomActionContext, RoomState } from '../types'

type DesignActions = Pick<
  RoomState,
  | 'initializeSavedDesigns'
  | 'selectSavedDesign'
  | 'deleteSavedDesign'
  | 'createDesign'
  | 'renameSavedDesign'
  | 'saveDesign'
  | 'importDesign'
  | 'loadDesign'
>

const writeFailureNotice = (error: unknown, fallback: string) => error instanceof DesignStorageConflictError
  ? 'La biblioteca ha cambiado en otra pestaña o no se ha podido cargar de forma segura. No se ha sobrescrito. Conserva tus cambios y exporta el JSON antes de recargar.'
  : fallback

const blankDesignData = (): PersistedDesign => persistedDesign({
  room: cloneRoom(),
  furniture: [],
  structurePacks: [],
  gridSnap: true,
  gridVisibility: { ...DEFAULT_GRID_VISIBILITY },
  hiddenElementIds: [],
  lockedElementIds: [],
  ...initialRoomFolder(DEFAULT_ROOM),
  sceneElementOrder: [],
})

const sceneFromDesign = (data: PersistedDesign) => ({
  ...data,
  structurePacks: data.structurePacks ?? [],
  ...normalizeDesignPreferences(data),
  selectedId: null,
})

export function createDesignActions(context: Pick<RoomActionContext, 'set' | 'get' | 'repository'>): DesignActions {
  const { set, get, repository } = context
  return {
    initializeSavedDesigns: () => {
      try {
        const savedDesigns = repository.read()
        set({ savedDesigns, selectedSavedDesignId: '' })
      } catch (error) {
        failDiagnosticAction('storage.read-failed')
        const detail = error instanceof Error && error.message.includes('no coincide') ? ` ${error.message}` : ''
        set({ notice: `No se pudieron leer los diseños guardados.${detail}` })
      }
    },
    selectSavedDesign: (selectedSavedDesignId) => set({ selectedSavedDesignId }),
    deleteSavedDesign: (id) => {
      const state = get()
      const designId = id ?? state.selectedSavedDesignId
      if (!designId) return
      const savedDesigns = state.savedDesigns.filter((design) => design.id !== designId)
      const deletingActive = state.selectedSavedDesignId === designId
      try {
        repository.write(savedDesigns)
        recordInteraction('state.design.deleted', {
          view: state.view,
          selectedId: state.selectedId,
          details: { id: designId },
        })
        if (!deletingActive) {
          set({ savedDesigns, notice: 'Diseño guardado eliminado.' })
          return
        }
        const nextDesign = savedDesigns[0]
        if (nextDesign) {
          try {
            const data = normalizeDesign(nextDesign.data)
            set({
              ...sceneFromDesign(data),
              selectedSavedDesignId: nextDesign.id,
              hasUnsavedChanges: false,
              savedDesigns,
              notice: 'Diseño guardado eliminado. Se ha abierto el primero de la lista.',
            })
            return
          } catch { /* Si el primero no es válido, se muestra un lienzo en blanco. */ }
        }
        const data = blankDesignData()
        set({
          ...sceneFromDesign(data),
          selectedSavedDesignId: '',
          hasUnsavedChanges: false,
          savedDesigns,
          notice: nextDesign
            ? 'Diseño eliminado. El primero de la lista no es válido; se muestra un lienzo en blanco.'
            : 'Diseño guardado eliminado. Se muestra un lienzo en blanco.',
        })
        // El envoltorio de set marca como no guardado un lienzo sin diseño activo; se corrige aquí.
        set({ hasUnsavedChanges: false })
      } catch (error) {
        failDiagnosticAction('storage.delete-failed')
        set({ notice: writeFailureNotice(error, 'No se pudo eliminar el diseño guardado.') })
      }
    },
    createDesign: (mode, name) => {
      const state = get()
      const cleanName = name.trim()
      if (!cleanName) return set({ notice: 'Escribe un nombre para el diseño.' })
      if (state.savedDesigns.length >= MAX_SAVED_DESIGNS) {
        return set({ notice: 'Ya hay 5 diseños guardados. Elimina uno antes de crear otro.' })
      }
      const data: PersistedDesign = mode === 'copy'
        ? persistedDesign(state)
        : blankDesignData()
      const savedAt = new Date().toISOString()
      const design: SavedDesign = {
        id: makeId('design'),
        name: cleanName,
        savedAt,
        data,
      }
      const savedDesigns = [...state.savedDesigns, design]
      try {
        repository.write(savedDesigns)
        recordInteraction('state.design.created', {
          view: state.view,
          selectedId: state.selectedId,
          details: { id: design.id, mode },
        })
        set({
          ...data,
          savedDesigns,
          selectedSavedDesignId: design.id,
          room: data.room,
          furniture: data.furniture,
          structurePacks: data.structurePacks ?? [],
          gridSnap: data.gridSnap,
          gridVisibility: data.gridVisibility ?? { ...DEFAULT_GRID_VISIBILITY },
          hiddenElementIds: data.hiddenElementIds ?? [],
          lockedElementIds: data.lockedElementIds ?? [],
          elementFolders: data.elementFolders ?? [],
          elementFolderAssignments: data.elementFolderAssignments ?? {},
          sceneElementOrder: data.sceneElementOrder ?? [],
          selectedId: null,
          hasUnsavedChanges: false,
          notice: mode === 'blank' ? 'Diseño nuevo creado en blanco.' : 'Copia del diseño creada.',
        })
      } catch (error) {
        failDiagnosticAction('storage.create-failed')
        set({ notice: writeFailureNotice(error, 'No se pudo crear el diseño en el almacenamiento local.') })
      }
    },
    renameSavedDesign: (id, name) => {
      const state = get()
      const cleanName = name.trim()
      if (!cleanName) return set({ notice: 'El nombre del diseño no puede estar vacío.' })
      const savedDesigns = state.savedDesigns.map((design) => design.id === id ? { ...design, name: cleanName } : design)
      try {
        repository.write(savedDesigns)
        recordInteraction('state.design.renamed', {
          view: state.view,
          selectedId: state.selectedId,
          details: { id },
        })
        set({ savedDesigns, notice: 'Nombre del diseño actualizado.' })
      } catch (error) {
        failDiagnosticAction('storage.rename-failed')
        set({ notice: writeFailureNotice(error, 'No se pudo cambiar el nombre del diseño.') })
      }
    },
    saveDesign: () => {
      const state = get()
      const activeDesign = state.savedDesigns.find((design) => design.id === state.selectedSavedDesignId)
      if (!activeDesign && state.savedDesigns.length >= MAX_SAVED_DESIGNS) {
        return set({ notice: 'Ya hay 5 diseños guardados. Elimina uno antes de guardar otro.' })
      }
      const data = persistedDesign(state)
      const savedAt = new Date().toISOString()
      const savedDesign: SavedDesign = activeDesign
        ? { ...activeDesign, savedAt, data }
        : {
          id: makeId('design'),
          name: `Diseño ${state.savedDesigns.length + 1}`,
          savedAt,
          data,
        }
      const savedDesigns = activeDesign
        ? state.savedDesigns.map((design) => design.id === activeDesign.id ? savedDesign : design)
        : [...state.savedDesigns, savedDesign]
      try {
        repository.write(savedDesigns)
        recordInteraction(activeDesign ? 'state.design.updated' : 'state.design.saved', {
          view: state.view,
          selectedId: state.selectedId,
          details: { id: savedDesign.id },
        })
        set({
          savedDesigns,
          selectedSavedDesignId: savedDesign.id,
          hasUnsavedChanges: false,
          notice: activeDesign ? 'Cambios guardados en el diseño actual.' : 'Diseño guardado en este navegador.',
        })
      } catch (error) {
        failDiagnosticAction('storage.save-failed')
        set({ notice: writeFailureNotice(error, 'No se pudo acceder al almacenamiento local.') })
      }
    },
    importDesign: (design) => {
      const state = get()
      if (state.savedDesigns.length >= MAX_SAVED_DESIGNS) return 'Ya hay 5 diseños guardados. Elimina uno antes de importar otro.'
      const ids = new Set(state.savedDesigns.map((entry) => entry.id))
      let id = design.id
      while (ids.has(id)) id = makeId('design')
      const imported = { ...structuredClone(design), id }
      const savedDesigns = [...state.savedDesigns, imported]
      try {
        repository.write(savedDesigns)
        set({ savedDesigns, notice: `Diseño «${imported.name}» importado.` })
        recordInteraction('state.design.imported', { view: state.view, selectedId: state.selectedId, details: { id } })
        return null
      } catch (error) {
        failDiagnosticAction('storage.import-failed')
        return writeFailureNotice(error, 'No se pudo guardar el diseño importado en este navegador.')
      }
    },
    loadDesign: (id) => {
      try {
        const current = get()
        const saved = current.savedDesigns.find((design) => design.id === (id ?? current.selectedSavedDesignId))
        if (!saved) return set({ notice: 'Selecciona un diseño guardado para recuperarlo.' })
        const data = normalizeDesign(saved.data)
        recordInteraction('state.design.loaded', {
          view: current.view,
          selectedId: current.selectedId,
          details: { id: saved.id },
        })
        set({
          ...data,
          structurePacks: data.structurePacks ?? [],
          selectedSavedDesignId: saved.id,
          ...normalizeDesignPreferences(data),
          selectedId: null,
          hasUnsavedChanges: false,
          notice: 'Diseño recuperado.',
        })
      } catch (error) {
        failDiagnosticAction('design.load-failed')
        const detail = error instanceof Error && error.message.includes('no coincide') ? ` ${error.message}` : ''
        set({ notice: `El diseño guardado no es válido.${detail}` })
      }
    },
  }
}
