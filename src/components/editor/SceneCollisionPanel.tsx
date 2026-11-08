import { useRoomStore } from '../../state/useRoomStore'
import type { SceneCollision, SceneOutsideIssue } from '../../domain/sceneCollisions'

export function SceneCollisionPanel({ collisions, outside, unsupported = [] }: { collisions: readonly SceneCollision[]; outside: readonly SceneOutsideIssue[]; unsupported?: readonly SceneOutsideIssue[] }) {
  if (!collisions.length && !outside.length && !unsupported.length) return null

  const groups = new Map<string, { name: string; others: Array<{ id: string; name: string }> }>()
  for (const collision of collisions) {
    let group = groups.get(collision.firstId)
    if (!group) {
      group = { name: collision.firstName, others: [] }
      groups.set(collision.firstId, group)
    }
    group.others.push({ id: collision.secondId, name: collision.secondName })
  }
  const select = (id: string) => useRoomStore.getState().selectSceneListItem(id, 'single', [id])
  const objectButton = (id: string, name: string) => (
    <button type="button" className="scene-collision-panel__object" onClick={() => select(id)} title={`Seleccionar ${name}`}>{name}</button>
  )

  return (
    <aside className="scene-collision-panel" aria-label="Incidencias en la escena" onWheel={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
      <div className="scene-collision-panel__heading">
        <strong>Incidencias en la escena</strong>
        <span>{[
          collisions.length ? `${collisions.length} ${collisions.length === 1 ? 'colisión' : 'colisiones'}` : '',
          outside.length ? `${outside.length} fuera` : '',
          unsupported.length ? `${unsupported.length} sin soporte` : '',
        ].filter(Boolean).join(' · ')}</span>
      </div>
      <ul>
        {[...groups.entries()].map(([id, { name, others }]) => (
          <li key={id}>{objectButton(id, name)} colisiona con {others.map((item, index) => (
            <span key={item.id}>{index > 0 ? ', ' : ''}{objectButton(item.id, item.name)}</span>
          ))}.</li>
        ))}
        {outside.map(({ id, name }) => (
          <li key={`outside-${id}`}>{objectButton(id, name)} está fuera de la vivienda, en el vacío.</li>
        ))}
        {unsupported.map(({ id, name }) => <li key={`support-${id}`}>{objectButton(id, name)} no tiene soporte completo en las paredes conectadas.</li>)}
      </ul>
    </aside>
  )
}
