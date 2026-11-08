import { useInspectorGesture } from './useInspectorGesture'
import { ROOM_LIMITS, WALL_LABELS } from '../../domain/constants'
import { FurnitureIcon } from '../iconCatalog'
import { wallLength } from '../../domain/geometry'
import { isWallMirrorShape, isWallPictureShape, openingKindForShape, OPENING_CATALOG } from '../../domain/objectCatalog'
import { useRoomStore } from '../../state/useRoomStore'
import type { WallSide } from '../../domain/types'
import { AxisPositionControl, ColorControl, OpeningSwatch, PositionControl, RotationControl, WallPicker } from './Controls'
import { ResizeControls } from './ResizeControls'
import { packWindowById } from '../../domain/structureWindows'
import { openingPosition, openingRunBounds, worldOpenings } from '../../domain/wallConnections'

type RoomState = ReturnType<typeof useRoomStore.getState>
type SelectedOpening = (RoomState['room']['door'] & { id: string; kind: 'door'; sill: number }) | (RoomState['room']['windows'][number] & { kind: 'window' })

export function OpeningInspector({ selectedOpening }: { selectedOpening: SelectedOpening }) {
  const gesture = useInspectorGesture(selectedOpening.id)
  const room = useRoomStore((state) => state.room)
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
  const locked = useRoomStore((state) => state.lockedElementIds.includes(selectedOpening.id))
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
  const openingName = selectedOpening.name || OPENING_CATALOG[catalogKind].name
  const free = selectedOpening.kind === 'window' && !!selectedOpening.freePosition
  const rawMaxOffset = Math.max(0, targetLength / 2 - selectedOpening.width / 2 - ROOM_LIMITS.edgeMargin)
  const openingStep = 0.01
  const maxOffset = Math.floor(rawMaxOffset / openingStep) * openingStep
  const position = worldPosition
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
        <span><small>Anchura</small><strong>{selectedOpening.width.toFixed(2)} m</strong></span>
        <span><small>Altura</small><strong>{selectedOpening.height.toFixed(2)} m</strong></span>
        <span><small>{free ? 'Anclaje' : 'Pared'}</small><strong>{free ? 'Libre' : WALL_LABELS[selectedOpening.wall]}</strong></span>
        <span><small>{free || wallShelf || wallPicture || wallMirror || wallSconce ? 'Altura base' : selectedOpening.kind === 'window' ? 'Antepecho' : 'Desde suelo'}</small><strong>{(free ? position.y : selectedOpening.sill).toFixed(2)} m</strong></span>
      </div>
      {selectedOpening.kind === 'window' && <ResizeControls capability={capabilities.resize} value={selectedOpening} disabled={locked} onChange={(dimension, value) => { if (dimension !== 'depth') resizeWallObject(selectedOpening.id, dimension, value) }} />}
      <ColorControl
        label="Color del objeto"
        value={selectedOpening.color ?? (selectedOpening.kind === 'door' ? '#ac704b' : '#c88f58')}
        onChange={(color) => update({ color })}
      />
      {capabilities.rotation.enabled && (
        <RotationControl
          rotation={selectedOpening.rotation}
          onChange={(rotation) => update({ rotation })}
          disabled={locked}
        />
      )}
      {capabilities.canChangeWall && <WallPicker label="Pared" value={selectedOpening.wall} onChange={(wall) => update({ wall })} disabled={locked} />}
      {selectedOpening.kind === 'window' && selectedOpening.freePosition && <button type="button" className="text-button" disabled={locked} onClick={() => update({ wall: selectedOpening.wall })}>Volver a colocar en la pared {WALL_LABELS[selectedOpening.wall]}</button>}
      {selectedOpening.kind === 'window' && !selectedOpening.freePosition && <button type="button" className="text-button" disabled={locked} onClick={() => detachWallObject(selectedOpening.id)}>Despegar de la pared</button>}
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
      {selectedOpening.kind === 'window' && capabilities.removable && <button type="button" className="text-button danger" onClick={() => removeWindow(selectedOpening.id)}>Eliminar {openingName.toLowerCase()}</button>}
      {selectedOpening.kind === 'door' && selectedOpening.id !== 'door' && <button type="button" className="text-button danger" onClick={() => removeStructureDoor(selectedOpening.id)}>Eliminar puerta</button>}
    </section>
  )

}
