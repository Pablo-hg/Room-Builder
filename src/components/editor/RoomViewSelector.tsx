import { useRoomStore } from '../../state/useRoomStore'
import { ROOT_ROOM_FOLDER } from '../../domain/elementFolders'

export function RoomViewSelector() {
  const view = useRoomStore((state) => state.view)
  const packs = useRoomStore((state) => state.structurePacks)
  const activeRoomId = useRoomStore((state) => state.activeRoomId)
  const setActiveRoomId = useRoomStore((state) => state.setActiveRoomId)
  const rootName = useRoomStore((state) => state.elementFolders.find((folder) => folder.id === ROOT_ROOM_FOLDER)?.name ?? 'Habitación principal')
  const rooms = packs.filter((pack) => pack.id.startsWith('floor-pack-'))
  if (!rooms.length || !['isometric', 'top', 'front', 'pov'].includes(view)) return null
  const selected = rooms.some((pack) => pack.id === activeRoomId) ? activeRoomId! : ''
  const levels = [...new Set([0, ...rooms.map((pack) => Math.round(pack.y * 1000) / 1000)])].sort((a, b) => a - b)
  const options = view === 'top'
    ? <><option value="">{rootName}</option>{rooms.map((pack) => <option key={pack.id} value={pack.id}>{pack.name} · {pack.y.toFixed(2)} m</option>)}</>
    : levels.map((height) => <optgroup key={height} label={`Planta · ${height.toFixed(2)} m`}>
      {height === 0 && <option value="">{rootName}</option>}
      {rooms.filter((pack) => Math.round(pack.y * 1000) / 1000 === height).map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
    </optgroup>)
  return <label className="room-view-selector">Cámara enfocada en… <select value={selected} onChange={(event) => setActiveRoomId(event.target.value || null)}>{options}</select></label>
}
