import {
  MATERIAL_CATALOG, MATERIAL_FAMILIES, finishFromLegacyColor, materialDefinition, materialFinishLabel,
  type MaterialFinish,
} from '../../domain/materials'
import { useRoomStore } from '../../state/useRoomStore'

export function MaterialControl({ elementId, finish, color, disabled = false }: {
  elementId: string
  finish?: MaterialFinish
  color: string
  disabled?: boolean
}) {
  const apply = useRoomStore((state) => state.setMaterialFinish)
  const current = materialDefinition(finish?.id)
  const familyPatterns = MATERIAL_CATALOG.filter((entry) => entry.family === current?.family)
  const finishes = [...new Set(familyPatterns.map((entry) => entry.finish))]
  const patterns = familyPatterns.filter((entry) => entry.finish === current?.finish)

  const choose = (entry: ReturnType<typeof materialDefinition>) => {
    if (!entry) return
    const baseColor = 'defaultColor' in entry ? entry.defaultColor : finishFromLegacyColor(color)?.color ?? '#cccccc'
    apply(elementId, { id: entry.id, color: finish?.color ?? baseColor, scale: finish?.scale ?? 1, rotation: finish?.rotation ?? 0 })
  }

  return <fieldset className="material-control" disabled={disabled}>
    <legend>Material</legend>
    <label className="material-control__family">Familia
      <select aria-label="Familia" value={current?.family ?? ''} onChange={(event) => {
        const value = event.target.value
        if (!value) apply(elementId, null)
        else choose(MATERIAL_CATALOG.find((entry) => entry.family === value))
      }}>
        <option value="">Color original</option>
        {Object.entries(MATERIAL_FAMILIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
    <label>Acabado
      <select aria-label="Acabado" disabled={!current} value={current?.finish ?? ''} onChange={(event) => choose(familyPatterns.find((entry) => entry.finish === event.target.value))}>
        {!current && <option value="">—</option>}
        {finishes.map((id) => <option key={id} value={id}>{materialFinishLabel(id)}</option>)}
      </select>
    </label>
    <label>Patrón
      <select aria-label="Patrón" disabled={!current} value={current?.id ?? ''} onChange={(event) => choose(patterns.find((entry) => entry.id === event.target.value))}>
        {!current && <option value="">—</option>}
        {patterns.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select>
    </label>
    {finish && <>
      <label>Color del acabado <input type="color" value={finish.color} onChange={(event) => apply(elementId, { ...finish, color: event.target.value })} /></label>
      {current?.textured && <>
        <label>Escala <output>{finish.scale.toFixed(1)}×</output><input type="range" aria-label="Escala del acabado" min="0.1" max="10" step="0.1" value={finish.scale} onChange={(event) => apply(elementId, { ...finish, scale: Number(event.target.value) })} /></label>
        <label>Orientación <output>{finish.rotation}°</output><input type="range" aria-label="Orientación del acabado" min="0" max="359" step="1" value={finish.rotation} onChange={(event) => apply(elementId, { ...finish, rotation: Number(event.target.value) })} /></label>
      </>}
    </>}
  </fieldset>
}
