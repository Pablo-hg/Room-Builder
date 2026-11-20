import { DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR, WALL_LABELS, WALL_SIDES } from '../../domain/constants'
import { baseWallId, BASE_FLOOR_ID, ROOT_ROOM_FOLDER } from '../../domain/elementFolders'
import { structureSurfaceElementId } from '../../domain/elementIds'
import { hiddenWallsForView } from '../../domain/geometry'
import { useRoomStore } from '../../state/useRoomStore'
import { MaterialSwatch } from './MaterialSwatch'

export type FreeVisibilityOverrides = Record<string, boolean>

export function FreeVisibility({ overrides, onChange, labelsVisible, onLabelsChange }: { overrides: FreeVisibilityOverrides; onChange: (value: FreeVisibilityOverrides) => void; labelsVisible: boolean; onLabelsChange: (value: boolean) => void }) {
  const state = useRoomStore()
  const automaticHidden = hiddenWallsForView('free', state.isoOrientation, null, state.freeAzimuth)
  const rootName = state.elementFolders.find((folder) => folder.id === ROOT_ROOM_FOLDER)?.name ?? 'Habitación principal'
  const groups = [
    { id: 'root', name: rootName, rows: [
      { id: BASE_FLOOR_ID, label: 'Suelo', automatic: !state.hiddenElementIds.includes(BASE_FLOOR_ID), material: state.room.floorMaterial, color: state.room.floorColor ?? DEFAULT_FLOOR_COLOR },
      ...WALL_SIDES.map((wall) => ({ id: baseWallId(wall), label: `Pared ${WALL_LABELS[wall]}`, automatic: !automaticHidden.includes(wall) && !state.hiddenElementIds.includes(baseWallId(wall)), material: state.room.wallMaterials?.[wall], color: state.room.wallColors?.[wall] ?? state.room.wallColor ?? DEFAULT_WALL_COLOR })),
    ] },
    ...state.structurePacks.filter((pack) => pack.id.startsWith('floor-pack-')).map((pack) => ({
      id: pack.id, name: pack.name,
      rows: pack.surfaces.filter((surface) => surface.kind === 'wall' || surface.kind === 'floor').map((surface) => {
        const id = structureSurfaceElementId(pack.id, surface.id)
        return { id, label: surface.kind === 'floor' ? 'Suelo' : `Pared ${surface.wall ? WALL_LABELS[surface.wall] : surface.name}`, automatic: !state.hiddenElementIds.includes(pack.id) && !state.hiddenElementIds.includes(id) && !(surface.kind === 'wall' && surface.wall && automaticHidden.includes(surface.wall)), material: surface.material, color: surface.color }
      }),
    })),
  ]
  return <details className="free-visibility" onWheel={(event) => event.stopPropagation()}>
    <summary>Visibilidad de la casa</summary>
    <div className="free-visibility__content">
      <label className="free-visibility__labels"><input type="checkbox" checked={labelsVisible} onChange={(event) => onLabelsChange(event.target.checked)} /> Mostrar nombres y letras</label>
      <button type="button" className="secondary-button free-visibility__reset" onClick={() => onChange({})}>Restablecer vista automática</button>
      {groups.map((group) => <fieldset key={group.id}><legend>{group.name}</legend>
        {group.rows.map((row) => <label className="free-visibility__row" key={row.id}><input type="checkbox" checked={overrides[row.id] ?? row.automatic} onChange={(event) => onChange({ ...overrides, [row.id]: event.target.checked })} /><span>{row.label}</span><MaterialSwatch id={row.material?.id ?? 'paint'} color={row.material?.color ?? row.color} scale={row.material?.scale} rotation={row.material?.rotation} /></label>)}
      </fieldset>)}
    </div>
  </details>
}
