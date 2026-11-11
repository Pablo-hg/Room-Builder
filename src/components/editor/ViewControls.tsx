import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT } from '../../domain/constants'
import { planRoomDimensions, planRoomDimensionsSummary } from '../../domain/planDimensions'
import { ROOT_ROOM_FOLDER } from '../../domain/elementFolders'
import { useRoomStore } from '../../state/useRoomStore'
import { topViewWallForOrientation } from '../../domain/geometry'

const ORBIT_DRAG_SENSITIVITY = 0.009

/** Alterna «Plano normal» / «Plano detallado» sin cambiar de vista, cámara ni diseño. */
function PlanDetailsToggle() {
  const planDetailsVisible = useRoomStore((state) => state.planDetailsVisible)
  const setPlanDetailsVisible = useRoomStore((state) => state.setPlanDetailsVisible)
  const room = useRoomStore((state) => state.room)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const rootName = useRoomStore((state) => state.elementFolders.find((folder) => folder.id === ROOT_ROOM_FOLDER)?.name ?? 'Habitación principal')
  const summary = useMemo(() => planDetailsVisible
    ? planRoomDimensionsSummary(
      planRoomDimensions({ room, structurePacks }, (wall) => !hiddenElementIds.includes(wall.id) && !(wall.packId && hiddenElementIds.includes(wall.packId))),
      (roomId) => roomId ? structurePacks.find((pack) => pack.id === roomId)?.name ?? 'Habitación' : rootName)
    : '', [planDetailsVisible, room, structurePacks, hiddenElementIds, rootName])
  return <>
    <label className="plan-details-toggle" title={planDetailsVisible ? 'Plano detallado: cotas de las paredes de cada habitación' : 'Plano normal: sin cotas'}>
      <input type="checkbox" checked={planDetailsVisible} onChange={(event) => setPlanDetailsVisible(event.target.checked)} aria-describedby="plan-details-summary" />
      <span>Mostrar detalles</span>
    </label>
    <span id="plan-details-summary" className="visually-hidden" aria-live="polite">{planDetailsVisible ? `Cotas: ${summary}.` : ''}</span>
  </>
}

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
  const resetTopCamera = useRoomStore((state) => state.resetTopCamera)
  const isoCameraHeight = useRoomStore((state) => state.isoCameraHeight)
  const setIsoCameraHeight = useRoomStore((state) => state.setIsoCameraHeight)
  const packs = useRoomStore((state) => state.structurePacks)
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
  if (view === 'top') return <div className="camera-controls camera-controls--plan"><PlanDetailsToggle /><span className="plan-camera-hint"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" /></svg>Arrastra el suelo para desplazar</span><button type="button" className="plan-camera-reset" onClick={resetTopCamera} aria-label="Restablecer posición y zoom del plano" title="Restablecer posición y zoom; usa las flechas para desplazar" onKeyDown={(event) => {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key]
    if (!direction) return
    event.preventDefault()
    const state = useRoomStore.getState()
    const wall = topViewWallForOrientation(state.topOrientation)
    const vectors = { north: [1, 0, 0, -1], east: [0, 1, 1, 0], south: [-1, 0, 0, 1], west: [0, -1, -1, 0] }[wall]
    state.setTopCameraPosition(state.topCameraX + (vectors[0] * direction[0] + vectors[2] * direction[1]) * 0.25, state.topCameraZ + (vectors[1] * direction[0] + vectors[3] * direction[1]) * 0.25)
  }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 10.5V20h13v-9.5M10 20v-6h4v6" /></svg><span>Restablecer vista</span></button></div>
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
      <span>WASD · Desplazar<br />Mayús · Más rápido</span>
    </div>
  )
  const rotate = view === 'isometric' ? rotateIso : rotatePov
  return (
    <><div className={`camera-controls ${view === 'isometric' ? 'camera-controls--orbit' : ''}`} aria-label={view === 'isometric' ? 'Girar habitación' : 'Mirar alrededor'}>
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
            <><svg className="camera-orbit-mouse-icon" viewBox="0 0 24 28" aria-hidden="true">
              <path d="M12 1.5a8.5 8.5 0 0 0-8.5 8.5v8a8.5 8.5 0 0 0 17 0v-8A8.5 8.5 0 0 0 12 1.5Z" />
              <path d="M12 2v9m-8.5 0h17" />
            </svg><svg className="camera-orbit-touch-icon" viewBox="0 0 24 28" aria-hidden="true">
              <path d="M9 17V6a2 2 0 0 1 4 0v6l3 1c2 .7 3 2.3 3 4.5V21a4 4 0 0 1-4 4h-3a4 4 0 0 1-3.2-1.6L5 18a2 2 0 0 1 2.8-2.8L9 17Z" />
              <path d="M6 4a5.5 5.5 0 0 1 10 0" />
            </svg></>
          )}
          <i aria-hidden="true">→</i>
        </button>
      ) : <span>{`${povYaw > 0 ? '+' : ''}${povYaw}°`}</span>}
      <button type="button" onClick={() => { selectElement(null); rotate(-1) }} aria-label="Girar a la derecha">↷</button>
    </div>{view === 'isometric' && <label className="iso-height-control">Centro de cámara <output>{isoCameraHeight.toFixed(1)} m</output><input type="range" aria-label="Altura del centro de cámara isométrica" min={Math.min(0, ...packs.map((pack) => pack.y))} max={Math.max(roomHeight, ...packs.map((pack) => pack.y + roomHeight))} step="0.125" value={isoCameraHeight} onChange={(event) => setIsoCameraHeight(Number(event.target.value))} /></label>}</>
  )
}

