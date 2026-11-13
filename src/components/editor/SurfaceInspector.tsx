import { structureSurfaceElementId } from '../../domain/elementIds'
import { structureSurfaceName } from '../../domain/selection'
import { useInspectorGesture } from './useInspectorGesture'
import { useRoomStore } from '../../state/useRoomStore'
import { ColorControl, StructurePositionControls, StructureSizeControls } from './Controls'

type RoomState = ReturnType<typeof useRoomStore.getState>

export function SurfaceInspector({ selectedSurface }: { selectedSurface: { pack: RoomState['structurePacks'][number]; surface: RoomState['structurePacks'][number]['surfaces'][number] } }) {
  const gesture = useInspectorGesture(structureSurfaceElementId(selectedSurface.pack.id, selectedSurface.surface.id))
  const moveStructureSurface = useRoomStore((state) => state.moveStructureSurface)
  const resizeStructureSurface = useRoomStore((state) => state.resizeStructureSurface)
  const setStructureSurfaceRotation = useRoomStore((state) => state.setStructureSurfaceRotation)
  const setStructureSurfaceColor = useRoomStore((state) => state.setStructureSurfaceColor)
  const removeStructureSurface = useRoomStore((state) => state.removeStructureSurface)
  const selectElement = useRoomStore((state) => state.selectElement)
  const { pack, surface } = selectedSurface
  const locked = useRoomStore((state) => state.lockedElementIds.includes(structureSurfaceElementId(pack.id, surface.id)))
  return (
    <section className="panel-section selection-section selection-section--inspector" {...gesture.events}>
      <span className="eyebrow">Superficie de construcción</span>
      <h2>{structureSurfaceName(surface)}</h2>
      <p className="section-copy">{pack.name} · posición independiente respecto al pack.</p>
      <StructurePositionControls
        label="Desplazamiento"
        position={surface}
        elementId={structureSurfaceElementId(pack.id, surface.id)}
        axisLocks={surface.axisLocks}
        onChange={(axis, value) => moveStructureSurface(pack.id, surface.id, axis, value)}
        disabled={locked}
      />
      <StructureSizeControls
        surface={surface}
        onChange={(dimension, value) => resizeStructureSurface(pack.id, surface.id, dimension, value)}
        disabled={locked}
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
            disabled={locked}
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
      {locked && <p className="lock-hint">Superficie bloqueada: desbloquea el candado de la lista para moverla, girarla o redimensionarla.</p>}
      <button type="button" className="text-button danger" disabled={locked} title={locked ? "Desbloquea el elemento para eliminarlo" : undefined} onClick={() => removeStructureSurface(pack.id, surface.id)}>Eliminar superficie</button>
    </section>
  )

}
