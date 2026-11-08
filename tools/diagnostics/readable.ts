import type { DiagnosticEvent } from '../../src/diagnostics/contract'

export const READABLE_HEADER = 'ROOM BUILDER · DIAGNÓSTICO DEL EDITOR\nHora de Madrid · Posiciones y tamaños en metros · Giros en grados\nInteracciones, colisiones, errores y sistema en un único archivo.\nLas entradas más antiguas pueden retirarse al alcanzar el límite de tamaño.\n\n'
const labels: Record<string, string> = {
  interactions: 'INTERACCIÓN', collisions: 'CONFLICTO ESPACIAL', errors: 'ERROR / ADVERTENCIA', system: 'SISTEMA',
  debug: 'DETALLE', info: 'INFO', warn: 'AVISO', error: 'ERROR',
  completed: 'Completada', cancelled: 'Cancelada', rejected: 'Rechazada', failed: 'Fallida', started: 'Iniciada', observed: 'Observada', finished: 'Finalizada',
  isometric: 'Isométrica', top: 'Plano', front: 'Frontal', free: 'Libre', pov: 'Interior',
  north: 'A', east: 'B', south: 'C', west: 'D',
  chair: 'Silla', armchair: 'Sillón', sofa: 'Sofá', table: 'Mesa', desk: 'Escritorio', bed: 'Cama', rug: 'Alfombra', ceilingLamp: 'Lámpara de techo',
  x: 'Posición X', y: 'Altura Y', z: 'Posición Z', width: 'Anchura', height: 'Altura', depth: 'Profundidad', rotation: 'Giro',
  offset: 'Desplazamiento en la pared', sill: 'Altura de la apertura', wall: 'Pared', kind: 'Tipo', shape: 'Forma',
  color: 'Color', wallColor: 'Color de pared', floorColor: 'Color de suelo', wallColors: 'Colores de paredes',
  axisLocks: 'Candados', freePosition: 'Posición libre', wallPosition: 'Posición en paredes conectadas', supportId: 'Pared de referencia', attachmentPolicy: 'Anclaje',
  cameraZoom: 'Zoom', freeCameraZoom: 'Zoom de cámara libre', povCameraZoom: 'Zoom interior',
  view: 'Vista', wallView: 'Pared frontal', activeRoomId: 'Habitación enfocada',
  isoAngle: 'Giro isométrico', freeAzimuth: 'Azimut', freeElevation: 'Inclinación', povYaw: 'Giro interior',
  frontCameraHeight: 'Altura de cámara frontal', isoCameraHeight: 'Altura de cámara isométrica',
  topCameraX: 'Cámara en plano X', topCameraZ: 'Cámara en plano Z', freeCameraOffset: 'Desplazamiento de cámara libre',
  selectedIds: 'Selección', hiddenElementIds: 'Elementos ocultos', lockedElementIds: 'Elementos bloqueados',
  sceneElementOrder: 'Orden de elementos', gridSnap: 'Ajuste a cuadrícula', gridVisibility: 'Cuadrículas visibles',
  library: 'Diseños guardados', activeDesign: 'Diseño activo', folders: 'Organización de carpetas',
  'rule-rejected': 'La validación no permite aplicar la operación.', 'element-locked': 'El elemento está bloqueado.',
  'furniture-axis-locked': 'El movimiento afecta a un eje bloqueado.', 'door-axis-locked': 'El movimiento desplazaría un eje bloqueado de una puerta.',
  'door-or-axis-locked': 'La puerta o uno de sus ejes está bloqueado.', 'opening-axis-locked': 'La apertura tiene el eje bloqueado.',
  'surface-axis-locked': 'La superficie o su eje está bloqueado.', 'pack-axis-locked': 'La habitación o una superficie tiene ese eje bloqueado.',
  'position-not-applicable': 'La posición solicitada no puede aplicarse.', 'no-free-position': 'No se encontró una posición libre.',
  'opening-gap': 'Las aperturas incumplen la separación mínima.', 'opening-bounds': 'La apertura queda fuera de su pared.',
  'opening-height': 'La apertura supera la altura disponible.', 'oriented-box-overlap': 'Se intersectan las cajas de los elementos.',
  'outside-room': 'El elemento queda fuera de una habitación.', 'structure-door-invalid': 'La geometría de una puerta no es válida.',
  'opening-without-support': 'La apertura no tiene soporte completo en las paredes conectadas.',
  'connected-opening-invalid': 'La apertura no cabe en el soporte conectado o solapa otra apertura.',
  'opening-path-unsupported': 'El recorrido atraviesa una región sin soporte.',
  'opening-support-locked': 'Una pared afectada por la apertura está bloqueada.',
  'invalid-centimetre-step': 'La medida debe expresarse en centímetros enteros.', 'measurement-out-of-range': 'La medida está fuera del intervalo permitido.',
  'storage.save-failed': 'No se pudo guardar el diseño en el navegador.', 'storage.read-failed': 'No se pudieron leer los diseños guardados.',
  'storage.create-failed': 'No se pudo crear el diseño guardado.', 'storage.delete-failed': 'No se pudo eliminar el diseño guardado.',
  'storage.rename-failed': 'No se pudo renombrar el diseño.', 'storage.import-failed': 'No se pudo guardar el diseño importado.',
  'design.load-failed': 'No se pudo abrir el diseño.', 'uncaught-exception': 'Se produjo una excepción no controlada.',
  'unhandled-rejection': 'Una operación asíncrona falló sin gestionar su error.',
}
const actions: Record<string, string> = {
  'session.started': 'Inicio de sesión de edición', 'session.page-hidden': 'La página pasa a segundo plano o se cierra',
  'runtime.error': 'Excepción del editor', 'runtime.rejection': 'Fallo asíncrono del editor',
  'spatial.entered': 'Aparece un conflicto espacial', 'spatial.left': 'Deja de detectarse un conflicto espacial', 'spatial.constraint': 'Una restricción impide el cambio',
  'storage.recovered': 'Se recupera el almacenamiento local', 'mirror.recovered': 'Se recupera la copia de archivos',
  'design.read-json': 'Leer y validar un diseño JSON', 'design.export-json': 'Exportar diseño JSON', 'model.export-glb': 'Exportar modelo 3D',
  'diagnostic.download-requested': 'Solicitar descarga del diagnóstico', 'measurement.input': 'Introducir una medida',
  initializeSavedDesigns: 'Leer diseños guardados', selectElement: 'Seleccionar elemento', selectSceneListItem: 'Cambiar selección de elementos',
  addFurniture: 'Añadir mueble', removeFurniture: 'Eliminar mueble', removeSelected: 'Eliminar selección', renameElement: 'Renombrar elemento',
  moveFurniture: 'Mover mueble', moveFurnitureVertically: 'Cambiar altura del mueble', setFurnitureRotation: 'Girar mueble', rotateFurniture: 'Girar mueble',
  moveSelectedFurnitureGroup: 'Mover selección', moveSelectedFurnitureGroupBy: 'Mover selección', rotateSelectedFurnitureGroup: 'Girar selección', colorSelectedFurnitureGroup: 'Cambiar color de la selección',
  resizeFurniture: 'Cambiar tamaño del mueble', resizeWallObject: 'Cambiar tamaño del elemento mural', setFurnitureColor: 'Cambiar color del mueble',
  setDimension: 'Cambiar tamaño de la habitación', setSelectedRoomDimension: 'Cambiar tamaño de la habitación seleccionada', setFocusedRoomDimension: 'Cambiar tamaño de la habitación enfocada',
  setWallColor: 'Cambiar color de las paredes', setWallSideColor: 'Cambiar color de una pared', setFloorColor: 'Cambiar color del suelo',
  addStructurePack: 'Crear habitación', addStructureObject: 'Añadir superficie independiente', moveStructurePack: 'Mover habitación',
  moveStructureSurface: 'Mover superficie', resizeStructureSurface: 'Cambiar tamaño de superficie', setStructureSurfaceRotation: 'Girar superficie',
  setStructureSurfaceColor: 'Cambiar color de superficie', addStructureSurface: 'Añadir superficie', removeStructurePack: 'Eliminar habitación', removeStructureSurface: 'Eliminar superficie',
  addStructureDoor: 'Añadir puerta', setStructureDoor: 'Modificar puerta', removeStructureDoor: 'Eliminar puerta', setDoor: 'Modificar puerta principal',
  addWindow: 'Añadir ventana o decoración mural', updateWindow: 'Modificar ventana o decoración mural', removeWindow: 'Eliminar ventana o decoración mural', moveWallObject: 'Mover elemento mural', detachWallObject: 'Despegar elemento de la pared',
  setView: 'Cambiar vista', lookAtWall: 'Mirar una pared', setActiveRoomId: 'Enfocar habitación', setCameraZoom: 'Ajustar zoom', adjustCameraZoom: 'Ajustar zoom',
  setFrontCameraHeight: 'Cambiar altura de cámara frontal', setIsoCameraHeight: 'Cambiar altura de cámara isométrica',
  setIsoAngle: 'Orbitar cámara isométrica', setFreeOrbit: 'Orbitar cámara libre', moveFreeCamera: 'Desplazar cámara libre', setTopCameraPosition: 'Desplazar cámara en plano', resetTopCamera: 'Centrar cámara en plano',
  lookFromIsoOrientation: 'Cambiar orientación isométrica', lookFromFreeOrbit: 'Cambiar orientación libre', rotateFront: 'Cambiar pared frontal', rotateIso: 'Girar vista isométrica', rotatePov: 'Girar vista interior',
  undo: 'Deshacer', redo: 'Rehacer', saveDesign: 'Guardar diseño', loadDesign: 'Abrir diseño', createDesign: 'Crear diseño', importDesign: 'Importar diseño', deleteSavedDesign: 'Eliminar diseño guardado', renameSavedDesign: 'Renombrar diseño',
  copySelected: 'Copiar selección', pasteSelected: 'Pegar selección', toggleElementLock: 'Cambiar bloqueo', setElementAxisLock: 'Cambiar candado de eje', toggleElementVisibility: 'Cambiar visibilidad', toggleGridVisibility: 'Cambiar visibilidad de cuadrícula',
  createElementFolder: 'Crear carpeta', renameElementFolder: 'Renombrar carpeta', deleteElementFolder: 'Eliminar carpeta', moveSceneItems: 'Reordenar elementos', groupSceneItems: 'Agrupar elementos', gesture: 'Gesto de edición',
}
const date = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23' })
const number = (value: number, digits = 3) => value.toLocaleString('es-ES', { maximumFractionDigits: digits })
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
function valueText(value: unknown, field: string): string {
  if (value === undefined) return 'sin dato'
  if (value === null) return 'ninguno'
  if (typeof value === 'boolean') return value ? 'sí' : 'no'
  if (typeof value === 'number') {
    if (/zoom/i.test(field)) return `${number(value * 100, 1)} %`
    if (['rotation', 'isoAngle', 'freeAzimuth', 'freeElevation'].includes(field)) return `${number(value * 180 / Math.PI, 1)}°`
    if (field === 'povYaw') return `${number(value)}°`
    return `${number(value)}${['x', 'y', 'z', 'width', 'height', 'depth', 'sill', 'offset', 'frontCameraHeight', 'isoCameraHeight', 'topCameraX', 'topCameraZ'].includes(field) ? ' m' : ''}`
  }
  if (typeof value === 'string') return labels[value] ?? value
  if (Array.isArray(value)) return value.length ? value.map((item) => valueText(item, field)).join(', ') : 'vacío'
  return Object.entries(record(value)).map(([key, entry]) => `${labels[key] ?? key}: ${valueText(entry, key)}`).join('; ') || 'sin propiedades'
}
function changes(before: unknown, after: unknown, path = ''): string[] {
  const left = record(before), right = record(after)
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap((field) => {
    const a = left[field], b = right[field]
    if (JSON.stringify(a) === JSON.stringify(b)) return []
    const name = `${path}${field.startsWith('obj-') ? `Objeto ${field}` : labels[field] ?? field}`
    if ((a && typeof a === 'object' && !Array.isArray(a) || b && typeof b === 'object' && !Array.isArray(b)) && !Array.isArray(a) && !Array.isArray(b)) return changes(a, b, `${name} / `)
    if (valueText(a, field) === valueText(b, field)) return [] // Formatting precision hides this change.
    return [`  · ${name}: ${valueText(a, field)} → ${valueText(b, field)}`]
  })
}
export function interactionType(event: DiagnosticEvent): string {
  const action = event.action.replace(/^editor\./, '').replace(/\.attempt$/, '')
  if (event.category === 'collisions') return event.data.disposition === 'blocking' ? 'RESTRICCIÓN QUE BLOQUEA LA OPERACIÓN'
    : event.data.rule === 'outside-room' ? 'LÍMITE DE HABITACIÓN' : 'AVISO ESPACIAL / SOLAPE'
  if (/^session\./.test(action)) return 'SESIÓN DEL EDITOR'
  if (/^(runtime\.|spatial\.detection)/.test(action)) return 'FALLO DEL EDITOR'
  if (/^(storage\.|mirror\.)/.test(action)) return 'ALMACENAMIENTO DE DIAGNÓSTICO'
  if (/^(selectElement|selectSceneListItem)$/.test(action)) {
    const selected = record(event.data.after).selectedIds
    return Array.isArray(selected) ? selected.length === 0 ? 'DESELECCIÓN' : selected.length > 1 ? 'SELECCIÓN MÚLTIPLE' : 'SELECCIÓN' : 'SELECCIÓN'
  }
  if (/Camera|^setView$|^setIsoAngle$|^setFreeOrbit$|^look|^rotate(Front|Iso|Pov)$|^setActiveRoomId$/.test(action)) return 'CÁMARA / VISTA'
  if (/^(undo|redo)$/.test(action)) return action === 'undo' ? 'DESHACER' : 'REHACER'
  if (/^diagnostic\.|export/.test(action)) return 'EXPORTACIÓN'
  if (action === 'design.read-json' || action === 'importDesign') return 'IMPORTACIÓN'
  if (action === 'saveDesign') return 'GUARDADO DE DISEÑO'
  if (action === 'loadDesign' || action === 'initializeSavedDesigns') return 'CARGA DE DISEÑO'
  if (/^(add|create|paste)/.test(action)) return 'CREACIÓN'
  if (/^(remove|delete)/.test(action)) return 'ELIMINACIÓN'
  if (/^resize|Dimension|^measurement\./.test(action)) return 'MEDIDAS / TAMAÑO'
  if (/Rotation|^rotate/.test(action)) return 'GIRO DE ELEMENTOS'
  if (/Color|^color/.test(action)) return 'COLOR / ASPECTO'
  if (/Lock|^toggleElementLock/.test(action)) return 'BLOQUEO DE ELEMENTOS / EJES'
  if (/Visibility|^toggleGrid/.test(action)) return 'VISIBILIDAD'
  if (/^detach/.test(action)) return 'ANCLAJE A PARED'
  if (/^moveScene|Folder|^group|^stepScene/.test(action)) return 'ORGANIZACIÓN DE ELEMENTOS'
  if (/^move/.test(action)) return 'MOVIMIENTO'
  if (/^setDoor$|^setStructureDoor$|^updateWindow$/.test(action)) return 'EDICIÓN DE PUERTA / VENTANA'
  if (/^rename/.test(action)) return 'RENOMBRADO'
  if (action === 'copySelected') return 'COPIA'
  return event.category === 'system' ? 'SISTEMA' : 'EDICIÓN'
}
export function readableEvent(event: DiagnosticEvent): string {
  const action = event.action.replace(/^editor\./, '').replace(/\.attempt$/, '')
  const type = interactionType(event)
  const title = type === 'DESELECCIÓN' ? 'Deseleccionar elementos' : actions[event.action] ?? actions[action] ?? `Acción: ${event.action}`
  const outcome = String(event.result ?? event.data.outcome ?? event.phase)
  const lines = [`[${date.format(new Date(event.timestamp))}] ${labels[event.level]} · ${labels[event.category]}`, `Tipo: ${type}`, `${title} — ${labels[outcome] ?? outcome}`]
  if (event.data.view) lines.push(`Vista: ${valueText(event.data.view, 'view')}`)
  if (event.data.appVersion) lines.push(`Versión de la aplicación: ${event.data.appVersion}`)
  const before = record(event.data.before), after = record(event.data.after)
  const details = changes(before, after)
  const compactCreation = type === 'CREACIÓN' && details.length > 16
  if (event.objectIds.length) lines.push(compactCreation
    ? `Elementos: ${event.objectIds.length} afectados (identificadores en el diagnóstico exportado)`
    : `Elementos: ${event.objectIds.join(', ')}`)
  const effects: Record<string, string> = { blocking: 'bloquea la operación', warning: 'avisa; no bloquea', allowed: 'superposición permitida' }
  if (event.data.disposition) lines.push(`Efecto: ${effects[String(event.data.disposition)] ?? String(event.data.disposition)}`)
  const reason = event.data.reason ?? event.data.rule
  if (reason) lines.push(`Motivo: ${labels[String(reason)] ?? reason}`)
  if (event.data.requiredGap !== undefined) lines.push(`Separación mínima: ${valueText(event.data.requiredGap, 'width')}`)
  if (compactCreation) {
    const fresh = Object.entries(after).filter(([id, value]) => id.startsWith('obj-') && !(id in before) && value && typeof value === 'object')
    const kinds = fresh.map(([, value]) => String(record(value).kind ?? ''))
    const count = (kind: string) => kinds.filter((value) => value === kind).length
    const parts = [
      count('wall') ? `${count('wall')} paredes` : '',
      count('floor') ? `${count('floor')} suelos` : '',
      count('ceiling') ? `${count('ceiling')} techos` : '',
    ].filter(Boolean)
    const other = fresh.length - count('wall') - count('floor') - count('ceiling')
    if (other > 0) parts.push(`${other} elementos adicionales`)
    lines.push(`Resumen: ${parts.join(', ') || `${fresh.length || event.objectIds.length} elementos afectados`}.`)
    const floor = fresh.find(([, value]) => record(value).kind === 'floor')
    if (floor) {
      const surface = record(floor[1])
      if (typeof surface.width === 'number' && typeof surface.depth === 'number')
        lines.push(`Dimensiones del suelo: ${valueText(surface.width, 'width')} × ${valueText(surface.depth, 'depth')}.`)
    }
    lines.push('Detalles técnicos disponibles en el diagnóstico exportado.')
  } else if (details.length) lines.push('Cambios:', ...details)
  if (event.result === 'cancelled') lines.push(event.data.changesApplied ? 'Cancelación: conserva los cambios ya aceptados.' : 'Cancelación: sin cambios aplicados.')
  else if (event.data.changesApplied === false) lines.push('Sin cambios efectivos.')
  if (event.data.sceneReplaced !== undefined) lines.push(`Escena sustituida: ${valueText(event.data.sceneReplaced, '')}. Muebles: ${event.data.furnitureCount ?? '?'}. Habitaciones adicionales: ${event.data.packCount ?? '?'}.`)
  if (event.data.truncated) lines.push('AVISO: detalles recortados por el límite de tamaño.')
  if (event.data.dropped) lines.push(`AVISO: ${event.data.dropped} eventos perdidos.`)
  lines.push('')
  return lines.join('\n') + '\n'
}
