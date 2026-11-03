import { MAX_SAVED_DESIGNS } from '../../persistence/localDesignRepository'
import { migrateDesignLayouts, normalizeDesignLayouts } from '../../persistence/designMigrations'
import { initialRoomFolder } from '../../domain/elementFolders'
import { DEFAULT_ROOM } from '../../domain/constants'
import { DEFAULT_GRID_VISIBILITY, persistedDesign, type SavedDesign } from '../../domain/designV1'
import { normalizeDesignPreferences } from '../../domain/normalizeDesignV1'
import { makeId } from '../../domain/elementIds'
import type { PersistedDesign } from '../../domain/types'
import { recordInteraction } from '../../debug/interactionLog'
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
  | 'loadDesign'
>

export function createDesignActions(context: Pick<RoomActionContext, 'set' | 'get' | 'repository'>): DesignActions {
  const { set, get, repository } = context
  return {
    initializeSavedDesigns: () => {
      try {
        const savedDesigns = repository.read()
        set({ savedDesigns, selectedSavedDesignId: '' })
      } catch (error) {
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
      try {
        repository.write(savedDesigns)
        recordInteraction('state.design.deleted', {
          view: state.view,
          selectedId: state.selectedId,
          details: { id: designId },
        })
        set({
          savedDesigns,
          selectedSavedDesignId: state.selectedSavedDesignId === designId ? '' : state.selectedSavedDesignId,
          hasUnsavedChanges: state.selectedSavedDesignId === designId || state.hasUnsavedChanges,
          notice: 'Diseño guardado eliminado.',
        })
      } catch {
        set({ notice: 'No se pudo eliminar el diseño guardado.' })
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
        : migrateDesignLayouts({
          version: 1,
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
          ...migrateDesignLayouts(data),
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
      } catch {
        set({ notice: 'No se pudo crear el diseño en el almacenamiento local.' })
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
      } catch {
        set({ notice: 'No se pudo cambiar el nombre del diseño.' })
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
      } catch {
        set({ notice: 'No se pudo acceder al almacenamiento local.' })
      }
    },
    loadDesign: (id) => {
      try {
        const current = get()
        const saved = current.savedDesigns.find((design) => design.id === (id ?? current.selectedSavedDesignId))
        if (!saved) return set({ notice: 'Selecciona un diseño guardado para recuperarlo.' })
        const data = normalizeDesignLayouts(saved.data)
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
        const detail = error instanceof Error && error.message.includes('no coincide') ? ` ${error.message}` : ''
        set({ notice: `El diseño guardado no es válido.${detail}` })
      }
    },
  }
}
