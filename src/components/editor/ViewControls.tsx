import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT } from '../../domain/constants'
import { useRoomStore } from '../../state/useRoomStore'

const ORBIT_DRAG_SENSITIVITY = 0.009

export function ViewControls() {
  const view = useRoomStore((state) => state.view)
  const rotateIso = useRoomStore((state) => state.rotateIso)
  const isoAngle = useRoomStore((state) => state.isoAngle)
  const isIsoOrbitDragging = useRoomStore((state) => state.isIsoOrbitDragging)
  const setIsoAngle = useRoomStore((state) => state.setIsoAngle)
  const setIsoOrbitDragging = useRoomStore((state) => state.setIsoOrbitDragging)
  const rotateFront = useRoomStore((state) => state.rotateFront)
  const rotatePov = useRoomStore((state) => state.rotatePov)
  const roomHeight = useRoomStore((state) => state.room.height)
  const frontCameraHeight = useRoomStore((state) => state.frontCameraHeight)
  const setFrontCameraHeight = useRoomStore((state) => state.setFrontCameraHeight)
  const povYaw = useRoomStore((state) => state.povYaw)
  const freeAzimuth = useRoomStore((state) => state.freeAzimuth)
  const freeElevation = useRoomStore((state) => state.freeElevation)
  const isFreeOrbitDragging = useRoomStore((state) => state.isFreeOrbitDragging)
  const selectElement = useRoomStore((state) => state.selectElement)
  const setFreeOrbit = useRoomStore((state) => state.setFreeOrbit)
  const setFreeOrbitDragging = useRoomStore((state) => state.setFreeOrbitDragging)
  const orbitDrag = useRef<{ pointerId: number; startX: number; startAngle: number } | null>(null)
  const freeOrbitDrag = useRef<{ pointerId: number; startX: number; startY: number; startAzimuth: number; startElevation: number } | null>(null)

  useEffect(() => () => {
    setIsoOrbitDragging(false)
    setFreeOrbitDragging(false)
  }, [setFreeOrbitDragging, setIsoOrbitDragging])

  const startOrbitDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    orbitDrag.current = { pointerId: event.pointerId, startX: event.clientX, startAngle: isoAngle }
    event.currentTarget.setPointerCapture(event.pointerId)
    selectElement(null)
    setIsoOrbitDragging(true)
  }
  const moveOrbitDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = orbitDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setIsoAngle(drag.startAngle + (event.clientX - drag.startX) * ORBIT_DRAG_SENSITIVITY)
  }
  const stopOrbitDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (orbitDrag.current?.pointerId !== event.pointerId) return
    orbitDrag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setIsoOrbitDragging(false)
  }
  const startFreeOrbitDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    freeOrbitDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startAzimuth: freeAzimuth,
      startElevation: freeElevation,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    selectElement(null)
    setFreeOrbitDragging(true)
  }
  const moveFreeOrbitDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = freeOrbitDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setFreeOrbit(
      drag.startAzimuth + (event.clientX - drag.startX) * ORBIT_DRAG_SENSITIVITY,
      drag.startElevation + (event.clientY - drag.startY) * ORBIT_DRAG_SENSITIVITY,
    )
  }
  const stopFreeOrbitDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (freeOrbitDrag.current?.pointerId !== event.pointerId) return
    freeOrbitDrag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setFreeOrbitDragging(false)
  }
  if (view === 'top') return <div className="scene-hint"><span>↕</span> Arrastra para organizar</div>
  if (view === 'front') return (
    <div className="front-camera-control">
      <div className="front-camera-control__header">
        <button type="button" onClick={() => rotateFront(-1)} aria-label="Ver la pared anterior" title="Pared anterior">↶</button>
        <span>
          <b>Altura de cámara</b>
          <output>{frontCameraHeight.toFixed(2)} m{Math.abs(frontCameraHeight - roomHeight / 2) < 0.001 ? ' · De frente' : ''}</output>
        </span>
        <button type="button" onClick={() => rotateFront(1)} aria-label="Ver la pared siguiente" title="Pared siguiente">↷</button>
      </div>
      <label className="front-camera-control__range">
        <i aria-hidden="true">−</i>
        <input
          type="range"
          min={FRONT_CAMERA_MIN_HEIGHT}
          max={FRONT_CAMERA_MAX_HEIGHT}
          step="0.05"
          value={frontCameraHeight}
          onChange={(event) => setFrontCameraHeight(Number(event.target.value))}
          aria-label="Subir o bajar la cámara frontal"
        />
        <i aria-hidden="true">＋</i>
      </label>
    </div>
  )
  if (view === 'free') return (
    <div className="camera-controls camera-controls--free" aria-label="Controles de órbita libre">
      <button
        type="button"
        className={`camera-orbit-drag camera-orbit-drag--free${isFreeOrbitDragging ? ' dragging' : ''}`}
        aria-label="Mantener pulsado y arrastrar en cualquier dirección para orbitar"
        onPointerDown={startFreeOrbitDrag}
        onPointerMove={moveFreeOrbitDrag}
        onPointerUp={stopFreeOrbitDrag}
        onPointerCancel={stopFreeOrbitDrag}
        onLostPointerCapture={() => {
          freeOrbitDrag.current = null
          setFreeOrbitDragging(false)
        }}
        onKeyDown={(event) => {
          const delta = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
            ? { azimuth: event.key === 'ArrowLeft' ? -0.15 : 0.15, elevation: 0 }
            : event.key === 'ArrowUp' || event.key === 'ArrowDown'
              ? { azimuth: 0, elevation: event.key === 'ArrowUp' ? -0.15 : 0.15 }
              : null
          if (!delta) return
          event.preventDefault()
          selectElement(null)
          setFreeOrbit(freeAzimuth + delta.azimuth, freeElevation + delta.elevation)
        }}
      >
        <i aria-hidden="true">↗</i>
        <span>{isFreeOrbitDragging ? 'Orbitando…' : 'Mantén y arrastra'}</span>
        <i aria-hidden="true">↙</i>
      </button>
    </div>
  )
  const rotate = view === 'isometric' ? rotateIso : rotatePov
  return (
    <div className={`camera-controls ${view === 'isometric' ? 'camera-controls--orbit' : ''}`} aria-label={view === 'isometric' ? 'Girar habitación' : 'Mirar alrededor'}>
      <button type="button" onClick={() => { selectElement(null); rotate(1) }} aria-label="Girar a la izquierda">↶</button>
      {view === 'isometric' ? (
        <button
          type="button"
          className={`camera-orbit-drag ${isIsoOrbitDragging ? 'dragging' : ''}`}
          aria-label="Mantener pulsado y arrastrar horizontalmente para girar la habitación"
          onPointerDown={startOrbitDrag}
          onPointerMove={moveOrbitDrag}
          onPointerUp={stopOrbitDrag}
          onPointerCancel={stopOrbitDrag}
          onLostPointerCapture={() => {
            orbitDrag.current = null
            setIsoOrbitDragging(false)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            rotateIso(event.key === 'ArrowLeft' ? 1 : -1)
          }}
        >
          <i aria-hidden="true">←</i>
          {isIsoOrbitDragging ? (
            <span>Girando…</span>
          ) : (
            <svg className="camera-orbit-mouse-icon" viewBox="0 0 24 28" aria-hidden="true">
              <path d="M12 1.5a8.5 8.5 0 0 0-8.5 8.5v8a8.5 8.5 0 0 0 17 0v-8A8.5 8.5 0 0 0 12 1.5Z" />
              <path d="M12 2v9m-8.5 0h17" />
            </svg>
          )}
          <i aria-hidden="true">→</i>
        </button>
      ) : <span>{`${povYaw > 0 ? '+' : ''}${povYaw}°`}</span>}
      <button type="button" onClick={() => { selectElement(null); rotate(-1) }} aria-label="Girar a la derecha">↷</button>
    </div>
  )
}

