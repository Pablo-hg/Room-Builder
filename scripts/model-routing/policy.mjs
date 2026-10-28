// Clasificador determinista: no llama a ningún modelo ni API de pago.
export const ROUTES = Object.freeze({
  quick: 'gpt-6-luna',
  balanced: 'gpt-6.1-terra',
  deep: 'gpt-6.1-sol',
  critical: 'gpt-6-astra',
})

export function classifyTask(input = '') {
  const text = String(input).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  // Respeta selección explícita. Astra nunca se elige por heurística.
  const explicit = text.match(/(?:^|\s)#modelo:(luna|terra|sol|astra|manual)\b/)
  if (explicit) {
    return explicit[1] === 'manual'
      ? { reason: 'seleccion manual preservada', model: null }
      : { reason: 'modelo solicitado expresamente', model: ROUTES[explicit[1] === 'luna' ? 'quick' : explicit[1] === 'terra' ? 'balanced' : explicit[1] === 'sol' ? 'deep' : 'critical'] }
  }
  // Mensajes de continuación aislados no describen la dificultad real.
  if (/^(?:continua|continuar|sigue|seguir|retoma|prosigue|adelante|ok|vale|perfecto|hecho|listo)[\s.!]*$/.test(text.trim())) {
    return { reason: 'continuacion: conservar modelo actual', model: null }
  }
  // No cambiar la ruta elegida por comandos gratuitos.
  if (/\/(?:gratis|traspaso-codex)\b|(?:opencode\/[^\s]+-free)|(?:solo|unicamente|exclusivamente) (?:este )?modelo gratuito/.test(text)) {
    return { reason: 'comando gratuito explicito', model: null }
  }

  const difficult = /\b(?:r2|r3|r4)\b|(?:camara|cameras?|camera|gizmo|three[. ]?js|react three fiber|r3f|webgl|renderizado 3d|orbitas?|paredes compartidas|multihabitacion|migracion(?:es)?|zustand|persistencia|schema v2|serializacion|arquitectura|refactor(?:izacion)? (?:compleja|del motor|3d|de escena|del estado)|colision(?:es)? complejas?|historial y deshacer|race condition|regresion critica)/.test(text)
  if (difficult) return { reason: 'dominio tecnico complejo o de riesgo', model: ROUTES.deep }

  const simple = /\b(?:readme|changelog|typo|erratas?|ortografia|comentarios?|traduccion|documentacion|documentar|docs\/|markdown|\.md\b|renombrar (?:una|un) (?:variable|archivo)|cambiar (?:un|el) texto|tooltip|copywriting|etiqueta|label)\b/.test(text)
  if (simple) return { reason: 'tarea sencilla o documental', model: ROUTES.quick }
  return { reason: 'desarrollo habitual', model: ROUTES.balanced }
}
