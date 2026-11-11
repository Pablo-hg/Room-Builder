import { useRoomStore } from '../../state/useRoomStore'
import { useShallow } from 'zustand/react/shallow'
import { selectEditorHeader } from '../../state/selectors'
import { VIEW_OPTIONS } from './viewOptions'
import { SavedDesignsMenu } from './SavedDesignsMenu'

export function EditorHeader({ exportMode, onExport }: {
  exportMode: boolean
  onExport: () => void
}) {
  const state = useRoomStore(useShallow(selectEditorHeader))
  return (
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Room Builder, ir al editor">
          <span className="brand-mark"><i /><i /></span>
          <span><strong>Room Builder</strong><small>Make a space feel yours</small></span>
          <b>V0.1</b>
        </a>
        <nav className="view-switcher" aria-label="Cambiar vista">
          <span className="view-switcher__heading" aria-hidden="true">Ver</span>
          {VIEW_OPTIONS.map((option) => (
            <button type="button" key={option.id} className={state.view === option.id ? 'active' : ''} onClick={() => state.setView(option.id)} aria-pressed={state.view === option.id}>
              <span aria-hidden="true">{option.icon}</span>{option.label}
            </button>
          ))}
        </nav>
        <div className="save-actions">
          <button
            type="button"
            className="secondary-button undo-button"
            onClick={state.undo}
            disabled={state.undoCount === 0}
            aria-label="Deshacer el último cambio"
            title="Deshacer el último cambio (Ctrl/⌘+Z)"
          >
            ↶ <span>Deshacer</span>
          </button>
          <button
            type="button"
            className="secondary-button undo-button"
            onClick={state.redo}
            disabled={state.redoCount === 0}
            aria-label="Rehacer el último cambio deshecho"
            title="Rehacer el último cambio deshecho (Ctrl/⌘+Shift+Z)"
          >
            ↷ <span>Rehacer</span>
          </button>
          <span className={`save-state${state.hasUnsavedChanges ? ' save-state--dirty' : ''}`} aria-live="polite">
            {state.hasUnsavedChanges ? 'Cambios sin guardar' : state.selectedSavedDesignId ? 'Guardado' : 'Sin guardar'}
          </span>
          <SavedDesignsMenu state={state} exportMode={exportMode} onExport={onExport} />
          <button type="button" className="primary-button" aria-label={state.selectedSavedDesignId ? 'Guardar cambios' : 'Guardar como'} aria-keyshortcuts="Control+G Meta+G" title="Guardar (Ctrl/⌘+G)" onClick={state.saveDesign}>
            ✓ <span>{state.selectedSavedDesignId ? 'Guardar cambios' : 'Guardar como'}</span>
          </button>
        </div>
      </header>
  )
}
