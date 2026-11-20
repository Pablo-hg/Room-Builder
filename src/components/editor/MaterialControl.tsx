import {
  MATERIAL_CATALOG, MATERIAL_FAMILIES, finishFromLegacyColor, materialDefinition, materialFinishLabel,
  type MaterialFinish,
} from '../../domain/materials'
import { useRoomStore } from '../../state/useRoomStore'
import { MaterialSwatch } from './MaterialSwatch'

/**
 * Campos de un acabado: familia, acabado, patrón, color, escala y orientación. Los usan el inspector de cada elemento y el
 * pincel de Pintar, para que construir un material sea igual en los dos sitios. `suffix` distingue sus nombres accesibles
 * cuando conviven («Familia» en el inspector, «Familia del pincel» en Pintar).
 */
export function MaterialFields({ finish, color, onChange, allowOriginal, suffix = '' }: {
  finish?: MaterialFinish
  /** Color histórico del elemento: tono inicial al elegir el primer acabado. */
  color: string
  onChange: (finish: MaterialFinish | null) => void
  /** El inspector permite volver al color original; el pincel siempre tiene un acabado. */
  allowOriginal: boolean
  suffix?: string
}) {
  const current = materialDefinition(finish?.id)
  const familyPatterns = MATERIAL_CATALOG.filter((entry) => entry.family === current?.family)
  // Dos niveles: Familia y Patrón. El acabado solo agrupa los patrones cuando la familia tiene más de uno.
  const finishes = [...new Set(familyPatterns.map((entry) => entry.finish))]

  const choose = (entry: ReturnType<typeof materialDefinition>) => {
    if (!entry) return
    const baseColor = 'defaultColor' in entry ? entry.defaultColor : finishFromLegacyColor(color)?.color ?? '#cccccc'
    onChange({ id: entry.id, color: finish?.color ?? baseColor, scale: finish?.scale ?? 1, rotation: finish?.rotation ?? 0 })
  }

  return <>
    <label className="material-control__family">Familia
      <select aria-label={`Familia${suffix}`} value={current?.family ?? ''} onChange={(event) => {
        const value = event.target.value
        if (!value) { if (allowOriginal) onChange(null) }
        else choose(MATERIAL_CATALOG.find((entry) => entry.family === value))
      }}>
        {(allowOriginal || !current) && <option value="">{allowOriginal ? 'Color original' : '—'}</option>}
        {Object.entries(MATERIAL_FAMILIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
    {current && familyPatterns.length === 1
      // Un único patrón en la familia: no hay nada que elegir, así que se muestra como texto.
      ? <div className="material-control__static"><span>Patrón</span><strong>{current.name}</strong></div>
      : <label>Patrón
        <select aria-label={`Patrón${suffix}`} disabled={!current} value={current?.id ?? ''} onChange={(event) => choose(familyPatterns.find((entry) => entry.id === event.target.value))}>
          {!current && <option value="">—</option>}
          {finishes.length > 1
            ? finishes.map((group) => <optgroup key={group} label={materialFinishLabel(group)}>
              {familyPatterns.filter((entry) => entry.finish === group).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </optgroup>)
            : familyPatterns.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>}
    {finish && <>
      <label>{suffix ? 'Color' : 'Color del acabado'} <input type="color" aria-label={suffix ? `Color${suffix}` : undefined} value={finish.color} onChange={(event) => onChange({ ...finish, color: event.target.value })} /></label>
      {current?.textured && <>
        <label>Escala <output>{finish.scale.toFixed(1)}×</output><input type="range" aria-label={`Escala del acabado${suffix}`} min="0.1" max="10" step="0.1" value={finish.scale} onChange={(event) => onChange({ ...finish, scale: Number(event.target.value) })} /></label>
        <label>Orientación <output>{finish.rotation}°</output><input type="range" aria-label={`Orientación del acabado${suffix}`} min="0" max="359" step="1" value={finish.rotation} onChange={(event) => onChange({ ...finish, rotation: Number(event.target.value) })} /></label>
      </>}
    </>}
  </>
}

export function MaterialControl({ elementId, finish, color, disabled = false }: {
  elementId: string
  finish?: MaterialFinish
  color: string
  disabled?: boolean
}) {
  const apply = useRoomStore((state) => state.setMaterialFinish)
  const current = materialDefinition(finish?.id)
  return <fieldset className="material-control" disabled={disabled}>
    <legend>Material</legend>
    {finish && current && <div className="material-control__preview"><MaterialSwatch id={finish.id} color={finish.color} label={`Muestra de ${current.name}`} /><span>{current.name}</span></div>}
    <MaterialFields finish={finish} color={color} allowOriginal onChange={(next) => apply(elementId, next)} />
  </fieldset>
}
