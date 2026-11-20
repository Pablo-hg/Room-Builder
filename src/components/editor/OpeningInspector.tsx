import { formatPanelLength } from '../../domain/lengthUnit'
import { MaterialControl } from './MaterialControl'
import { useInspectorGesture } from './useInspectorGesture'
import { ROOM_LIMITS, WALL_LABELS } from '../../domain/constants'
import { FurnitureIcon } from '../iconCatalog'
import { wallLength } from '../../domain/geometry'
import { isWallMirrorShape, isWallPictureShape, openingKindForShape, OPENING_CATALOG } from '../../domain/objectCatalog'
import { useRoomStore } from '../../state/useRoomStore'
import type { DoorSwing, WallSide } from '../../domain/types'
import { doorSwingGeometry, doorSwingOf, HINGE_LABELS, SWING_SIDE_LABELS } from '../../domain/doorSwing'
import { AxisPositionControl, ColorControl, OpeningSwatch, PositionControl, RotationControl, WallPicker } from './Controls'
import { ResizeControls } from './ResizeControls'
import { packWindowById } from '../../domain/structureWindows'
import { openingPosition, openingRunBounds, worldOpenings } from '../../domain/wallConnections'

/** Vista previa del símbolo de plano de la puerta con el giro elegido (la pared va arriba; el interior, abajo). */
function SwingPreview({ swing }: { swing: DoorSwing }) {
  // Cabe el arco hacia los dos lados: la pared va en el centro, el exterior arriba y el interior abajo.
  const scale = 30, geometry = doorSwingGeometry(1, swing)
  const point = (p: { x: number; z: number }) => `${(p.x * scale + 60).toFixed(1)},${(p.z * scale + 40).toFixed(1)}`
  return <svg className="door-swing__preview" viewBox="0 0 120 80" role="img" aria-label={`Puerta con bisagra a la ${swing.hinge === 'left' ? 'izquierda' : 'derecha'}, abre ${swing.side === 'inside' ? 'hacia dentro' : 'hacia fuera'}`}>
    <path d="M8 40H45M75 40H112" className="door-swing__wall" />
    <path d={`M${point(geometry.arc[0])} ${geometry.arc.slice(1).map((p) => `L${point(p)}`).join(' ')}`} className="door-swing__arc" />
    <path d={`M${point(geometry.hinge)}L${point(geometry.leafEnd)}`} className="door-swing__leaf" />
    <text x="6" y="9" className="door-swing__label">Exterior</text>
    <text x="6" y="77" className="door-swing__label">Interior</text>
  </svg>
}

/** Bisagra y lado hacia el que se abre la puerta; solo cambia cómo se dibuja en el Plano (el modelo 3D sigue cerrado). */
function DoorSwingControl({ swing, disabled, onChange }: { swing: DoorSwing; disabled: boolean; onChange: (swing: DoorSwing) => void }) {
  const group = <T extends string>(label: string, current: T, options: Record<T, string>, set: (value: T) => void) => <div className="door-swing__group" role="group" aria-label={label}>
    <span>{label}</span>
    <div>{(Object.keys(options) as T[]).map((value) => <button key={value} type="button" disabled={disabled} aria-pressed={current === value} className={current === value ? 'is-active' : ''} onClick={() => set(value)}>{options[value]}</button>)}</div>
  </div>
  return <fieldset className="door-swing">
    <legend>Giro de la puerta en el Plano</legend>
    <SwingPreview swing={swing} />
    {group('Bisagra (mirando desde dentro)', swing.hinge, HINGE_LABELS, (hinge) => onChange({ ...swing, hinge }))}
    {group('Se abre', swing.side, SWING_SIDE_LABELS, (side) => onChange({ ...swing, side }))}
  </fieldset>
}

type RoomState = ReturnType<typeof useRoomStore.getState>
type SelectedOpening = (RoomState['room']['door'] & { id: string; kind: 'door'; sill: number }) | (RoomState['room']['windows'][number] & { kind: 'window' })

export function OpeningInspector({ selectedOpening }: { selectedOpening: SelectedOpening }) {
  const gesture = useInspectorGesture(selectedOpening.id)
  const room = useRoomStore((state) => state.room)
  useRoomStore((state) => state.lengthUnit) // las medidas se redibujan al cambiar de unidad
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const moveWallObject = useRoomStore((state) => state.moveWallObject)
  const detachWallObject = useRoomStore((state) => state.detachWallObject)
  const packWindow = selectedOpening.kind === 'window' ? packWindowById(structurePacks, selectedOpening.id) : null
  const world = { room, structurePacks }
  const source = worldOpenings(world).find((opening) => opening.id === selectedOpening.id)
  const sourcePack = structurePacks.find((pack) => pack.id === source?.packId)
  const worldPosition = openingPosition(world, selectedOpening, sourcePack?.id)
  const detached = selectedOpening.kind === 'window' && !!selectedOpening.freePosition
  const availableAxes = { x: detached || Math.abs(Math.sin(worldPosition.yaw)) < 1e-7,
    y: selectedOpening.kind !== 'door', z: detached || Math.abs(Math.cos(worldPosition.yaw)) < 1e-7 }
  const runBounds = openingRunBounds(world, selectedOpening.id)
  const targetWall = packWindow?.pack.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === selectedOpening.wall)
  const targetLength = targetWall?.width ?? wallLength(room, selectedOpening.wall)
  const setDoor = useRoomStore((state) => state.setDoor)
  const setStructureDoor = useRoomStore((state) => state.setStructureDoor)
  const removeStructureDoor = useRoomStore((state) => state.removeStructureDoor)
  const updateWindow = useRoomStore((state) => state.updateWindow)
  const removeWindow = useRoomStore((state) => state.removeWindow)
  const resizeWallObject = useRoomStore((state) => state.resizeWallObject)
  const locked = useRoomStore((state) => state.lockedElementIds.includes(selectedOpening.id)
    || !!sourcePack && state.lockedElementIds.includes(sourcePack.id))
  const pictureShape = selectedOpening.kind === 'window' && isWallPictureShape(selectedOpening.shape)
    ? selectedOpening.shape
    : null
  const wallPicture = pictureShape !== null
  const wallShelf = selectedOpening.kind === 'window' && selectedOpening.shape === 'wallShelf'
  const wallMirror = selectedOpening.kind === 'window' && isWallMirrorShape(selectedOpening.shape)
  const wallSconce = selectedOpening.kind === 'window' && selectedOpening.shape === 'wallSconce'
  const originalColor = selectedOpening.color ?? (selectedOpening.kind === 'door' ? '#ac704b' : '#c88f58')
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
  const openingName = selectedOpening.name || OPENING_CATALOG[catalogKind].name
  const free = selectedOpening.kind === 'window' && !!selectedOpening.freePosition
  const rawMaxOffset = Math.max(0, targetLength / 2 - selectedOpening.width / 2 - ROOM_LIMITS.edgeMargin)
  const openingStep = 0.01
  const maxOffset = Math.floor(rawMaxOffset / openingStep) * openingStep
  const position = worldPosition
  const setSwing = (swing: DoorSwing) => {
    if (selectedOpening.id === 'door') setDoor({ swing })
    else setStructureDoor(selectedOpening.id, { swing })
  }
  const update = (partial: { wall?: WallSide; offset?: number; rotation?: number; color?: string }) => {
    if (selectedOpening.kind === 'door') {
      if (selectedOpening.id === 'door') setDoor(partial)
      else setStructureDoor(selectedOpening.id, partial)
    } else updateWindow(selectedOpening.id, partial)
  }
  return (
    <section className="panel-section selection-section selection-section--inspector" {...gesture.events}>
      <span className="eyebrow">Inspector del elemento</span>
      <div className="selected-heading">{pictureShape ? <FurnitureIcon kind={pictureShape} color={selectedOpening.color ?? '#d49a72'} /> : openingSwatchKind && <OpeningSwatch kind={openingSwatchKind} color={selectedOpening.color} />}<div><h2>{openingName}</h2><p>{wallShelf || wallPicture || wallMirror || wallSconce ? 'Elemento montado en pared' : 'Apertura seleccionada'}</p></div></div>
      <div className="property-grid" aria-label={`Características de ${openingName.toLowerCase()}`}>
        <span><small>Anchura</small><strong>{formatPanelLength(selectedOpening.width)}</strong></span>
        <span><small>Altura</small><strong>{formatPanelLength(selectedOpening.height)}</strong></span>
        <span><small>{free ? 'Anclaje' : 'Pared'}</small><strong>{free ? 'Libre' : WALL_LABELS[selectedOpening.wall]}</strong></span>
        <span><small>{free || wallShelf || wallPicture || wallMirror || wallSconce ? 'Altura base' : selectedOpening.kind === 'window' ? 'Antepecho' : 'Desde suelo'}</small><strong>{formatPanelLength(free ? position.y : selectedOpening.sill)}</strong></span>
      </div>
      {selectedOpening.kind === 'window' && <ResizeControls capability={capabilities.resize} value={selectedOpening} disabled={locked} onChange={(dimension, value) => { if (dimension !== 'depth') resizeWallObject(selectedOpening.id, dimension, value) }} />}
      {!selectedOpening.material && <ColorControl
        label="Color del objeto"
        value={originalColor}
        disabled={locked}
        onChange={(color) => update({ color })}
      />}
      <MaterialControl elementId={selectedOpening.id} color={originalColor} finish={selectedOpening.material} disabled={locked} />
      {capabilities.rotation.enabled && (
        <RotationControl
          rotation={selectedOpening.rotation}
          onChange={(rotation) => update({ rotation })}
          disabled={locked}
        />
      )}
      {selectedOpening.kind === 'door' && <DoorSwingControl swing={doorSwingOf(selectedOpening)} disabled={locked} onChange={setSwing} />}
      {capabilities.canChangeWall && <WallPicker label="Pared" value={selectedOpening.wall} onChange={(wall) => update({ wall })} disabled={locked} />}
      {/* Objetos de pared: fijados por defecto; al arrastrarlos libres se fijan solos al tocar una pared. Solo la casilla los despega. */}
      {selectedOpening.kind === 'window' && <div className="wall-attachment-controls">
        <label><input type="checkbox" checked={!selectedOpening.freePosition} disabled={locked} onChange={(event) => {
          if (event.target.checked) update({ wall: selectedOpening.wall })
          else detachWallObject(selectedOpening.id)
        }} /> Fijar a pared</label>
        <p className="rotation-hint">{selectedOpening.freePosition
          ? `Libre: muévelo en XYZ. Marca la casilla para colocarlo en la pared ${WALL_LABELS[selectedOpening.wall]}, o acércalo a una pared y se fijará solo.`
          : 'Fijado a la pared: se desliza por ella. Desmarca la casilla para despegarlo.'}</p>
      </div>}
      {(['x', 'y', 'z'] as const).map((axis) => {
        const component = axis === 'x' ? Math.cos(position.yaw) : axis === 'z' ? -Math.sin(position.yaw) : 0
        const limits = runBounds && axis !== 'y' ? [position[axis] + component * runBounds.min, position[axis] + component * runBounds.max] : [-20, 20]
        return <AxisPositionControl key={axis} id={selectedOpening.id} axis={axis} label={`Posición ${axis.toUpperCase()}`} value={position[axis]} min={Math.min(position[axis], ...limits)} max={Math.max(position[axis], ...limits)} step={openingStep} disabled={locked} locked={selectedOpening.axisLocks?.[axis] ?? false} unavailable={!availableAxes[axis]} onChange={(value) => moveWallObject(selectedOpening.id, axis, value)} />
      })}
      {!free && !availableAxes.x && !availableAxes.z && <PositionControl label="Desplazamiento por la pared" value={selectedOpening.offset} min={runBounds ? selectedOpening.offset + runBounds.min : -maxOffset} max={runBounds ? selectedOpening.offset + runBounds.max : maxOffset} step={openingStep} disabled={locked || !!selectedOpening.axisLocks?.x || !!selectedOpening.axisLocks?.z} onChange={(offset) => update({ offset })} />}
      {selectedOpening.kind === 'window' && <p className="rotation-hint">{free ? 'Elemento libre: puedes moverlo en XYZ o volver a colocarlo en una pared.' : 'Fijado a la pared: el eje perpendicular está bloqueado. Despega el elemento para moverlo libremente.'}</p>}
      {locked
        ? <p className="lock-hint">Elemento bloqueado: desbloquea el candado de la lista para moverlo o girarlo.</p>
        : <p className="rotation-hint">{capabilities.rotation.enabled ? 'Arrastra los ejes para mover el elemento y el aro naranja para girarlo.' : 'Arrastra las flechas horizontales para moverla a izquierda o derecha.'}</p>}
      {selectedOpening.kind === 'window' && capabilities.removable && <button type="button" className="text-button danger" disabled={locked} title={locked ? "Desbloquea el elemento para eliminarlo" : undefined} onClick={() => removeWindow(selectedOpening.id)}>Eliminar {openingName.toLowerCase()}</button>}
      {selectedOpening.kind === 'door' && selectedOpening.id !== 'door' && <button type="button" className="text-button danger" disabled={locked} title={locked ? "Desbloquea el elemento para eliminarlo" : undefined} onClick={() => removeStructureDoor(selectedOpening.id)}>Eliminar puerta</button>}
    </section>
  )

}
