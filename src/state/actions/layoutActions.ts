import { duplicateLayout, removeLayout, renameLayout, switchLayout } from '../../domain/designLayouts'
import { makeId, structureGridElementId } from '../../domain/elementIds'
import { orderedSceneIds } from '../../domain/elementFolders'
import { finishHistoryTransaction } from '../historyTransactions'
import type { RoomActionContext, RoomState } from '../types'

function selectionFor(state: RoomState, next: ReturnType<typeof switchLayout>) {
  const available = new Set(orderedSceneIds({ ...state, furniture: next.furniture }))
  const selectedIds = state.selectedIds.filter((id) => available.has(id))
  return {
    selectedIds,
    selectedId: selectedIds.length === 1 ? selectedIds[0] : null,
    selectionAnchor: selectedIds.length ? state.selectionAnchor && available.has(state.selectionAnchor) ? state.selectionAnchor : selectedIds[0] : null,
  }
}

export function createLayoutActions({ set, get, runtime }: RoomActionContext): Pick<RoomState, 'duplicateActiveLayout' | 'activateLayout' | 'renameLayout' | 'deleteAlternativeLayout'> {
  const apply = (operation: (state: RoomState) => Partial<RoomState>) => {
    finishHistoryTransaction(runtime)
    try { set(operation(get())) }
    catch (error) { set({ notice: error instanceof Error ? error.message : 'No se pudo cambiar la variante.' }) }
  }
  return {
    duplicateActiveLayout: () => apply((state) => {
      if (state.layouts.some((layout) => layout.kind === 'alternative')) return { notice: 'Ya existe una alternativa.' }
      const next = duplicateLayout(state, makeId('layout'))
      return { ...next, ...selectionFor(state, next), notice: 'Alternativa A creada. Puedes reorganizar sus muebles.' }
    }),
    activateLayout: (id) => {
      if (get().activeLayoutId === id) return
      apply((state) => {
        const next = switchLayout(state, id)
        return { ...next, ...selectionFor(state, next), notice: `Variante «${next.layouts.find((layout) => layout.id === id)!.name}» activa.` }
      })
    },
    renameLayout: (id, name) => apply((state) => ({ ...renameLayout(state, id, name), notice: 'Nombre de variante actualizado.' })),
    // La confirmación destructiva corresponde a la UI; la operación sigue siendo deshacible.
    deleteAlternativeLayout: (id) => apply((state) => {
      const next = removeLayout(state, id)
      const furniture = next.layouts.flatMap((layout) => layout.furniture)
      const available = new Set(orderedSceneIds({ ...state, furniture }))
      for (const pack of state.structurePacks) for (const surface of pack.surfaces) available.add(structureGridElementId(pack.id, surface.id))
      return {
        ...next, ...selectionFor(state, next),
        hiddenElementIds: state.hiddenElementIds.filter((elementId) => available.has(elementId)),
        lockedElementIds: state.lockedElementIds.filter((elementId) => available.has(elementId)),
        sceneElementOrder: state.sceneElementOrder.filter((elementId) => available.has(elementId)),
        elementFolderAssignments: Object.fromEntries(Object.entries(state.elementFolderAssignments).filter(([elementId]) => available.has(elementId))),
        notice: 'Alternativa eliminada. Original está activa.',
      }
    }),
  }
}
