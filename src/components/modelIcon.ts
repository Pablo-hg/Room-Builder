// Iconos de catálogo generados a partir del propio modelo 3D (F1 · #30).
//
// El modelo de cada mueble es un árbol JSX puro de primitivas (group/mesh/geometría/
// material). Aquí se recorre ese árbol, se construye la geometría con three.js y se
// proyecta con la cámara isométrica de la escena a polígonos SVG con sombreado plano.
// Así el icono es, por construcción, el mismo objeto que se ve en 3D, y cualquier
// mueble nuevo obtiene su icono con la misma estética sin dibujarlo a mano.
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import * as THREE from 'three'
import { intersectPolygon, polygonArea } from '../domain/connectedWallGeometry'

/** Lienzo compartido de todos los iconos del catálogo. */
export const ICON_VIEWBOX = { width: 48, height: 42 } as const
/** Margen interior mínimo del objeto respecto al borde del lienzo. */
export const ICON_PADDING = 4

/**
 * Dirección desde el objeto hacia la cámara: azimut 45° (frente del objeto abajo a la
 * izquierda, como en la vista isométrica por defecto) y elevación ≈26°, medida sobre
 * las capturas de la escena.
 */
export const ICON_CAMERA_DIRECTION = new THREE.Vector3(1, 0.69, 1).normalize()
/**
 * Sombreado plano calibrado con las capturas de la escena: cara superior ≈ ×1,12 (algo
 * más clara que el color base), frontal ≈ ×0,97 y lateral derecha ≈ ×0,85.
 */
const SHADE_BASE = 0.85
const SHADE_WEIGHTS = new THREE.Vector3(0, 0.27, 0.12)
const SHADE_MIN = 0.72
/** Detalle máximo: las curvas se simplifican para un icono minimalista. */
const MAX_RADIAL_SEGMENTS = 14
const MAX_SPHERE_SEGMENTS = [10, 7] as const

export interface IconPolygon {
  points: string
  fill: string
}

type Props = Record<string, unknown> & { children?: ReactNode }

function childrenOf(element: ReactElement<Props>): ReactElement<Props>[] {
  const result: ReactElement<Props>[] = []
  const visit = (node: ReactNode) => {
    if (Array.isArray(node)) node.forEach(visit)
    else if (isValidElement<Props>(node)) result.push(node)
  }
  visit(element.props.children)
  return result
}

function capSegments(type: string, args: unknown[]): unknown[] {
  const copy = [...args]
  const cap = (index: number, max: number) => { if (typeof copy[index] === 'number') copy[index] = Math.min(copy[index] as number, max) }
  if (type === 'cylinderGeometry') cap(3, MAX_RADIAL_SEGMENTS)
  if (type === 'coneGeometry') cap(2, MAX_RADIAL_SEGMENTS)
  if (type === 'sphereGeometry') { cap(1, MAX_SPHERE_SEGMENTS[0]); cap(2, MAX_SPHERE_SEGMENTS[1]) }
  if (type === 'circleGeometry') cap(1, MAX_RADIAL_SEGMENTS * 2)
  if (type === 'ringGeometry') cap(2, MAX_RADIAL_SEGMENTS * 2)
  if (type === 'torusGeometry') { cap(2, 6); cap(3, MAX_RADIAL_SEGMENTS * 2) }
  if (type === 'latheGeometry') cap(1, MAX_RADIAL_SEGMENTS)
  if (type === 'capsuleGeometry') { cap(2, 4); cap(3, 8) }
  return copy
}

const GEOMETRIES: Record<string, new (...args: never[]) => THREE.BufferGeometry> = {
  boxGeometry: THREE.BoxGeometry,
  cylinderGeometry: THREE.CylinderGeometry,
  coneGeometry: THREE.ConeGeometry,
  sphereGeometry: THREE.SphereGeometry,
  circleGeometry: THREE.CircleGeometry,
  ringGeometry: THREE.RingGeometry,
  planeGeometry: THREE.PlaneGeometry,
  torusGeometry: THREE.TorusGeometry,
  latheGeometry: THREE.LatheGeometry,
  capsuleGeometry: THREE.CapsuleGeometry,
}

/** Tipos de geometría que el generador sabe proyectar (los tests exigen que el modelo use solo estos). */
export const SUPPORTED_GEOMETRIES = Object.keys(GEOMETRIES)

interface Triangle { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; color: THREE.Color; doubleSide: boolean }

function applyTransform(object: THREE.Object3D, props: Props) {
  const position = props.position as number[] | undefined
  const rotation = props.rotation as number[] | undefined
  const scale = props.scale as number[] | number | undefined
  if (position) object.position.set(position[0], position[1], position[2])
  if (rotation) object.rotation.set(rotation[0], rotation[1], rotation[2])
  if (typeof scale === 'number') object.scale.setScalar(scale)
  else if (scale) object.scale.set(scale[0], scale[1], scale[2])
}

/** Errores de modelo no proyectable: se exponen para que los tests los detecten. */
export class ModelIconError extends Error {}

function buildObject(element: ReactElement<Props>): THREE.Object3D | null {
  const type = element.type
  if (type === 'group') {
    const group = new THREE.Group()
    applyTransform(group, element.props)
    for (const child of childrenOf(element)) {
      const built = buildObject(child)
      if (built) group.add(built)
    }
    return group
  }
  if (type === 'mesh') {
    const parts = childrenOf(element)
    const geometryElement = parts.find((part) => typeof part.type === 'string' && part.type.endsWith('Geometry'))
    const materialElement = parts.find((part) => typeof part.type === 'string' && part.type.endsWith('Material'))
    if (!geometryElement || typeof geometryElement.type !== 'string') throw new ModelIconError('Malla sin geometría')
    const Geometry = GEOMETRIES[geometryElement.type]
    if (!Geometry) throw new ModelIconError(`Geometría no soportada: ${geometryElement.type}`)
    const args = capSegments(geometryElement.type, (geometryElement.props.args as unknown[] | undefined) ?? [])
    const geometry = new Geometry(...(args as never[]))
    const color = materialElement?.props.color
    if (typeof color !== 'string') throw new ModelIconError('Malla sin color de material')
    const material = new THREE.MeshBasicMaterial({ color, side: materialElement?.props.side === THREE.DoubleSide ? THREE.DoubleSide : THREE.FrontSide })
    const mesh = new THREE.Mesh(geometry, material)
    applyTransform(mesh, element.props)
    return mesh
  }
  // Luces y otros nodos no geométricos no forman parte del icono.
  if (typeof type === 'string') return null
  throw new ModelIconError('Componente no primitivo en el modelo')
}

function collectTriangles(root: THREE.Object3D): Triangle[] {
  root.updateMatrixWorld(true)
  const triangles: Triangle[] = []
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const geometry = (object.geometry as THREE.BufferGeometry).index ? (object.geometry as THREE.BufferGeometry).toNonIndexed() : object.geometry as THREE.BufferGeometry
    const positions = geometry.getAttribute('position')
    const material = object.material as THREE.MeshBasicMaterial
    // three guarda los colores en espacio lineal; el icono SVG trabaja en sRGB.
    const srgb = { r: 0, g: 0, b: 0 }
    material.color.getRGB(srgb, THREE.SRGBColorSpace)
    const color = new THREE.Color().setRGB(srgb.r, srgb.g, srgb.b, THREE.LinearSRGBColorSpace)
    for (let index = 0; index + 2 < positions.count; index += 3) {
      const vertex = (offset: number) => new THREE.Vector3().fromBufferAttribute(positions, index + offset).applyMatrix4(object.matrixWorld)
      triangles.push({ a: vertex(0), b: vertex(1), c: vertex(2), color, doubleSide: material.side === THREE.DoubleSide })
    }
  })
  return triangles
}

const toHex = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0')

/** Oscurece multiplicando; aclara mezclando hacia blanco para no saturar el canal. */
function shade(color: THREE.Color, factor: number): string {
  const channel = (value: number) => factor <= 1 ? value * factor : value + (1 - value) * (factor - 1)
  return `#${toHex(channel(color.r))}${toHex(channel(color.g))}${toHex(channel(color.b))}`
}

interface ProjectedTriangle { points: [number, number][]; depths: [number, number, number]; depth: number; fill: string }

/** Profundidad hacia la cámara del plano de un triángulo en un punto 2D (coordenadas baricéntricas). */
function depthAt(triangle: ProjectedTriangle, [x, y]: [number, number]): number {
  const [[x1, y1], [x2, y2], [x3, y3]] = triangle.points
  const det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
  if (Math.abs(det) < 1e-14) return triangle.depth
  const l1 = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / det
  const l2 = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / det
  return l1 * triangle.depths[0] + l2 * triangle.depths[1] + (1 - l1 - l2) * triangle.depths[2]
}

/**
 * Orden de pintado correcto (lo de detrás primero). Ordenar solo por el centro de cada
 * triángulo falla cuando una cara grande queda junto a piezas pequeñas delante (p. ej. el
 * frente de un mueble y sus puertas). Aquí, para cada par de triángulos que se solapan en
 * pantalla, se compara la profundidad real de ambos en la zona de solape y se ordena
 * topológicamente; el centro solo desempata y rompe ciclos (raros en modelos de cajas).
 */
function paintersOrder<T extends ProjectedTriangle>(triangles: T[]): T[] {
  const count = triangles.length
  const boxes = triangles.map(({ points }) => ({
    minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)),
  }))
  const inFront: number[][] = Array.from({ length: count }, () => [])
  const pending = new Array<number>(count).fill(0)
  for (let first = 0; first < count; first++) {
    for (let second = first + 1; second < count; second++) {
      const a = boxes[first], b = boxes[second]
      if (a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY) continue
      const overlap = intersectPolygon(triangles[first].points, triangles[second].points)
      if (overlap.length < 3 || polygonArea(overlap) < 1e-10) continue
      const centre: [number, number] = [overlap.reduce((sum, [x]) => sum + x, 0) / overlap.length, overlap.reduce((sum, [, y]) => sum + y, 0) / overlap.length]
      const difference = depthAt(triangles[first], centre) - depthAt(triangles[second], centre)
      if (Math.abs(difference) < 1e-9) continue
      const [back, front] = difference > 0 ? [second, first] : [first, second]
      inFront[back].push(front)
      pending[front]++
    }
  }
  const done = new Array<boolean>(count).fill(false)
  const result: T[] = []
  for (let step = 0; step < count; step++) {
    let next = -1
    for (let index = 0; index < count; index++) {
      if (done[index] || pending[index] > 0) continue
      if (next < 0 || triangles[index].depth < triangles[next].depth) next = index
    }
    if (next < 0) {
      // Ciclo: se fuerza el más lejano de los restantes.
      for (let index = 0; index < count; index++) if (!done[index] && (next < 0 || triangles[index].depth < triangles[next].depth)) next = index
    }
    done[next] = true
    result.push(triangles[next])
    for (const front of inFront[next]) pending[front]--
  }
  return result
}

/** Proyecta un modelo (árbol JSX de primitivas) a polígonos SVG ajustados al lienzo del icono. */
export function projectModelIcon(model: ReactElement): IconPolygon[] {
  const root = buildObject(model as ReactElement<Props>)
  if (!root) throw new ModelIconError('Modelo vacío')
  const triangles = collectTriangles(root)
  // Base de la vista: right y up perpendiculares a la dirección de la cámara.
  const forward = ICON_CAMERA_DIRECTION.clone()
  const right = new THREE.Vector3(0, 1, 0).cross(forward).normalize()
  const up = forward.clone().cross(right).normalize()
  const projected = triangles.flatMap((triangle) => {
    const normal = new THREE.Vector3().subVectors(triangle.b, triangle.a).cross(new THREE.Vector3().subVectors(triangle.c, triangle.a))
    if (normal.lengthSq() < 1e-14) return []
    normal.normalize()
    const facing = normal.dot(forward)
    if (facing <= 1e-6 && !triangle.doubleSide) return []
    if (facing < 0) normal.negate()
    const fill = shade(triangle.color, Math.max(SHADE_MIN, SHADE_BASE + normal.dot(SHADE_WEIGHTS)))
    const points = [triangle.a, triangle.b, triangle.c].map((point) => [point.dot(right), -point.dot(up)] as [number, number])
    const depths = [triangle.a.dot(forward), triangle.b.dot(forward), triangle.c.dot(forward)] as [number, number, number]
    return [{ points, fill, depths, depth: (depths[0] + depths[1] + depths[2]) / 3 }]
  })
  if (!projected.length) throw new ModelIconError('El modelo no tiene caras visibles')
  const ordered = paintersOrder(projected)
  const xs = ordered.flatMap((polygon) => polygon.points.map(([x]) => x))
  const ys = ordered.flatMap((polygon) => polygon.points.map(([, y]) => y))
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const scale = Math.min((ICON_VIEWBOX.width - ICON_PADDING * 2) / (maxX - minX || 1), (ICON_VIEWBOX.height - ICON_PADDING * 2) / (maxY - minY || 1))
  const offsetX = (ICON_VIEWBOX.width - (maxX - minX) * scale) / 2
  const offsetY = (ICON_VIEWBOX.height - (maxY - minY) * scale) / 2
  const round = (value: number) => Math.round(value * 100) / 100
  return ordered.map(({ points, fill }) => ({
    fill,
    points: points.map(([x, y]) => `${round(offsetX + (x - minX) * scale)},${round(offsetY + (y - minY) * scale)}`).join(' '),
  }))
}

/** Caja envolvente del modelo en metros (coordenadas locales del objeto). */
export function modelBounds(model: ReactElement): { min: [number, number, number]; max: [number, number, number] } {
  const root = buildObject(model as ReactElement<Props>)
  if (!root) throw new ModelIconError('Modelo vacío')
  root.updateMatrixWorld(true)
  // Preciso: con piezas giradas, la caja aproximada de three agranda la envolvente.
  const box = new THREE.Box3().setFromObject(root, true)
  return { min: box.min.toArray() as [number, number, number], max: box.max.toArray() as [number, number, number] }
}
