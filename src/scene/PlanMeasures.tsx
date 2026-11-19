import { formatCoordinate } from '../domain/lengthUnit'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  constrainToDirection, describeMeasure, makeMeasureEnd, measureGeometry, measureSnapTargets, nearestSnapTarget, visiblePlanMeasures,
  type MeasureEnd, type PlanMeasure, type PlanPoint,
} from '../domain/planMeasures'
import { planFurnitureDistances } from '../domain/planDimensionDetails'
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

interface Label { texture: THREE.CanvasTexture; widthPx: number; heightPx: number }

function createLabel(content: string | readonly string[], color: string): Label {
  const lines = typeof content === 'string' ? [content] : content
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const font = `700 ${LABEL_FONT_PX * SCALE}px Arial, sans-serif`
  let width = Math.max(...lines.map((line) => line.length)) * LABEL_FONT_PX * 0.62 * SCALE
  if (context) { context.font = font; width = Math.max(...lines.map((line) => context.measureText(line).width)) }
  const heightPx = LABEL_HEIGHT_PX * lines.length
  const widthPx = Math.ceil(width / SCALE + LABEL_PAD_PX * 2)
  canvas.width = widthPx * SCALE
  canvas.height = heightPx * SCALE
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
    lines.forEach((line, index) => context.fillText(line, canvas.width / 2, (index + 0.5) * LABEL_HEIGHT_PX * SCALE + SCALE * 0.5))
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return { texture, widthPx, heightPx }
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
  useRoomStore((state) => state.lengthUnit) // las etiquetas se redibujan al cambiar de unidad
  const measurements = useRoomStore((state) => state.measurements)
  const planDetailsVisible = useRoomStore((state) => state.planDetailsVisible && state.planDetailCategories.annotations)
  const view = useRoomStore((state) => state.view)
  const draft = useRoomStore((state) => state.view === 'top' ? state.measureDraft : null)
  const editId = useRoomStore((state) => state.view === 'top' ? state.measureEditId : null)
  // La cota que se está editando la dibuja el editor (siempre visible, aunque esté oculta).
  const shown = visiblePlanMeasures(measurements, { detailsVisible: planDetailsVisible, view }).filter((measure) => measure.id !== editId)
  if (!shown.length && !draft && !editId) return null
  return <group name="plan-measures">
    {shown.map((measure) => (
      <MeasureLine key={measure.id} id={measure.id} start={measure.start} end={measure.end} y={y}
        color={measure.stale ? STALE_COLOR : SAVED_COLOR} text={measureText(measure, measure.start, measure.end)} />
    ))}
    {draft?.end && <MeasureLine id="measure-draft" start={draft.start} end={draft.end} y={y + 0.01} color={DRAFT_COLOR} text={measureText({}, draft.start, draft.end)} />}
  </group>
}

interface Hover { point: PlanPoint; snapped: boolean }

/**
 * Dónde cae un punto del puntero: fija horizontal/vertical respecto de `start` (los ejes de la pantalla, aunque el
 * Plano esté girado) y, con el imán activo, se engancha a esquinas y bordes a menos de 14 px.
 */
function resolveMeasurePoint(camera: THREE.Camera, raw: PlanPoint, start: PlanPoint | null, axisMode: 'free' | 'horizontal' | 'vertical', worldPerPixel: number): { end: MeasureEnd; snapped: boolean } {
  const state = useRoomStore.getState()
  const world = { room: state.room, structurePacks: state.structurePacks, furniture: state.furniture }
  let direction: PlanPoint | null = null
  if (start && axisMode !== 'free') {
    const vector = new THREE.Vector3(axisMode === 'horizontal' ? 1 : 0, axisMode === 'vertical' ? 1 : 0, 0).applyQuaternion(camera.quaternion)
    direction = { x: vector.x, z: vector.z }
  }
  const candidate = direction && start ? constrainToDirection(start, raw, direction) : raw
  const targets = state.measureSnap ? measureSnapTargets(world, state.hiddenElementIds) : []
  const target = nearestSnapTarget(candidate, targets, SNAP_PX * worldPerPixel)
  if (!target) return { end: makeMeasureEnd(candidate), snapped: false }
  if (direction && start) {
    const aligned = constrainToDirection(start, target, direction)
    const onLine = Math.hypot(aligned.x - target.x, aligned.z - target.z) < 1e-3
    return onLine ? { end: makeMeasureEnd(target, target), snapped: true } : { end: makeMeasureEnd(aligned), snapped: true }
  }
  return { end: makeMeasureEnd(target, target), snapped: true }
}

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
    const axisMode = event.nativeEvent.shiftKey && state.measureAxis === 'free' ? 'horizontal' : state.measureAxis
    return resolveMeasurePoint(camera, { x: event.point.x, z: event.point.z }, start, axisMode, worldPerPixel())
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

const HANDLE_PX = 8
const HANDLE_HIT_PX = 20
const EDIT_COLOR = '#1d6fd1'

/** Un punto arrastrable de la cota: círculo visible y un área de toque más grande, de tamaño fijo en pantalla. */
function Handle({ point, planeY, y, letter, active, onDown }: { point: PlanPoint; planeY: number; y: number; letter: 'A' | 'B'; active: boolean; onDown: (event: ThreeEvent<PointerEvent>) => void }) {
  const worldPerPixel = useWorldPerPixel()
  const visible = useRef<THREE.Mesh>(null)
  const hit = useRef<THREE.Mesh>(null)
  const sprite = useRef<THREE.Sprite>(null)
  const unit = useRoomStore((state) => state.lengthUnit)
  // Las coordenadas cambian a la vez que el punto se arrastra: cada cambio redibuja la etiqueta (pequeña).
  const coordinates = `x (${formatCoordinate(point.x, unit)}) ; z (${formatCoordinate(point.z, unit)})`
  const label = useMemo(() => createLabel([letter, coordinates], EDIT_COLOR), [letter, coordinates])
  useEffect(() => () => label.texture.dispose(), [label])
  useFrame(() => {
    const unit = worldPerPixel()
    visible.current?.scale.setScalar((active ? HANDLE_PX + 2 : HANDLE_PX) * unit)
    hit.current?.scale.setScalar(HANDLE_HIT_PX * unit)
    if (sprite.current) {
      // La etiqueta crece hacia arriba y a la derecha del punto para no taparlo.
      sprite.current.position.set(point.x + (label.widthPx / 2 + 8) * unit, y + 0.02, point.z - (label.heightPx / 2 + 8) * unit)
      sprite.current.scale.set(Math.max(label.widthPx, LABEL_HEIGHT_PX) * unit, label.heightPx * unit, 1)
    }
  })
  return <group>
    <mesh ref={visible} position={[point.x, y + 0.02, point.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={7} raycast={noRaycast}>
      <circleGeometry args={[1, 28]} />
      <meshBasicMaterial color={EDIT_COLOR} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
    <mesh ref={hit} name={`measure-handle-${letter}`} position={[point.x, planeY, point.z]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onDown}>
      <circleGeometry args={[1, 24]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
    </mesh>
    <sprite ref={sprite} renderOrder={8} raycast={noRaycast}>
      <spriteMaterial map={label.texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  </group>
}

/**
 * Edición de una cota guardada: sus dos puntos se mueven arrastrándolos en el plano, con el imán a esquinas y
 * bordes (que los vuelve a anclar) y Mayús para fijar horizontal. El arrastre es una vista previa: solo al soltar
 * se guarda, en un único paso de historial; Esc lo cancela. Esc sin arrastrar termina la edición.
 */
export function MeasureEditor({ y, planeY }: { y: number; planeY: number }) {
  const { camera, gl } = useThree()
  const id = useRoomStore((state) => state.view === 'top' ? state.measureEditId : null)
  const measure = useRoomStore((state) => id ? state.measurements.find((candidate) => candidate.id === id) : undefined)
  const worldPerPixel = useWorldPerPixel()
  const [drag, setDrag] = useState<{ side: 'start' | 'end'; end: MeasureEnd; snapped: boolean } | null>(null)
  const dragging = useRef<typeof drag>(null)
  dragging.current = drag
  const cleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanup.current?.(), [])
  useEffect(() => { if (!id) { cleanup.current?.(); setDrag(null) } }, [id])
  useEffect(() => {
    if (!id) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return
      event.preventDefault()
      if (dragging.current) { cleanup.current?.(); setDrag(null) } else useRoomStore.getState().setMeasureEditId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id])
  if (!measure || !id) return null

  const ground = (clientX: number, clientY: number): PlanPoint | null => {
    const rect = gl.domElement.getBoundingClientRect()
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera)
    const point = new THREE.Vector3()
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point) ? { x: point.x, z: point.z } : null
  }
  const begin = (side: 'start' | 'end') => (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    cleanup.current?.()
    const other = side === 'start' ? measure.end : measure.start
    const pointerId = event.pointerId
    const resolveAt = (native: PointerEvent) => {
      const raw = ground(native.clientX, native.clientY)
      if (!raw) return null
      return resolveMeasurePoint(camera, raw, other, native.shiftKey ? 'horizontal' : 'free', worldPerPixel())
    }
    const move = (native: PointerEvent) => {
      if (native.pointerId !== pointerId) return
      const resolved = resolveAt(native)
      if (resolved) setDrag({ side, ...resolved })
    }
    const finish = (native: PointerEvent) => {
      if (native.pointerId !== pointerId) return
      const resolved = resolveAt(native)
      cleanup.current?.()
      setDrag(null)
      // No se guarda una cota degenerada: si los dos puntos coinciden, el gesto no tiene efecto.
      if (resolved && Math.hypot(resolved.end.x - other.x, resolved.end.z - other.z) >= 0.005) useRoomStore.getState().updateMeasure(id, { [side]: resolved.end })
    }
    const abort = () => { cleanup.current?.(); setDrag(null) }
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', finish, true)
    window.addEventListener('pointercancel', abort, true)
    cleanup.current = () => {
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', finish, true)
      window.removeEventListener('pointercancel', abort, true)
      cleanup.current = null
    }
    setDrag({ side, end: side === 'start' ? measure.start : measure.end, snapped: false })
  }

  const start = drag?.side === 'start' ? drag.end : measure.start
  const end = drag?.side === 'end' ? drag.end : measure.end
  return <group name="measure-editor">
    <MeasureLine id={measure.id} start={start} end={end} y={y} color={measure.stale ? STALE_COLOR : EDIT_COLOR} text={measureText(measure, start, end)} />
    <Handle point={start} planeY={planeY} y={y} letter="A" active={drag?.side === 'start'} onDown={begin('start')} />
    <Handle point={end} planeY={planeY} y={y} letter="B" active={drag?.side === 'end'} onDown={begin('end')} />
    {drag?.snapped && <Marker point={drag.end} snapped y={y + 0.03} color="#2f7d4f" />}
  </group>
}

const DISTANCE_COLOR = '#2f6f5e'

/**
 * Distancias del mueble seleccionado a las paredes (categoría «Muebles» de «Mostrar detalles»). Solo del
 * seleccionado, para no llenar el plano; se recalculan al moverlo y no se guardan.
 */
export function PlanFurnitureDistances({ y }: { y: number }) {
  const room = useRoomStore((state) => state.room)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const item = useRoomStore((state) => state.selectedIds.length === 1 && state.view === 'top' ? state.furniture.find((candidate) => candidate.id === state.selectedIds[0]) : undefined)
  const lengthUnit = useRoomStore((state) => state.lengthUnit)
  const distances = useMemo(() => item ? planFurnitureDistances({ room, structurePacks }, item) : [], [item, room, structurePacks, lengthUnit])
  if (!distances.length) return null
  return <group name="plan-furniture-distances">
    {distances.map((distance) => <MeasureLine key={distance.id} id={distance.id} start={distance.start} end={distance.end} y={y} color={DISTANCE_COLOR} text={distance.label} />)}
  </group>
}
