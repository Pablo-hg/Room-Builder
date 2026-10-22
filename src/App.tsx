import { useEffect } from 'react'
import { FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT, FURNITURE_PRESETS, ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from './domain/constants'
import { furnitureHalfExtents, visibleWallsForOrientation, wallLength } from './domain/geometry'
import type { FurnitureKind, ViewMode, WallSide } from './domain/types'
import RoomScene, { FurnitureSwatch, RoomCompass3D } from './components/RoomScene'
import { useRoomStore } from './state/useRoomStore'
import './styles.css'

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'isometric', label: 'Isométrica', icon: '◇' },
  { id: 'top', label: 'Plano', icon: '▦' },
  { id: 'front', label: 'Frontal', icon: '▣' },
  { id: 'pov', label: 'POV', icon: '◉' },
]

function visibleWallsForView(view: ViewMode, orientation: number, wallView: WallSide | null): WallSide[] {
  if (view === 'isometric') return visibleWallsForOrientation(orientation)
  if (view === 'front') return [wallView ?? 'north']
  if (view === 'top') return []
  return []
}

function wallsDescription(view: ViewMode, walls: WallSide[]) {
  if (view === 'pov') return 'Cámara interior'
  if (view === 'top') return 'Vista superior de la habitación'
  const names = walls.map((wall) => WALL_LABELS[wall])
  if (view === 'front') return `Pared frontal: ${names[0]}`
  return `Paredes visibles: ${names.join(' y ')}`
}

function compassLabel(view: ViewMode, orientation: number) {
  if (view !== 'isometric') return 'Gizmo 3D para cambiar la orientación de la habitación'
  const directions = ['sureste', 'suroeste', 'noroeste', 'noreste']
  return `Cámara al ${directions[((orientation % 4) + 4) % 4]}`
}

function DimensionControl({ field, label }: { field: 'width' | 'depth'; label: string }) {
  const room = useRoomStore((state) => state.room)
  const setDimension = useRoomStore((state) => state.setDimension)
  return (
    <label className="range-control">
      <span><span>{label}</span><strong>{room[field].toFixed(1)} m</strong></span>
      <input
        type="range"
        min={field === 'width' ? ROOM_LIMITS.minWidth : ROOM_LIMITS.minDepth}
        max={field === 'width' ? ROOM_LIMITS.maxWidth : ROOM_LIMITS.maxDepth}
        step="0.25"
        value={room[field]}
        onChange={(event) => setDimension(field, Number(event.target.value))}
      />
    </label>
  )
}

function WallPicker({ value, onChange, label }: { value: WallSide; onChange: (wall: WallSide) => void; label: string }) {
  return (
    <fieldset className="wall-picker">
      <legend>{label}</legend>
      <div>
        {WALL_SIDES.map((wall) => (
          <button key={wall} type="button" className={value === wall ? 'active' : ''} onClick={() => onChange(wall)} aria-pressed={value === wall}>
            {WALL_LABELS[wall]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function OpeningSwatch({ kind }: { kind: 'door' | 'window' }) {
  return <span className={`opening-swatch opening-swatch--${kind}`} aria-hidden="true"><i /></span>
}

function SelectionInspector() {
  const room = useRoomStore((state) => state.room)
  const furniture = useRoomStore((state) => state.furniture)
  const selectedId = useRoomStore((state) => state.selectedId)
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const rotateFurniture = useRoomStore((state) => state.rotateFurniture)
  const removeFurniture = useRoomStore((state) => state.removeFurniture)
  const setDoor = useRoomStore((state) => state.setDoor)
  const updateWindow = useRoomStore((state) => state.updateWindow)
  const removeWindow = useRoomStore((state) => state.removeWindow)
  const selectedFurniture = furniture.find((item) => item.id === selectedId)
  const selectedWindow = room.windows.find((window) => window.id === selectedId)
  const selectedOpening = selectedId === 'door' ? { ...room.door, id: 'door' as const, kind: 'door' as const, sill: 0 } : selectedWindow ? { ...selectedWindow, kind: 'window' as const } : null

  if (selectedFurniture) {
    const extents = furnitureHalfExtents(selectedFurniture)
    const xLimit = Math.max(0, room.width / 2 - extents.halfWidth)
    const zLimit = Math.max(0, room.depth / 2 - extents.halfDepth)
    return (
      <section className="panel-section selection-section selection-section--inspector">
        <span className="eyebrow">Inspector del elemento</span>
        <div className="selected-heading"><FurnitureSwatch kind={selectedFurniture.kind} /><div><h2>{selectedFurniture.name}</h2><p>{selectedFurniture.x.toFixed(2)}, {selectedFurniture.z.toFixed(2)} m</p></div></div>
        <div className="property-grid" aria-label="Características del mueble">
          <span><small>Anchura</small><strong>{selectedFurniture.width.toFixed(2)} m</strong></span>
          <span><small>Fondo</small><strong>{selectedFurniture.depth.toFixed(2)} m</strong></span>
          <span><small>Altura</small><strong>{selectedFurniture.height.toFixed(2)} m</strong></span>
          <span><small>Giro</small><strong>{Math.round(selectedFurniture.rotation * 180 / Math.PI)}°</strong></span>
        </div>
        <label className="range-control compact">
          <span><span>Posición X</span><strong>{selectedFurniture.x.toFixed(2)} m</strong></span>
          <input type="range" min={-xLimit} max={xLimit} step={ROOM_LIMITS.placementStep} value={selectedFurniture.x} onChange={(event) => moveFurniture(selectedFurniture.id, Number(event.target.value), selectedFurniture.z)} />
        </label>
        <label className="range-control compact">
          <span><span>Posición Z</span><strong>{selectedFurniture.z.toFixed(2)} m</strong></span>
          <input type="range" min={-zLimit} max={zLimit} step={ROOM_LIMITS.placementStep} value={selectedFurniture.z} onChange={(event) => moveFurniture(selectedFurniture.id, selectedFurniture.x, Number(event.target.value))} />
        </label>
        <div className="object-actions">
          <button type="button" onClick={rotateFurniture}><span>↻</span> Girar 90°</button>
          <button type="button" className="danger" onClick={removeFurniture}><span>×</span> Eliminar</button>
        </div>
        <p className="rotation-hint">En la vista también puedes arrastrar los ejes y el aro de giro.</p>
      </section>
    )
  }

  if (selectedOpening) {
    const rawMaxOffset = Math.max(0, wallLength(room, selectedOpening.wall) / 2 - selectedOpening.width / 2 - ROOM_LIMITS.edgeMargin)
    const maxOffset = Math.floor(rawMaxOffset / ROOM_LIMITS.placementStep) * ROOM_LIMITS.placementStep
    const update = selectedOpening.kind === 'door'
      ? (partial: { wall?: WallSide; offset?: number }) => setDoor(partial)
      : (partial: { wall?: WallSide; offset?: number }) => updateWindow(selectedOpening.id, partial)
    return (
      <section className="panel-section selection-section selection-section--inspector">
        <span className="eyebrow">Inspector del elemento</span>
        <div className="selected-heading"><OpeningSwatch kind={selectedOpening.kind} /><div><h2>{selectedOpening.kind === 'door' ? 'Puerta' : 'Ventana'}</h2><p>Apertura seleccionada</p></div></div>
        <div className="property-grid" aria-label="Características de la apertura">
          <span><small>Anchura</small><strong>{selectedOpening.width.toFixed(2)} m</strong></span>
          <span><small>Altura</small><strong>{selectedOpening.height.toFixed(2)} m</strong></span>
          <span><small>Pared</small><strong>{WALL_LABELS[selectedOpening.wall]}</strong></span>
          <span><small>{selectedOpening.kind === 'window' ? 'Antepecho' : 'Desde suelo'}</small><strong>{selectedOpening.sill.toFixed(2)} m</strong></span>
        </div>
        <WallPicker label="Pared" value={selectedOpening.wall} onChange={(wall) => update({ wall })} />
        <label className="range-control compact">
          <span><span>Posición lateral</span><strong>{selectedOpening.offset.toFixed(2)} m</strong></span>
          <input type="range" min={-maxOffset} max={maxOffset} step={ROOM_LIMITS.placementStep} value={selectedOpening.offset} onChange={(event) => update({ offset: Number(event.target.value) })} />
        </label>
        <p className="rotation-hint">También puedes arrastrarla directamente hacia los lados en la vista.</p>
        {selectedOpening.kind === 'window' && <button type="button" className="text-button danger" onClick={() => removeWindow(selectedOpening.id)}>Eliminar ventana</button>}
      </section>
    )
  }

  return (
    <section className="panel-section selection-section selection-section--inspector">
      <span className="eyebrow">Inspector del elemento</span>
      <h2>Nada seleccionado</h2>
      <p className="empty-selection">Selecciona un mueble, la puerta o una ventana en la vista para consultar y editar sus propiedades.</p>
    </section>
  )
}

function SettingsPanel() {
  const room = useRoomStore((state) => state.room)
  return (
    <aside className="side-panel settings-panel" aria-label="Inspector y configuración detallada">
      <SelectionInspector />
      <section className="panel-section room-section">
        <span className="eyebrow">Espacio</span>
        <h2>Tu habitación</h2>
        <p className="section-copy">Ajusta el tamaño y coloca sus aperturas.</p>
        <div className="dimension-visual" aria-hidden="true">
          <span>{room.depth.toFixed(1)} m</span><div><b>{room.width.toFixed(1)} m</b><i>⌂</i></div>
        </div>
        <DimensionControl field="width" label="Anchura" />
        <DimensionControl field="depth" label="Profundidad" />
      </section>
    </aside>
  )
}

function ObjectsPanel() {
  const room = useRoomStore((state) => state.room)
  const furniture = useRoomStore((state) => state.furniture)
  const selectedId = useRoomStore((state) => state.selectedId)
  const gridSnap = useRoomStore((state) => state.gridSnap)
  const addFurniture = useRoomStore((state) => state.addFurniture)
  const addWindow = useRoomStore((state) => state.addWindow)
  const selectElement = useRoomStore((state) => state.selectElement)
  const toggleGrid = useRoomStore((state) => state.toggleGrid)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const toggleElementVisibility = useRoomStore((state) => state.toggleElementVisibility)
  const sceneElements = [
    { id: 'door', name: 'Puerta', kind: 'Apertura' },
    ...room.windows.map((window, index) => ({ id: window.id, name: `Ventana ${index + 1}`, kind: WALL_LABELS[window.wall] })),
    ...furniture.map((item) => ({ id: item.id, name: item.name, kind: 'Mueble' })),
  ]

  return (
    <aside className="side-panel objects-panel" aria-label="Catálogo de objetos">
      <section className="panel-section">
        <span className="eyebrow">Objetos</span>
        <h2>Pequeño catálogo</h2>
        <p className="section-copy">Añade muebles y aperturas, o selecciona la puerta existente.</p>
        <div className="catalog-grid">
          <button type="button" className={`catalog-card ${selectedId === 'door' ? 'active' : ''}`} onClick={() => selectElement('door')} aria-pressed={selectedId === 'door'}>
            <OpeningSwatch kind="door" />
            <span>Puerta</span><small>Seleccionar</small>
          </button>
          <button type="button" className="catalog-card" onClick={addWindow}>
            <OpeningSwatch kind="window" />
            <span>Ventana</span><small>＋ Añadir</small>
          </button>
          {(Object.keys(FURNITURE_PRESETS) as FurnitureKind[]).map((kind) => (
            <button key={kind} type="button" className="catalog-card" onClick={() => addFurniture(kind)}>
              <FurnitureSwatch kind={kind} />
              <span>{FURNITURE_PRESETS[kind].name}</span><small>＋ Añadir</small>
            </button>
          ))}
        </div>
      </section>
      <section className="panel-section elements-section" aria-labelledby="elements-heading">
        <span className="eyebrow">Escena</span>
        <h2 id="elements-heading">Elementos en la habitación</h2>
        <p className="section-copy">Activa o desactiva cada elemento sin eliminarlo.</p>
        <div className="element-list">
          {sceneElements.map((element) => (
            <div className={`element-row ${selectedId === element.id ? 'selected' : ''}`} key={element.id}>
              <label className="element-visibility" title={`Mostrar u ocultar ${element.name}`}>
                <input
                  type="checkbox"
                  checked={!hiddenElementIds.includes(element.id)}
                  onChange={() => toggleElementVisibility(element.id)}
                  aria-label={`Mostrar ${element.name}`}
                />
                <span className="element-check" aria-hidden="true">✓</span>
              </label>
              <button type="button" className="element-select" onClick={() => selectElement(element.id)} aria-pressed={selectedId === element.id}>
                <strong>{element.name}</strong><small>{element.kind}</small>
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="panel-section grid-section">
        <div><span className="grid-icon" aria-hidden="true">▦</span><span><strong>Ajuste a subcuadrícula</strong><small>4 secciones invisibles de 12,5 cm</small></span></div>
        <button type="button" className={`switch ${gridSnap ? 'on' : ''}`} role="switch" aria-checked={gridSnap} onClick={toggleGrid}><span /></button>
      </section>
    </aside>
  )
}

function ViewControls() {
  const view = useRoomStore((state) => state.view)
  const rotateIso = useRoomStore((state) => state.rotateIso)
  const rotateFront = useRoomStore((state) => state.rotateFront)
  const rotatePov = useRoomStore((state) => state.rotatePov)
  const roomHeight = useRoomStore((state) => state.room.height)
  const frontCameraHeight = useRoomStore((state) => state.frontCameraHeight)
  const setFrontCameraHeight = useRoomStore((state) => state.setFrontCameraHeight)
  const povYaw = useRoomStore((state) => state.povYaw)
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
  const rotate = view === 'isometric' ? rotateIso : rotatePov
  return (
    <div className="camera-controls" aria-label={view === 'isometric' ? 'Girar habitación' : 'Mirar alrededor'}>
      <button type="button" onClick={() => rotate(-1)} aria-label="Girar a la izquierda">↶</button>
      <span>{view === 'isometric' ? 'Girar vista' : `${povYaw > 0 ? '+' : ''}${povYaw}°`}</span>
      <button type="button" onClick={() => rotate(1)} aria-label="Girar a la derecha">↷</button>
    </div>
  )
}

function App() {
  const state = useRoomStore()
  const currentView = VIEW_OPTIONS.find((option) => option.id === state.view)!
  const visibleWalls = visibleWallsForView(state.view, state.isoOrientation, state.wallView)
  const visibleWallsText = wallsDescription(state.view, visibleWalls)
  const viewLabel = state.view === 'front' && state.wallView
    ? `Frontal · ${WALL_LABELS[state.wallView]}`
    : currentView.label
  useEffect(() => {
    if (!state.notice) return
    const timer = window.setTimeout(state.clearNotice, 3200)
    return () => window.clearTimeout(timer)
  }, [state.notice, state.clearNotice])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
      if (event.key.toLowerCase() === 'r') state.rotateFurniture()
      if (event.key === 'Delete' || event.key === 'Backspace') state.removeSelected()
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [state.rotateFurniture, state.removeSelected])

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Room Builder, ir al editor">
          <span className="brand-mark"><i /><i /></span>
          <span><strong>Room Builder</strong><small>Make a space feel yours</small></span>
          <b>V0.1</b>
        </a>
        <nav className="view-switcher" aria-label="Cambiar vista">
          {VIEW_OPTIONS.map((option) => (
            <button type="button" key={option.id} className={state.view === option.id ? 'active' : ''} onClick={() => state.setView(option.id)} aria-pressed={state.view === option.id}>
              <span aria-hidden="true">{option.icon}</span>{option.label}
            </button>
          ))}
        </nav>
        <div className="save-actions">
          <button type="button" className="secondary-button" onClick={state.loadDesign}>↙ <span>Recuperar</span></button>
          <button type="button" className="primary-button" onClick={state.saveDesign}>✓ <span>Guardar</span></button>
        </div>
      </header>

      <main id="main" className="workspace">
        <SettingsPanel />
        <section className="scene-panel" aria-label={`Vista ${viewLabel}`}>
          <div className="scene-topline">
            <div className="scene-topline__labels">
              <span className="view-badge"><i /> Vista {viewLabel}</span>
              <span className="visible-walls-badge"><b aria-hidden="true">◫</b> {visibleWallsText}</span>
              <span className="grid-scale"><b aria-hidden="true">▦</b> Cuadrado: 25 cm · movimiento: 12,5 cm</span>
            </div>
            <span className="room-size">{state.room.width.toFixed(1)} × {state.room.depth.toFixed(1)} m</span>
          </div>
          <RoomScene
            room={state.room}
            view={state.view}
            orientation={state.isoOrientation}
            wallView={state.wallView}
            frontCameraHeight={state.frontCameraHeight}
            povYaw={state.povYaw}
            gridSnap={state.gridSnap}
            furniture={state.furniture}
          />
          {state.furniture.length === 0 && state.view !== 'pov' && (
            <div className="empty-scene"><span>✦</span><strong>La habitación está lista</strong><small>Añade tu primera pieza desde el catálogo</small></div>
          )}
          <ViewControls />
          <div className="compass" role="group" aria-label={compassLabel(state.view, state.isoOrientation)}>
            <RoomCompass3D
              visibleWalls={visibleWalls}
              highlightTop={state.view === 'top'}
              activeOrientation={state.view === 'isometric' ? state.isoOrientation : null}
              onOrientationSelect={state.lookFromIsoOrientation}
              onTopView={() => state.setView('top')}
              onWallView={state.lookAtWall}
            />
            {[0, 1, 2, 3].map((orientation) => (
              <button key={orientation} type="button" className="visually-hidden" onClick={() => state.lookFromIsoOrientation(orientation)}>
                Ir directamente a la vista diagonal {orientation + 1}
              </button>
            ))}
          </div>
        </section>
        <ObjectsPanel />
      </main>
      <footer className="statusbar">
        <span><i className="status-dot" /> Guardado local en tu navegador</span>
        <span>Cuadrado visible: 25 cm · ajuste: 12,5 cm</span>
      </footer>
      {state.notice && <div className="toast" role="status" aria-live="polite">{state.notice}</div>}
    </div>
  )
}

export default App
