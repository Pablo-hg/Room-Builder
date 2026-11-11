import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { planDimensionLabelMode, type PlanDimension } from '../domain/planDimensions'
import { planWallTraceInset, planWallTraceThickness } from './planWallGeometry'
import { useWallIdentityTexture, WALL_IDENTITY_LABEL_SIZE } from './RoomShell'

/**
 * Cotas arquitectónicas orientativas del perímetro en la vista Plano (#26).
 * Las posiciones salen del modelo geométrico (en metros); solo el grosor de
 * línea, las marcas y el tamaño del texto se recalculan en píxeles por
 * fotograma para que sigan legibles con cualquier zoom o tamaño de pantalla.
 * No interceptan el puntero ni forman parte del modelo exportado.
 */

const LINE_COLOR = '#405748'
const LABEL_HEIGHT_PX = 20
const LABEL_FONT_PX = 12.5
const LABEL_PADDING_PX = 7
const LABEL_TEXTURE_SCALE = 3
const LINE_WIDTH_PX = 1.4
const TICK_LENGTH_PX = 11
const EXTENSION_GAP_PX = 3
const EXTENSION_OVERSHOOT_PX = 6
/** Separación en pantalla entre el trazo de la pared y la etiqueta de la cota. */
const WALL_TO_DIMENSION_GAP_PX = 8
/** Separación en pantalla entre la etiqueta de la cota y la letra de la pared. */
const DIMENSION_TO_WALL_LABEL_GAP_PX = 8

const noRaycast = () => undefined

interface DimensionLabel {
  texture: THREE.CanvasTexture
  widthPx: number
}

function createLabel(text: string): DimensionLabel {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const font = `700 ${LABEL_FONT_PX * LABEL_TEXTURE_SCALE}px Arial, sans-serif`
  let textWidth = text.length * LABEL_FONT_PX * 0.62 * LABEL_TEXTURE_SCALE
  if (context) {
    context.font = font
    textWidth = context.measureText(text).width
  }
  const widthPx = Math.ceil(textWidth / LABEL_TEXTURE_SCALE + LABEL_PADDING_PX * 2)
  canvas.width = widthPx * LABEL_TEXTURE_SCALE
  canvas.height = LABEL_HEIGHT_PX * LABEL_TEXTURE_SCALE
  if (context) {
    const s = LABEL_TEXTURE_SCALE
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.beginPath()
    context.roundRect(s, s, canvas.width - 2 * s, canvas.height - 2 * s, 6 * s)
    context.fillStyle = 'rgba(255, 253, 249, 0.96)'
    context.fill()
    context.lineWidth = s
    context.strokeStyle = 'rgba(64, 87, 72, 0.45)'
    context.stroke()
    context.font = font
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = LINE_COLOR
    context.fillText(text, canvas.width / 2, canvas.height / 2 + s * 0.5)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return { texture, widthPx }
}

function DimensionLine({ dimension, y, showWallLabel }: { dimension: PlanDimension; y: number; showWallLabel: boolean }) {
  const { camera, size } = useThree()
  const line = useRef<THREE.Mesh>(null)
  const startExtension = useRef<THREE.Mesh>(null)
  const endExtension = useRef<THREE.Mesh>(null)
  const startTick = useRef<THREE.Mesh>(null)
  const endTick = useRef<THREE.Mesh>(null)
  const label = useRef<THREE.Sprite>(null)
  const material = useRef<THREE.SpriteMaterial>(null)
  const wallLabel = useRef<THREE.Sprite>(null)
  const wallLabelTexture = useWallIdentityTexture(dimension.wall)
  const labels = useMemo(() => ({ full: createLabel(dimension.label), compact: createLabel(dimension.compactLabel) }), [dimension.label, dimension.compactLabel])
  useEffect(() => () => {
    labels.full.texture.dispose()
    labels.compact.texture.dispose()
  }, [labels])
  const right = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return
    // Metros del mundo por píxel de pantalla con el zoom actual.
    const unit = (camera.right - camera.left) / Math.max(camera.zoom, 1e-6) / Math.max(size.width, 1)
    const length = dimension.length
    right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    const tangentOnScreen = Math.abs(Math.cos(dimension.yaw) * right.x - Math.sin(dimension.yaw) * right.z)
    const runsHorizontally = tangentOnScreen > 0.7071
    const mode = planDimensionLabelMode(length / unit, runsHorizontally ? labels.full.widthPx : LABEL_HEIGHT_PX, runsHorizontally ? labels.compact.widthPx : LABEL_HEIGHT_PX)
    const shown = mode === 'compact' ? labels.compact : labels.full
    // Medida perpendicular a la pared que ocupa la etiqueta en pantalla.
    // Si la etiqueta se oculta, la línea se acerca a la pared igualmente.
    const labelDepthPx = mode === 'hidden' ? 0 : runsHorizontally ? LABEL_HEIGHT_PX : shown.widthPx
    // Orden desde la pared hacia fuera: trazo de pared → cota → letra «PARED X».
    const traceFace = planWallTraceThickness(dimension.thickness) / 2 - planWallTraceInset(dimension.thickness)
    const offset = traceFace + (labelDepthPx / 2 + WALL_TO_DIMENSION_GAP_PX) * unit
    const side = dimension.outwardSign
    const lineWidth = LINE_WIDTH_PX * unit
    const wallFace = traceFace + EXTENSION_GAP_PX * unit
    const extensionEnd = offset + EXTENSION_OVERSHOOT_PX * unit
    if (line.current) {
      line.current.position.set(0, 0, side * offset)
      line.current.scale.set(length + 2 * EXTENSION_OVERSHOOT_PX * unit, 1, lineWidth)
    }
    for (const [ref, x] of [[startExtension, -length / 2], [endExtension, length / 2]] as const) {
      if (!ref.current) continue
      ref.current.position.set(x, 0, side * (wallFace + extensionEnd) / 2)
      ref.current.scale.set(lineWidth, 1, extensionEnd - wallFace)
    }
    for (const [ref, x] of [[startTick, -length / 2], [endTick, length / 2]] as const) {
      if (!ref.current) continue
      ref.current.position.set(x, 0, side * offset)
      ref.current.scale.set(TICK_LENGTH_PX * unit, 1, lineWidth * 1.6)
    }
    if (label.current && material.current) {
      label.current.visible = mode !== 'hidden'
      if (material.current.map !== shown.texture) {
        material.current.map = shown.texture
        material.current.needsUpdate = true
      }
      label.current.position.set(0, 0.01, side * offset)
      label.current.scale.set(shown.widthPx * unit, LABEL_HEIGHT_PX * unit, 1)
    }
    if (wallLabel.current) {
      // La letra conserva su tamaño en metros, igual que en el Plano normal.
      const [labelWidth, labelHeight] = WALL_IDENTITY_LABEL_SIZE
      const wallLabelHalfDepth = (runsHorizontally ? labelHeight : labelWidth) / 2
      const outerEdge = Math.max(offset + (labelDepthPx / 2) * unit, extensionEnd)
      wallLabel.current.position.set(0, 0.02, side * (outerEdge + DIMENSION_TO_WALL_LABEL_GAP_PX * unit + wallLabelHalfDepth))
    }
  })

  const centre: [number, number, number] = [(dimension.start.x + dimension.end.x) / 2, y, (dimension.start.z + dimension.end.z) / 2]
  const lineMaterial = <meshBasicMaterial color={LINE_COLOR} transparent opacity={0.9} depthTest={false} depthWrite={false} toneMapped={false} />
  return (
    <group position={centre} rotation={[0, dimension.yaw, 0]} name={dimension.id} userData={{ planDimension: dimension.wall, length: dimension.length }}>
      <mesh ref={line} renderOrder={1} raycast={noRaycast}><boxGeometry args={[1, 0.002, 1]} />{lineMaterial}</mesh>
      <mesh ref={startExtension} renderOrder={1} raycast={noRaycast}><boxGeometry args={[1, 0.002, 1]} />{lineMaterial}</mesh>
      <mesh ref={endExtension} renderOrder={1} raycast={noRaycast}><boxGeometry args={[1, 0.002, 1]} />{lineMaterial}</mesh>
      {/* Marcas oblicuas a 45° en los extremos, como en un plano técnico. */}
      <mesh ref={startTick} rotation={[0, Math.PI / 4, 0]} renderOrder={1} raycast={noRaycast}><boxGeometry args={[1, 0.002, 1]} />{lineMaterial}</mesh>
      <mesh ref={endTick} rotation={[0, Math.PI / 4, 0]} renderOrder={1} raycast={noRaycast}><boxGeometry args={[1, 0.002, 1]} />{lineMaterial}</mesh>
      <sprite ref={label} renderOrder={2} raycast={noRaycast}>
        <spriteMaterial ref={material} map={labels.full.texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
      {showWallLabel && <sprite ref={wallLabel} scale={[...WALL_IDENTITY_LABEL_SIZE, 1]} renderOrder={30} raycast={noRaycast}>
        <spriteMaterial map={wallLabelTexture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>}
    </group>
  )
}

/**
 * `wallLabels`: ids de las paredes cuya letra «PARED X» dibuja esta capa por
 * detrás de la cota. La escena oculta entonces su etiqueta normal.
 */
export function PlanDimensions({ dimensions, y, wallLabels }: { dimensions: readonly PlanDimension[]; y: number; wallLabels: ReadonlySet<string> }) {
  return <group name="plan-dimensions">
    {dimensions.map((dimension) => <DimensionLine key={dimension.id} dimension={dimension} y={y} showWallLabel={wallLabels.has(dimension.wallId)} />)}
  </group>
}
