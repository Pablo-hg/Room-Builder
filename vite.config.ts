import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { appendFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

interface InteractionEntry {
  sessionId?: string
  timestamp?: string
  action?: string
  view?: string
  selectedId?: string | null
  details?: Record<string, unknown>
}

const viewNames: Record<string, string> = {
  isometric: 'Isométrica',
  top: 'Plano',
  front: 'Frontal',
  pov: 'POV',
}

const wallNames: Record<string, string> = { north: 'A', east: 'B', south: 'C', west: 'D' }

function formatNumber(value: unknown) {
  return typeof value === 'number' ? value.toFixed(3) : '?'
}

function formatDegrees(value: unknown) {
  return typeof value === 'number' ? (value * 180 / Math.PI).toFixed(1) : '?'
}

function formatDate(timestamp: unknown) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date()
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
  const base = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
  return `${base}.${milliseconds}`
}

function elementName(value: unknown) {
  return typeof value === 'string' && value ? `“${value}”` : 'ningún elemento'
}

function describeInteraction(entry: InteractionEntry) {
  const details = entry.details ?? {}
  const view = viewNames[entry.view ?? ''] ?? entry.view ?? 'desconocida'
  const wall = wallNames[String(details.wall)] ?? details.wall
  switch (entry.action) {
    case 'session.started': return `Se inicia una sesión de edición en vista ${view}.`
    case 'session.ended': return 'Finaliza la sesión de edición.'
    case 'state.view.changed': return `Se cambia la vista de ${viewNames[String(details.previousView)] ?? details.previousView} a ${viewNames[String(details.nextView)] ?? details.nextView}.`
    case 'state.wall-view.changed': return `Se abre la vista frontal de la pared ${wallNames[String(details.nextWall)] ?? details.nextWall}.`
    case 'state.selection.requested':
      if (!details.requestedId) return `Se deselecciona ${elementName(details.previousName ?? details.previousId)}.`
      if (details.changed === false) return `Se vuelve a pulsar ${elementName(details.requestedName ?? details.requestedId)}, que ya estaba seleccionado.`
      return `Se selecciona ${elementName(details.requestedName ?? details.requestedId)}; antes estaba seleccionado ${elementName(details.previousName ?? details.previousId)}.`
    case 'state.furniture.added': return `Se crea ${elementName(details.name ?? details.kind)} en vista ${view}, posición (${formatNumber(details.x)}, ${formatNumber(details.z)}).`
    case 'state.structure-object.floor-added':
    case 'state.structure-object.wall-added': return `Se crea ${elementName(details.name)} en vista ${view}, posición (${formatNumber(details.x)}, ${formatNumber(details.z)}).`
    case 'state.structure-pack.added': return `Se crea ${elementName(details.name)} en vista ${view}, altura ${formatNumber(details.y)} m.`
    case 'state.structure-pack.moved':
    case 'state.structure-surface.moved': return `Se mueve ${elementName(details.name ?? details.packId)} sobre el eje ${details.axis} a ${formatNumber(details.value)} m.`
    case 'state.structure-surface.resized': return `Se cambia ${String(details.dimension ?? 'tamaño')} de ${elementName(details.name ?? details.packId)} a ${formatNumber(details.value)} m.`
    case 'state.structure-surface.rotated': return `Se gira ${elementName(details.name ?? details.packId)} a ${formatDegrees(details.rotation)}°.`
    case 'state.structure-surface.color': return `Se cambia el color de ${elementName(details.name ?? details.packId)} a ${details.color}.`
    case 'state.structure-surface.added': return `Se añade ${elementName(details.surfaceName)} a ${elementName(details.name)}.`
    case 'state.structure-pack.removed': return `Se elimina ${elementName(details.name)}.`
    case 'state.structure-surface.removed': return `Se elimina ${elementName(details.surfaceName ?? details.name)} de ${elementName(details.name)}.`
    case 'state.furniture.add-rejected': return `No se puede crear ${elementName(details.name ?? details.kind)}: no hay una posición libre.`
    case 'state.furniture.moved': return `Se mueve ${elementName(details.name ?? details.id)} a (${formatNumber(details.x)}, ${formatNumber(details.z)}).`
    case 'state.furniture.rotated': return `Se gira ${elementName(details.name ?? details.id)} a ${formatNumber(details.degrees)}°.`
    case 'state.window.added': return `Se crea una ventana en la pared ${wall}, desplazamiento ${formatNumber(details.offset)} m.`
    case 'state.opening.updated': return `Se modifica ${elementName(details.name ?? details.id)} en la pared ${wall}: desplazamiento ${formatNumber(details.offset)} m, altura ${formatNumber(details.sill)} m.`
    case 'state.element.removed': return `Se elimina ${elementName(details.name ?? details.id)}.`
    case 'state.element.visibility': return `${details.visible ? 'Se muestra' : 'Se oculta'} ${elementName(details.name ?? details.id)}.`
    case 'state.grid.visibility': return `${details.visible ? 'Se muestra' : 'Se oculta'} la cuadrícula de ${details.surface}.`
    case 'state.room.dimension': return `Se cambia ${details.dimension} de la habitación a ${formatNumber(details.value)} m.`
    case 'state.camera.zoom': return `Se ajusta el zoom al ${typeof details.zoom === 'number' ? Math.round(details.zoom * 100) : '?'}%.`
    case 'state.camera.height': return `Se ajusta la altura de la cámara frontal a ${formatNumber(details.height)} m.`
    case 'state.camera.orientation': return `Se cambia la orientación de cámara a ${formatNumber(details.degrees)}° (${details.mode}).`
    case 'state.design.saved': return 'Se guarda el diseño en el navegador.'
    case 'state.design.loaded': return 'Se recupera el diseño guardado.'
    case 'scene.furniture.pointer-down': return `El puntero alcanza ${elementName(details.name ?? details.kind ?? details.id)} en el canvas; seleccionado antes: ${details.selectedBefore ? 'sí' : 'no'}.`
    case 'scene.structure-surface.pointer-down': return `El puntero alcanza ${elementName(details.name ?? details.surfaceId)} en el canvas; seleccionado antes: ${details.selectedBefore ? 'sí' : 'no'}.`
    case 'scene.structure-surface.axis-drag-start': return `Comienza el movimiento de ${elementName(details.name ?? details.packId)} sobre el eje ${details.axis}.`
    case 'scene.structure-surface.axis-drag-end': return `Finaliza el movimiento de ${elementName(details.name ?? details.packId)} sobre el eje ${details.axis}.`
    case 'scene.structure-surface.rotation-start': return `Comienza el giro de ${elementName(details.name ?? details.packId)}.`
    case 'scene.structure-surface.rotation-end': return `Finaliza el giro de ${elementName(details.name ?? details.packId)} a ${formatDegrees(details.rotation)}°.`
    case 'scene.opening.pointer-down': return `El puntero alcanza ${elementName(details.name ?? details.kind ?? details.id)} de la pared ${wall}.`
    case 'scene.background.pointer-down': return `Se pulsa el fondo de la escena (${details.target}${wall ? `, pared ${wall}` : ''}).`
    case 'scene.pointer-missed': return `El motor 3D considera que el clic en (${details.x}, ${details.y}) no alcanzó ningún objeto.`
    case 'scene.furniture.drag-end': return `Finaliza el arrastre de ${elementName(details.name ?? details.id)} en (${formatNumber(details.x)}, ${formatNumber(details.z)}).`
    case 'scene.furniture.drag-cancel': return `Se cancela el arrastre de ${elementName(details.name ?? details.id)}.`
    case 'scene.furniture.rotation-start': return `Comienza el giro de ${elementName(details.name ?? details.id)}.`
    case 'scene.furniture.rotation-end': return `Finaliza el giro de ${elementName(details.name ?? details.id)}.`
    case 'scene.furniture.axis-drag-start': return `Comienza el movimiento de ${elementName(details.name ?? details.id)} sobre el eje ${details.axis}.`
    case 'scene.furniture.axis-drag-end': return `Finaliza el movimiento de ${elementName(details.name ?? details.id)} sobre el eje ${details.axis}.`
    case 'scene.opening.drag-end': return `Finaliza el movimiento de ${elementName(details.name ?? details.id)} en la pared ${wall}.`
    default: return `${entry.action ?? 'interaction'} ${JSON.stringify(details)}`
  }
}

function interactionFileLogger() {
  let writes = Promise.resolve()
  const install = (middlewares: { use: (route: string, handler: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => void) => void }, root: string) => {
    const directory = resolve(root, 'logs')
    const file = resolve(directory, 'interactions.log')
    middlewares.use('/__room-builder/interaction-log', (request, response) => {
      if (request.method !== 'POST') {
        response.statusCode = 405
        response.end()
        return
      }
      let body = ''
      request.setEncoding('utf8')
      request.on('data', (chunk) => {
        body += chunk
        if (body.length > 64_000) request.destroy()
      })
      request.on('end', () => {
        try {
          const entry = JSON.parse(body) as InteractionEntry
          const line = `[${formatDate(entry.timestamp)}] [${entry.sessionId ?? 'sin-sesión'}] ${describeInteraction(entry)}\n`
          writes = writes.then(async () => {
            await mkdir(directory, { recursive: true })
            await appendFile(file, line, 'utf8')
          })
          void writes.then(() => {
            response.statusCode = 204
            response.end()
          }).catch(() => {
            response.statusCode = 500
            response.end()
          })
        } catch {
          response.statusCode = 400
          response.end()
        }
      })
    })
  }
  return {
    name: 'room-builder-interaction-file-logger',
    configureServer(server: { middlewares: Parameters<typeof install>[0]; config: { root: string } }) {
      install(server.middlewares, server.config.root)
    },
    configurePreviewServer(server: { middlewares: Parameters<typeof install>[0]; config: { root: string } }) {
      install(server.middlewares, server.config.root)
    },
  }
}

export default defineConfig({
  plugins: [react(), interactionFileLogger()],
})
