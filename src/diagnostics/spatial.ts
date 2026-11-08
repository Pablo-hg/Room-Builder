import { detectOutsideRoom, detectSceneCollisions, detectUnsupportedOpenings } from '../domain/sceneCollisions'
import type { RoomState } from '../state/types'
import { diagnostics } from './engine'

export class SpatialDiagnostics {
  private previous = new Map<string, { objectIds: string[]; rule: string }>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending: { world: RoomState; operationId?: string } | undefined
  update(world: RoomState, operationId?: string) {
    this.pending = { world, operationId }
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 150)
  }
  flush() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    const pending = this.pending; this.pending = undefined
    if (!pending) return
    try {
      const next = new Map<string, { objectIds: string[]; rule: string }>()
      for (const pair of detectSceneCollisions(pending.world)) {
        const ids = [pair.firstId, pair.secondId].map((id) => diagnostics.objectId(id)).sort()
        next.set(`pair:${ids.join(':')}`, { objectIds: ids, rule: 'oriented-box-overlap' })
      }
      for (const outside of detectOutsideRoom(pending.world)) {
        const id = diagnostics.objectId(outside.id)
        next.set(`bounds:${id}`, { objectIds: [id], rule: 'outside-room' })
      }
      for (const opening of detectUnsupportedOpenings(pending.world)) {
        const id = diagnostics.objectId(opening.id)
        next.set(`support:${id}`, { objectIds: [id], rule: 'opening-without-support' })
      }
      const emit = (action: string, issue: { objectIds: string[]; rule: string }) => diagnostics.emit({
        action, category: 'collisions', level: action.endsWith('entered') ? 'warn' : 'info', phase: 'observed',
        operationId: pending.operationId, objectIds: issue.objectIds,
        data: { rule: issue.rule, disposition: 'warning', detector: 'oriented-box', precision: 'approximate' },
      })
      for (const [key, issue] of next) if (!this.previous.has(key)) emit('spatial.entered', issue)
      for (const [key, issue] of this.previous) if (!next.has(key)) emit('spatial.left', issue)
      this.previous = next
    } catch { diagnostics.emit({ action: 'spatial.detection', category: 'errors', level: 'error', result: 'failed', data: { reason: 'detector-failed' } }) }
  }
  reset() { this.previous.clear() }
}
export const spatialDiagnostics = new SpatialDiagnostics()
