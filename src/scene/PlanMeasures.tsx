import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  constrainToDirection, describeMeasure, makeMeasureEnd, measureGeometry, measureSnapTargets, nearestSnapTarget, visiblePlanMeasures,
  type MeasureEnd, type PlanMeasure, type PlanPoint,
} from '../domain/planMeasures'
import { useRoomStore } from '../state/useRoomStore'

/**
 * Cotas manuales del Plano (#38): dibujo de las guardadas y herramienta Medir.
 * Las posiciones están en metros del mundo; solo el grosor de las líneas, las marcas y el texto se
 * recalculan en píxeles por fotograma para seguir legibles con cualquier zoom. Las cotas no interceptan
 * el puntero (salvo la herramienta mientras está activa) y no forman parte del modelo exportado.
 */
const SAVED_COLOR = '#2a5d9f'
const DRAFT_COLOR = '#b4541c'
const STALE_COLOR = '#b3261e'
const LINE_PX = 2
const TICK_PX = 14
const LABEL_HEIGHT_PX = 20
const LABEL_FONT_PX = 12.5
const LABEL_PAD_PX = 7
const LABEL_OFFSET_PX = 16
const SCALE = 3
const SNAP_PX = 14
const DRAG_PX = 6
const noRaycast = () => undefined

interface Label { texture: THREE.CanvasTexture; widthPx: number }

function createLabel(text: string, color: string): Label {
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
    context.fillStyle = 'rgba(255, 253, 249, 0.97)'
    context.fill()
    context.lineWidth = SCALE
    context.strokeStyle = color
    context.stroke()
    context.font = font
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = color
    context.fillText(text, canvas.width / 2, canvas.height / 2 + SCALE * 0.5)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return { texture, widthPx }
}

/** Metros del mundo por píxel de pantalla en el Plano (cámara ortográfica). */
function useWorldPerPixel() {
  const { camera, size } = useThree()
  return () => camera instanceof THREE.OrthographicCamera
    ? (camera.right - camera.left) / Math.max(camera.zoom, 1e-6) / Math.max(size.width, 1)
    : 0.01
}

interface LineProps { start: PlanPoint; end: PlanPoint; y: number; color: string; text: string; id: string; dashed?: boolean }

/** Línea de cota: trazo, marcas en los extremos y etiqueta, con tamaño constante en pantalla. */
function MeasureLine({ start, end, y, color, text, id }: LineProps) {
  const worldPerPixel = useWorldPerPixel()
  const line = useRef<THREE.Mesh>(null)
  const startTick = useRef<THREE.Mesh>(null)
  const endTick = useRef<THREE.Mesh>(null)
  const sprite = useRef<THREE.Sprite>(null)
  const label = useMemo(() => createLabel(text, color), [text, color])
  useEffect(() => () => label.texture.dispose(), [label])
  const { dx, dz, length } = measureGeometry(start, end)
  const yaw = -Math.atan2(dz, dx)
  useFrame(() => {
    const unit = worldPerPixel()
    line.current?.scale.set(Math.max(length, 1e-4), 1, LINE_PX * unit)
    for (const [ref, x] of [[startTick, -length / 2], [endTick, length / 2]] as const) {
      if (!ref.current) continue
      ref.current.position.set(x, 0, 0)
      ref.current.scale.set(LINE_PX * 1.6 * unit, 1, TICK_PX * unit)
    }
    if (sprite.current) {
      sprite.current.position.set(0, 0.01, -(LABEL_HEIGHT_PX / 2 + LABEL_OFFSET_PX) * unit)
      // La etiqueta se mantiene a un lado de la línea y nunca patas arriba respecto de la pantalla.
      sprite.current.scale.set(label.widthPx * unit, LABEL_HEIGHT_PX * unit, 1)
    }
  })
  const material = <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
  return <group position={[(start.x + end.x) / 2, y, (start.z + end.z) / 2]} rotation={[0, yaw, 0]} name={id} userData={{ planMeasure: id, length }}>
    <mesh ref={line} renderOrder={3} raycast={noRaycast}><boxGeometry args={[1, 0.002, 1]} />{material}</mesh>
    <mesh ref={startTick} renderOrder={3} raycast={noRaycast}><boxGeometry args={[1, 0.002, 1]} />{material}</mesh>
    <mesh ref={endTick} renderOrder={3} raycast={noRaycast}><boxGeometry args={[1, 0.002, 1]} />{material}</mesh>
    <sprite ref={sprite} renderOrder={4} raycast={noRaycast}>
      <spriteMaterial map={label.texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  </group>
}

function measureText(measure: Pick<PlanMeasure, 'name' | 'stale'>, start: PlanPoint, end: PlanPoint) {
  const { label, detail } = describeMeasure(start, end)
  return `${measure.stale ? '⚠ ' : ''}${measure.name ? `${measure.name} · ` : ''}${label}${detail ? ` (${detail})` : ''}`
}

/** Cotas guardadas: solo en Plano detallado y mientras no estén ocultas una a una. */
export function PlanMeasures({ y }: { y: number }) {
  const measurements = useRoomStore((state) => state.measurements)
  const planDetailsVisible = useRoomStore((state) => state.planDetailsVisible)
  const view = useRoomStore((state) => state.view)
  const draft = useRoomStore((state) => state.view === 'top' ? state.measureDraft : null)
  const shown = visiblePlanMeasures(measurements, { detailsVisible: planDetailsVisible, view })
  if (!shown.length && !draft) return null
  return <group name="plan-measures">
    {shown.map((measure) => (
      <MeasureLine key={measure.id} id={measure.id} start={measure.start} end={measure.end} y={y}
        color={measure.stale ? STALE_COLOR : SAVED_COLOR} text={measureText(measure, measure.start, measure.end)} />
    ))}
    {draft?.end && <MeasureLine id="measure-draft" start={draft.start} end={draft.end} y={y + 0.01} color={DRAFT_COLOR} text={measureText({}, draft.start, draft.end)} />}
  </group>
}

interface Hover { point: PlanPoint; snapped: boolean }

/** Marcador circular de tamaño fijo en pantalla: dónde caerá el punto (y si se engancha). */
function Marker({ point, snapped, y, color }: { point: PlanPoint; snapped: boolean; y: number; color: string }) {
  const worldPerPixel = useWorldPerPixel()
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const unit = worldPerPixel()
    mesh.current?.scale.setScalar((snapped ? 9 : 5) * unit)
  })
  return <mesh ref={mesh} position={[point.x, y, point.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5} raycast={noRaycast}>
    <ringGeometry args={[0.7, 1, 24]} />
    <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
  </mesh>
}

/**
 * Herramienta Medir: marca dos puntos (toque/clic, o arrastrando) en el Plano.
 * Un plano invisible por encima de la escena recoge el puntero mientras la herramienta está activa, de modo que
 * no se selecciona, mueve ni desplaza nada por debajo. Escape descarta la medida; Intro la guarda.
 */
export function MeasureTool({ y, planeY }: { y: number; planeY: number }) {
  const { camera } = useThree()
  const active = useRoomStore((state) => state.measureToolActive && state.view === 'top')
  const draft = useRoomStore((state) => state.measureDraft)
  const [hover, setHover] = useState<Hover | null>(null)
  const [preview, setPreview] = useState<MeasureEnd | null>(null)
  const gesture = useRef<{ pointerId: number; x: number; y: number; created: boolean } | null>(null)
  const worldPerPixel = useWorldPerPixel()

  useEffect(() => {
    if (!active) { setHover(null); setPreview(null); gesture.current = null; return }
    const onKey = (event: KeyboardEvent) => {
      const state = useRoomStore.getState()
      const field = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)
      if (field) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (state.measureDraft) state.setMeasureDraft(null); else state.setMeasureToolActive(false)
        setPreview(null)
      } else if (event.key === 'Enter' && state.measureDraft?.end) {
        event.preventDefault()
        state.saveMeasureDraft()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
  useEffect(() => { if (!draft || draft.end) setPreview(null) }, [draft])

  const resolve = (event: ThreeEvent<PointerEvent>, start: PlanPoint | null): { end: MeasureEnd; snapped: boolean } => {
    const state = useRoomStore.getState()
    const raw = { x: event.point.x, z: event.point.z }
    const world = { room: state.room, structurePacks: state.structurePacks, furniture: state.furniture }
    const axisMode = event.nativeEvent.shiftKey && state.measureAxis === 'free' ? 'horizontal' : state.measureAxis
    let direction: PlanPoint | null = null
    if (start && axisMode !== 'free') {
      // Horizontal/vertical son los de la pantalla, aunque el Plano esté girado.
      const vector = new THREE.Vector3(axisMode === 'horizontal' ? 1 : 0, axisMode === 'vertical' ? 1 : 0, 0).applyQuaternion(camera.quaternion)
      direction = { x: vector.x, z: vector.z }
    }
    const candidate = direction && start ? constrainToDirection(start, raw, direction) : raw
    const targets = state.measureSnap ? measureSnapTargets(world, state.hiddenElementIds) : []
    const target = nearestSnapTarget(candidate, targets, SNAP_PX * worldPerPixel())
    if (!target) return { end: makeMeasureEnd(candidate), snapped: false }
    if (direction && start) {
      const aligned = constrainToDirection(start, target, direction)
      const onLine = Math.hypot(aligned.x - target.x, aligned.z - target.z) < 1e-3
      return onLine ? { end: makeMeasureEnd(target, target), snapped: true } : { end: makeMeasureEnd(aligned), snapped: true }
    }
    return { end: makeMeasureEnd(target, target), snapped: true }
  }

  if (!active) return null
  const startPoint = draft && !draft.end ? draft.start : null
  const down = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const state = useRoomStore.getState()
    const current = state.measureDraft
    const { end } = resolve(event, current && !current.end ? current.start : null)
    if (current && !current.end) {
      if (Math.hypot(end.x - current.start.x, end.z - current.start.z) < 0.005) return
      state.setMeasureDraft({ start: current.start, end })
      gesture.current = null
    } else {
      state.setMeasureDraft({ start: end, end: null })
      gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, created: true }
      ;(event.target as Element | null)?.setPointerCapture?.(event.pointerId)
    }
  }
  const move = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    const state = useRoomStore.getState()
    const current = state.measureDraft
    const { end, snapped } = resolve(event, current && !current.end ? current.start : null)
    setHover({ point: end, snapped })
    setPreview(current && !current.end ? end : null)
  }
  const up = (event: ThreeEvent<PointerEvent>) => {
    const started = gesture.current
    gesture.current = null
    if (!started || started.pointerId !== event.pointerId) return
    event.stopPropagation()
    const state = useRoomStore.getState()
    const current = state.measureDraft
    // Arrastrar de un punto a otro también mide; un simple toque deja el primer punto a la espera del segundo.
    if (!current || current.end || Math.hypot(event.clientX - started.x, event.clientY - started.y) < DRAG_PX) return
    const { end } = resolve(event, current.start)
    if (Math.hypot(end.x - current.start.x, end.z - current.start.z) >= 0.005) state.setMeasureDraft({ start: current.start, end })
  }
  const cancel = () => { gesture.current = null; useRoomStore.getState().setMeasureDraft(null); setPreview(null) }

  return <group name="measure-tool">
    <mesh name="measure-tool-surface" position={[0, planeY, 0]} rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
      onPointerOut={() => setHover(null)}>
      <planeGeometry args={[4000, 4000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
    </mesh>
    {draft && <Marker point={draft.start} snapped={!!draft.start.anchor} y={y + 0.02} color={DRAFT_COLOR} />}
    {draft?.end && <Marker point={draft.end} snapped={!!draft.end.anchor} y={y + 0.02} color={DRAFT_COLOR} />}
    {hover && <Marker point={hover.point} snapped={hover.snapped} y={y + 0.02} color={hover.snapped ? '#2f7d4f' : DRAFT_COLOR} />}
    {startPoint && preview && <MeasureLine id="measure-preview" start={startPoint} end={preview} y={y + 0.01} color={DRAFT_COLOR} text={measureText({}, startPoint, preview)} />}
  </group>
}
