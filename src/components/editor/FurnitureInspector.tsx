import { ROOM_LIMITS } from '../../domain/constants'
import { FurnitureIcon } from '../iconCatalog'
import { furnitureHalfExtents } from '../../domain/geometry'
import { isCeilingMountedFurniture, isFloorBoundFurniture } from '../../domain/objectCatalog'
import { useRoomStore } from '../../state/useRoomStore'
import { ColorControl, RotationControl } from './Controls'

type RoomState = ReturnType<typeof useRoomStore.getState>

export function FurnitureInspector({ selectedFurniture }: { selectedFurniture: RoomState['furniture'][number] }) {
  const room = useRoomStore((state) => state.room)
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const moveFurnitureVertically = useRoomStore((state) => state.moveFurnitureVertically)
  const setFurnitureRotation = useRoomStore((state) => state.setFurnitureRotation)
  const setFurnitureColor = useRoomStore((state) => state.setFurnitureColor)
  const rotateFurniture = useRoomStore((state) => state.rotateFurniture)
  const removeFurniture = useRoomStore((state) => state.removeFurniture)
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
