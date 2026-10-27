import { structureSurfaceElementId, useRoomStore } from '../../state/useRoomStore'
import type { StructureSurfaceKey } from '../../domain/types'
import { StructurePositionControls } from './Controls'

type RoomState = ReturnType<typeof useRoomStore.getState>

export function PackInspector({ selectedPack }: { selectedPack: RoomState['structurePacks'][number] }) {
  const moveStructurePack = useRoomStore((state) => state.moveStructurePack)
  const addStructureSurface = useRoomStore((state) => state.addStructureSurface)
  const removeStructurePack = useRoomStore((state) => state.removeStructurePack)
  const beginStructureMove = useRoomStore((state) => state.beginStructureMove)
  const endStructureMove = useRoomStore((state) => state.endStructureMove)
  const selectElement = useRoomStore((state) => state.selectElement)
  const toggleElementVisibility = useRoomStore((state) => state.toggleElementVisibility)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
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
    <section className="panel-section selection-section selection-section--inspector">
      <span className="eyebrow">Pack de construcción</span>
      <h2>{selectedPack.name}</h2>
      <p className="section-copy">Mueve el pack completo; selecciona una superficie en la escena o en la lista para editarla por separado.</p>
      <StructurePositionControls
        label="Mover pack"
        position={selectedPack}
        onChange={(axis, value) => moveStructurePack(selectedPack.id, axis, value)}
        onStart={beginStructureMove}
        onEnd={endStructureMove}
      />
      <h3>Superficies del pack</h3>
      {selectedPack.surfaces.map((surface) => {
        const id = structureSurfaceElementId(selectedPack.id, surface.id)
        return (
          <div className="structure-surface-visibility" key={surface.id}>
            <label title={`Mostrar u ocultar ${surface.name}`}>
              <input type="checkbox" checked={!hiddenElementIds.includes(id)} onChange={() => toggleElementVisibility(id)} />
              <small>{hiddenElementIds.includes(id) ? 'Oculta' : 'Visible'}</small>
            </label>
            <button type="button" onClick={() => selectElement(id)}>{surface.name} · Editar</button>
          </div>
        )
      })}
      <h3>Añadir superficie</h3>
      {availableSurfaces.filter((surface) => !existingSurfaces.has(surface.id)).map((surface) => (
        <button type="button" className="text-button" key={surface.id} onClick={() => addStructureSurface(selectedPack.id, surface.id)}>
          ＋ Añadir {surface.label.toLowerCase()}
        </button>
      ))}
      <button type="button" className="text-button danger" onClick={() => removeStructurePack(selectedPack.id)}>Eliminar piso completo</button>
    </section>
  )

}
