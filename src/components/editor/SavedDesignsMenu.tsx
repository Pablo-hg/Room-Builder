import { useEffect, useRef, useState } from 'react'
import type { EditorHeaderState } from '../../state/selectors'

export function SavedDesignsMenu({ state }: { state: EditorHeaderState }) {
  const [savedDesignsOpen, setSavedDesignsOpen] = useState(false)
  const [createDesignOpen, setCreateDesignOpen] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')
  const [renamingDesignId, setRenamingDesignId] = useState<string | null>(null)
  const [renamingDesignName, setRenamingDesignName] = useState('')
  const savedDesignsRef = useRef<HTMLDivElement>(null)
  const savedDesignTriggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!savedDesignsOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !savedDesignsRef.current?.contains(event.target)) {
        setSavedDesignsOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSavedDesignsOpen(false)
        savedDesignTriggerRef.current?.focus()
      }
    }
    window.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [savedDesignsOpen])

  const createDesign = (mode: 'blank' | 'copy') => {
    if (!newDesignName.trim()) {
      state.createDesign(mode, '')
      return
    }
    state.createDesign(mode, newDesignName)
    setCreateDesignOpen(false)
    setNewDesignName('')
  }

  return (
          <div className="saved-design-select" ref={savedDesignsRef}>
            <button
              type="button"
              className="saved-design-trigger"
              ref={savedDesignTriggerRef}
              aria-label="Seleccionar diseño guardado"
              aria-expanded={savedDesignsOpen}
              aria-haspopup="dialog"
              aria-controls="saved-designs-popup"
              onClick={() => setSavedDesignsOpen((open) => !open)}
            >
              <span>{state.savedDesigns.find((design) => design.id === state.selectedSavedDesignId)?.name ?? `Diseños (${state.savedDesigns.length}/5)`}</span>
              <span aria-hidden="true">▾</span>
            </button>
            {savedDesignsOpen && (
              <div id="saved-designs-popup" className="saved-design-menu" role="dialog" aria-label="Diseños guardados">
                {state.savedDesigns.length === 0 && !createDesignOpen && (
                  <p className="saved-design-empty">Aún no hay diseños guardados.</p>
                )}
                {state.savedDesigns.map((design) => (
                  <div className="saved-design-item" key={design.id}>
                    {renamingDesignId === design.id ? (
                      <div className="saved-design-rename">
                        <input
                          autoFocus
                          aria-label={`Nuevo nombre para ${design.name}`}
                          maxLength={48}
                          value={renamingDesignName}
                          onChange={(event) => setRenamingDesignName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              state.renameSavedDesign(design.id, renamingDesignName)
                              setRenamingDesignId(null)
                            }
                            if (event.key === 'Escape') setRenamingDesignId(null)
                          }}
                        />
                        <button
                          type="button"
                          className="saved-design-action"
                          aria-label="Guardar nombre"
                          onClick={() => {
                            state.renameSavedDesign(design.id, renamingDesignName)
                            setRenamingDesignId(null)
                          }}
                        >✓</button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`saved-design-choice${state.selectedSavedDesignId === design.id ? ' active' : ''}`}
                          onClick={() => {
                            state.loadDesign(design.id)
                            setSavedDesignsOpen(false)
                            savedDesignTriggerRef.current?.focus()
                          }}
                        >
                          <span className="saved-design-name">{design.name}</span>
                          {state.selectedSavedDesignId === design.id && <span className="saved-design-current">Actual</span>}
                        </button>
                        <button
                          type="button"
                          className="saved-design-action saved-design-action--rename"
                          aria-label={`Cambiar nombre de ${design.name}`}
                          title={`Cambiar nombre de ${design.name}`}
                          onClick={() => {
                            setRenamingDesignId(design.id)
                            setRenamingDesignName(design.name)
                          }}
                        >
                          ✎
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="saved-design-action"
                      aria-label={`Eliminar ${design.name}`}
                      title={`Eliminar ${design.name}`}
                      onClick={() => state.deleteSavedDesign(design.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {createDesignOpen ? (
                  <div className="saved-design-create">
                    <label>
                      <span>Nombre del diseño</span>
                      <input
                        autoFocus
                        maxLength={48}
                        value={newDesignName}
                        onChange={(event) => setNewDesignName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') setCreateDesignOpen(false)
                        }}
                        placeholder="Mi diseño"
                      />
                    </label>
                    <div>
                      <button
                        type="button"
                        className="saved-design-create-action"
                        disabled={state.savedDesigns.length >= 5}
                        onClick={() => createDesign('blank')}
                      >Lienzo en blanco</button>
                      <button
                        type="button"
                        className="saved-design-create-action"
                        disabled={state.savedDesigns.length >= 5}
                        onClick={() => createDesign('copy')}
                      >Copiar diseño actual</button>
                    </div>
                    <button type="button" className="saved-design-cancel" onClick={() => setCreateDesignOpen(false)}>Cancelar</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="saved-design-create-trigger"
                    disabled={state.savedDesigns.length >= 5}
                    onClick={() => {
                      setNewDesignName('')
                      setCreateDesignOpen(true)
                      setRenamingDesignId(null)
                    }}
                  >＋ Crear diseño</button>
                )}
                <p className="saved-design-info">
                  Se guardan en este navegador, no en cookies, y no caducan automáticamente. Se borran si los eliminas aquí o borras los datos del sitio; en navegación privada, al cerrar la sesión privada.
                </p>
              </div>
            )}
          </div>
  )
}
