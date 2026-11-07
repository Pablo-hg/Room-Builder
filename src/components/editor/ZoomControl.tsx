import { useRoomStore } from '../../state/useRoomStore'
import { cameraZoomLimits } from '../../state/defaults'

export function ZoomControl() {
  const view = useRoomStore((state) => state.view)
  const zoom = useRoomStore((state) => state.view === 'pov' ? state.povCameraZoom : state.view === 'free' ? state.freeCameraZoom : state.cameraZoom)
  const setCameraZoom = useRoomStore((state) => state.setCameraZoom)
  const { min, max } = cameraZoomLimits(view)
  return <label className="zoom-indicator zoom-control">
    <span>Zoom</span><input type="range" min={min} max={max} step="0.01" value={zoom} aria-label="Zoom de la cámara" aria-valuetext={`${Math.round(zoom * 100)} %`} onChange={(event) => setCameraZoom(Number(event.target.value))} />
    <output aria-live="polite">{Math.round(zoom * 100)}%</output>
  </label>
}
