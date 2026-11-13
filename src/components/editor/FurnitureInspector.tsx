import { useInspectorGesture } from './useInspectorGesture'
import { ROOM_LIMITS } from '../../domain/constants'
import { FurnitureIcon } from '../iconCatalog'
import { FURNITURE_CATALOG, hasUsefulFurnitureRotation, furnitureVisualYOffset } from '../../domain/objectCatalog'
import { furnitureAxisLocks } from '../../domain/axisLocks'
import { furnitureWallAxes } from '../../domain/furnitureWalls'
import { ResizeControls } from './ResizeControls'
import { useRoomStore } from '../../state/useRoomStore'
import { AxisPositionControl, ColorControl, PositionControl, RotationControl } from './Controls'

type RoomState = ReturnType<typeof useRoomStore.getState>

export function FurnitureInspector({ selectedFurniture }: { selectedFurniture: RoomState['furniture'][number] }) {
  const gesture = useInspectorGesture(selectedFurniture.id)
  const moveFurniture = useRoomStore((state) => state.moveFurniture)
  const moveFurnitureVertically = useRoomStore((state) => state.moveFurnitureVertically)
  const setFurnitureRotation = useRoomStore((state) => state.setFurnitureRotation)
  const setFurnitureColor = useRoomStore((state) => state.setFurnitureColor)
  const rotateFurniture = useRoomStore((state) => state.rotateFurniture)
  const removeFurniture = useRoomStore((state) => state.removeFurniture)
  const setWallAttachment = useRoomStore((state) => state.setFurnitureWallAttachment)
  const resizeFurniture = useRoomStore((state) => state.resizeFurniture)
  const locked = useRoomStore((state) => state.lockedElementIds.includes(selectedFurniture.id))
  const room = useRoomStore((state) => state.room)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const locks = furnitureAxisLocks(selectedFurniture)
  const canRotate = hasUsefulFurnitureRotation(selectedFurniture.kind, selectedFurniture)
  const attachment = selectedFurniture.wallAttachment
  const available = furnitureWallAxes({ room, structurePacks }, selectedFurniture)
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
      <div className="wall-attachment-controls">
        <label><input type="checkbox" checked={!!attachment} disabled={locked} onChange={(event) => setWallAttachment(selectedFurniture.id, event.target.checked)} /> Fijar a pared</label>
        <p className="rotation-hint">{attachment
          ? 'El objeto permanece en esta pared. Puedes moverlo lateralmente y en altura; desmarca la casilla para despegarlo.'
          : 'Activa la casilla para situarlo en la pared válida más cercana. Sin fijar, el ajuste magnético permite atravesar las paredes.'}</p>
      </div>
      {(['x', 'y', 'z'] as const).map((axis) => {
        const props = {
          label: `Posición ${axis.toUpperCase()}`,
          min: Math.min(-10, position[axis]), max: Math.max(10, position[axis]),
          step: ROOM_LIMITS.placementStep, value: position[axis],
          disabled: locked || (!!attachment && !available[axis]),
          onChange: (value: number) => axis === 'y'
            ? moveFurnitureVertically(selectedFurniture.id, value - furnitureVisualYOffset(selectedFurniture, { room, structurePacks }))
            : moveFurniture(selectedFurniture.id, axis === 'x' ? value : selectedFurniture.x, axis === 'z' ? value : selectedFurniture.z),
        }
        return attachment
          ? <PositionControl key={axis} {...props} axis={axis} />
          : <AxisPositionControl key={axis} {...props} id={selectedFurniture.id} axis={axis} locked={locks[axis]} />
      })}
      {canRotate && <RotationControl
        rotation={selectedFurniture.rotation}
        onChange={(rotation) => setFurnitureRotation(selectedFurniture.id, rotation)}
        disabled={locked || !!attachment}
      />}
      <ColorControl
        label="Color del objeto"
        value={selectedFurniture.color}
        onChange={(color) => setFurnitureColor(selectedFurniture.id, color)}
      />
      <div className="object-actions">
        {canRotate && <button type="button" onClick={rotateFurniture} disabled={locked || !!attachment}><span>↻</span> Girar 90°</button>}
        <button type="button" className="danger" onClick={removeFurniture}><span>×</span> Eliminar</button>
      </div>
      {locked
        ? <p className="lock-hint">Elemento bloqueado: desbloquea el candado de la lista para moverlo o girarlo.</p>
        : <p className="rotation-hint">La posición Y indica la altura absoluta de la base. {attachment ? 'Para moverlo libremente en los tres ejes, desmarca «Fijar a pared».' : 'Puedes bloquear cada eje para conservar su posición.'}{canRotate && !attachment ? ' Usa el aro para girar.' : ''}</p>}
    </section>
  )

}
