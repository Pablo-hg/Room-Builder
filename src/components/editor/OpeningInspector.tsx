import { useInspectorGesture } from './useInspectorGesture'
import { ROOM_LIMITS, WALL_LABELS } from '../../domain/constants'
import { FurnitureIcon } from '../iconCatalog'
import { wallLength } from '../../domain/geometry'
import { isWallMirrorShape, isWallPictureShape, openingKindForShape, OPENING_CATALOG } from '../../domain/objectCatalog'
import { useRoomStore } from '../../state/useRoomStore'
import type { WallSide } from '../../domain/types'
import { AxisPositionControl, ColorControl, OpeningSwatch, RotationControl, WallPicker } from './Controls'
import { ResizeControls } from './ResizeControls'

type RoomState = ReturnType<typeof useRoomStore.getState>
type SelectedOpening = (RoomState['room']['door'] & { id: 'door'; kind: 'door'; sill: number }) | (RoomState['room']['windows'][number] & { kind: 'window' })

export function OpeningInspector({ selectedOpening }: { selectedOpening: SelectedOpening }) {
  const gesture = useInspectorGesture(selectedOpening.id)
  const room = useRoomStore((state) => state.room)
  const setDoor = useRoomStore((state) => state.setDoor)
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
  const rawMaxOffset = Math.max(0, wallLength(room, selectedOpening.wall) / 2 - selectedOpening.width / 2 - ROOM_LIMITS.edgeMargin)
  const openingStep = 0.01
  const maxOffset = Math.floor(rawMaxOffset / openingStep) * openingStep
  const maxSill = Math.max(0, Math.floor((room.height - selectedOpening.height - 0.08) * 100) / 100)
  const horizontalAxis = selectedOpening.wall === 'north' || selectedOpening.wall === 'south' ? 'x' : 'z'
  const sign = selectedOpening.wall === 'south' || selectedOpening.wall === 'west' ? -1 : 1
  const position = {
    x: horizontalAxis === 'x' ? selectedOpening.offset * sign : selectedOpening.wall === 'east' ? room.width / 2 : -room.width / 2,
    y: selectedOpening.sill,
    z: horizontalAxis === 'z' ? selectedOpening.offset * sign : selectedOpening.wall === 'south' ? room.depth / 2 : -room.depth / 2,
  }
  const update = (partial: { wall?: WallSide; offset?: number; rotation?: number; color?: string }) => {
    if (selectedOpening.kind === 'door') {
      setDoor(partial)
    } else updateWindow(selectedOpening.id, partial)
  }
  return (
    <section className="panel-section selection-section selection-section--inspector" {...gesture.events}>
      <span className="eyebrow">Inspector del elemento</span>
      <div className="selected-heading">{pictureShape ? <FurnitureIcon kind={pictureShape} color={selectedOpening.color ?? '#d49a72'} /> : openingSwatchKind && <OpeningSwatch kind={openingSwatchKind} color={selectedOpening.color} />}<div><h2>{openingName}</h2><p>{wallShelf || wallPicture || wallMirror || wallSconce ? 'Elemento montado en pared' : 'Apertura seleccionada'}</p></div></div>
      <div className="property-grid" aria-label={`Características de ${openingName.toLowerCase()}`}>
        <span><small>Anchura</small><strong>{selectedOpening.width.toFixed(2)} m</strong></span>
        <span><small>Altura</small><strong>{selectedOpening.height.toFixed(2)} m</strong></span>
        <span><small>Pared</small><strong>{WALL_LABELS[selectedOpening.wall]}</strong></span>
        <span><small>{wallShelf || wallPicture || wallMirror || wallSconce ? 'Altura base' : selectedOpening.kind === 'window' ? 'Antepecho' : 'Desde suelo'}</small><strong>{selectedOpening.sill.toFixed(2)} m</strong></span>
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
      {(['x', 'y', 'z'] as const).map((axis) => <AxisPositionControl key={axis} id={selectedOpening.id} axis={axis} label={`Posición ${axis.toUpperCase()}`} value={position[axis]} min={axis === 'y' ? 0 : Math.min(-maxOffset, position[axis])} max={axis === 'y' ? maxSill : Math.max(maxOffset, position[axis])} step={axis === 'y' ? ROOM_LIMITS.gridSize : openingStep} disabled={locked} locked={selectedOpening.axisLocks?.[axis] ?? false} unavailable={axis === 'y' ? selectedOpening.kind === 'door' || !capabilities.translation.includes('wall-vertical') : axis !== horizontalAxis} onChange={(value) => axis === 'y' ? updateWindow(selectedOpening.id, { sill: value }) : update({ offset: value * sign })} />)}
      {locked
        ? <p className="lock-hint">Elemento bloqueado: desbloquea el candado de la lista para moverlo o girarlo.</p>
        : <p className="rotation-hint">{capabilities.rotation.enabled ? 'Arrastra los ejes para mover el elemento y el aro naranja para girarlo.' : 'Arrastra las flechas horizontales para moverla a izquierda o derecha.'}</p>}
      {selectedOpening.kind === 'window' && capabilities.removable && <button type="button" className="text-button danger" onClick={() => removeWindow(selectedOpening.id)}>Eliminar {openingName.toLowerCase()}</button>}
    </section>
  )

}
