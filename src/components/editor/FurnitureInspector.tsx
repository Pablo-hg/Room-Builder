import { useInspectorGesture } from './useInspectorGesture'
import { ROOM_LIMITS } from '../../domain/constants'
import { FurnitureIcon } from '../iconCatalog'
import { canElevateFurniture, FURNITURE_CATALOG, isCeilingMountedFurniture } from '../../domain/objectCatalog'
import { ResizeControls } from './ResizeControls'
import { useRoomStore } from '../../state/useRoomStore'
import { ColorControl, PositionControl, RotationControl } from './Controls'

type RoomState = ReturnType<typeof useRoomStore.getState>

export function FurnitureInspector({ selectedFurniture }: { selectedFurniture: RoomState['furniture'][number] }) {
  const gesture = useInspectorGesture(selectedFurniture.id)
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const moveFurnitureVertically = useRoomStore((state) => state.moveFurnitureVertically)
  const setFurnitureRotation = useRoomStore((state) => state.setFurnitureRotation)
  const setFurnitureColor = useRoomStore((state) => state.setFurnitureColor)
  const rotateFurniture = useRoomStore((state) => state.rotateFurniture)
  const removeFurniture = useRoomStore((state) => state.removeFurniture)
  const resizeFurniture = useRoomStore((state) => state.resizeFurniture)
  const locked = useRoomStore((state) => state.lockedElementIds.includes(selectedFurniture.id))
  const canChangeElevation = canElevateFurniture(selectedFurniture)
  const canRotate = !isCeilingMountedFurniture(selectedFurniture.kind)
  const xLimit = Math.max(10, Math.abs(selectedFurniture.x))
  const zLimit = Math.max(10, Math.abs(selectedFurniture.z))
  return (
    <section className="panel-section selection-section selection-section--inspector" {...gesture.events}>
      <span className="eyebrow">Inspector del elemento</span>
      <div className="selected-heading"><FurnitureIcon kind={selectedFurniture.kind} color={selectedFurniture.color} /><div><h2>{selectedFurniture.name}</h2><p>{selectedFurniture.x.toFixed(2)}, {selectedFurniture.z.toFixed(2)} m</p></div></div>
      <div className="property-grid" aria-label="Características del mueble">
        <span><small>Anchura</small><strong>{selectedFurniture.width.toFixed(2)} m</strong></span>
        <span><small>Fondo</small><strong>{selectedFurniture.depth.toFixed(2)} m</strong></span>
        <span><small>Altura</small><strong>{selectedFurniture.height.toFixed(2)} m</strong></span>
      </div>
      <ResizeControls capability={FURNITURE_CATALOG[selectedFurniture.kind]?.capabilities.resize} value={selectedFurniture} disabled={locked} onChange={(dimension, value) => resizeFurniture(selectedFurniture.id, dimension, value)} />
      <PositionControl label="Posición X" min={-xLimit} max={xLimit} step={ROOM_LIMITS.placementStep} value={selectedFurniture.x} disabled={locked} onChange={(value) => moveFurniture(selectedFurniture.id, value, selectedFurniture.z)} />
      <PositionControl label="Posición Z" min={-zLimit} max={zLimit} step={ROOM_LIMITS.placementStep} value={selectedFurniture.z} disabled={locked} onChange={(value) => moveFurniture(selectedFurniture.id, selectedFurniture.x, value)} />
      {canChangeElevation && <PositionControl label="Posición Y" min={Math.min(-10, selectedFurniture.y)} max={Math.max(10, selectedFurniture.y)} step={ROOM_LIMITS.placementStep} value={selectedFurniture.y} disabled={locked} onChange={(value) => moveFurnitureVertically(selectedFurniture.id, value)} />}
      {canRotate && <RotationControl
        rotation={selectedFurniture.rotation}
        onChange={(rotation) => setFurnitureRotation(selectedFurniture.id, rotation)}
        disabled={locked}
      />}
      <ColorControl
        label="Color del objeto"
        value={selectedFurniture.color}
        onChange={(color) => setFurnitureColor(selectedFurniture.id, color)}
      />
      <div className="object-actions">
        {canRotate && <button type="button" onClick={rotateFurniture} disabled={locked}><span>↻</span> Girar 90°</button>}
        <button type="button" className="danger" onClick={removeFurniture}><span>×</span> Eliminar</button>
      </div>
      {locked
        ? <p className="lock-hint">Elemento bloqueado: desbloquea el candado de la lista para moverlo o girarlo.</p>
        : <p className="rotation-hint">{canChangeElevation ? 'En la vista también puedes arrastrar los ejes X, Y y Z y el aro de giro.' : isCeilingMountedFurniture(selectedFurniture.kind) ? 'Fijada al techo. Puedes moverla horizontalmente con los ejes X y Z.' : 'Fijada al suelo. Puedes moverla con los ejes X y Z y girarla.'}</p>}
    </section>
  )

}
