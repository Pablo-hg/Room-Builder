import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { folderSelectionId } from '../domain/elementFolders'
import { useRoomStore } from '../state/useRoomStore'
import { selectSceneObject } from './sceneInteraction'

type ScreenRect = { x: number; y: number; width: number; height: number }

/** Indicadores y paneles que flotan sobre el lienzo: una etiqueta de habitación no debe taparlos. */
const CHROME_SELECTOR = '.scene-topline__labels > *, .room-view-selector, .measure-panel, .scene-controls'
let chromeCache: { at: number; parent: HTMLElement; rects: ScreenRect[] } | null = null

/**
 * Rectángulos de esos elementos en el sistema de las etiquetas (centro horizontal y borde inferior, relativo al contenedor).
 * Se miden como mucho cada 300 ms: leer posiciones en cada fotograma forzaría al navegador a recalcular el diseño.
 */
function chromeObstacles(parent: HTMLElement): ScreenRect[] {
  const now = performance.now()
  if (chromeCache && chromeCache.parent === parent && now - chromeCache.at < 300) return chromeCache.rects
  const origin = parent.getBoundingClientRect()
  const rects = [...document.querySelectorAll<HTMLElement>(CHROME_SELECTOR)]
    .map((item) => item.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({ x: rect.left - origin.left + rect.width / 2, y: rect.bottom - origin.top, width: rect.width, height: rect.height }))
  chromeCache = { at: now, parent, rects }
  return rects
}

/** A real button projected over its room, so it remains readable and keyboard accessible. */
export function RoomNameLabel({ folderId, name, position, extent, anchor = 'top' }: { folderId: string; name: string; position: [number, number, number]; extent: { width: number; height: number; depth: number }; anchor?: 'top' | 'floor' }) {
  const { camera, gl, size } = useThree()
  const selected = useRoomStore((state) => state.selectedIds.includes(folderSelectionId(folderId)))
  const button = useRef<HTMLButtonElement | null>(null)
  const dimensions = useRef({ width: 100, height: 30 })
  const point = useMemo(() => new THREE.Vector3(), [])
  const direction = useMemo(() => new THREE.Vector3(), [])
  const corners = useMemo(() => Array.from({ length: 8 }, () => new THREE.Vector3()), [])

  useEffect(() => {
    const parent = gl.domElement.parentElement
    if (!parent) return
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'room-name-label'
    element.style.visibility = 'hidden'
    const stop = (event: PointerEvent) => event.stopPropagation()
    const select = (event: MouseEvent) => { event.stopPropagation(); selectSceneObject(folderSelectionId(folderId), event) }
    element.addEventListener('pointerdown', stop)
    element.addEventListener('click', select)
    parent.appendChild(element)
    button.current = element
    return () => {
      button.current = null
      element.removeEventListener('pointerdown', stop)
      element.removeEventListener('click', select)
      element.remove()
    }
  }, [folderId, gl])

  useEffect(() => {
    if (!button.current) return
    button.current.textContent = name
    button.current.setAttribute('aria-label', `Seleccionar habitación ${name}`)
    button.current.setAttribute('aria-pressed', String(selected))
    button.current.title = `Seleccionar habitación ${name}`
    dimensions.current = { width: button.current.offsetWidth, height: button.current.offsetHeight }
  }, [folderId, name, selected])

  useFrame(() => {
    const element = button.current
    if (!element) return
    point.set(...position).project(camera)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    corners.forEach((corner, index) => {
      corner.set(position[0] + (index & 1 ? 1 : -1) * extent.width / 2,
        // `position` está 0,35 m sobre el techo (anchor «top») o sobre el suelo («floor»): la caja se calcula igual.
        position[1] - 0.35 + (anchor === 'floor' ? extent.height : 0) - (index & 2 ? 0 : extent.height),
        position[2] + (index & 4 ? 1 : -1) * extent.depth / 2).project(camera)
      if (corner.z < -1 || corner.z > 1) return
      minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x)
      minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y)
    })
    const visible = point.z >= -1 && point.z <= 1 && minX <= 1 && maxX >= -1 && minY <= 1 && maxY >= -1
    const visibility = visible ? 'visible' : 'hidden'
    if (element.style.visibility !== visibility) element.style.visibility = visibility
    if (visible) {
      const { width, height } = dimensions.current
      // Keep labels clear of the sidebar toggles that overlay the canvas edges.
      const edge = Math.min(40, Math.max(4, (size.width - width) / 2))
      // En Plano el punto proyectado cae en el centro de la habitación y taparía lo que haya
      // allí (y capturaría el gesto táctil de un mueble o de su gizmo). Se ancla a la esquina
      // superior (centrada) de la huella de la habitación, lejos de los indicadores de la esquina.
      const planView = camera instanceof THREE.OrthographicCamera && camera.getWorldDirection(direction).y < -0.98
      const planX = ((minX + maxX) / 2 + 1) * size.width / 2
      const x = Math.max(width / 2 + edge, Math.min(size.width - width / 2 - edge, planView ? planX : (point.x + 1) * size.width / 2))
      const idealY = Math.max(height + 4, Math.min(size.height - 4, planView ? (1 - maxY) * size.height / 2 + height + 8 : (1 - point.y) * size.height / 2))
      const earlier: Array<{ x: number; y: number; width: number; height: number }> = []
      for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        if (!(sibling instanceof HTMLElement) || sibling.className !== 'room-name-label' || sibling.style.visibility === 'hidden') continue
        const [sx, sy, sw, sh] = (sibling.dataset.rect ?? '').split(',').map(Number)
        if ([sx, sy, sw, sh].every(Number.isFinite)) earlier.push({ x: sx, y: sy, width: sw, height: sh })
      }
      // Además de las otras etiquetas, se esquivan los indicadores y paneles superpuestos al lienzo.
      const blockers = element.parentElement ? chromeObstacles(element.parentElement) : []
      const avoid = [...earlier, ...blockers]
      const clampY = (y: number) => Math.max(height + 4, Math.min(size.height - 4, y))
      const shifts = Math.max(avoid.length, 1)
      const candidates = [idealY, ...Array.from({ length: shifts }, (_, index) => idealY + (index + 1) * (height + 6)), ...Array.from({ length: shifts }, (_, index) => idealY - (index + 1) * (height + 6))].map(clampY)
      const free = (candidate: number) => avoid.every((other) => Math.abs(x - other.x) >= (width + other.width) / 2 + 4 || candidate <= other.y - other.height - 4 || candidate - height >= other.y + 4)
      const found = candidates.find(free)
      // Sin hueco libre: antes que tapar un panel, la etiqueta se oculta hasta que la cámara la deje sitio.
      if (found === undefined && !blockers.every((other) => Math.abs(x - other.x) >= (width + other.width) / 2 + 4 || idealY <= other.y - other.height - 4 || idealY - height >= other.y + 4)) {
        if (element.style.visibility !== 'hidden') element.style.visibility = 'hidden'
        delete element.dataset.rect
        return
      }
      const y = found ?? idealY
      const screenX = Math.round(x * 10) / 10, screenY = Math.round(y * 10) / 10
      const rect = [screenX, screenY, width, height].join(',')
      if (element.dataset.rect !== rect) element.dataset.rect = rect
      const transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -100%)`
      if (element.style.transform !== transform) element.style.transform = transform
    } else delete element.dataset.rect
  })
  return null
}
