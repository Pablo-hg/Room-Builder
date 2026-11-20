import { parseMaterialFinish, type MaterialFinish } from '../../domain/materials'
import { DEFAULT_PAINT_FINISH, elementFinish, paintTargetLabel, type PaintMode } from '../../domain/paintTool'
import type { RoomActionContext, RoomState } from '../types'

type PaintActions = Pick<RoomState, 'startPaintTool' | 'stopPaintTool' | 'setPaintMode' | 'setPaintFinish' | 'setPaintHover' | 'applyPaint' | 'applyPaintToMany' | 'samplePaint'>

/**
 * Herramientas Pintar y Cuentagotas (#39). El estado de la herramienta es de sesión: ni se guarda ni entra en el
 * historial. Cada pincelada es una única edición de `setMaterialFinish`, así que deshacer y rehacer funcionan por pincelada
 * y respetan bloqueos y validación igual que el inspector.
 */
export function createPaintActions({ set, get }: Pick<RoomActionContext, 'set' | 'get'>): PaintActions {
  return {
    startPaintTool: () => {
      const state = get()
      // Si hay un elemento seleccionado, su acabado es el pincel inicial; si no, pintura lisa.
      const sampled = state.selectedId ? elementFinish(state, state.selectedId) : null
      set({ paintTool: { mode: 'paint', finish: sampled ?? DEFAULT_PAINT_FINISH }, paintHoverId: null, notice: '' })
    },
    stopPaintTool: () => set({ paintTool: null, paintHoverId: null }),
    setPaintMode: (mode: PaintMode) => set((state) => state.paintTool ? { paintTool: { ...state.paintTool, mode }, notice: '' } : {}),
    setPaintFinish: (finish: MaterialFinish) => set((state) => {
      if (!state.paintTool) return {}
      const parsed = parseMaterialFinish(finish)
      return parsed ? { paintTool: { ...state.paintTool, finish: parsed } } : { notice: 'El acabado no es válido.' }
    }),
    setPaintHover: (paintHoverId) => set((state) => state.paintHoverId === paintHoverId ? {} : { paintHoverId }),
    applyPaint: (id) => {
      const state = get()
      const tool = state.paintTool
      if (!tool) return false
      const label = paintTargetLabel(state, id)
      if (!label) { set({ notice: 'Ese elemento no se puede pintar.' }); return false }
      state.setMaterialFinish(id, tool.finish)
      // `setMaterialFinish` deja un aviso si rechaza (bloqueado, acabado no válido) y vacío si aplica.
      if (get().notice) return false
      set({ notice: `Pintado: ${label}.` })
      return true
    },
    // Pinta varios elementos con el mismo material en un único paso de deshacer; los bloqueados o no pintables se saltan.
    applyPaintToMany: (ids) => {
      const state = get()
      if (!state.paintTool || !ids.length) return 0
      const token = state.beginHistoryGesture(null)
      let painted = 0
      for (const id of ids) if (get().applyPaint(id)) painted++
      get().commitHistoryGesture(token)
      const skipped = ids.length - painted
      set({ notice: painted
        ? `Pintado${painted === 1 ? '' : 's'} ${painted} elemento${painted === 1 ? '' : 's'}${skipped ? ` · ${skipped} sin pintar (bloqueado o no pintable)` : ''}.`
        : 'Ninguno de los elementos seleccionados se puede pintar.' })
      return painted
    },
    samplePaint: (id) => {
      const state = get()
      if (!state.paintTool) return false
      const label = paintTargetLabel(state, id)
      const finish = label ? elementFinish(state, id) : null
      if (!label || !finish) {
        set({ notice: `${label ? `«${label}»` : 'Ese elemento'} no tiene un acabado que se pueda copiar.` })
        return false
      }
      // Solo viaja el aspecto: nada de posición, medidas ni otras propiedades. Tras copiar se vuelve al pincel.
      set({ paintTool: { mode: 'paint', finish: { ...finish } }, notice: `Acabado copiado de «${label}». Pinta para aplicarlo.` })
      return true
    },
  }
}
