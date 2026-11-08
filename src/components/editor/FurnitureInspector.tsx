import { useInspectorGesture } from './useInspectorGesture'
import { ROOM_LIMITS } from '../../domain/constants'
import { FurnitureIcon } from '../iconCatalog'
import { FURNITURE_CATALOG, hasUsefulFurnitureRotation, furnitureVisualYOffset } from '../../domain/objectCatalog'
import { furnitureAxisLocks } from '../../domain/axisLocks'
import { ResizeControls } from './ResizeControls'
import { useRoomStore } from '../../state/useRoomStore'
import { AxisPositionControl, ColorControl, RotationControl } from './Controls'

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
  const room = useRoomStore((state) => state.room)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const locks = furnitureAxisLocks(selectedFurniture)
  const canRotate = hasUsefulFurnitureRotation(selectedFurniture.kind, selectedFurniture)
  const position = { ...selectedFurniture, y: selectedFurniture.y + furnitureVisualYOffset(selectedFurniture, { room, structurePacks }) }
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
      {(['x', 'y', 'z'] as const).map((axis) => <AxisPositionControl key={axis} id={selectedFurniture.id} axis={axis} label={`Posición ${axis.toUpperCase()}`} min={Math.min(-10, position[axis])} max={Math.max(10, position[axis])} step={ROOM_LIMITS.placementStep} value={position[axis]} locked={locks[axis]} disabled={locked} onChange={(value) => axis === 'y' ? moveFurnitureVertically(selectedFurniture.id, value - furnitureVisualYOffset(selectedFurniture, { room, structurePacks })) : moveFurniture(selectedFurniture.id, axis === 'x' ? value : selectedFurniture.x, axis === 'z' ? value : selectedFurniture.z)} />)}
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
        : <p className="rotation-hint">La posición Y es la altura absoluta de la base. Desbloquea un eje para moverlo; al bloquearlo conserva su posición.{canRotate ? ' Usa el aro para girar.' : ''}</p>}
    </section>
  )

}
