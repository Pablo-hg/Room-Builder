import { useInspectorGesture } from './useInspectorGesture'
import { ROOM_LIMITS, WALL_LABELS } from '../../domain/constants'
import { FurnitureIcon } from '../iconCatalog'
import { wallLength } from '../../domain/geometry'
import { isWallMirrorShape, isWallPictureShape, openingKindForShape, OPENING_CATALOG } from '../../domain/objectCatalog'
import { useRoomStore } from '../../state/useRoomStore'
import type { WallSide } from '../../domain/types'
import { ColorControl, OpeningSwatch, RotationControl, WallPicker } from './Controls'

type RoomState = ReturnType<typeof useRoomStore.getState>
type SelectedOpening = (RoomState['room']['door'] & { id: 'door'; kind: 'door'; sill: number }) | (RoomState['room']['windows'][number] & { kind: 'window' })

export function OpeningInspector({ selectedOpening }: { selectedOpening: SelectedOpening }) {
  const gesture = useInspectorGesture(selectedOpening.id)
  const room = useRoomStore((state) => state.room)
  const setDoor = useRoomStore((state) => state.setDoor)
  const updateWindow = useRoomStore((state) => state.updateWindow)
  const removeWindow = useRoomStore((state) => state.removeWindow)
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
    <section className="panel-section selection-section selection-section--inspector" {...gesture.events}>
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
