import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { DEFAULT_FLOOR_COLOR, DEFAULT_ROOM, DEFAULT_WALL_COLOR, FRONT_CAMERA_MAX_HEIGHT, FRONT_CAMERA_MIN_HEIGHT, ROOM_LIMITS, WALL_LABELS, WALL_SIDES } from './domain/constants'
import { furnitureHalfExtents, orientationForAzimuth, sideWallsForFrontView, visibleWallsForOrientation, wallLength } from './domain/geometry'
import { FURNITURE_CATALOG, FURNITURE_FAMILIES, FURNITURE_PRESETS, isCeilingMountedFurniture, isFloorBoundFurniture, isWallMirrorShape, isWallPictureKind, isWallPictureShape, OPENING_CATALOG, openingKindForShape } from './domain/objectCatalog'
import type { FurnitureKind, ViewMode, WallSide } from './domain/types'
import RoomScene, { FreeCameraCompass3D, RoomCompass3D } from './components/RoomScene'
import { FurnitureIcon, OpeningIcon, StructurePackIcon, StructureSurfaceIcon } from './components/iconCatalog'
import InteractionLogger from './components/InteractionLogger'
import { structureSurfaceElementId, useRoomStore } from './state/useRoomStore'
import type { StructureSurfaceKey } from './domain/types'
import './styles.css'

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'isometric', label: 'Isométrica', icon: '◇' },
  { id: 'top', label: 'Plano', icon: '▦' },
  { id: 'front', label: 'Frontal', icon: '▣' },
  { id: 'pov', label: 'POV', icon: '◉' },
  { id: 'free', label: 'Libre', icon: '✥' },
]
const ORBIT_DRAG_SENSITIVITY = 0.009

function visibleWallsForView(view: ViewMode, orientation: number, wallView: WallSide | null, freeAzimuth: number): WallSide[] {
  if (view === 'isometric') return visibleWallsForOrientation(orientation)
  if (view === 'free') return visibleWallsForOrientation(orientationForAzimuth(freeAzimuth))
  if (view === 'front') return [wallView ?? 'north']
  if (view === 'top') return []
  return []
}

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

function DimensionControl({ field, label }: { field: 'width' | 'depth' | 'height'; label: string }) {
  const room = useRoomStore((state) => state.room)
  const setDimension = useRoomStore((state) => state.setDimension)
  return (
    <label className="range-control">
      <span><span>{label}</span><strong>{room[field].toFixed(1)} m</strong></span>
      <input
        type="range"
        min={field === 'width' ? ROOM_LIMITS.minWidth : field === 'depth' ? ROOM_LIMITS.minDepth : ROOM_LIMITS.minHeight}
        max={field === 'width' ? ROOM_LIMITS.maxWidth : field === 'depth' ? ROOM_LIMITS.maxDepth : ROOM_LIMITS.maxHeight}
        step="0.25"
        value={room[field]}
        onChange={(event) => setDimension(field, Number(event.target.value))}
      />
    </label>
  )
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  return (
    <label className="color-control">
      <span>{label}</span>
      <span className="color-control__input">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
        <small>{value.toUpperCase()}</small>
      </span>
    </label>
  )
}

function StructurePositionControls({
  label,
  position,
  onChange,
  onStart,
  onEnd,
}: {
  label: string
  position: { x: number; y: number; z: number }
  onChange: (axis: 'x' | 'y' | 'z', value: number) => void
  onStart: () => void
  onEnd: () => void
}) {
  return (
    <>
      {(['x', 'y', 'z'] as const).map((axis) => (
        <label className="range-control compact" key={axis}>
          <span><span>{label} {axis.toUpperCase()}</span><strong>{position[axis].toFixed(2)} m</strong></span>
          <input
            type="range"
            min={Math.floor(Math.min(-10, position[axis]) / 0.05) * 0.05}
            max={Math.ceil(Math.max(10, position[axis]) / 0.05) * 0.05}
            step="0.05"
            value={position[axis]}
            onPointerDown={onStart}
            onPointerUp={onEnd}
            onPointerCancel={onEnd}
            onBlur={onEnd}
            onChange={(event) => onChange(axis, Number(event.target.value))}
          />
        </label>
      ))}
    </>
  )
}

function StructureSizeControls({
  surface,
  onChange,
  onStart,
  onEnd,
}: {
  surface: { width: number; height: number; depth: number }
  onChange: (dimension: 'width' | 'height' | 'depth', value: number) => void
  onStart: () => void
  onEnd: () => void
}) {
  return (
    <>
      {(['width', 'height', 'depth'] as const).map((dimension) => {
        const label = dimension === 'width' ? 'Anchura' : dimension === 'height' ? 'Altura' : 'Fondo'
        return (
          <label className="range-control compact" key={dimension}>
            <span><span>{label}</span><strong>{surface[dimension].toFixed(2)} m</strong></span>
            <input
              type="range"
              min="0.25"
              max={Math.max(10, Math.ceil(surface[dimension] * 4) / 4)}
              step="0.25"
              value={surface[dimension]}
              onPointerDown={onStart}
              onPointerUp={onEnd}
              onPointerCancel={onEnd}
              onBlur={onEnd}
              onChange={(event) => onChange(dimension, Number(event.target.value))}
            />
          </label>
        )
      })}
    </>
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

function OpeningSwatch({ kind, color }: { kind: 'door' | 'window' | 'circularWindow' | 'wallShelf' | 'mirrorRectangular' | 'mirrorCircular' | 'wallSconce'; color?: string }) {
  return <OpeningIcon kind={kind} color={color} />
}

function rotationDegrees(rotation: number) {
  const degrees = Math.round(rotation * 180 / Math.PI)
  return ((degrees + 180) % 360 + 360) % 360 - 180
}

function RotationDial({ rotation, onChange }: { rotation: number; onChange: (rotation: number) => void }) {
  const dragging = useRef(false)
  const indicatorX = 50 + Math.sin(rotation) * 34
  const indicatorY = 50 - Math.cos(rotation) * 34

  const setRotationFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return
    const x = (event.clientX - bounds.left) / bounds.width * 100 - 50
    const y = (event.clientY - bounds.top) / bounds.height * 100 - 50
    if (Math.hypot(x, y) < 4) return
    onChange(Math.atan2(x, -y))
  }

  const stopDragging = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <svg
      className="rotation-dial"
      viewBox="0 0 100 100"
      role="slider"
      aria-label="Giro del mueble"
      aria-valuemin={-180}
      aria-valuemax={180}
      aria-valuenow={rotationDegrees(rotation)}
      aria-valuetext={`${rotationDegrees(rotation)} grados`}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault()
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        setRotationFromPointer(event)
      }}
      onPointerMove={(event) => {
        if (dragging.current) setRotationFromPointer(event)
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onKeyDown={(event) => {
        const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
            ? -1
            : 0
        if (direction) {
          event.preventDefault()
          onChange(rotation + direction * Math.PI / 36)
        } else if (event.key === 'Home') {
          event.preventDefault()
          onChange(0)
        } else if (event.key === 'End') {
          event.preventDefault()
          onChange(Math.PI)
        }
      }}
    >
      <circle className="rotation-dial__track" cx="50" cy="50" r="39" />
      <line className="rotation-dial__indicator" x1="50" y1="50" x2={indicatorX} y2={indicatorY} />
      <circle className="rotation-dial__center" cx="50" cy="50" r="3" />
    </svg>
  )
}

function RotationControl({ rotation, onChange }: { rotation: number; onChange: (rotation: number) => void }) {
  return (
    <div className="rotation-control">
      <label className="property-angle">
        <small>Giro</small>
        <span>
          <input
            type="number"
            min={-180}
            max={180}
            step={1}
            value={rotationDegrees(rotation)}
            onChange={(event) => onChange(Number(event.target.value) * Math.PI / 180)}
          />
          <b>°</b>
        </span>
      </label>
      <div className="rotation-dial-card">
        <small>Ajustar giro</small>
        <RotationDial rotation={rotation} onChange={onChange} />
      </div>
    </div>
  )
}

function SelectionInspector() {
  const room = useRoomStore((state) => state.room)
  const furniture = useRoomStore((state) => state.furniture)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const selectedId = useRoomStore((state) => state.selectedId)
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const moveFurnitureVertically = useRoomStore((state) => state.moveFurnitureVertically)
  const setFurnitureRotation = useRoomStore((state) => state.setFurnitureRotation)
  const setFurnitureColor = useRoomStore((state) => state.setFurnitureColor)
  const rotateFurniture = useRoomStore((state) => state.rotateFurniture)
  const removeFurniture = useRoomStore((state) => state.removeFurniture)
  const setDoor = useRoomStore((state) => state.setDoor)
  const updateWindow = useRoomStore((state) => state.updateWindow)
  const removeWindow = useRoomStore((state) => state.removeWindow)
  const moveStructurePack = useRoomStore((state) => state.moveStructurePack)
  const moveStructureSurface = useRoomStore((state) => state.moveStructureSurface)
  const resizeStructureSurface = useRoomStore((state) => state.resizeStructureSurface)
  const setStructureSurfaceRotation = useRoomStore((state) => state.setStructureSurfaceRotation)
  const setStructureSurfaceColor = useRoomStore((state) => state.setStructureSurfaceColor)
  const addStructureSurface = useRoomStore((state) => state.addStructureSurface)
  const removeStructurePack = useRoomStore((state) => state.removeStructurePack)
  const removeStructureSurface = useRoomStore((state) => state.removeStructureSurface)
  const beginStructureMove = useRoomStore((state) => state.beginStructureMove)
  const endStructureMove = useRoomStore((state) => state.endStructureMove)
  const selectElement = useRoomStore((state) => state.selectElement)
  const toggleElementVisibility = useRoomStore((state) => state.toggleElementVisibility)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const selectedPack = structurePacks.find((pack) => pack.id === selectedId)
  const selectedSurface = structurePacks.flatMap((pack) => pack.surfaces.map((surface) => ({ pack, surface })))
    .find(({ pack, surface }) => structureSurfaceElementId(pack.id, surface.id) === selectedId)
  const selectedFurniture = furniture.find((item) => item.id === selectedId)
  const selectedWindow = room.windows.find((window) => window.id === selectedId)
  const selectedOpening = selectedId === 'door'
    ? { ...room.door, id: 'door' as const, kind: 'door' as const, sill: 0 }
    : selectedWindow ? { ...selectedWindow, kind: 'window' as const } : null

  if (selectedPack) {
    const existingSurfaces = new Set(selectedPack.surfaces.map((surface) => surface.id))
    const availableSurfaces: { id: StructureSurfaceKey; label: string }[] = [
      { id: 'floor', label: 'Suelo' },
      { id: 'ceiling', label: 'Techo' },
      { id: 'wall-north', label: 'Pared norte' },
      { id: 'wall-east', label: 'Pared este' },
      { id: 'wall-south', label: 'Pared sur' },
      { id: 'wall-west', label: 'Pared oeste' },
    ]
    return (
      <section className="panel-section selection-section selection-section--inspector">
        <span className="eyebrow">Pack de construcción</span>
        <h2>{selectedPack.name}</h2>
        <p className="section-copy">Mueve el pack completo; selecciona una superficie en la escena o en la lista para editarla por separado.</p>
        <StructurePositionControls
          label="Mover pack"
          position={selectedPack}
          onChange={(axis, value) => moveStructurePack(selectedPack.id, axis, value)}
          onStart={beginStructureMove}
          onEnd={endStructureMove}
        />
        <h3>Superficies del pack</h3>
        {selectedPack.surfaces.map((surface) => {
          const id = structureSurfaceElementId(selectedPack.id, surface.id)
          return (
            <div className="structure-surface-visibility" key={surface.id}>
              <label title={`Mostrar u ocultar ${surface.name}`}>
                <input type="checkbox" checked={!hiddenElementIds.includes(id)} onChange={() => toggleElementVisibility(id)} />
                <small>{hiddenElementIds.includes(id) ? 'Oculta' : 'Visible'}</small>
              </label>
              <button type="button" onClick={() => selectElement(id)}>{surface.name} · Editar</button>
            </div>
          )
        })}
        <h3>Añadir superficie</h3>
        {availableSurfaces.filter((surface) => !existingSurfaces.has(surface.id)).map((surface) => (
          <button type="button" className="text-button" key={surface.id} onClick={() => addStructureSurface(selectedPack.id, surface.id)}>
            ＋ Añadir {surface.label.toLowerCase()}
          </button>
        ))}
        <button type="button" className="text-button danger" onClick={() => removeStructurePack(selectedPack.id)}>Eliminar piso completo</button>
      </section>
    )
  }

  if (selectedSurface) {
    const { pack, surface } = selectedSurface
    return (
      <section className="panel-section selection-section selection-section--inspector">
        <span className="eyebrow">Superficie de construcción</span>
        <h2>{surface.name}</h2>
        <p className="section-copy">{pack.name} · posición independiente respecto al pack.</p>
        <StructurePositionControls
          label="Desplazamiento"
          position={surface}
          onChange={(axis, value) => moveStructureSurface(pack.id, surface.id, axis, value)}
          onStart={beginStructureMove}
          onEnd={endStructureMove}
        />
        <StructureSizeControls
          surface={surface}
          onChange={(dimension, value) => resizeStructureSurface(pack.id, surface.id, dimension, value)}
          onStart={beginStructureMove}
          onEnd={endStructureMove}
        />
        {surface.kind === 'wall' && (
          <label className="range-control compact">
            <span><span>Giro</span><strong>{Math.round(surface.rotation * 180 / Math.PI)}°</strong></span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={Math.round(surface.rotation * 180 / Math.PI)}
              onChange={(event) => setStructureSurfaceRotation(pack.id, surface.id, Number(event.target.value) * Math.PI / 180)}
            />
          </label>
        )}
        <ColorControl
          label="Color de la superficie"
          value={surface.color}
          onChange={(color) => setStructureSurfaceColor(pack.id, surface.id, color)}
        />
        <button type="button" className="text-button" onClick={() => selectElement(pack.id)}>Seleccionar pack completo</button>
        <button type="button" className="text-button danger" onClick={() => removeStructureSurface(pack.id, surface.id)}>Eliminar superficie</button>
      </section>
    )
  }

  if (selectedFurniture) {
    const extents = furnitureHalfExtents(selectedFurniture)
    const canChangeElevation = !isFloorBoundFurniture(selectedFurniture.kind) && !isCeilingMountedFurniture(selectedFurniture.kind)
    const canRotate = !isCeilingMountedFurniture(selectedFurniture.kind)
    const xLimit = Math.max(0, room.width / 2 - extents.halfWidth)
    const zLimit = Math.max(0, room.depth / 2 - extents.halfDepth)
    return (
      <section className="panel-section selection-section selection-section--inspector">
        <span className="eyebrow">Inspector del elemento</span>
        <div className="selected-heading"><FurnitureIcon kind={selectedFurniture.kind} color={selectedFurniture.color} /><div><h2>{selectedFurniture.name}</h2><p>{selectedFurniture.x.toFixed(2)}, {selectedFurniture.z.toFixed(2)} m</p></div></div>
        <div className="property-grid" aria-label="Características del mueble">
          <span><small>Anchura</small><strong>{selectedFurniture.width.toFixed(2)} m</strong></span>
          <span><small>Fondo</small><strong>{selectedFurniture.depth.toFixed(2)} m</strong></span>
          <span><small>Altura</small><strong>{selectedFurniture.height.toFixed(2)} m</strong></span>
        </div>
        <label className="range-control compact">
          <span><span>Posición X</span><strong>{selectedFurniture.x.toFixed(2)} m</strong></span>
          <input type="range" min={-xLimit} max={xLimit} step={ROOM_LIMITS.placementStep} value={selectedFurniture.x} onChange={(event) => moveFurniture(selectedFurniture.id, Number(event.target.value), selectedFurniture.z)} />
        </label>
        <label className="range-control compact">
          <span><span>Posición Z</span><strong>{selectedFurniture.z.toFixed(2)} m</strong></span>
          <input type="range" min={-zLimit} max={zLimit} step={ROOM_LIMITS.placementStep} value={selectedFurniture.z} onChange={(event) => moveFurniture(selectedFurniture.id, selectedFurniture.x, Number(event.target.value))} />
        </label>
        {canChangeElevation && <label className="range-control compact">
          <span><span>Posición Y</span><strong>{selectedFurniture.y.toFixed(2)} m</strong></span>
          <input type="range" min={0} max={Math.max(0, room.height - selectedFurniture.height)} step={ROOM_LIMITS.placementStep} value={selectedFurniture.y} onChange={(event) => moveFurnitureVertically(selectedFurniture.id, Number(event.target.value))} />
        </label>}
        {canRotate && <RotationControl
          rotation={selectedFurniture.rotation}
          onChange={(rotation) => setFurnitureRotation(selectedFurniture.id, rotation)}
        />}
        <ColorControl
          label="Color del objeto"
          value={selectedFurniture.color}
          onChange={(color) => setFurnitureColor(selectedFurniture.id, color)}
        />
        <div className="object-actions">
          {canRotate && <button type="button" onClick={rotateFurniture}><span>↻</span> Girar 90°</button>}
          <button type="button" className="danger" onClick={removeFurniture}><span>×</span> Eliminar</button>
        </div>
        <p className="rotation-hint">En la vista también puedes arrastrar los ejes X, Y y Z y el aro de giro.</p>
      </section>
    )
  }

  if (selectedOpening) {
    const pictureShape = selectedOpening.kind === 'window' && isWallPictureShape(selectedOpening.shape)
      ? selectedOpening.shape
      : null
    const wallPicture = pictureShape !== null
    const wallShelf = selectedOpening.kind === 'window' && selectedOpening.shape === 'wallShelf'
    const wallMirror = selectedOpening.kind === 'window' && isWallMirrorShape(selectedOpening.shape)
    const wallSconce = selectedOpening.kind === 'window' && selectedOpening.shape === 'wallSconce'
    const catalogKind = selectedOpening.kind === 'door' ? 'door' : openingKindForShape(selectedOpening.shape)
    const openingSwatchKind = selectedOpening.kind === 'door'
      ? 'door'
      : selectedOpening.shape === 'wallShelf'
        ? 'wallShelf'
        : isWallMirrorShape(selectedOpening.shape)
          ? selectedOpening.shape
        : selectedOpening.shape === 'wallSconce'
          ? 'wallSconce'
        : selectedOpening.shape === 'circular'
          ? 'circularWindow'
          : wallPicture
            ? null
            : 'window'
    const capabilities = OPENING_CATALOG[catalogKind].capabilities
    const openingName = OPENING_CATALOG[catalogKind].name
    const rawMaxOffset = Math.max(0, wallLength(room, selectedOpening.wall) / 2 - selectedOpening.width / 2 - ROOM_LIMITS.edgeMargin)
    const openingStep = selectedOpening.kind === 'window' ? ROOM_LIMITS.gridSize : ROOM_LIMITS.placementStep
    const maxOffset = Math.floor(rawMaxOffset / openingStep) * openingStep
    const maxSill = Math.max(0, Math.floor((room.height - selectedOpening.height - 0.08) / ROOM_LIMITS.gridSize) * ROOM_LIMITS.gridSize)
    const update = (partial: { wall?: WallSide; offset?: number; rotation?: number; color?: string }) => {
      if (selectedOpening.kind === 'door') {
        setDoor(partial)
      } else updateWindow(selectedOpening.id, partial)
    }
    return (
      <section className="panel-section selection-section selection-section--inspector">
        <span className="eyebrow">Inspector del elemento</span>
        <div className="selected-heading">{pictureShape ? <FurnitureIcon kind={pictureShape} color={selectedOpening.color ?? '#d49a72'} /> : openingSwatchKind && <OpeningSwatch kind={openingSwatchKind} color={selectedOpening.color} />}<div><h2>{openingName}</h2><p>{wallShelf || wallPicture || wallMirror || wallSconce ? 'Elemento montado en pared' : 'Apertura seleccionada'}</p></div></div>
        <div className="property-grid" aria-label={`Características de ${openingName.toLowerCase()}`}>
          <span><small>Anchura</small><strong>{selectedOpening.width.toFixed(2)} m</strong></span>
          <span><small>Altura</small><strong>{selectedOpening.height.toFixed(2)} m</strong></span>
          <span><small>Pared</small><strong>{WALL_LABELS[selectedOpening.wall]}</strong></span>
          <span><small>{wallShelf || wallPicture || wallMirror || wallSconce ? 'Altura base' : selectedOpening.kind === 'window' ? 'Antepecho' : 'Desde suelo'}</small><strong>{selectedOpening.sill.toFixed(2)} m</strong></span>
        </div>
        <ColorControl
          label="Color del objeto"
          value={selectedOpening.color ?? (selectedOpening.kind === 'door' ? '#ac704b' : '#c88f58')}
          onChange={(color) => update({ color })}
        />
        {capabilities.rotation.enabled && (
          <RotationControl
            rotation={selectedOpening.rotation}
            onChange={(rotation) => update({ rotation })}
          />
        )}
        {capabilities.canChangeWall && <WallPicker label="Pared" value={selectedOpening.wall} onChange={(wall) => update({ wall })} />}
        {capabilities.translation.includes('wall-horizontal') && <label className="range-control compact">
          <span><span>Posición lateral</span><strong>{selectedOpening.offset.toFixed(2)} m</strong></span>
          <input type="range" min={-maxOffset} max={maxOffset} step={openingStep} value={selectedOpening.offset} onChange={(event) => update({ offset: Number(event.target.value) })} />
        </label>}
        {selectedOpening.kind === 'window' && capabilities.translation.includes('wall-vertical') && (
          <label className="range-control compact">
            <span><span>Altura desde el suelo</span><strong>{selectedOpening.sill.toFixed(2)} m</strong></span>
            <input
              type="range"
              min={0}
              max={maxSill}
              step={ROOM_LIMITS.gridSize}
              value={selectedOpening.sill}
              onChange={(event) => updateWindow(selectedOpening.id, { sill: Number(event.target.value) })}
            />
          </label>
        )}
        <p className="rotation-hint">{capabilities.rotation.enabled ? 'Arrastra los ejes para mover el elemento y el aro naranja para girarlo.' : 'Arrastra las flechas horizontales para moverla a izquierda o derecha.'}</p>
        {selectedOpening.kind === 'window' && capabilities.removable && <button type="button" className="text-button danger" onClick={() => removeWindow(selectedOpening.id)}>Eliminar {openingName.toLowerCase()}</button>}
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
  const [wallColorsCollapsed, setWallColorsCollapsed] = useState(false)
  const [shortcutGuideCollapsed, setShortcutGuideCollapsed] = useState(false)
  const room = useRoomStore((state) => state.room)
  const setWallColor = useRoomStore((state) => state.setWallColor)
  const setWallSideColor = useRoomStore((state) => state.setWallSideColor)
  const setFloorColor = useRoomStore((state) => state.setFloorColor)
  return (
    <aside id="settings-panel" className="side-panel settings-panel" aria-label="Inspector y configuración detallada">
      <div className="side-panel__content settings-panel__content">
        <section className="panel-section shortcut-guide">
          <h3 className="shortcut-guide__heading">
            <button
              type="button"
              className="shortcut-guide__toggle"
              aria-expanded={!shortcutGuideCollapsed}
              aria-controls="shortcut-guide-list"
              onClick={() => setShortcutGuideCollapsed((collapsed) => !collapsed)}
            >
              <span>Atajos de teclado</span>
              <span className="shortcut-guide__chevron" aria-hidden="true" />
            </button>
          </h3>
          <div id="shortcut-guide-list" hidden={shortcutGuideCollapsed}>
            <dl className="shortcut-list">
              <div><dt>Deshacer</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Z</kbd></dd></div>
              <div><dt>Rehacer</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd></dd></div>
              <div><dt>Copiar elemento</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>C</kbd></dd></div>
              <div><dt>Pegar elemento</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>V</kbd></dd></div>
              <div><dt>Duplicar elemento</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>D</kbd></dd></div>
              <div><dt>Girar elemento</dt><dd><kbd>R</kbd></dd></div>
              <div><dt>Eliminar elemento</dt><dd><kbd>Supr</kbd> / <kbd>Retroceso</kbd></dd></div>
            </dl>
            <p className="shortcut-guide__hint">Copia, pega y duplica con un elemento seleccionado.</p>
          </div>
        </section>
        <SelectionInspector />
        <section className="panel-section room-section">
          <span className="eyebrow">Espacio</span>
          <h2>Tu habitación</h2>
          <p className="section-copy">Ajusta el tamaño, los colores y las aperturas.</p>
          <div className="dimension-visual" aria-hidden="true">
            <span>{room.depth.toFixed(1)} m</span><div><b>{room.width.toFixed(1)} m</b><i>⌂</i></div>
          </div>
          <DimensionControl field="width" label="Anchura" />
          <DimensionControl field="depth" label="Profundidad" />
          <DimensionControl field="height" label="Altura" />
          <ColorControl
            label="Suelo"
            value={room.floorColor ?? DEFAULT_FLOOR_COLOR}
            onChange={setFloorColor}
          />
          <ColorControl
            label="Todas las paredes"
            value={room.wallColor ?? DEFAULT_WALL_COLOR}
            onChange={setWallColor}
          />
          <h3 className={`wall-colors-heading${wallColorsCollapsed ? ' wall-colors-heading--collapsed' : ''}`}>
            <button
              type="button"
              className="catalog-family__toggle"
              aria-expanded={!wallColorsCollapsed}
              aria-controls="wall-color-controls"
              aria-label={`${wallColorsCollapsed ? 'Mostrar' : 'Minimizar'} controles de color de las paredes`}
              onClick={() => setWallColorsCollapsed((collapsed) => !collapsed)}
            >
              <i aria-hidden="true" />
              Paredes por separado
            </button>
          </h3>
          <div id="wall-color-controls" hidden={wallColorsCollapsed}>
            {WALL_SIDES.map((wall) => (
              <ColorControl
                key={wall}
                label={`Pared ${WALL_LABELS[wall]}`}
                value={room.wallColors?.[wall] ?? room.wallColor ?? DEFAULT_WALL_COLOR}
                onChange={(color) => setWallSideColor(wall, color)}
              />
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}

function ObjectsPanel() {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const [catalogCollapsed, setCatalogCollapsed] = useState(false)
  const room = useRoomStore((state) => state.room)
  const furniture = useRoomStore((state) => state.furniture)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const selectedId = useRoomStore((state) => state.selectedId)
  const view = useRoomStore((state) => state.view)
  const isoOrientation = useRoomStore((state) => state.isoOrientation)
  const freeAzimuth = useRoomStore((state) => state.freeAzimuth)
  const wallView = useRoomStore((state) => state.wallView)
  const gridVisibility = useRoomStore((state) => state.gridVisibility)
  const addFurniture = useRoomStore((state) => state.addFurniture)
  const addWindow = useRoomStore((state) => state.addWindow)
  const addStructurePack = useRoomStore((state) => state.addStructurePack)
  const addStructureObject = useRoomStore((state) => state.addStructureObject)
  const selectElement = useRoomStore((state) => state.selectElement)
  const toggleGridVisibility = useRoomStore((state) => state.toggleGridVisibility)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const toggleElementVisibility = useRoomStore((state) => state.toggleElementVisibility)
  const sceneElements = [
    { id: 'door', name: 'Puerta', kind: 'Apertura' },
    ...room.windows.map((window, index) => {
      const name = OPENING_CATALOG[openingKindForShape(window.shape)].name
      const family = window.shape === 'wallShelf' ? 'Almacenaje' : isWallPictureShape(window.shape) || isWallMirrorShape(window.shape) || window.shape === 'wallSconce' ? 'Decoración' : 'Apertura'
      return { id: window.id, name: `${name} ${index + 1}`, kind: `${family} · pared ${WALL_LABELS[window.wall]}` }
    }),
    ...furniture.map((item) => ({ id: item.id, name: item.name, kind: FURNITURE_FAMILIES.find((family) => family.id === FURNITURE_CATALOG[item.kind].family)?.label ?? 'Mueble' })),
    ...structurePacks.flatMap((pack) => [
      { id: pack.id, name: pack.name, kind: 'Pack de construcción' },
      ...pack.surfaces.map((surface) => ({
        id: structureSurfaceElementId(pack.id, surface.id),
        name: `${pack.name} · ${surface.name}`,
        kind: 'Superficie de construcción',
      })),
    ]),
  ]
  const visibleGridWalls = visibleWallsForView(view, isoOrientation, wallView, freeAzimuth)
  const gridControls = [
    { id: 'floor' as const, label: 'Suelo' },
    ...visibleGridWalls.map((wall) => ({ id: wall, label: `Pared ${WALL_LABELS[wall]}` })),
  ]
  const toggleCategory = (category: string) => {
    setCollapsedCategories((current) => ({ ...current, [category]: !current[category] }))
  }

  return (
    <aside id="objects-panel" className="side-panel objects-panel" aria-label="Catálogo de objetos">
      <div className="side-panel__content objects-panel__content">
        <section className="panel-section">
        <span className="eyebrow">Objetos</span>
        <div className="catalog-heading">
          <div>
            <h2>Pequeño catálogo</h2>
            {!catalogCollapsed && <p className="section-copy">Añade muebles, aperturas y decoración mural, o selecciona la puerta existente.</p>}
          </div>
          <button
            type="button"
            className="catalog-family__toggle catalog-toggle-all"
            aria-expanded={!catalogCollapsed}
            aria-controls="catalog-families"
            aria-label={catalogCollapsed ? 'Mostrar catálogo completo' : 'Minimizar catálogo completo'}
            onClick={() => setCatalogCollapsed((collapsed) => !collapsed)}
          >
            <i aria-hidden="true" />
          </button>
        </div>
        {!catalogCollapsed && <div className="catalog-families" id="catalog-families">
          <section className={`catalog-family ${collapsedCategories.structure ? 'catalog-family--collapsed' : ''}`} aria-labelledby="catalog-structure">
            <h3>
              <button
                id="catalog-structure"
                type="button"
                className="catalog-family__toggle"
                aria-expanded={!collapsedCategories.structure}
                aria-controls="catalog-grid-structure"
                onClick={() => toggleCategory('structure')}
              >
                <span>Construcción</span><i aria-hidden="true" />
              </button>
            </h3>
            {!collapsedCategories.structure && <div className="catalog-grid" id="catalog-grid-structure">
              <button type="button" className="catalog-card" onClick={addStructurePack}>
                <StructurePackIcon />
                <span>Nuevo piso vacío</span><small>＋ Pack apilado</small>
              </button>
              <button type="button" className="catalog-card" onClick={() => addStructureObject('floor')}>
                <StructureSurfaceIcon kind="floor" />
                <span>Suelo</span><small>＋ Objeto independiente</small>
              </button>
              <button type="button" className="catalog-card" onClick={() => addStructureObject('wall')}>
                <StructureSurfaceIcon kind="wall" />
                <span>Pared</span><small>＋ Objeto independiente</small>
              </button>
            </div>}
          </section>
          <section className={`catalog-family ${collapsedCategories.openings ? 'catalog-family--collapsed' : ''}`} aria-labelledby="catalog-openings">
            <h3>
              <button
                id="catalog-openings"
                type="button"
                className="catalog-family__toggle"
                aria-expanded={!collapsedCategories.openings}
                aria-controls="catalog-grid-openings"
                onClick={() => toggleCategory('openings')}
              >
                <span>Aperturas</span><i aria-hidden="true" />
              </button>
            </h3>
            {!collapsedCategories.openings && <div className="catalog-grid" id="catalog-grid-openings">
              <button type="button" className={`catalog-card ${selectedId === 'door' ? 'active' : ''}`} onClick={() => selectElement('door')} aria-pressed={selectedId === 'door'}>
                <OpeningSwatch kind="door" />
                <span>{OPENING_CATALOG.door.name}</span><small>Seleccionar</small>
              </button>
              <button type="button" className="catalog-card" onClick={() => addWindow('rectangular')}>
                <OpeningSwatch kind="window" />
                <span>{OPENING_CATALOG.window.name}</span><small>＋ Añadir</small>
              </button>
              <button type="button" className="catalog-card" onClick={() => addWindow('circular')}>
                <OpeningSwatch kind="circularWindow" />
                <span>{OPENING_CATALOG.circularWindow.name}</span><small>＋ Añadir</small>
              </button>
            </div>}
          </section>
          {FURNITURE_FAMILIES.map((family) => {
            const kinds = (Object.keys(FURNITURE_CATALOG) as FurnitureKind[]).filter((kind) => FURNITURE_CATALOG[kind].family === family.id)
            return (
              <section className={`catalog-family ${collapsedCategories[family.id] ? 'catalog-family--collapsed' : ''}`} key={family.id} aria-labelledby={`catalog-${family.id}`}>
                <h3>
                  <button
                    id={`catalog-${family.id}`}
                    type="button"
                    className="catalog-family__toggle"
                    aria-expanded={!collapsedCategories[family.id]}
                    aria-controls={`catalog-grid-${family.id}`}
                    onClick={() => toggleCategory(family.id)}
                  >
                    <span>{family.label}</span><i aria-hidden="true" />
                  </button>
                </h3>
                {!collapsedCategories[family.id] && <div className="catalog-grid" id={`catalog-grid-${family.id}`}>
                  {kinds.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className="catalog-card"
                      onClick={() => {
                        if (isWallPictureKind(kind)) addWindow(kind)
                        else addFurniture(kind)
                      }}
                    >
                      <FurnitureIcon kind={kind} />
                      <span>{FURNITURE_PRESETS[kind].name}</span><small>＋ Añadir</small>
                    </button>
                  ))}
                  {family.id === 'wallDecor' && (
                    <>
                      <button type="button" className="catalog-card" onClick={() => addWindow('wallSconce')}>
                        <OpeningSwatch kind="wallSconce" />
                        <span>{OPENING_CATALOG.wallSconce.name}</span><small>＋ Añadir</small>
                      </button>
                      <button type="button" className="catalog-card" onClick={() => addWindow('mirrorRectangular')}>
                        <OpeningSwatch kind="mirrorRectangular" />
                        <span>{OPENING_CATALOG.mirrorRectangular.name}</span><small>＋ Añadir</small>
                      </button>
                      <button type="button" className="catalog-card" onClick={() => addWindow('mirrorCircular')}>
                        <OpeningSwatch kind="mirrorCircular" />
                        <span>{OPENING_CATALOG.mirrorCircular.name}</span><small>＋ Añadir</small>
                      </button>
                    </>
                  )}
                  {family.id === 'storage' && (
                    <button type="button" className="catalog-card" onClick={() => addWindow('wallShelf')}>
                      <OpeningSwatch kind="wallShelf" />
                      <span>{OPENING_CATALOG.wallShelf.name}</span><small>＋ Añadir</small>
                    </button>
                  )}
                </div>}
              </section>
            )
          })}
        </div>}
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
        <section className="panel-section grid-section" aria-labelledby="grid-heading">
        <div className="grid-section__heading">
          <span className="grid-icon" aria-hidden="true">▦</span>
          <span><strong id="grid-heading">Cuadrículas visibles</strong><small>Cuadrados de 25 cm</small></span>
        </div>
        <div className="grid-visibility-list">
          {gridControls.map((surface) => (
            <div className="grid-visibility-row" key={surface.id}>
              <span>{surface.label}</span>
              <button
                type="button"
                className={`switch ${gridVisibility[surface.id] ? 'on' : ''}`}
                role="switch"
                aria-checked={gridVisibility[surface.id]}
                aria-label={`Mostrar cuadrícula de ${surface.label.toLowerCase()}`}
                onClick={() => toggleGridVisibility(surface.id)}
              ><span /></button>
            </div>
          ))}
        </div>
        <small className="grid-snap-note">El ajuste de movimiento a 12,5 cm se mantiene activo.</small>
        </section>
      </div>
    </aside>
  )
}

function ViewControls() {
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

function App() {
  const state = useRoomStore()
  const [settingsCollapsed, setSettingsCollapsed] = useState(false)
  const [objectsCollapsed, setObjectsCollapsed] = useState(false)
  const [savedDesignsOpen, setSavedDesignsOpen] = useState(false)
  const [createDesignOpen, setCreateDesignOpen] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')
  const [renamingDesignId, setRenamingDesignId] = useState<string | null>(null)
  const [renamingDesignName, setRenamingDesignName] = useState('')
  const [exportMode, setExportMode] = useState(false)
  const [exportRequest, setExportRequest] = useState(0)
  const [exportNotice, setExportNotice] = useState('')
  const savedDesignsRef = useRef<HTMLDivElement>(null)
  const savedDesignTriggerRef = useRef<HTMLButtonElement>(null)
  const sceneOrbitDrag = useRef<{
    pointerId: number
    mode: 'isometric' | 'free'
    startX: number
    startY: number
    startAngle: number
    startElevation: number
  } | null>(null)
  const currentView = VIEW_OPTIONS.find((option) => option.id === state.view)!
  const visibleWalls = visibleWallsForView(state.view, state.isoOrientation, state.wallView, state.freeAzimuth)
  const visibleWallsText = wallsDescription(state.view, visibleWalls)
  const hasPlacedSceneContent = state.furniture.length > 0
    || state.structurePacks.length > 0
    || state.room.windows.some((window) => !DEFAULT_ROOM.windows.some((defaultWindow) => defaultWindow.id === window.id))
  const viewLabel = state.view === 'front' && state.wallView
    ? `Frontal · ${WALL_LABELS[state.wallView]}`
    : currentView.label
  const activeDesignName = state.savedDesigns.find((design) => design.id === state.selectedSavedDesignId)?.name ?? 'Room Builder'
  useEffect(() => {
    state.initializeSavedDesigns()
  }, [state.initializeSavedDesigns])

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

  useEffect(() => {
    if (!state.notice) return
    const timer = window.setTimeout(state.clearNotice, 3200)
    return () => window.clearTimeout(timer)
  }, [state.notice, state.clearNotice])

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

  useEffect(() => {
    if (!exportNotice) return
    const timer = window.setTimeout(() => setExportNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [exportNotice])

  const handleExportComplete = useCallback((error?: Error) => {
    setExportMode(false)
    setExportNotice(error ? `No se pudo descargar el modelo: ${error.message}` : 'Modelo 3D descargado en formato GLB.')
  }, [])

  const createDesign = (mode: 'blank' | 'copy') => {
    if (!newDesignName.trim()) {
      state.createDesign(mode, '')
      return
    }
    state.createDesign(mode, newDesignName)
    setCreateDesignOpen(false)
    setNewDesignName('')
  }

  const exportDesignName = activeDesignName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'room-builder'

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) return

      const key = event.key.toLowerCase()
      const modifier = event.ctrlKey || event.metaKey
      if (modifier && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) state.redo()
        else state.undo()
        return
      }
      if (modifier && key === 'y') {
        event.preventDefault()
        state.redo()
        return
      }
      if (modifier && key === 'c' && state.copySelected()) {
        event.preventDefault()
        return
      }
      if (modifier && key === 'v' && state.pasteSelected()) {
        event.preventDefault()
        return
      }
      if (modifier && key === 'd') {
        if (state.copySelected()) {
          event.preventDefault()
          state.pasteSelected()
        }
        return
      }
      if (modifier || event.altKey) return
      if (key === 'r') state.rotateFurniture()
      if (event.key === 'Delete' || event.key === 'Backspace') state.removeSelected()
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [state.copySelected, state.pasteSelected, state.redo, state.removeSelected, state.rotateFurniture, state.undo])

  return (
    <div className="app">
      <InteractionLogger />
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
          <button
            type="button"
            className="secondary-button undo-button"
            onClick={state.undo}
            disabled={state.undoCount === 0}
            aria-label="Deshacer el último cambio"
            title="Deshacer el último cambio (Ctrl/⌘+Z)"
          >
            ↶ <span>Deshacer</span>
          </button>
          <button
            type="button"
            className="secondary-button undo-button"
            onClick={state.redo}
            disabled={state.redoCount === 0}
            aria-label="Rehacer el último cambio deshecho"
            title="Rehacer el último cambio deshecho (Ctrl/⌘+Shift+Z)"
          >
            ↷ <span>Rehacer</span>
          </button>
          <span className={`save-state${state.hasUnsavedChanges ? ' save-state--dirty' : ''}`} aria-live="polite">
            {state.hasUnsavedChanges ? 'Cambios sin guardar' : state.selectedSavedDesignId ? 'Guardado' : 'Sin guardar'}
          </span>
          <button
            type="button"
            className="secondary-button export-button"
            disabled={exportMode}
            onClick={() => {
              setExportMode(true)
              setExportRequest((request) => request + 1)
            }}
            title="Descargar la habitación como modelo 3D GLB"
          >
            ⇩ <span>{exportMode ? 'Exportando…' : 'Descargar 3D'}</span>
          </button>
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
          <button type="button" className="primary-button" onClick={state.saveDesign}>
            ✓ <span>{state.selectedSavedDesignId ? 'Guardar cambios' : 'Guardar como'}</span>
          </button>
        </div>
      </header>

      <main
        id="main"
        className={`workspace${settingsCollapsed ? ' workspace--settings-collapsed' : ''}${objectsCollapsed ? ' workspace--objects-collapsed' : ''}`}
      >
        <SettingsPanel />
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
          <button
            type="button"
            className="sidebar-toggle sidebar-toggle--settings"
            aria-controls="settings-panel"
            aria-expanded={!settingsCollapsed}
            aria-label={settingsCollapsed ? 'Mostrar panel izquierdo' : 'Minimizar panel izquierdo'}
            title={settingsCollapsed ? 'Mostrar panel izquierdo' : 'Minimizar panel izquierdo'}
            onClick={() => setSettingsCollapsed((collapsed) => !collapsed)}
          >
            <span aria-hidden="true">{settingsCollapsed ? '›' : '‹'}</span>
          </button>
          <button
            type="button"
            className="sidebar-toggle sidebar-toggle--objects"
            aria-controls="objects-panel"
            aria-expanded={!objectsCollapsed}
            aria-label={objectsCollapsed ? 'Mostrar panel derecho' : 'Minimizar panel derecho'}
            title={objectsCollapsed ? 'Mostrar panel derecho' : 'Minimizar panel derecho'}
            onClick={() => setObjectsCollapsed((collapsed) => !collapsed)}
          >
            <span aria-hidden="true">{objectsCollapsed ? '‹' : '›'}</span>
          </button>
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
            orientation={state.view === 'top' ? state.topOrientation : state.isoOrientation}
            isoAngle={state.isoAngle}
            isIsoOrbitDragging={state.isIsoOrbitDragging}
            freeAzimuth={state.freeAzimuth}
            freeElevation={state.freeElevation}
            isFreeOrbitDragging={state.isFreeOrbitDragging}
            cameraZoom={state.cameraZoom}
            wallView={state.wallView}
            frontCameraHeight={state.frontCameraHeight}
            povYaw={state.povYaw}
            gridSnap={state.gridSnap}
            gridVisibility={state.gridVisibility}
            furniture={state.furniture}
            structurePacks={state.structurePacks}
            exportMode={exportMode}
            exportRequest={exportRequest}
            onExportComplete={handleExportComplete}
            exportDesignName={exportDesignName}
          />
          {!hasPlacedSceneContent && state.view !== 'pov' && (
            <div className="empty-scene"><span>✦</span><strong>La habitación está lista</strong><small>Añade tu primera pieza desde el catálogo</small></div>
          )}
          <ViewControls />
          <div className={`zoom-indicator ${state.view === 'front' ? 'zoom-indicator--front' : ''}`} aria-live="polite">
            <b aria-hidden="true">↕</b>
            <span>Rueda · Zoom</span>
            <output>{Math.round(state.cameraZoom * 100)}%</output>
          </div>
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
        </section>
        <ObjectsPanel />
      </main>
      <footer className="statusbar">
        <span><i className="status-dot" /> Guardado local en tu navegador</span>
        <span>Cuadrado visible: 25 cm · ajuste: 12,5 cm</span>
      </footer>
      {(state.notice || exportNotice) && <div className="toast" role="status" aria-live="polite">{exportNotice || state.notice}</div>}
    </div>
  )
}

export default App
