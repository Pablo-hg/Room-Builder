import type { OpeningConflict } from '../domain/geometry'
import { currentActionScope, rejectDiagnosticAction } from './actionScope'
import { diagnostics } from './engine'
const reported = new Set<string>()
export function reportOpeningConflict(conflict: OpeningConflict) {
  rejectDiagnosticAction(conflict.rule)
  const scope = currentActionScope()
  const objectIds = conflict.objectIds.map((id) => diagnostics.objectId(id))
  if (scope) scope.objectIds = objectIds
  const key = `${scope?.operationId}:${conflict.rule}:${objectIds.join(':')}`
  if (reported.has(key)) return
  reported.add(key)
  if (reported.size > 512) reported.delete(reported.values().next().value!)
  diagnostics.emit({ action: 'spatial.constraint', operationId: scope?.operationId, category: 'collisions', level: 'warn', phase: 'observed',
    objectIds, data: { rule: conflict.rule, wall: conflict.wall, requiredGap: conflict.requiredGap, disposition: 'blocking', detector: 'opening-validator' } })
}
