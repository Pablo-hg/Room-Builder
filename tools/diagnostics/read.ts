import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseDiagnosticFile } from '../../src/diagnostics/portable'
import type { DiagnosticEvent } from '../../src/diagnostics/contract'
import { parseLegacy } from '../../src/diagnostics/dev/legacy'
import { READABLE_HEADER, readableEvent } from './readable'

interface Filters { categoria?: string; nivel?: string; fecha?: string; sesion?: string; objeto?: string; operacion?: string }
export function filterEvents(events: DiagnosticEvent[], filters: Filters) {
  return events.filter((event) => (!filters.categoria || event.category === filters.categoria)
    && (!filters.nivel || event.level === filters.nivel) && (!filters.fecha || event.timestamp.startsWith(filters.fecha))
    && (!filters.sesion || event.sessionId.includes(filters.sesion)) && (!filters.objeto || event.objectIds.some((id) => id.includes(filters.objeto!)))
    && (!filters.operacion || event.operationId?.includes(filters.operacion)))
}
const HELP = `Diagnósticos internos de Room Builder (sin interfaz web)
Uso: npm run diagnostics -- [archivo.json|archivo.jsonl|historico.log|carpeta] [opciones]
Por defecto: logs/LECTURA.log (archivo activo, ya legible).
Los filtros estructurados requieren un JSON/JSONL histórico o exportado.
  --categoria interactions|collisions|errors|system
  --nivel debug|info|warn|error
  --fecha AAAA-MM-DD   Filtra por fecha UTC; la lectura muestra hora de Madrid.
  --sesion texto      --objeto obj-codigo      --operacion op12
  --limite 200        Hasta 10000 eventos.
  --salida ruta.log   Guarda una lectura conjunta para abrir en VS Code.
  --seguir            Actualiza al cambiar archivos; Ctrl+C termina.
  --regenerar         Genera .lectura.log junto a los JSONL existentes, sin modificarlos.
`
export async function main(args: string[]) {
  if (args.includes('--help') || args.includes('--ayuda')) { process.stdout.write(HELP); return }
  const values: Record<string, string> = {}, switches = new Set<string>()
  let source = 'logs/LECTURA.log'
  let positional = false
  for (let index = 0; index < args.length; index++) {
    const option = args[index]
    if (['--seguir', '--regenerar'].includes(option)) { switches.add(option); continue }
    if (['--categoria', '--nivel', '--fecha', '--sesion', '--objeto', '--operacion', '--limite', '--salida'].includes(option)) {
      if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Falta el valor de ${option}.`)
      values[option.slice(2)] = args[++index]; continue
    }
    if (option.startsWith('--') || positional) throw new Error(`Argumento no reconocido: ${option}`)
    source = option; positional = true
  }
  const limit = Number(values.limite ?? 200)
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error('El límite debe estar entre 1 y 10000.')
  if (values.categoria && !['interactions', 'collisions', 'errors', 'system'].includes(values.categoria)) throw new Error('Categoría no válida.')
  if (values.nivel && !['debug', 'info', 'warn', 'error'].includes(values.nivel)) throw new Error('Nivel no válido.')
  if (values.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(values.fecha)) throw new Error('La fecha debe tener formato AAAA-MM-DD.')
  const input = resolve(source), directory = (await stat(input)).isDirectory()
  const output = values.salida && resolve(values.salida)
  if (output && (output === input || directory && output.endsWith('.jsonl'))) throw new Error('La salida no puede sobrescribir el origen ni un JSONL.')
  const cache = new Map<string, { stamp: string; events: DiagnosticEvent[]; legacy?: string; readable?: string }>()
  let running = false
  const refresh = async () => {
    if (running) return
    running = true
    try {
      const files = directory ? (await readdir(input)).filter((name) => name.endsWith('.jsonl')).map((name) => join(input, name)).sort() : [input]
      const known = new Set(files)
      let changed = false
      for (const file of cache.keys()) if (!known.has(file)) { cache.delete(file); changed = true }
      for (const file of files) {
        const info = await stat(file), stamp = `${info.mtimeMs}:${info.size}`
        if (cache.get(file)?.stamp === stamp) continue
        if (info.size > 8 * 1024 * 1024) throw new Error('Un archivo supera el límite de 8 MiB.')
        const text = await readFile(file, 'utf8')
        if (text.trimStart().startsWith('ROOM BUILDER · DIAGNÓSTICO DEL EDITOR')) {
          if (['categoria', 'nivel', 'fecha', 'sesion', 'objeto', 'operacion'].some((key) => values[key])) throw new Error('Los filtros requieren un JSON/JSONL estructurado; el log activo ya es legible.')
          cache.set(file, { stamp, events: [], readable: text })
        } else if (text.trimStart().startsWith('[')) {
          cache.set(file, { stamp, events: [], legacy: parseLegacy(text).map((entry) => `[${entry.localTimestamp}] [${entry.session}] ${entry.description}`).join('\n') })
        } else {
          // A live append can leave an incomplete final line: retry it on the next refresh.
          let events: DiagnosticEvent[]
          try { events = text.trim() ? parseDiagnosticFile(text) : [] }
          catch (error) {
            if (!(error instanceof SyntaxError) || !file.endsWith('.jsonl') || text.endsWith('\n')) throw error
            const complete = text.slice(0, text.lastIndexOf('\n') + 1)
            events = complete.trim() ? parseDiagnosticFile(complete) : []
          }
          cache.set(file, { stamp, events })
          if (switches.has('--regenerar') && file.endsWith('.jsonl')) await writeFile(file.replace(/\.jsonl$/, '.lectura.log'), READABLE_HEADER + events.map(readableEvent).join(''), 'utf8')
        }
        changed = true
      }
      if (!changed && switches.has('--seguir')) return
      const unique = new Map<string, DiagnosticEvent>()
      for (const entry of cache.values()) for (const event of entry.events) { unique.set(event.eventId, event); if (unique.size > 100000) throw new Error('Demasiados eventos para una lectura; selecciona un archivo o carpeta menor.') }
      const events = filterEvents([...unique.values()], values).sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.seq - b.seq).slice(-limit)
      const historical = [...cache.values()].flatMap((entry) => entry.legacy ? [entry.legacy] : [])
      const readable = [...cache.values()].flatMap((entry) => entry.readable ? [entry.readable] : [])
      const contents = readable.length ? readable.join('\n') : READABLE_HEADER + (historical.length ? 'HISTÓRICO ORIGINAL (sin resultados estructurados)\n' + historical.join('\n') + '\n' : '') + (events.length ? events.map(readableEvent).join('') : historical.length ? '' : 'No hay eventos que coincidan con los filtros.\n')
      if (output) { await writeFile(output, contents, 'utf8'); process.stdout.write(`Lectura actualizada: ${output}\n`) }
      else { if (switches.has('--seguir') && process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[H'); process.stdout.write(contents) }
    } finally { running = false }
  }
  await refresh()
  if (switches.has('--seguir')) {
    const timer = setInterval(() => { void refresh().catch(() => process.stderr.write('No se pudo actualizar la lectura; se reintentará.\n')) }, 1000)
    process.once('SIGINT', () => { clearInterval(timer) })
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main(process.argv.slice(2)).catch((error) => { process.stderr.write(`No se pudo leer el diagnóstico: ${error instanceof Error ? error.message : 'error desconocido'}\n`); process.exitCode = 1 })
}
