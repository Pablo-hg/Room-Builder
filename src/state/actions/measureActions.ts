import { makeId } from '../../domain/elementIds'
import { MAX_MEASURES, MEASURE_NAME_LIMIT, roundCoordinate, type MeasureEnd, type PlanMeasure, type PlanPoint } from '../../domain/planMeasures'
import type { RoomActionContext, RoomState } from '../types'

type MeasureActions = Pick<RoomState,
  | 'setMeasureToolActive' | 'setMeasureAxis' | 'setMeasureSnap' | 'setMeasureDraft'
  | 'addMeasure' | 'saveMeasureDraft' | 'updateMeasure' | 'acknowledgeMeasure' | 'removeMeasure'>

const cleanName = (name: string | undefined) => {
  const trimmed = name?.trim().slice(0, MEASURE_NAME_LIMIT).trim()
  return trimmed ? trimmed : undefined
}
const validEnd = (end: MeasureEnd) => Number.isFinite(end.x) && Number.isFinite(end.z) && Math.abs(end.x) <= 10_000 && Math.abs(end.z) <= 10_000
const fixedEnd = (point: PlanPoint): MeasureEnd => ({ x: roundCoordinate(point.x), z: roundCoordinate(point.z) })

/**
 * Cotas del Plano (#38). La herramienta (activa, ayuda de eje, imán y medida en curso) es estado de sesión:
 * no se guarda ni entra en el historial. Las cotas guardadas sí son parte del diseño y cada alta, edición,
 * ocultación o baja es un único paso de historial.
 */
export function createMeasureActions({ set, get }: Pick<RoomActionContext, 'set' | 'get'>): MeasureActions {
  const full = () => get().measurements.length >= MAX_MEASURES
  return {
    setMeasureToolActive: (measureToolActive) => set({ measureToolActive, measureDraft: null }),
    setMeasureAxis: (measureAxis) => set({ measureAxis }),
    setMeasureSnap: (measureSnap) => set({ measureSnap }),
    setMeasureDraft: (measureDraft) => set({ measureDraft }),
    addMeasure: (start, end, name) => {
      if (!validEnd(start) || !validEnd(end)) { set({ notice: 'Las coordenadas de la cota no son válidas.' }); return null }
      if (Math.hypot(end.x - start.x, end.z - start.z) < 0.005) { set({ notice: 'Los dos puntos de la cota coinciden: elige puntos distintos.' }); return null }
      if (full()) { set({ notice: `Has alcanzado el máximo de ${MAX_MEASURES} cotas guardadas.` }); return null }
      const id = makeId('measure')
      const label = cleanName(name)
      const measure: PlanMeasure = { id, ...(label ? { name: label } : {}), start, end }
      set((state) => ({
        measurements: [...state.measurements, measure],
        measureDraft: null,
        notice: state.planDetailsVisible ? 'Cota guardada.' : 'Cota guardada. Activa «Mostrar detalles» para verla en el plano.',
      }))
      return id
    },
    saveMeasureDraft: (name) => {
      const draft = get().measureDraft
      if (!draft?.end) return null
      return get().addMeasure(draft.start, draft.end, name)
    },
    updateMeasure: (id, patch) => set((state) => {
      const current = state.measurements.find((measure) => measure.id === id)
      if (!current) return {}
      let next: PlanMeasure = { ...current }
      if (patch.name !== undefined) {
        const name = cleanName(patch.name)
        if (name) next.name = name; else delete next.name
      }
      if (patch.hidden !== undefined) { if (patch.hidden) next.hidden = true; else delete next.hidden }
      // Editar un extremo a mano lo deja fijo (sin anclaje) y resuelve la advertencia: el usuario lo ha revisado.
      for (const side of ['start', 'end'] as const) {
        const point = patch[side]
        if (!point) continue
        const end = fixedEnd(point)
        if (!validEnd(end)) return { notice: 'Las coordenadas de la cota no son válidas.' }
        next = { ...next, [side]: end }
        delete next.stale
      }
      if (Math.hypot(next.end.x - next.start.x, next.end.z - next.start.z) < 0.005) return { notice: 'Los dos puntos de la cota coinciden: elige puntos distintos.' }
      if (JSON.stringify(next) === JSON.stringify(current)) return {}
      return { measurements: state.measurements.map((measure) => measure.id === id ? next : measure) }
    }),
    acknowledgeMeasure: (id) => set((state) => {
      if (!state.measurements.some((measure) => measure.id === id && measure.stale)) return {}
      return { measurements: state.measurements.map((measure) => {
        if (measure.id !== id) return measure
        const { stale: _stale, ...rest } = measure
        return rest
      }) }
    }),
    removeMeasure: (id) => set((state) => state.measurements.some((measure) => measure.id === id)
      ? { measurements: state.measurements.filter((measure) => measure.id !== id), notice: 'Cota eliminada.' }
      : {}),
  }
}
