import { useRoomStore } from '../../state/useRoomStore'
import { deriveSelection } from '../../domain/selection'
import { BASE_FLOOR_ID, BASE_ROOM_SURFACE_IDS, folderIdFromSelection, folderRoomPack, ROOT_ROOM_FOLDER } from '../../domain/elementFolders'
import { DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR, WALL_LABELS } from '../../domain/constants'
import type { WallSide } from '../../domain/types'
import { PackInspector } from './PackInspector'
import { SurfaceInspector } from './SurfaceInspector'
import { FurnitureInspector } from './FurnitureInspector'
import { OpeningInspector } from './OpeningInspector'
import { StructureDoorInspector } from './StructureDoorInspector'
import { FolderInspector } from './FolderInspector'
import { multiSelectionBounds, multiSelectionItems, type MultiItem } from '../../domain/multiSelection'
import { isCeilingMountedFurniture } from '../../domain/objectCatalog'
import { ColorControl, PositionControl } from './Controls'
import { useInspectorGesture } from './useInspectorGesture'
import type { StructureSurfaceKey } from '../../domain/types'

function MultiFurnitureInspector({ items }: { items: MultiItem[] }) {
  const bounds = multiSelectionBounds(items)!
  const room = useRoomStore((state) => state.room)
  const locked = useRoomStore((state) => [...state.selectedIds, ...items.flatMap((item) => item.packId ? [item.id, item.packId] : [item.id])].some((id) => state.lockedElementIds.includes(id)))
  const furniture = useRoomStore((state) => state.furniture)
  const selectionCount = useRoomStore((state) => state.selectedIds.length)
  const move = useRoomStore((state) => state.moveSelectedFurnitureGroup)
  const rotate = useRoomStore((state) => state.rotateSelectedFurnitureGroup)
  const setFurnitureColor = useRoomStore((state) => state.setFurnitureColor)
  const setDoor = useRoomStore((state) => state.setDoor)
  const updateWindow = useRoomStore((state) => state.updateWindow)
  const setStructureDoor = useRoomStore((state) => state.setStructureDoor)
  const setSurfaceColor = useRoomStore((state) => state.setStructureSurfaceColor)
  const gesture = useInspectorGesture(`multi:${items.map((item) => item.id).sort().join(',')}`)
  const canRotate = items.every((item) => item.type === 'furniture' && item.axes.includes('x') && item.axes.includes('z') && !isCeilingMountedFurniture(furniture.find((candidate) => candidate.id === item.id)!.kind))
  const setItemColor = (item: MultiItem, color: string) => {
    if (item.type === 'furniture') setFurnitureColor(item.id, color)
    else if (item.type === 'opening') {
      if (item.packId || room.extraDoors?.some((door) => door.id === item.id)) { setStructureDoor(item.id, { color }); return }
      if (item.id === 'door') setDoor({ color })
      else updateWindow(item.id, { color })
    } else if (item.packId && item.surfaceId) setSurfaceColor(item.packId, item.surfaceId as StructureSurfaceKey, color)
  }
  return <section className="panel-section selection-section selection-section--inspector" {...gesture.events}>
    <span className="eyebrow">Selección múltiple</span>
    <h2>{selectionCount > 1 ? selectionCount : items.length} elementos seleccionados</h2>
    <div className="property-grid" aria-label="Dimensiones del conjunto">
      <span><small>Anchura</small><strong>{(bounds.max.x - bounds.min.x).toFixed(2)} m</strong></span>
      <span><small>Fondo</small><strong>{(bounds.max.z - bounds.min.z).toFixed(2)} m</strong></span>
      <span><small>Altura</small><strong>{(bounds.max.y - bounds.min.y).toFixed(2)} m</strong></span>
    </div>
    {(['x', 'y', 'z'] as const).map((axis) => {
      const min = Math.min(-10, bounds.center[axis])
      const max = Math.max(10, bounds.center[axis], axis === 'y' ? room.height : 0)
      return <PositionControl key={axis} label={`Posición ${axis.toUpperCase()} del conjunto`} min={min} max={max} step={0.125} value={bounds.center[axis]} disabled={locked || items.some((item) => !item.axes.includes(axis))} onChange={(value) => move(axis, value - bounds.center[axis])} />
    })}
    <ul className="multi-color-list" aria-label="Colores de los elementos">{items.map((item) => <li key={item.id}><ColorControl label={`Color de ${item.name}`} value={item.color} onChange={(color) => setItemColor(item, color)} /></li>)}</ul>
    <div className="object-actions"><button type="button" onClick={rotate} disabled={locked || !canRotate}>↻ Girar conjunto 90°</button></div>
    <p className="rotation-hint">Arrastra el volumen o sus flechas en la vista para mover el conjunto. Los objetos conservan su posición relativa.</p>
    {locked && <p className="lock-hint">Desbloquea todos los elementos para editar el conjunto.</p>}
  </section>
}

export function SelectionInspector() {
  const room = useRoomStore((state) => state.room)
  const furniture = useRoomStore((state) => state.furniture)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const elementFolders = useRoomStore((state) => state.elementFolders)
  const assignments = useRoomStore((state) => state.elementFolderAssignments)
  const selectedId = useRoomStore((state) => state.selectedId)
  const selectedIds = useRoomStore((state) => state.selectedIds)
  const setFloorColor = useRoomStore((state) => state.setFloorColor)
  const setWallSideColor = useRoomStore((state) => state.setWallSideColor)
  const locked = useRoomStore((state) => !!state.selectedId && state.lockedElementIds.includes(state.selectedId))
  const selectedFolderId = folderIdFromSelection(selectedId)
  const selectedFolder = selectedFolderId
    ? elementFolders.find((folder) => folder.id === selectedFolderId)
    : undefined
  const { selectedPack, selectedSurface, selectedFurniture, selectedOpening, selectedStructureDoor } = deriveSelection(
    { room, furniture, structurePacks }, selectedId,
  )

  const multiItems = multiSelectionItems({ room, furniture, structurePacks, elementFolders, elementFolderAssignments: assignments, selectedIds })
  const folderPack = selectedFolder && folderRoomPack(elementFolders, assignments, structurePacks, selectedFolder.id)
  if (folderPack && selectedIds.length === 1) return <PackInspector selectedPack={folderPack} />
  if (selectedFolder?.id === ROOT_ROOM_FOLDER && selectedIds.length === 1) return <FolderInspector folder={selectedFolder} />
  if (selectedIds.length === 1 && selectedId && BASE_ROOM_SURFACE_IDS.includes(selectedId)) {
    const wall = selectedId === BASE_FLOOR_ID ? null : selectedId.slice('room-wall:'.length) as WallSide
    const label = wall ? `Pared ${WALL_LABELS[wall]}` : 'Suelo'
    return <section className="panel-section selection-section selection-section--inspector"><span className="eyebrow">Habitación principal</span><h2>{label}</h2><p className="section-copy">Superficie de la habitación principal.</p><ColorControl label={`Color de ${label.toLowerCase()}`} value={wall ? room.wallColors?.[wall] ?? room.wallColor ?? DEFAULT_WALL_COLOR : room.floorColor ?? DEFAULT_FLOOR_COLOR} onChange={(color) => { if (wall) setWallSideColor(wall, color); else setFloorColor(color) }} disabled={locked} /></section>
  }
  if (multiItems.length > 1 && (selectedIds.length > 1 || selectedFolder)) return <>{selectedFolder && <FolderInspector folder={selectedFolder} />}<MultiFurnitureInspector items={multiItems} /></>
  if (selectedIds.length > 1) return <section className="panel-section selection-section selection-section--inspector">
    <span className="eyebrow">Selección múltiple</span>
    <h2>{selectedIds.length} elementos seleccionados</h2>
    <p className="empty-selection">La edición conjunta está disponible para selecciones de muebles. Las selecciones que incluyen aperturas, superficies o carpetas todavía no admiten transformaciones conjuntas.</p>
  </section>
  if (selectedFolder) return <FolderInspector folder={selectedFolder} />
  if (selectedPack) return <PackInspector selectedPack={selectedPack} />
  if (selectedSurface) return <SurfaceInspector selectedSurface={selectedSurface} />
  if (selectedStructureDoor) return <StructureDoorInspector {...selectedStructureDoor} />
  if (selectedFurniture) return <FurnitureInspector selectedFurniture={selectedFurniture} />
  if (selectedOpening) return <OpeningInspector selectedOpening={selectedOpening} />

  return (
    <section className="panel-section selection-section selection-section--inspector">
      <span className="eyebrow">Inspector del elemento</span>
      <h2>Nada seleccionado</h2>
      <p className="empty-selection">Selecciona un mueble, la puerta o una ventana en la vista para consultar y editar sus propiedades.</p>
    </section>
  )
}

