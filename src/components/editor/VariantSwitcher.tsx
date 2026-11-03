import { useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useRoomStore } from '../../state/useRoomStore'

export function VariantSwitcher() {
  const state = useRoomStore(useShallow((value) => ({
    layouts: value.layouts, activeLayoutId: value.activeLayoutId,
    activateLayout: value.activateLayout, duplicateActiveLayout: value.duplicateActiveLayout,
    renameLayout: value.renameLayout, deleteAlternativeLayout: value.deleteAlternativeLayout,
  })))
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const originalButton = useRef<HTMLButtonElement>(null)
  const active = state.layouts.find((layout) => layout.id === state.activeLayoutId)!
  const alternative = state.layouts.find((layout) => layout.kind === 'alternative')
  return (
    <section className="panel-section variant-section" aria-label="Comparar distribuciones">
      <span className="eyebrow">Distribuciones</span>
      <div className="variant-switcher" role="group" aria-label="Distribución activa">
        {state.layouts.map((layout) => (
          <button type="button" key={layout.id} ref={layout.kind === 'original' ? originalButton : undefined}
            aria-pressed={layout.id === state.activeLayoutId} onClick={() => { state.activateLayout(layout.id); setRenaming(null) }}>
            {layout.name}
          </button>
        ))}
      </div>
      <p className="variant-hint">La habitación y las aperturas son comunes a las dos variantes.</p>
      <div className="variant-actions">
        <button type="button" disabled={!!alternative} onClick={state.duplicateActiveLayout}>Duplicar como alternativa</button>
        <button type="button" onClick={() => setRenaming({ id: active.id, name: active.name })}>Renombrar variante</button>
        <button type="button" disabled={!alternative} onClick={() => {
          if (alternative && window.confirm(`¿Eliminar «${alternative.name}»? Original se conservará. Puedes deshacer esta acción.`)) {
            state.deleteAlternativeLayout(alternative.id)
            setRenaming(null)
            originalButton.current?.focus()
          }
        }}>Eliminar alternativa</button>
      </div>
      {renaming && (
        <form className="variant-rename" onSubmit={(event) => {
          event.preventDefault()
          if (!renaming.name.trim()) return
          state.renameLayout(renaming.id, renaming.name)
          setRenaming(null)
        }}>
          <label>Nombre de la variante
            <input autoFocus value={renaming.name} onChange={(event) => setRenaming({ ...renaming, name: event.target.value })}
              onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setRenaming(null) } }} />
          </label>
          <button type="submit" disabled={!renaming.name.trim()}>Guardar nombre de variante</button>
          <button type="button" onClick={() => setRenaming(null)}>Cancelar</button>
        </form>
      )}
    </section>
  )
}
