import { describeGuides } from '../../domain/dragGuides'
import { useRoomStore } from '../../state/useRoomStore'

/** Indicador visible del paso de movimiento, el magnetismo y las guías (#37), más el texto de las guías activas. */
export function MovementStatus() {
  const gridSnap = useRoomStore((state) => state.gridSnap)
  const magnetism = useRoomStore((state) => state.magnetismEnabled)
  const guides = useRoomStore((state) => state.guidesEnabled)
  const active = useRoomStore((state) => state.activeGuides)
  return <>
    <span className="grid-scale" data-testid="movement-status">
      <b aria-hidden="true">▦</b> Cuadrado: 25 cm · movimiento: {gridSnap ? '5 cm' : '1 cm'} · magnetismo: {magnetism ? 'sí' : 'no'} · guías: {guides ? 'sí' : 'no'}
    </span>
    <span className="visually-hidden" role="status" aria-live="polite">{describeGuides(active)}</span>
  </>
}
