import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { EditorHeaderState } from '../../state/selectors'
import { useRoomStore } from '../../state/useRoomStore'
import { persistedDesign } from '../../domain/designV1'
import { makeId } from '../../domain/elementIds'
import { cleanExportReferences, DESIGN_FILE_MAX_BYTES, parseDesignFile, serializeDesignFile, type DesignFilePreview } from '../../persistence/designFile'
import { DesignModal } from './DesignModal'
import { diagnostics } from '../../diagnostics/engine'

type ContextMenu = { x: number; y: number; designId: string | null }
type PendingDiscard = { kind: 'load'; id: string } | { kind: 'create'; name: string }

export function SavedDesignsMenu({ state, exportMode, onExport }: { state: EditorHeaderState; exportMode: boolean; onExport: () => void }) {
  const [savedDesignsOpen, setSavedDesignsOpen] = useState(false)
  const [createDesignOpen, setCreateDesignOpen] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')
  const [renamingDesignId, setRenamingDesignId] = useState<string | null>(null)
  const [renamingDesignName, setRenamingDesignName] = useState('')
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const [pendingDiscard, setPendingDiscard] = useState<PendingDiscard | null>(null)
  const [preview, setPreview] = useState<DesignFilePreview | null>(null)
  const [fileError, setFileError] = useState('')
  const [fileNotice, setFileNotice] = useState('')
  const [readingFile, setReadingFile] = useState(false)
  const [context, setContext] = useState<ContextMenu | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const savedDesignsRef = useRef<HTMLDivElement>(null)
  const savedDesignTriggerRef = useRef<HTMLButtonElement>(null)
  const contextRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const currentDesign = state.savedDesigns.find((design) => design.id === state.selectedSavedDesignId)
  const contextDesign = context?.designId ? state.savedDesigns.find((design) => design.id === context.designId) : undefined
  const isCurrent = !context?.designId || context.designId === state.selectedSavedDesignId

  useEffect(() => {
    if (!savedDesignsOpen && !context) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!contextRef.current?.contains(event.target) && !moreRef.current?.contains(event.target)) setContext(null)
      if (!savedDesignsRef.current?.contains(event.target) && !contextRef.current?.contains(event.target)) setSavedDesignsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (context) { event.preventDefault(); setContext(null); moreRef.current?.focus(); return }
      if (savedDesignsOpen) { setSavedDesignsOpen(false); savedDesignTriggerRef.current?.focus() }
    }
    window.addEventListener('pointerdown', closeOnOutsideClick, true)
    window.addEventListener('keydown', closeOnEscape)
    return () => { window.removeEventListener('pointerdown', closeOnOutsideClick, true); window.removeEventListener('keydown', closeOnEscape) }
  }, [savedDesignsOpen, context])
  useEffect(() => { if (context) contextRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus() }, [context])
  useEffect(() => {
    if (!state.hasUnsavedChanges) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [state.hasUnsavedChanges])

  const openContext = (x: number, y: number, designId: string | null) => {
    setContext({ x: Math.max(8, Math.min(x, window.innerWidth - 246)), y: Math.max(8, Math.min(y, window.innerHeight - 320)), designId })
  }
  const showError = (message: string) => { setFileNotice(''); setFileError(message); setSavedDesignsOpen(true) }
  const loadSavedDesign = (id: string) => {
    // Seleccionar el diseño que ya está abierto no debe descartar su edición.
    if (id === useRoomStore.getState().selectedSavedDesignId) {
      setSavedDesignsOpen(false)
      savedDesignTriggerRef.current?.focus()
      return
    }
    if (useRoomStore.getState().hasUnsavedChanges) {
      setSavedDesignsOpen(false)
      setPendingDiscard({ kind: 'load', id })
      return
    }
    state.loadDesign(id)
    setSavedDesignsOpen(false)
    savedDesignTriggerRef.current?.focus()
  }
  const createBlankDesign = () => {
    if (!newDesignName.trim()) { showError('Introduce un nombre para crear el diseño.'); return }
    if (useRoomStore.getState().hasUnsavedChanges) {
      setSavedDesignsOpen(false)
      setPendingDiscard({ kind: 'create', name: newDesignName.trim() })
      return
    }
    state.createDesign('blank', newDesignName)
    setCreateDesignOpen(false)
    setNewDesignName('')
  }
  const confirmDiscard = () => {
    if (!pendingDiscard) return
    const current = useRoomStore.getState()
    if (pendingDiscard.kind === 'load') current.loadDesign(pendingDiscard.id)
    else {
      current.createDesign('blank', pendingDiscard.name)
      setCreateDesignOpen(false)
      setNewDesignName('')
    }
    setPendingDiscard(null)
    savedDesignTriggerRef.current?.focus()
  }
  const exportDesign = (designId: string | null) => {
    const operationId = diagnostics.nextOperation()
    diagnostics.emit({ action: 'design.export-json', operationId, phase: 'started' })
    try {
      const current = useRoomStore.getState()
      const saved = current.savedDesigns.find((entry) => entry.id === designId)
      const now = new Date().toISOString()
      const name = saved?.name ?? 'Mi diseño'
      const source = !designId || designId === current.selectedSavedDesignId ? persistedDesign(current) : saved?.data
      if (!source) throw new Error('El diseño seleccionado ya no existe.')
      const { data, omitted } = cleanExportReferences(source)
      const contents = serializeDesignFile({ id: saved?.id ?? makeId('design'), name, savedAt: saved?.savedAt ?? now, data })
      if (new TextEncoder().encode(contents).length > DESIGN_FILE_MAX_BYTES) throw new Error('El diseño supera el límite de 2 MB.')
      parseDesignFile(contents)
      // Fallback limitado para navegadores que no exponen URL.createObjectURL.
      // Evitar data URLs enormes: podrían fallar sin avisar o saturar el navegador.
      const objectUrl = typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(new Blob([contents], { type: 'application/json;charset=utf-8' }))
        : null
      if (!objectUrl && contents.length > 128 * 1024) throw new Error('Este navegador no permite descargar archivos JSON grandes.')
      const link = document.createElement('a')
      link.href = objectUrl ?? `data:application/json;charset=utf-8,${encodeURIComponent(contents)}`
      link.download = `${name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim().slice(0, 80) || 'diseno'}-${now.slice(0, 10)}.json`
      try { document.body.appendChild(link); link.click() }
      finally {
        link.remove()
        if (objectUrl && typeof URL.revokeObjectURL === 'function') window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      }
      setFileError('')
      setFileNotice(omitted ? `Descarga solicitada. Se omitieron ${omitted} referencias obsoletas o duplicadas.` : 'Descarga solicitada.')
      setSavedDesignsOpen(true)
      diagnostics.emit({ action: 'design.export-json', operationId, result: 'completed', data: { downloadRequested: true, omittedReferences: omitted } })
    } catch (error) { diagnostics.emit({ action: 'design.export-json', operationId, category: 'errors', level: 'error', result: 'failed', data: { reason: 'export-failed' } }); showError(error instanceof Error ? error.message : 'No se pudo exportar el diseño.') }
  }
  const readDesign = async (file: File | undefined) => {
    setPreview(null); setFileError(''); setFileNotice('')
    if (!file) return
    const operationId = diagnostics.nextOperation()
    diagnostics.emit({ action: 'design.read-json', operationId, phase: 'started' })
    if (file.size > DESIGN_FILE_MAX_BYTES) { diagnostics.emit({ action: 'design.read-json', operationId, level: 'warn', result: 'rejected', data: { reason: 'file-size-limit' } }); showError('El archivo supera el límite de 2 MB.'); return }
    setReadingFile(true)
    try { const next = parseDesignFile(await file.text()); setSavedDesignsOpen(false); setPreview(next); diagnostics.emit({ action: 'design.read-json', operationId, result: 'completed', data: { validated: true, sourceVersion: next.sourceVersion } }) }
    catch (error) { diagnostics.emit({ action: 'design.read-json', operationId, category: 'errors', level: 'warn', result: 'rejected', data: { reason: 'read-or-validation-failed' } }); showError(error instanceof Error ? error.message : 'No se pudo leer el archivo.') }
    finally { setReadingFile(false) }
  }
  const copyDesign = (designId: string | null) => {
    const current = useRoomStore.getState()
    const saved = current.savedDesigns.find((entry) => entry.id === designId)
    const data = !designId || designId === current.selectedSavedDesignId ? persistedDesign(current) : saved?.data
    if (!data) { showError('El diseño seleccionado ya no existe.'); return }
    const error = current.importDesign({ id: makeId('design'), name: `Copia de ${saved?.name ?? 'Mi diseño'}`.slice(0, 48), savedAt: new Date().toISOString(), data })
    if (error) showError(error)
    else { setFileError(''); setFileNotice('Copia creada en la biblioteca.'); setSavedDesignsOpen(true) }
  }
  const contextKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setContext(null); moreRef.current?.focus(); return }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    const active = buttons.indexOf(document.activeElement as HTMLButtonElement)
    buttons[(active + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
  }
  const designListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    if (!buttons.length) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : event.key === 'ArrowDown' ? (index + 1) % buttons.length : (index < 0 ? 0 : index + buttons.length - 1) % buttons.length
    buttons[next]?.focus()
  }
  const onContext = (event: ReactMouseEvent, designId: string | null) => { event.preventDefault(); event.stopPropagation(); openContext(event.clientX, event.clientY, designId) }
  const act = (action: () => void) => { setContext(null); action() }

  return <>
    <div className="saved-design-select" ref={savedDesignsRef} onContextMenu={(event) => onContext(event, state.selectedSavedDesignId || null)}>
      <div className="saved-design-selector-row">
        <button type="button" className="saved-design-trigger" ref={savedDesignTriggerRef} aria-label="Seleccionar diseño guardado" aria-expanded={savedDesignsOpen} aria-haspopup="dialog" aria-controls="saved-designs-popup" onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          event.preventDefault()
          setContext(null)
          setSavedDesignsOpen(true)
          window.requestAnimationFrame(() => {
            const buttons = Array.from(savedDesignsRef.current?.querySelectorAll<HTMLButtonElement>('.saved-design-menu button:not(:disabled)') ?? [])
            if (event.key === 'ArrowUp') buttons[buttons.length - 1]?.focus()
            else buttons[0]?.focus()
          })
        }} onClick={() => { setContext(null); setSavedDesignsOpen((open) => !open) }}>
          <span>{currentDesign?.name ?? `Diseños (${state.savedDesigns.length}/5)`}</span><span aria-hidden="true">▾</span>
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void readDesign(file) }} />
      {savedDesignsOpen && <div id="saved-designs-popup" className="saved-design-menu" role="dialog" aria-label="Diseños guardados" onKeyDown={designListKeyDown}>
        <p className="saved-design-menu__heading">Mis diseños <span>{state.savedDesigns.length}/5</span></p>
        {state.savedDesigns.length === 0 && !createDesignOpen && <p className="saved-design-empty">Aún no hay diseños guardados.</p>}
        {state.savedDesigns.map((design) => <div className="saved-design-item" key={design.id} onContextMenu={(event) => onContext(event, design.id)}>
          {renamingDesignId === design.id ? <div className="saved-design-rename">
            <input autoFocus aria-label={`Nuevo nombre para ${design.name}`} maxLength={48} value={renamingDesignName} onChange={(event) => setRenamingDesignName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { state.renameSavedDesign(design.id, renamingDesignName); setRenamingDesignId(null) } else if (event.key === 'Escape') { event.stopPropagation(); setRenamingDesignId(null) } }} />
            <button type="button" className="saved-design-action" aria-label="Guardar nombre" onClick={() => { state.renameSavedDesign(design.id, renamingDesignName); setRenamingDesignId(null) }}>✓</button>
          </div> : <>
            <button type="button" className={`saved-design-choice${state.selectedSavedDesignId === design.id ? ' active' : ''}`} aria-label={design.name} onClick={() => loadSavedDesign(design.id)}><span className="saved-design-name">{design.name}</span>{state.selectedSavedDesignId === design.id && <span className="saved-design-current">Actual</span>}</button>
            <button type="button" className="saved-design-action" aria-label={`Más opciones de ${design.name}`} aria-haspopup="menu" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); openContext(rect.left, rect.bottom + 5, design.id) }}>⋯</button>
          </>}
        </div>)}
        <div className="saved-design-quick-actions">
          <button type="button" className="saved-design-create-trigger" disabled={state.savedDesigns.length >= 5} onClick={() => { setNewDesignName(''); setCreateDesignOpen(true); setRenamingDesignId(null) }}>＋ Crear diseño</button>
          <button type="button" className="saved-design-create-trigger" disabled={readingFile || state.savedDesigns.length >= 5} onClick={() => fileInputRef.current?.click()}>⇧ Importar diseño</button>
        </div>
        {createDesignOpen && <div className="saved-design-create">
          <label><span>Nombre del diseño</span><input autoFocus maxLength={48} value={newDesignName} onChange={(event) => setNewDesignName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setCreateDesignOpen(false) } }} placeholder="Mi diseño" /></label>
          <button type="button" className="saved-design-create-action" disabled={state.savedDesigns.length >= 5} onClick={createBlankDesign}>Crear en blanco</button>
          <button type="button" className="saved-design-cancel" onClick={() => setCreateDesignOpen(false)}>Cancelar</button>
        </div>}
        <details className="saved-design-help"><summary>¿Dónde se guardan los diseños?</summary><p>Se guardan en este navegador, no en cookies, y no caducan automáticamente. Se borran si los eliminas aquí o borras los datos del sitio; en navegación privada, al cerrar la sesión privada.</p></details>
        {state.savedDesigns.length >= 5 && <p className="saved-design-info">La biblioteca está llena. Elimina un diseño para importar o crear otro.</p>}
        {readingFile && <p role="status">Leyendo archivo…</p>}
        {fileNotice && <p className="saved-design-info" role="status">{fileNotice}</p>}
        {fileError && <p className="design-file-error" role="alert">{fileError}</p>}
      </div>}
    </div>
    {context && createPortal(<div ref={contextRef} className="scene-context-menu design-context-menu" role="menu" aria-label="Opciones del diseño" style={{ left: context.x, top: context.y }} onContextMenu={(event) => event.preventDefault()} onKeyDown={contextKeyDown}>
      <button role="menuitem" type="button" disabled={!isCurrent || exportMode} title={!isCurrent ? 'Abre el diseño para descargarlo en 3D' : undefined} onClick={() => act(onExport)}><span>Descargar 3D</span><small>GLB</small></button>
      <button role="menuitem" type="button" onClick={() => act(() => exportDesign(context.designId))}><span>Exportar diseño</span><small>JSON</small></button>
      <button role="menuitem" type="button" disabled={state.savedDesigns.length >= 5} onClick={() => act(() => copyDesign(context.designId))}><span>Copiar diseño</span></button>
      <button role="menuitem" type="button" disabled={!contextDesign} onClick={() => act(() => { if (!contextDesign) return; setSavedDesignsOpen(true); setCreateDesignOpen(false); setRenamingDesignId(contextDesign.id); setRenamingDesignName(contextDesign.name) })}><span>Renombrar</span></button>
      <button role="menuitem" type="button" disabled={!contextDesign} onClick={() => act(() => { if (!contextDesign) return; setSavedDesignsOpen(false); setPendingDelete({ id: contextDesign.id, name: contextDesign.name }) })}><span>Borrar</span></button>
    </div>, document.body)}
    {pendingDelete && <DesignModal titleId="delete-design-title" descriptionId="delete-design-copy" onClose={() => setPendingDelete(null)}>
      <h2 id="delete-design-title">¿Eliminar «{pendingDelete.name}»?</h2>
      <p id="delete-design-copy">Se borrará de este navegador y no se puede deshacer.</p>
      {state.hasUnsavedChanges && state.selectedSavedDesignId === pendingDelete.id && <p>También se perderán los cambios sin guardar del diseño abierto.</p>}
      <div className="design-modal-actions"><button type="button" data-modal-initial onClick={() => setPendingDelete(null)}>Cancelar</button><button type="button" className="design-modal-danger" onClick={(event) => { event.stopPropagation(); state.deleteSavedDesign(pendingDelete.id); setPendingDelete(null) }}>Eliminar diseño</button></div>
    </DesignModal>}
    {pendingDiscard && <DesignModal titleId="discard-design-title" descriptionId="discard-design-copy" onClose={() => { setPendingDiscard(null); setSavedDesignsOpen(true) }}>
      <h2 id="discard-design-title">¿Descartar los cambios sin guardar?</h2>
      <p id="discard-design-copy">Los cambios de la habitación actual se perderán al {pendingDiscard.kind === 'load' ? 'abrir otro diseño' : 'crear un diseño en blanco'}. Puedes cancelar y guardar o exportar el diseño actual.</p>
      <div className="design-modal-actions">
        <button type="button" data-modal-initial onClick={() => { setPendingDiscard(null); setSavedDesignsOpen(true) }}>Cancelar</button>
        <button type="button" className="design-modal-danger" onClick={confirmDiscard}>Descartar y continuar</button>
      </div>
    </DesignModal>}
    {preview && <DesignModal titleId="import-design-title" descriptionId="import-design-copy" onClose={() => { setPreview(null); setFileError('') }}>
      <h2 id="import-design-title">Importar «{preview.design.name}»</h2>
      <p id="import-design-copy">{preview.design.data.room.width} × {preview.design.data.room.depth} × {preview.design.data.room.height} m · {preview.design.data.furniture.length} muebles · versión {preview.sourceVersion}</p>
      {preview.removedVariants > 0 && <p>Se importará la distribución activa. Las {preview.removedVariants} variantes restantes no se conservarán.</p>}
      {state.savedDesigns.some((entry) => entry.id === preview.design.id) && <p>Ya existe este diseño: se importará como copia independiente.</p>}
      {fileError && <p className="design-file-error" role="alert">{fileError}</p>}
      <div className="design-modal-actions"><button type="button" data-modal-initial onClick={() => { setPreview(null); setFileError('') }}>Cancelar</button><button type="button" className="design-modal-primary" onClick={(event) => { event.stopPropagation(); const error = useRoomStore.getState().importDesign(preview.design); if (error) setFileError(error); else { setPreview(null); setFileError(''); setFileNotice('Diseño importado.'); setSavedDesignsOpen(true) } }}>Confirmar importación</button></div>
    </DesignModal>}
  </>
}
