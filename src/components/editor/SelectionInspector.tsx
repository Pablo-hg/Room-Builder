import { structureSurfaceElementId, useRoomStore } from '../../state/useRoomStore'
import { PackInspector } from './PackInspector'
import { SurfaceInspector } from './SurfaceInspector'
import { FurnitureInspector } from './FurnitureInspector'
import { OpeningInspector } from './OpeningInspector'

export function SelectionInspector() {
  const room = useRoomStore((state) => state.room)
  const furniture = useRoomStore((state) => state.furniture)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const selectedId = useRoomStore((state) => state.selectedId)
  const selectedPack = structurePacks.find((pack) => pack.id === selectedId)
  const selectedSurface = structurePacks.flatMap((pack) => pack.surfaces.map((surface) => ({ pack, surface })))
    .find(({ pack, surface }) => structureSurfaceElementId(pack.id, surface.id) === selectedId)
  const selectedFurniture = furniture.find((item) => item.id === selectedId)
  const selectedWindow = room.windows.find((window) => window.id === selectedId)
  const selectedOpening = selectedId === 'door'
    ? { ...room.door, id: 'door' as const, kind: 'door' as const, sill: 0 }
    : selectedWindow ? { ...selectedWindow, kind: 'window' as const } : null

  if (selectedPack) return <PackInspector selectedPack={selectedPack} />
  if (selectedSurface) return <SurfaceInspector selectedSurface={selectedSurface} />
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

