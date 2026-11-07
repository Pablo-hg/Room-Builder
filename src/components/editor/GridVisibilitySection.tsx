import { WALL_LABELS } from '../../domain/constants'
import { visibleWallsForView } from './viewHelpers'
import { structureGridElementId } from '../../domain/elementIds'
import { ROOT_ROOM_FOLDER } from '../../domain/elementFolders'
import { useRoomStore } from '../../state/useRoomStore'

// Visibilidad de las cuadrículas: conserva IDs y estado del store original.
export function GridVisibilitySection() {
  const activeRoomId = useRoomStore((state) => state.activeRoomId)
  const view = useRoomStore((state) => state.view)
  const isoOrientation = useRoomStore((state) => state.isoOrientation)
  const freeAzimuth = useRoomStore((state) => state.freeAzimuth)
  const wallView = useRoomStore((state) => state.wallView)
  const gridVisibility = useRoomStore((state) => state.gridVisibility)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const elementFolders = useRoomStore((state) => state.elementFolders)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const toggleGridVisibility = useRoomStore((state) => state.toggleGridVisibility)
  const toggleElementVisibility = useRoomStore((state) => state.toggleElementVisibility)

  const visibleGridWalls = visibleWallsForView(view, isoOrientation, wallView, freeAzimuth)
  const activeRoom = structurePacks.find((pack) => pack.id === activeRoomId && pack.id.startsWith('floor-pack-'))
  const gridControls = [
    { id: 'floor' as const, label: 'Suelo' },
    ...visibleGridWalls.map((wall) => ({ id: wall, label: `Pared ${WALL_LABELS[wall]}` })),
  ].filter((control) => !activeRoom || activeRoom.surfaces.some((surface) => control.id === 'floor' ? surface.kind === 'floor' : surface.kind === 'wall' && surface.wall === control.id))

  return (
        <section className="panel-section grid-section" aria-labelledby="grid-heading">
        <div className="grid-section__heading">
          <span className="grid-icon" aria-hidden="true">▦</span>
          <span><strong id="grid-heading">Cuadrículas visibles</strong><small>{activeRoom?.name ?? elementFolders.find((folder) => folder.id === ROOT_ROOM_FOLDER)?.name ?? 'Habitación principal'} · cuadrados de 25 cm</small></span>
        </div>
        <div className="grid-visibility-list">
          {gridControls.map((surface) => {
            const roomSurface = activeRoom?.surfaces.find((item) => surface.id === 'floor' ? item.kind === 'floor' : item.kind === 'wall' && item.wall === surface.id)
            const gridId = activeRoom && roomSurface ? structureGridElementId(activeRoom.id, roomSurface.id) : null
            const visible = gridId ? !hiddenElementIds.includes(gridId) : gridVisibility[surface.id]
            return (
            <div className="grid-visibility-row" key={surface.id}>
              <span>{surface.label}</span>
              <button
                type="button"
                className={`switch ${visible ? 'on' : ''}`}
                role="switch"
                aria-checked={visible}
                aria-label={`Mostrar cuadrícula de ${surface.label.toLowerCase()}`}
                onClick={() => gridId ? toggleElementVisibility(gridId) : toggleGridVisibility(surface.id)}
              ><span /></button>
            </div>
          )})}
          {structurePacks.filter((pack) => pack.id.startsWith('floor-object-') || pack.id.startsWith('wall-object-')).flatMap((pack) => pack.surfaces.map((surface) => {
            const id = structureGridElementId(pack.id, surface.id)
            const visible = !hiddenElementIds.includes(id)
            return <div className="grid-visibility-row" key={id}>
              <span>{pack.name}</span>
              <button type="button" className={`switch ${visible ? 'on' : ''}`} role="switch" aria-checked={visible} aria-label={`Mostrar cuadrícula de ${pack.name}`} onClick={() => toggleElementVisibility(id)}><span /></button>
            </div>
          }))}
        </div>
        <small className="grid-snap-note">El ajuste de movimiento a 5 cm se mantiene activo.</small>
        </section>
  )
}
