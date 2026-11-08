import type { SceneCollision } from '../../domain/sceneCollisions'

export function SceneCollisionPanel({ collisions }: { collisions: readonly SceneCollision[] }) {
  if (collisions.length === 0) return null

  const groups = new Map<string, { name: string; others: string[] }>()
  for (const collision of collisions) {
    let group = groups.get(collision.firstId)
    if (!group) {
      group = { name: collision.firstName, others: [] }
      groups.set(collision.firstId, group)
    }
    group.others.push(collision.secondName)
  }

  return (
    <aside className="scene-collision-panel" aria-label="Colisiones en la escena" onWheel={(event) => event.stopPropagation()}>
      <div className="scene-collision-panel__heading">
        <strong>Objetos en colisión</strong>
        <span>{collisions.length} {collisions.length === 1 ? 'intersección' : 'intersecciones'}</span>
      </div>
      <ul>
        {[...groups.entries()].map(([id, { name, others }]) => (
          <li key={id}><strong>{name}</strong> intersecta con {others.join(', ')}.</li>
        ))}
      </ul>
    </aside>
  )
}
