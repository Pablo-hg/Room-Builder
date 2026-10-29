import { useRoomStore } from '../../state/useRoomStore'

export function RoomViewSelector() {
  const view = useRoomStore((state) => state.view)
  const packs = useRoomStore((state) => state.structurePacks)
  const activeRoomId = useRoomStore((state) => state.activeRoomId)
  const setActiveRoomId = useRoomStore((state) => state.setActiveRoomId)
  const rooms = packs.filter((pack) => pack.id.startsWith('floor-pack-'))
  if (!rooms.length || !['isometric', 'top', 'front', 'pov'].includes(view)) return null
  const selected = rooms.some((pack) => pack.id === activeRoomId) ? activeRoomId! : ''
  const levels = [...new Set([0, ...rooms.map((pack) => Math.round(pack.y * 1000) / 1000)])].sort((a, b) => a - b)
  const options = view === 'top'
    ? <><option value="">Habitación principal</option>{rooms.map((pack) => <option key={pack.id} value={pack.id}>{pack.name} · {pack.y.toFixed(2)} m</option>)}</>
    : levels.map((height) => <optgroup key={height} label={`Planta · ${height.toFixed(2)} m`}>
      {height === 0 && <option value="">Habitación principal</option>}
      {rooms.filter((pack) => Math.round(pack.y * 1000) / 1000 === height).map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
    </optgroup>)
  return <label className="room-view-selector">Habitación <select aria-label="Habitación de la vista" value={selected} onChange={(event) => setActiveRoomId(event.target.value || null)}>{options}</select></label>
}
