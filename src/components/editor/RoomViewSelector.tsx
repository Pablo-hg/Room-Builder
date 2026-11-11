import { useRoomStore } from '../../state/useRoomStore'
import { ROOT_ROOM_FOLDER } from '../../domain/elementFolders'
import { floorLevels, roundFloorLevel } from '../../domain/floorLevels'

export function RoomViewSelector() {
  const view = useRoomStore((state) => state.view)
  const packs = useRoomStore((state) => state.structurePacks)
  const activeRoomId = useRoomStore((state) => state.activeRoomId)
  const setActiveRoomId = useRoomStore((state) => state.setActiveRoomId)
  const rootName = useRoomStore((state) => state.elementFolders.find((folder) => folder.id === ROOT_ROOM_FOLDER)?.name ?? 'Habitación principal')
  const rooms = packs.filter((pack) => pack.id.startsWith('floor-pack-'))
  if (!rooms.length || !['isometric', 'top', 'front', 'pov'].includes(view)) return null
  const selected = rooms.some((pack) => pack.id === activeRoomId) ? activeRoomId! : ''
  // Mismo agrupado por plantas en todas las vistas, también en Plano.
  // Plantas numeradas como en un edificio: 0 la de la raíz, 1, 2… y −1, −2…
  const options = floorLevels(rooms.map((pack) => pack.y)).map((level) => <optgroup key={level.y} label={level.name} title={`Altura ${level.y.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`}>
    {level.y === 0 && <option value="">{rootName}</option>}
    {rooms.filter((pack) => roundFloorLevel(pack.y) === level.y).map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
  </optgroup>)
  return <label className="room-view-selector">Cámara enfocada en… <select value={selected} onChange={(event) => setActiveRoomId(event.target.value || null)}>{options}</select></label>
}
