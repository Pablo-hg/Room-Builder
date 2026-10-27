import { useRoomStore } from '../../state/useRoomStore'
import { ColorControl, StructurePositionControls, StructureSizeControls } from './Controls'

type RoomState = ReturnType<typeof useRoomStore.getState>

export function SurfaceInspector({ selectedSurface }: { selectedSurface: { pack: RoomState['structurePacks'][number]; surface: RoomState['structurePacks'][number]['surfaces'][number] } }) {
  const moveStructureSurface = useRoomStore((state) => state.moveStructureSurface)
  const resizeStructureSurface = useRoomStore((state) => state.resizeStructureSurface)
  const setStructureSurfaceRotation = useRoomStore((state) => state.setStructureSurfaceRotation)
  const setStructureSurfaceColor = useRoomStore((state) => state.setStructureSurfaceColor)
  const removeStructureSurface = useRoomStore((state) => state.removeStructureSurface)
  const beginStructureMove = useRoomStore((state) => state.beginStructureMove)
  const endStructureMove = useRoomStore((state) => state.endStructureMove)
  const selectElement = useRoomStore((state) => state.selectElement)
  const { pack, surface } = selectedSurface
  return (
    <section className="panel-section selection-section selection-section--inspector">
      <span className="eyebrow">Superficie de construcción</span>
      <h2>{surface.name}</h2>
      <p className="section-copy">{pack.name} · posición independiente respecto al pack.</p>
      <StructurePositionControls
        label="Desplazamiento"
        position={surface}
        onChange={(axis, value) => moveStructureSurface(pack.id, surface.id, axis, value)}
        onStart={beginStructureMove}
        onEnd={endStructureMove}
      />
      <StructureSizeControls
        surface={surface}
        onChange={(dimension, value) => resizeStructureSurface(pack.id, surface.id, dimension, value)}
        onStart={beginStructureMove}
        onEnd={endStructureMove}
      />
      {surface.kind === 'wall' && (
        <label className="range-control compact">
          <span><span>Giro</span><strong>{Math.round(surface.rotation * 180 / Math.PI)}°</strong></span>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={Math.round(surface.rotation * 180 / Math.PI)}
            onChange={(event) => setStructureSurfaceRotation(pack.id, surface.id, Number(event.target.value) * Math.PI / 180)}
          />
        </label>
      )}
      <ColorControl
        label="Color de la superficie"
        value={surface.color}
        onChange={(color) => setStructureSurfaceColor(pack.id, surface.id, color)}
      />
      <button type="button" className="text-button" onClick={() => selectElement(pack.id)}>Seleccionar pack completo</button>
      <button type="button" className="text-button danger" onClick={() => removeStructureSurface(pack.id, surface.id)}>Eliminar superficie</button>
    </section>
  )

}
