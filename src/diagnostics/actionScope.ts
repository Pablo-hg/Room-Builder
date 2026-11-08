export interface ActionScope { result?: 'rejected' | 'failed'; reason?: string; operationId?: string; objectIds?: string[] }
let active: ActionScope | undefined
export function currentActionScope() { return active }
export function enterActionScope(scope: ActionScope) { active = scope }
export function leaveActionScope() { active = undefined }
export function rejectDiagnosticAction(reason = 'rule-rejected') {
  if (active && active.result !== 'failed') { active.result = 'rejected'; if (!active.reason || active.reason === 'rule-rejected') active.reason = reason }
}
export function failDiagnosticAction(reason: string) { if (active) { active.result = 'failed'; active.reason = reason } }
