import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { AlignGuide, DragGuide, GapGuide } from '../domain/dragGuides'
import { useRoomStore } from '../state/useRoomStore'

/**
 * Guías temporales de arrastre (#37). Las posiciones están en metros del mundo; solo el grosor de la
 * línea y el tamaño del texto se recalculan en píxeles por fotograma para seguir legibles con cualquier
 * zoom o rotación. No interceptan el puntero, no se exportan y desaparecen al terminar el gesto.
 */
const ALIGN_COLOR = '#c2417d'
const GAP_COLOR = '#2f6f5e'
const LINE_PX = 2
const TICK_PX = 10
const LABEL_HEIGHT_PX = 20
const LABEL_FONT_PX = 12.5
const LABEL_PAD_PX = 7
const SCALE = 3
const noRaycast = () => undefined

/** Metros del mundo por píxel en el punto indicado. */
function useWorldPerPixel() {
  const { camera, size } = useThree()
  return (point: THREE.Vector3) => {
    if (camera instanceof THREE.OrthographicCamera) return (camera.right - camera.left) / Math.max(camera.zoom, 1e-6) / Math.max(size.width, 1)
    const perspective = camera as THREE.PerspectiveCamera
    return 2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2) * Math.max(camera.position.distanceTo(point), 0.1) / Math.max(size.height, 1)
  }
}

function createLabel(text: string) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const font = `700 ${LABEL_FONT_PX * SCALE}px Arial, sans-serif`
  let width = text.length * LABEL_FONT_PX * 0.62 * SCALE
  if (context) { context.font = font; width = context.measureText(text).width }
  const widthPx = Math.ceil(width / SCALE + LABEL_PAD_PX * 2)
  canvas.width = widthPx * SCALE
  canvas.height = LABEL_HEIGHT_PX * SCALE
  if (context) {
    context.beginPath()
    context.roundRect(SCALE, SCALE, canvas.width - 2 * SCALE, canvas.height - 2 * SCALE, 6 * SCALE)
    context.fillStyle = 'rgba(255, 253, 249, 0.96)'
    context.fill()
    context.lineWidth = SCALE
    context.strokeStyle = 'rgba(47, 111, 94, 0.55)'
    context.stroke()
    context.font = font
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = GAP_COLOR
    context.fillText(text, canvas.width / 2, canvas.height / 2 + SCALE * 0.5)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return { texture, widthPx }
}

/** Barra plana sobre el suelo entre dos puntos X/Z, con grosor constante en pantalla. */
function Bar({ ax, az, bx, bz, y, color, widthPx = LINE_PX, order }: { ax: number; az: number; bx: number; bz: number; y: number; color: string; widthPx?: number; order: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const worldPerPixel = useWorldPerPixel()
  const centre = useMemo(() => new THREE.Vector3((ax + bx) / 2, y, (az + bz) / 2), [ax, az, bx, bz, y])
  useFrame(() => {
    if (!mesh.current) return
    const unit = worldPerPixel(centre)
    mesh.current.position.copy(centre)
    mesh.current.rotation.y = -Math.atan2(bz - az, bx - ax)
    mesh.current.scale.set(Math.max(Math.hypot(bx - ax, bz - az), 1e-4), 1, widthPx * unit)
  })
  return <mesh ref={mesh} renderOrder={order} raycast={noRaycast}>
    <boxGeometry args={[1, 0.002, 1]} />
    <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
  </mesh>
}

function Align({ guide, y }: { guide: AlignGuide; y: number }) {
  const margin = 0.15
  const [ax, az, bx, bz] = guide.axis === 'x'
    ? [guide.position, guide.from - margin, guide.position, guide.to + margin]
    : [guide.from - margin, guide.position, guide.to + margin, guide.position]
  return <Bar ax={ax} az={az} bx={bx} bz={bz} y={y} color={ALIGN_COLOR} order={20} />
}

function Gap({ guide, y }: { guide: GapGuide; y: number }) {
  const sprite = useRef<THREE.Sprite>(null)
  const worldPerPixel = useWorldPerPixel()
  const label = useMemo(() => createLabel(guide.label), [guide.label])
  useEffect(() => () => label.texture.dispose(), [label])
  const horizontal = guide.axis === 'x'
  const [ax, az, bx, bz] = horizontal ? [guide.from, guide.at, guide.to, guide.at] : [guide.at, guide.from, guide.at, guide.to]
  const centre = useMemo(() => new THREE.Vector3((ax + bx) / 2, y, (az + bz) / 2), [ax, az, bx, bz, y])
  useFrame(() => {
    if (!sprite.current) return
    const unit = worldPerPixel(centre)
    sprite.current.position.set(centre.x, y + 0.02, centre.z)
    sprite.current.scale.set(label.widthPx * unit, LABEL_HEIGHT_PX * unit, 1)
  })
  const tick = (x: number, z: number) => {
    const half = TICK_PX / 2
    return <TickBar key={`${x}:${z}`} x={x} z={z} y={y} along={horizontal ? 'z' : 'x'} halfPx={half} />
  }
  return <group>
    <Bar ax={ax} az={az} bx={bx} bz={bz} y={y} color={GAP_COLOR} order={20} />
    {tick(ax, az)}{tick(bx, bz)}
    <sprite ref={sprite} renderOrder={22} raycast={noRaycast}>
      <spriteMaterial map={label.texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  </group>
}

function TickBar({ x, z, y, along, halfPx }: { x: number; z: number; y: number; along: 'x' | 'z'; halfPx: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const worldPerPixel = useWorldPerPixel()
  const position = useMemo(() => new THREE.Vector3(x, y, z), [x, y, z])
  useFrame(() => {
    if (!mesh.current) return
    const unit = worldPerPixel(position)
    mesh.current.position.copy(position)
    mesh.current.scale.set(along === 'x' ? halfPx * 2 * unit : LINE_PX * unit, 1, along === 'z' ? halfPx * 2 * unit : LINE_PX * unit)
  })
  return <mesh ref={mesh} renderOrder={21} raycast={noRaycast}>
    <boxGeometry args={[1, 0.002, 1]} />
    <meshBasicMaterial color={GAP_COLOR} depthTest={false} depthWrite={false} toneMapped={false} />
  </mesh>
}

export function DragGuidesOverlay({ y }: { y: number }) {
  const guides: readonly DragGuide[] = useRoomStore((state) => state.activeGuides)
  if (!guides.length) return null
  return <group name="drag-guides">
    {guides.map((guide, index) => guide.type === 'line'
      ? <Align key={`l:${guide.axis}:${guide.position.toFixed(3)}:${guide.kind}`} guide={guide} y={y} />
      : <Gap key={`g:${index}:${guide.axis}:${guide.label}`} guide={guide} y={y} />)}
  </group>
}
