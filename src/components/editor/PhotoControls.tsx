import { useEffect, useRef, useState, type RefObject } from 'react'
import { persistedDesign } from '../../domain/designV1'
import { cleanExportReferences, serializeDesignFile } from '../../persistence/designFile'
import { createPhotoPackage, downloadPhotoFile, photoGuide } from '../../persistence/photoPackage'
import type { PhotoCapture } from '../../scene/PhotoCapture'
import { planScreenRight, planScreenUp } from '../../scene/planSheet'
import type { PhotoResolution } from '../../scene/photoResolution'
import { selectActiveDesignName } from '../../state/selectors'
import { useRoomStore } from '../../state/useRoomStore'
import { VIEW_OPTIONS } from './viewOptions'
import { ZoomControl } from './ZoomControl'

export const PHOTO_RATIOS = { '4:3': 4 / 3, '16:9': 16 / 9, '1:1': 1, '9:16': 9 / 16 }
export const PHOTO_VIEWS = VIEW_OPTIONS.filter(({ id }) => id === 'top' || id === 'isometric' || id === 'pov')

export type PhotoSettings = {
  ratio: keyof typeof PHOTO_RATIOS
  longSide: number
  background: string
  annotations: boolean
}

export function photoResolution({ ratio, longSide }: PhotoSettings): PhotoResolution {
  const aspect = PHOTO_RATIOS[ratio]
  return aspect >= 1
    ? { width: longSide, height: Math.round(longSide / aspect) }
    : { width: Math.round(longSide * aspect), height: longSide }
}

export function PhotoControls({ settings, onSettings, captureRef, exportName, onClose }: {
  settings: PhotoSettings
  onSettings: (settings: PhotoSettings) => void
  captureRef: RefObject<PhotoCapture | null>
  exportName: string
  onClose: () => void
}) {
  const view = useRoomStore((state) => state.view)
  const setView = useRoomStore((state) => state.setView)
  const closeButton = useRef<HTMLButtonElement>(null)
  const cancelled = useRef(false)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ message: string; error?: boolean }>()
  const resolution = photoResolution(settings)

  useEffect(() => {
    cancelled.current = false
    closeButton.current?.focus()
    return () => { cancelled.current = true }
  }, [])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const download = async (format: 'png' | 'zip') => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setStatus(undefined)
    try {
      // El JSON corresponde al diseño abierto cuando se toma la captura,
      // incluso si los cambios aún no se han guardado en la biblioteca.
      const state = useRoomStore.getState()
      const viewLabel = PHOTO_VIEWS.find(({ id }) => id === state.view)?.label ?? state.view
      // POV monta otro Canvas y el cambio de proporción redimensiona
      // la vista previa de forma asíncrona.
      const currentCapture = () => {
        const capture = captureRef.current
        return capture?.view === state.view && capture.matchesPreview(resolution) ? capture : null
      }
      const limit = performance.now() + 1800
      while (!cancelled.current && !currentCapture() && performance.now() < limit) {
        await new Promise((resolve) => window.setTimeout(resolve, 32))
      }
      if (cancelled.current) return
      const capture = currentCapture()
      if (!capture || useRoomStore.getState().view !== state.view) {
        throw new Error('La vista previa aún no está lista. Vuelve a intentarlo cuando se muestre.')
      }
      let file = await capture.render(resolution)
      if (format === 'zip') {
        const { data } = cleanExportReferences(persistedDesign(state))
        const json = serializeDesignFile({
          id: state.selectedSavedDesignId || 'referencia-room-builder',
          name: selectActiveDesignName(state),
          savedAt: new Date().toISOString(),
          data,
        })
        file = await createPhotoPackage(file, json, photoGuide(viewLabel, resolution))
      }
      if (cancelled.current) return
      downloadPhotoFile(file, `${exportName}-referencia.${format}`)
      setStatus({ message: format === 'zip' ? 'Paquete listo. Descomprímelo y abre la guía para empezar.' : 'Captura PNG preparada.' })
    } catch (error) {
      if (cancelled.current) return
      const detail = error instanceof DOMException && error.name === 'SecurityError'
        ? 'Un recurso de la escena impide copiar la imagen.'
        : error instanceof Error ? error.message : 'La captura ha fallado.'
      setStatus({ message: `No se pudo descargar. ${detail}`, error: true })
    } finally {
      pending.current = false
      if (!cancelled.current) setBusy(false)
    }
  }

  const rotate = (direction: -1 | 1) => {
    const state = useRoomStore.getState()
    if (view === 'top') state.rotateTop(direction)
    else if (view === 'pov') state.rotatePov(direction)
    else state.rotateIso(direction)
  }

  const pan = (horizontal: number, vertical: number) => {
    const state = useRoomStore.getState()
    const right = planScreenRight(state.topOrientation)
    const up = planScreenUp(state.topOrientation)
    state.setTopCameraPosition(
      state.topCameraX + (horizontal * right.x + vertical * up.x) * 0.25,
      state.topCameraZ + (horizontal * right.z + vertical * up.z) * 0.25,
    )
  }

  return <div className="photo-controls">
    <div className="photo-controls__heading">
      <h1>Fotografía</h1>
      <button type="button" className="secondary-button" ref={closeButton} onClick={onClose}>Volver al editor</button>
    </div>
    <div className="photo-controls__row">
      <label>Vista <select aria-label="Vista" value={view} onChange={(event) => {
        const option = PHOTO_VIEWS.find(({ id }) => id === event.target.value)
        if (option) setView(option.id)
      }}>
        {PHOTO_VIEWS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <div className="photo-controls__buttons" role="group" aria-label="Orientación de cámara">
        <button type="button" className="secondary-button" onClick={() => rotate(1)} aria-label="Girar la vista a la izquierda">↶</button>
        <button type="button" className="secondary-button" onClick={() => rotate(-1)} aria-label="Girar la vista a la derecha">↷</button>
      </div>
      <ZoomControl />
      {view === 'top' && <div className="photo-controls__buttons" role="group" aria-label="Desplazar el encuadre del plano">
        <button type="button" className="secondary-button" onClick={() => pan(-1, 0)} aria-label="Encuadrar más a la izquierda">←</button>
        <button type="button" className="secondary-button" onClick={() => pan(0, 1)} aria-label="Encuadrar más arriba">↑</button>
        <button type="button" className="secondary-button" onClick={() => pan(0, -1)} aria-label="Encuadrar más abajo">↓</button>
        <button type="button" className="secondary-button" onClick={() => pan(1, 0)} aria-label="Encuadrar más a la derecha">→</button>
      </div>}
    </div>
    <div className="photo-controls__row">
      <label>Proporción <select aria-label="Proporción" value={settings.ratio} onChange={(event) => onSettings({ ...settings, ratio: event.target.value as PhotoSettings['ratio'] })}>
        {Object.keys(PHOTO_RATIOS).map((ratio) => <option key={ratio}>{ratio}</option>)}
      </select></label>
      <label>Resolución <select aria-label="Resolución" value={settings.longSide} onChange={(event) => onSettings({ ...settings, longSide: Number(event.target.value) })}>
        {[1280, 1920, 2560, 3200].map((longSide) => {
          const { width, height } = photoResolution({ ...settings, longSide })
          return <option key={longSide} value={longSide}>{width} × {height} px</option>
        })}
      </select></label>
      <label>Fondo <input type="color" value={settings.background} onChange={(event) => onSettings({ ...settings, background: event.target.value })} /></label>
      {view === 'top' && <label><input type="checkbox" checked={settings.annotations} onChange={(event) => onSettings({ ...settings, annotations: event.target.checked })} /> Cotas y anotaciones</label>}
    </div>
    <div className="photo-controls__row">
      <button type="button" className="secondary-button" aria-disabled={busy} onClick={() => void download('png')}>Descargar PNG</button>
      <button type="button" className="primary-button" aria-disabled={busy} onClick={() => void download('zip')} aria-describedby="photo-package-description">Descargar paquete para IA</button>
      <small id="photo-package-description">Incluye una captura, el diseño editable y una guía con un prompt personalizable.</small>
    </div>
    {busy && <p role="status">Preparando descarga…</p>}
    {status && <p role={status.error ? 'alert' : 'status'}>{status.message}</p>}
  </div>
}
