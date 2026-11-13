import { useRoomStore } from '../../state/useRoomStore'
import { surfacePosition } from '../../domain/roomEditing'
import type { StructurePack } from '../../domain/types'
import { structureDoorPosition, type StructureDoor } from '../../domain/structureDoors'
import { AxisPositionControl, ColorControl, PositionControl, WallPicker } from './Controls'
import { useInspectorGesture } from './useInspectorGesture'
import { structureSurfaceElementId } from '../../domain/elementIds'

export function StructureDoorInspector({ pack, door }: { pack: StructurePack; door: StructureDoor }) {
  const gesture = useInspectorGesture(door.id)
  const room = useRoomStore((state) => state.room)
  const update = useRoomStore((state) => state.setStructureDoor)
  const remove = useRoomStore((state) => state.removeStructureDoor)
  const wall = pack.surfaces.find((surface) => surface.kind === 'wall' && surface.wall === door.wall)!
  const locked = useRoomStore((state) => [pack.id, door.id, structureSurfaceElementId(pack.id, wall.id)].some((id) => state.lockedElementIds.includes(id)))
  const horizontal = door.wall === 'north' || door.wall === 'south' ? 'x' : 'z'
  const sign = door.wall === 'south' || door.wall === 'west' ? -1 : 1
  const local = surfacePosition(room, wall)
  const position = structureDoorPosition(room, pack, door)!
  const anchor = horizontal === 'x' ? pack.x + local[0] : pack.z + local[2]
  const limit = wall.width / 2 - door.width / 2 - 0.12
  return <section className="panel-section selection-section selection-section--inspector" {...gesture.events}>
    <span className="eyebrow">Puerta de habitación</span><h2>{door.name || 'Puerta'}</h2><p>{pack.name} · vinculada a su pared</p>
    <WallPicker label="Pared" value={door.wall} disabled={locked} onChange={(next) => update(door.id, { wall: next })} />
    {(['x', 'y', 'z'] as const).map((axis) => <AxisPositionControl key={axis} id={door.id} axis={axis} label={`Posición ${axis.toUpperCase()}`} value={position[axis]} min={Math.min(-10, position[axis], anchor - limit)} max={Math.max(10, position[axis], anchor + limit)} step={0.01} disabled={locked} locked={door.axisLocks?.[axis] ?? false} unavailable={axis !== horizontal || Math.abs(wall.rotation) > 1e-6} onChange={(value) => update(door.id, { offset: (value - anchor) * sign })} />)}
    {Math.abs(wall.rotation) > 1e-6 && <PositionControl label="Posición lateral" value={door.offset} min={-limit} max={limit} step={0.01} disabled={locked || !!door.axisLocks?.x || !!door.axisLocks?.z} onChange={(offset) => update(door.id, { offset })} />}
    <ColorControl label="Color del objeto" value={door.color ?? '#ac704b'} disabled={locked} onChange={(color) => update(door.id, { color })} />
    <p className="section-copy">Edita la posición desde este inspector. La puerta sigue a su pared y conserva un hueco real.</p>
    <button type="button" className="text-button danger" disabled={locked} title={locked ? "Desbloquea el elemento para eliminarlo" : undefined} onClick={() => remove(door.id)}>Eliminar puerta</button>
  </section>
}
