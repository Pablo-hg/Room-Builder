import { useInspectorGesture } from './useInspectorGesture'
import { useRoomStore } from '../../state/useRoomStore'
import { structureSurfaceElementId } from '../../domain/elementIds'
import type { StructureSurfaceKey } from '../../domain/types'
import { StructurePositionControls } from './Controls'
import { structureSurfaceName } from '../../domain/selection'

type RoomState = ReturnType<typeof useRoomStore.getState>

export function PackInspector({ selectedPack }: { selectedPack: RoomState['structurePacks'][number] }) {
  const gesture = useInspectorGesture(selectedPack.id)
  const moveStructurePack = useRoomStore((state) => state.moveStructurePack)
  const addStructureSurface = useRoomStore((state) => state.addStructureSurface)
  const removeStructurePack = useRoomStore((state) => state.removeStructurePack)
  const selectElement = useRoomStore((state) => state.selectElement)
  const toggleElementVisibility = useRoomStore((state) => state.toggleElementVisibility)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const locked = useRoomStore((state) => state.lockedElementIds.includes(selectedPack.id))
  const existingSurfaces = new Set(selectedPack.surfaces.map((surface) => surface.id))
  const availableSurfaces: { id: StructureSurfaceKey; label: string }[] = [
    { id: 'floor', label: 'Suelo' },
    { id: 'ceiling', label: 'Techo' },
    { id: 'wall-north', label: 'Pared norte' },
    { id: 'wall-east', label: 'Pared este' },
    { id: 'wall-south', label: 'Pared sur' },
    { id: 'wall-west', label: 'Pared oeste' },
  ]
  return (
    <div className="room-pack-controls" aria-label="Controles de la habitación enfocada" {...gesture.events}>
      <h3>Posición de la habitación</h3>
      <p className="section-copy">Mueve la habitación completa; selecciona una superficie en la escena o en la lista para editarla por separado.</p>
      <StructurePositionControls
        label="Mover pack"
        position={selectedPack}
        elementId={selectedPack.id}
        axisLocks={selectedPack.axisLocks}
        onChange={(axis, value) => moveStructurePack(selectedPack.id, axis, value)}
        disabled={locked}
      />
      {locked && <p className="lock-hint">Pack bloqueado: desbloquea el candado de la lista para moverlo.</p>}
      <h3>Superficies del pack</h3>
      {selectedPack.surfaces.map((surface) => {
        const id = structureSurfaceElementId(selectedPack.id, surface.id)
        return (
          <div className="structure-surface-visibility" key={surface.id}>
            <label title={`Mostrar u ocultar ${structureSurfaceName(surface)}`}>
              <input type="checkbox" checked={!hiddenElementIds.includes(id)} onChange={() => toggleElementVisibility(id)} />
              <small>{hiddenElementIds.includes(id) ? 'Oculta' : 'Visible'}</small>
            </label>
            <button type="button" onClick={() => selectElement(id)}>{structureSurfaceName(surface)} · Editar</button>
          </div>
        )
      })}
      {availableSurfaces.some((surface) => !existingSurfaces.has(surface.id)) && (
        <>
          <h3>Añadir superficie</h3>
          {availableSurfaces.filter((surface) => !existingSurfaces.has(surface.id)).map((surface) => (
            <button type="button" className="text-button" key={surface.id} onClick={() => addStructureSurface(selectedPack.id, surface.id)}>
              ＋ Añadir {surface.label.toLowerCase()}
            </button>
          ))}
        </>
      )}
      <button type="button" className="text-button danger" disabled={locked} title={locked ? "Desbloquea el elemento para eliminarlo" : undefined} onClick={() => removeStructurePack(selectedPack.id)}>Eliminar habitación completa</button>
    </div>
  )
}
