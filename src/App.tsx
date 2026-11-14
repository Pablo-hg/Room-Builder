import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { DEFAULT_ROOM, WALL_LABELS } from './domain/constants'
import { sideWallsForFrontView, visibleWallsForOrientation } from './domain/geometry'
import type { ViewMode, WallSide } from './domain/types'
import RoomScene, { FreeCameraCompass3D, RoomCompass3D } from './components/RoomScene'
import InteractionLogger from './components/InteractionLogger'
import { useRoomStore } from './state/useRoomStore'
import { collisionElementIds, detectOutsideRoom, detectSceneCollisions, detectUnsupportedOpenings } from './domain/sceneCollisions'
import { SceneCollisionPanel } from './components/editor/SceneCollisionPanel'
import { useShallow } from 'zustand/react/shallow'
import { selectActiveDesignName, selectEditorScene } from './state/selectors'
import { SettingsPanel } from './components/editor/SettingsPanel'
import { ObjectsPanel } from './components/editor/ObjectsPanel'
import { ViewControls } from './components/editor/ViewControls'
import { RoomViewSelector } from './components/editor/RoomViewSelector'
import { ZoomControl } from './components/editor/ZoomControl'
import { packRoomBox } from './domain/roomEditing'
import { visibleWallsForView } from './components/editor/viewHelpers'
import { EditorHeader } from './components/editor/EditorHeader'
import { VIEW_OPTIONS } from './components/editor/viewOptions'
import { useEditorShortcuts } from './components/editor/useEditorShortcuts'
import { FirstUseGuide, FirstUseInvitation, rememberFirstUseGuide, shouldOfferFirstUseGuide } from './components/editor/FirstUseGuide'
import './styles.css'

const ORBIT_DRAG_SENSITIVITY = 0.009

function wallsDescription(view: ViewMode, walls: WallSide[]) {
  if (view === 'pov') return 'Cámara interior'
  if (view === 'top') return 'Vista superior de la habitación'
  const names = walls.map((wall) => WALL_LABELS[wall])
  if (view === 'front') {
    const sides = sideWallsForFrontView(walls[0] ?? 'north')
    return `Frente: ${names[0]} · Izquierda: ${WALL_LABELS[sides.left]} · Derecha: ${WALL_LABELS[sides.right]}`
  }
  return `Paredes visibles: ${names.join(' y ')}`
}

function compassLabel(view: ViewMode, orientation: number, freeAzimuth: number, freeElevation: number) {
  if (view === 'free') return `Brújula XYZ · azimut ${Math.round(freeAzimuth * 180 / Math.PI)}° · elevación ${Math.round(freeElevation * 180 / Math.PI)}°`
  if (view !== 'isometric') return 'Gizmo 3D para cambiar la orientación de la habitación'
  const walls = visibleWallsForOrientation(orientation).map((wall) => WALL_LABELS[wall])
  return `Vista diagonal · paredes visibles ${walls.join(' y ')}`
}

function isOrbitCanvasTarget(target: EventTarget | null): target is HTMLCanvasElement {
  return target instanceof HTMLCanvasElement && target.closest('.room-scene-canvas--orbit') !== null
}

function EditorScene({ settingsCollapsed, objectsCollapsed, onToggleSettings, onToggleObjects, settingsWidth, objectsWidth, setSettingsWidth, setObjectsWidth, exportMode, exportRequest, onExportComplete }: {
  settingsCollapsed: boolean
  objectsCollapsed: boolean
  onToggleSettings: () => void
  onToggleObjects: () => void
  settingsWidth: number
  objectsWidth: number
  setSettingsWidth: (width: number) => void
  setObjectsWidth: (width: number) => void
  exportMode: boolean
  exportRequest: number
  onExportComplete: (error?: Error) => void
}) {
  const state = useRoomStore(useShallow(selectEditorScene))
  const hiddenElementIds = useRoomStore((current) => current.hiddenElementIds)
  const areaSelect = useRoomStore((current) => current.areaSelect)
  const setAreaSelect = useRoomStore((current) => current.setAreaSelect)
  const collisions = useMemo(() => detectSceneCollisions({ room: state.room, furniture: state.furniture, structurePacks: state.structurePacks, hiddenElementIds }), [state.room, state.furniture, state.structurePacks, hiddenElementIds])
  const collisionIds = useMemo(() => collisionElementIds(collisions), [collisions])
  const outside = useMemo(() => detectOutsideRoom({ room: state.room, furniture: state.furniture, structurePacks: state.structurePacks, hiddenElementIds }), [state.room, state.furniture, state.structurePacks, hiddenElementIds])
  const unsupported = useMemo(() => detectUnsupportedOpenings({ room: state.room, furniture: state.furniture, structurePacks: state.structurePacks, hiddenElementIds }), [state.room, state.furniture, state.structurePacks, hiddenElementIds])
  const spatialIssueIds = useMemo(() => new Set([...collisionIds, ...outside.map((item) => item.id)]), [collisionIds, outside])
  const activeRoomId = useRoomStore((current) => current.activeRoomId)
  const focusedPack = state.structurePacks.find((pack) => pack.id === activeRoomId && pack.id.startsWith('floor-pack-'))
  const roomSize = focusedPack && packRoomBox(focusedPack, state.room) || state.room
  const sceneOrbitDrag = useRef<{
    pointerId: number
    mode: 'isometric' | 'free'
    startX: number
    startY: number
    startAngle: number
    startElevation: number
  } | null>(null)
  const resizeDrag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null)
  const resizeHandle = (side: 'objects' | 'settings', width: number, setWidth: (width: number) => void, collapsed: boolean) => {
    const min = side === 'objects' ? 264 : 286
    const max = min * 2
    const direction = side === 'objects' ? 1 : -1
    const apply = (value: number) => setWidth(Math.max(min, Math.min(max, value)))
    if (collapsed) return null
    return <div className={`sidebar-resize sidebar-resize--${side}`} role="separator" tabIndex={0}
      aria-label={`Cambiar anchura del panel ${side === 'objects' ? 'izquierdo' : 'derecho'}`}
      aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={width}
      aria-controls={side === 'objects' ? 'objects-panel' : 'settings-panel'}
      onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); resizeDrag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width }; event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={(event) => { const drag = resizeDrag.current; if (drag?.pointerId === event.pointerId) apply(drag.startWidth + direction * (event.clientX - drag.startX)) }}
      onPointerUp={(event) => { if (resizeDrag.current?.pointerId === event.pointerId) resizeDrag.current = null }}
      onPointerCancel={() => { resizeDrag.current = null }}
      onLostPointerCapture={() => { resizeDrag.current = null }}
      onKeyDown={(event) => { const delta = event.key === 'ArrowRight' ? 16 : event.key === 'ArrowLeft' ? -16 : 0; if (delta) { event.preventDefault(); apply(width + direction * delta) } else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); apply(event.key === 'Home' ? min : max) } }}
    />
  }
  const currentView = VIEW_OPTIONS.find((option) => option.id === state.view)!
  const visibleWalls = visibleWallsForView(state.view, state.isoOrientation, state.wallView, state.freeAzimuth)
  const visibleWallsText = wallsDescription(state.view, visibleWalls)
  const hasPlacedSceneContent = state.furniture.length > 0 || state.structurePacks.length > 0
    || state.room.windows.some((window) => !DEFAULT_ROOM.windows.some((defaultWindow) => defaultWindow.id === window.id))
    || Boolean(state.room.extraDoors?.length)
  const viewLabel = state.view === 'front' && state.wallView
    ? `Frontal · ${WALL_LABELS[state.wallView]}`
    : currentView.label
  const activeCameraZoom = state.view === 'pov' ? state.povCameraZoom : state.view === 'free' ? state.freeCameraZoom : state.cameraZoom
  const activeDesignName = useRoomStore(selectActiveDesignName)
  const startSceneOrbitDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if ((state.view !== 'isometric' && state.view !== 'free') || event.button !== 1 || !isOrbitCanvasTarget(event.target)) return
    event.preventDefault()
    event.stopPropagation()
    sceneOrbitDrag.current = {
      pointerId: event.pointerId,
      mode: state.view,
      startX: event.clientX,
      startY: event.clientY,
      startAngle: state.view === 'isometric' ? state.isoAngle : state.freeAzimuth,
      startElevation: state.freeElevation,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    state.selectElement(null)
    if (state.view === 'isometric') state.setIsoOrbitDragging(true)
    else state.setFreeOrbitDragging(true)
  }
  const moveSceneOrbitDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = sceneOrbitDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    if (drag.mode === 'isometric') {
      state.setIsoAngle(drag.startAngle + (event.clientX - drag.startX) * ORBIT_DRAG_SENSITIVITY)
    } else {
      state.setFreeOrbit(
        drag.startAngle + (event.clientX - drag.startX) * ORBIT_DRAG_SENSITIVITY,
        drag.startElevation + (event.clientY - drag.startY) * ORBIT_DRAG_SENSITIVITY,
      )
    }
  }
  const stopSceneOrbitDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = sceneOrbitDrag.current
    if (drag?.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    sceneOrbitDrag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (drag.mode === 'isometric') state.setIsoOrbitDragging(false)
    else state.setFreeOrbitDragging(false)
  }

  const exportDesignName = activeDesignName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'room-builder'

  return (
        <section
          className={`scene-panel${state.view === 'isometric' || state.view === 'free' ? ' scene-panel--orbit-ready' : ''}${state.view === 'isometric' ? ' scene-panel--orbit-ready-isometric' : ''}${state.isIsoOrbitDragging || state.isFreeOrbitDragging ? ' scene-panel--orbit-dragging' : ''}`}
          aria-label={`Vista ${viewLabel}`}
          onPointerDownCapture={startSceneOrbitDrag}
          onPointerMoveCapture={moveSceneOrbitDrag}
          onPointerUpCapture={stopSceneOrbitDrag}
          onPointerCancelCapture={stopSceneOrbitDrag}
          onLostPointerCapture={() => {
            const drag = sceneOrbitDrag.current
            if (!drag) return
            sceneOrbitDrag.current = null
            if (drag.mode === 'isometric') state.setIsoOrbitDragging(false)
            else state.setFreeOrbitDragging(false)
          }}
          onContextMenu={(event) => {
            if (isOrbitCanvasTarget(event.target)) event.preventDefault()
          }}
          onWheel={(event) => {
            if (event.ctrlKey) return
            event.preventDefault()
            const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1)
            state.adjustCameraZoom(delta)
          }}
        >
          {resizeHandle('objects', objectsWidth, setObjectsWidth, objectsCollapsed)}
          {resizeHandle('settings', settingsWidth, setSettingsWidth, settingsCollapsed)}
          <button
            type="button"
            className="sidebar-toggle sidebar-toggle--settings"
            aria-controls="settings-panel"
            aria-expanded={!settingsCollapsed}
            aria-label={settingsCollapsed ? 'Mostrar panel derecho' : 'Minimizar panel derecho'}
            title={settingsCollapsed ? 'Mostrar panel derecho' : 'Minimizar panel derecho'}
            onClick={onToggleSettings}
          >
            <span aria-hidden="true">{settingsCollapsed ? '‹' : '›'}</span>
          </button>
          <button
            type="button"
            className="sidebar-toggle sidebar-toggle--objects"
            aria-controls="objects-panel"
            aria-expanded={!objectsCollapsed}
            aria-label={objectsCollapsed ? 'Mostrar panel izquierdo' : 'Minimizar panel izquierdo'}
            title={objectsCollapsed ? 'Mostrar panel izquierdo' : 'Minimizar panel izquierdo'}
            onClick={onToggleObjects}
          >
            <span aria-hidden="true">{objectsCollapsed ? '›' : '‹'}</span>
          </button>
          <div className="scene-layout">
          <div className="scene-header">
          <div className="scene-topline">
            <div className="scene-topline__labels">
              <span className="view-badge"><i /> Vista {viewLabel}</span>
              <span className="visible-walls-badge"><b aria-hidden="true">◫</b> {visibleWallsText}</span>
              <button type="button" className={`area-select-toggle${areaSelect ? ' is-active' : ''}`} aria-pressed={areaSelect} onClick={() => setAreaSelect(!areaSelect)} title="Arrastra sobre el fondo para seleccionar varios objetos (también con Mayús + arrastrar)">▢ Selección por área</button>
              <span className="grid-scale"><b aria-hidden="true">▦</b> Cuadrado: 25 cm · movimiento: 5 cm</span>
            </div>
            <span className="room-size">{roomSize.width.toFixed(1)} × {roomSize.depth.toFixed(1)} m</span>
          </div>
          <RoomViewSelector />
          </div>
          <div className="scene-stage">
          <RoomScene
            room={state.room}
            view={state.view}
            orientation={state.view === 'top' ? state.topOrientation : state.isoOrientation}
            isoAngle={state.isoAngle}
            isIsoOrbitDragging={state.isIsoOrbitDragging}
            freeAzimuth={state.freeAzimuth}
            freeElevation={state.freeElevation}
            isFreeOrbitDragging={state.isFreeOrbitDragging}
            cameraZoom={activeCameraZoom}
            wallView={state.wallView}
            frontCameraHeight={state.frontCameraHeight}
            povYaw={state.povYaw}
            gridSnap={state.gridSnap}
            gridVisibility={state.gridVisibility}
            furniture={state.furniture}
            structurePacks={state.structurePacks}
            collisionIds={spatialIssueIds}
            exportMode={exportMode}
            exportRequest={exportRequest}
            onExportComplete={onExportComplete}
            exportDesignName={exportDesignName}
          />
          {!exportMode && <SceneCollisionPanel collisions={collisions} outside={outside} unsupported={unsupported} />}
          {!hasPlacedSceneContent && state.view !== 'pov' && (
            <div className="empty-scene"><span>✦</span><strong>La habitación está lista</strong><small>Añade tu primera pieza desde el catálogo</small></div>
          )}
          <div className="compass" role="group" aria-label={compassLabel(state.view, state.isoOrientation, state.freeAzimuth, state.freeElevation)}>
            {state.view === 'free' ? (
              <FreeCameraCompass3D
                azimuth={state.freeAzimuth}
                elevation={state.freeElevation}
                onOrientationSelect={state.lookFromFreeOrbit}
              />
            ) : (
              <RoomCompass3D
                visibleWalls={visibleWalls}
                highlightTop={state.view === 'top'}
                activeOrientation={state.view === 'isometric' ? state.isoOrientation : null}
                onOrientationSelect={state.lookFromIsoOrientation}
                onTopView={() => state.setView('top')}
                onWallView={state.lookAtWall}
              />
            )}
            {state.view === 'free' ? (
              [
                { label: 'Eje X positivo', azimuth: 0, elevation: 0 },
                { label: 'Eje X negativo', azimuth: Math.PI, elevation: 0 },
                { label: 'Eje Y positivo', azimuth: state.freeAzimuth, elevation: 1.42 },
                { label: 'Eje Y negativo', azimuth: state.freeAzimuth, elevation: -1.42 },
                { label: 'Eje Z positivo', azimuth: Math.PI / 2, elevation: 0 },
                { label: 'Eje Z negativo', azimuth: -Math.PI / 2, elevation: 0 },
              ].map(({ label, azimuth, elevation }) => (
                <button key={label} type="button" className="visually-hidden" onClick={() => state.lookFromFreeOrbit(azimuth, elevation)}>
                  Alinear cámara con {label}
                </button>
              ))
            ) : [
              { orientation: 0, walls: 'D y A' },
              { orientation: 1, walls: 'A y B' },
              { orientation: 2, walls: 'B y C' },
              { orientation: 3, walls: 'C y D' },
            ].map(({ orientation, walls }) => (
              <button key={orientation} type="button" className="visually-hidden" onClick={() => state.lookFromIsoOrientation(orientation)}>
                Ver en isométrica las paredes {walls}
              </button>
            ))}
          </div>
          </div>
          <div className="scene-controls"><ZoomControl /><ViewControls /></div>
          </div>
        </section>
  )
}

function EditorNotice({ exportNotice }: { exportNotice: string }) {
  const notice = useRoomStore((state) => state.notice)
  const clearNotice = useRoomStore((state) => state.clearNotice)
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(clearNotice, 3200)
    return () => window.clearTimeout(timer)
  }, [notice, clearNotice])
  return (notice || exportNotice) ? <div className="toast" role="status" aria-live="polite">{exportNotice || notice}</div> : null
}

function App() {
  const initializeSavedDesigns = useRoomStore((state) => state.initializeSavedDesigns)
  const hasUnsavedChanges = useRoomStore((state) => state.hasUnsavedChanges)
  const selectedSavedDesignId = useRoomStore((state) => state.selectedSavedDesignId)
  const [settingsCollapsed, setSettingsCollapsed] = useState(false)
  const [objectsCollapsed, setObjectsCollapsed] = useState(false)
  const [objectsWidth, setObjectsWidth] = useState(264)
  const [settingsWidth, setSettingsWidth] = useState(286)
  const [exportMode, setExportMode] = useState(false)
  const [exportRequest, setExportRequest] = useState(0)
  const [exportNotice, setExportNotice] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideInvitation, setGuideInvitation] = useState(shouldOfferFirstUseGuide)
  const startGuide = useCallback(() => {
    // Mostrar los paneles que la guía necesita resaltar, sin cambiar el diseño.
    setObjectsCollapsed(false)
    setSettingsCollapsed(false)
    setGuideInvitation(false)
    setGuideOpen(true)
  }, [])
  const closeGuide = useCallback(() => { rememberFirstUseGuide(); setGuideInvitation(false); setGuideOpen(false) }, [])
  useEditorShortcuts()
  useEffect(() => { initializeSavedDesigns() }, [initializeSavedDesigns])
  useEffect(() => {
    if (!exportNotice) return
    const timer = window.setTimeout(() => setExportNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [exportNotice])
  const handleExportComplete = useCallback((error?: Error) => {
    setExportMode(false)
    setExportNotice(error ? `No se pudo descargar el modelo: ${error.message}` : 'Modelo 3D descargado en formato GLB.')
  }, [])
  return (
    <div className="app">
      <InteractionLogger />
      <EditorHeader exportMode={exportMode} onExport={() => {
        setExportMode(true)
        setExportRequest((request) => request + 1)
      }} />
      <main
        id="main"
        className={`workspace${settingsCollapsed ? ' workspace--settings-collapsed' : ''}${objectsCollapsed ? ' workspace--objects-collapsed' : ''}`}
        style={{ '--objects-expanded-width': `${objectsWidth}px`, '--settings-expanded-width': `${settingsWidth}px` } as CSSProperties}
      >
        <ObjectsPanel />
        <EditorScene
          settingsCollapsed={settingsCollapsed}
          objectsCollapsed={objectsCollapsed}
          onToggleSettings={() => setSettingsCollapsed((collapsed) => !collapsed)}
          onToggleObjects={() => setObjectsCollapsed((collapsed) => !collapsed)}
          objectsWidth={objectsWidth}
          settingsWidth={settingsWidth}
          setObjectsWidth={setObjectsWidth}
          setSettingsWidth={setSettingsWidth}
          exportMode={exportMode}
          exportRequest={exportRequest}
          onExportComplete={handleExportComplete}
        />
        <SettingsPanel onStartGuide={startGuide} />
      </main>
      <footer className="statusbar">
        <span className={`statusbar__save${hasUnsavedChanges || !selectedSavedDesignId ? ' statusbar__save--pending' : ''}`} role="status" aria-live="polite"><i className="status-dot" aria-hidden="true" />{hasUnsavedChanges ? 'Cambios sin guardar · pulsa Guardar' : selectedSavedDesignId ? 'Diseño guardado en este navegador' : 'Diseño sin guardar · pulsa Guardar'}</span>
        <span>Cuadrado visible: 25 cm · ajuste: 5 cm</span>
      </footer>
      <EditorNotice exportNotice={exportNotice} />
      {guideInvitation && <FirstUseInvitation onStart={startGuide} onDismiss={closeGuide} />}
      <FirstUseGuide open={guideOpen} onClose={closeGuide} />
    </div>
  )
}

export default App
