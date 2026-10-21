import { useEffect } from 'react'
import { FURNITURE_PRESETS, ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from './domain/constants'
import { wallLength } from './domain/geometry'
import type { FurnitureKind, ViewMode, WallSide } from './domain/types'
import RoomScene, { FurnitureSwatch } from './components/RoomScene'
import { useRoomStore } from './state/useRoomStore'
import './styles.css'

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'isometric', label: 'Isométrica', icon: '◇' },
  { id: 'top', label: 'Plano', icon: '▦' },
  { id: 'pov', label: 'POV', icon: '◉' },
]

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

function WindowEditor() {
  const room = useRoomStore((state) => state.room)
  const addWindow = useRoomStore((state) => state.addWindow)
  const updateWindow = useRoomStore((state) => state.updateWindow)
  const removeWindow = useRoomStore((state) => state.removeWindow)
  return (
    <section className="panel-section">
      <div className="section-title-row">
        <div><span className="eyebrow">Aperturas</span><h2>Ventanas</h2></div>
        <button type="button" className="icon-button" onClick={addWindow} aria-label="Añadir ventana">＋</button>
      </div>
      <div className="window-list">
        {room.windows.length === 0 && <p className="muted-copy">Todavía no hay ventanas.</p>}
        {room.windows.map((window, index) => {
          const maxOffset = Math.max(0, wallLength(room, window.wall) / 2 - window.width / 2 - ROOM_LIMITS.edgeMargin)
          return (
            <details className="window-card" key={window.id} open={index === room.windows.length - 1}>
              <summary><span><i aria-hidden="true" />Ventana {index + 1}</span><span>{WALL_LABELS[window.wall]}</span></summary>
              <div className="window-card__body">
                <WallPicker label="Pared" value={window.wall} onChange={(wall) => updateWindow(window.id, { wall })} />
                <label className="range-control compact">
                  <span><span>Posición</span><strong>{window.offset.toFixed(2)} m</strong></span>
                  <input type="range" min={-maxOffset} max={maxOffset} step="0.05" value={window.offset} onChange={(e) => updateWindow(window.id, { offset: Number(e.target.value) })} />
                </label>
                <button type="button" className="text-button danger" onClick={() => removeWindow(window.id)}>Eliminar ventana</button>
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}

function SettingsPanel() {
  const room = useRoomStore((state) => state.room)
  const setDoor = useRoomStore((state) => state.setDoor)
  const maxDoorOffset = Math.max(0, wallLength(room, room.door.wall) / 2 - room.door.width / 2 - ROOM_LIMITS.edgeMargin)
  return (
    <aside className="side-panel settings-panel" aria-label="Configurar habitación">
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
      <section className="panel-section">
        <span className="eyebrow">Acceso</span>
        <h2>Puerta</h2>
        <WallPicker label="Pared de la puerta" value={room.door.wall} onChange={(wall) => setDoor({ wall })} />
        <label className="range-control compact">
          <span><span>Posición</span><strong>{room.door.offset.toFixed(2)} m</strong></span>
          <input type="range" min={-maxDoorOffset} max={maxDoorOffset} step="0.05" value={room.door.offset} onChange={(event) => setDoor({ offset: Number(event.target.value) })} />
        </label>
      </section>
      <WindowEditor />
    </aside>
  )
}

function ObjectsPanel() {
  const furniture = useRoomStore((state) => state.furniture)
  const selectedId = useRoomStore((state) => state.selectedId)
  const gridSnap = useRoomStore((state) => state.gridSnap)
  const addFurniture = useRoomStore((state) => state.addFurniture)
  const rotateFurniture = useRoomStore((state) => state.rotateFurniture)
  const removeFurniture = useRoomStore((state) => state.removeFurniture)
  const toggleGrid = useRoomStore((state) => state.toggleGrid)
  const selected = furniture.find((item) => item.id === selectedId)

  return (
    <aside className="side-panel objects-panel" aria-label="Catálogo de objetos">
      <section className="panel-section">
        <span className="eyebrow">Objetos</span>
        <h2>Pequeño catálogo</h2>
        <p className="section-copy">Añade una pieza y arrástrala por la habitación.</p>
        <div className="catalog-grid">
          {(Object.keys(FURNITURE_PRESETS) as FurnitureKind[]).map((kind) => (
            <button key={kind} type="button" className="catalog-card" onClick={() => addFurniture(kind)}>
              <FurnitureSwatch kind={kind} />
              <span>{FURNITURE_PRESETS[kind].name}</span><small>＋ Añadir</small>
            </button>
          ))}
        </div>
      </section>
      <section className="panel-section selection-section">
        <span className="eyebrow">Selección</span>
        {selected ? (
          <>
            <div className="selected-heading"><FurnitureSwatch kind={selected.kind} /><div><h2>{selected.name}</h2><p>{selected.x.toFixed(2)}, {selected.z.toFixed(2)} m</p></div></div>
            <div className="object-actions">
              <button type="button" onClick={rotateFurniture}><span>↻</span> Girar 90°</button>
              <button type="button" className="danger" onClick={removeFurniture}><span>×</span> Eliminar</button>
            </div>
          </>
        ) : <p className="empty-selection">Selecciona una pieza para girarla o eliminarla.</p>}
      </section>
      <section className="panel-section grid-section">
        <div><span className="grid-icon" aria-hidden="true">▦</span><span><strong>Ajuste a cuadrícula</strong><small>Saltos de 25 cm</small></span></div>
        <button type="button" className={`switch ${gridSnap ? 'on' : ''}`} role="switch" aria-checked={gridSnap} onClick={toggleGrid}><span /></button>
      </section>
    </aside>
  )
}

function ViewControls() {
  const view = useRoomStore((state) => state.view)
  const rotateIso = useRoomStore((state) => state.rotateIso)
  const rotatePov = useRoomStore((state) => state.rotatePov)
  const povYaw = useRoomStore((state) => state.povYaw)
  if (view === 'top') return <div className="scene-hint"><span>↕</span> Arrastra para organizar</div>
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
  useEffect(() => {
    if (!state.notice) return
    const timer = window.setTimeout(state.clearNotice, 3200)
    return () => window.clearTimeout(timer)
  }, [state.notice, state.clearNotice])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
      if (event.key.toLowerCase() === 'r') state.rotateFurniture()
      if (event.key === 'Delete' || event.key === 'Backspace') state.removeFurniture()
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [state.rotateFurniture, state.removeFurniture])

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
        <section className="scene-panel" aria-label={`Vista ${currentView.label}`}>
          <div className="scene-topline">
            <span className="view-badge"><i /> Vista {currentView.label}</span>
            <span className="room-size">{state.room.width.toFixed(1)} × {state.room.depth.toFixed(1)} m</span>
          </div>
          <RoomScene room={state.room} view={state.view} orientation={state.isoOrientation} povYaw={state.povYaw} gridSnap={state.gridSnap} furniture={state.furniture} />
          {state.furniture.length === 0 && state.view !== 'pov' && (
            <div className="empty-scene"><span>✦</span><strong>La habitación está lista</strong><small>Añade tu primera pieza desde el catálogo</small></div>
          )}
          <ViewControls />
          <div className="compass" aria-label="Orientación"><span>N</span><i /></div>
        </section>
        <ObjectsPanel />
      </main>
      <footer className="statusbar">
        <span><i className="status-dot" /> Guardado local en tu navegador</span>
        <span>1 cuadrícula = 25 cm</span>
      </footer>
      {state.notice && <div className="toast" role="status" aria-live="polite">{state.notice}</div>}
    </div>
  )
}

export default App
