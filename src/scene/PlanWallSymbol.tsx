import { doorSwingGeometry, doorSwingOf } from '../domain/doorSwing'
import type { DoorSwing, WindowConfig } from '../domain/types'

type PlanWallSymbolProps = {
  kind: 'door' | 'window'
  width: number
  height: number
  shape: WindowConfig['shape']
  color: string
  /** Solo puertas: giro elegido (si no hay, bisagra izquierda y hacia dentro). */
  swing?: DoorSwing
}

const isPicture = (shape: string) => shape.startsWith('picture')
const isMirror = (shape: string) => shape.startsWith('mirror')

/**
 * True top-view glyphs, drawn after the wall traces without changing the
 * 3D models. Every symbol has a strong visible edge: door leaf, glass in a
 * window, or a coloured object projecting from its wall.
 */
const DOOR_LINE = '#69402c'
const DOOR_GAP = '#f0dbb9'
const JAMB_DEPTH = 0.17
const LEAF_THICKNESS = 0.05
const ARC_THICKNESS = 0.02

/** Trazo plano entre dos puntos del marco local de la puerta. */
function Stroke({ from, to, thickness, y, order }: { from: { x: number; z: number }; to: { x: number; z: number }; thickness: number; y: number; order: number }) {
  const dx = to.x - from.x, dz = to.z - from.z
  return <mesh position={[(from.x + to.x) / 2, y, (from.z + to.z) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]} renderOrder={order}>
    <boxGeometry args={[Math.hypot(dx, dz) + thickness * 0.5, 0.012, thickness]} />
    <meshBasicMaterial color={DOOR_LINE} depthTest={false} depthWrite={false} toneMapped={false} />
  </mesh>
}

/**
 * Puerta como en un plano de arquitectura: hueco en la pared con sus jambas, la hoja abierta a 90° y el arco de
 * giro. La bisagra y el lado salen del giro elegido en el inspector.
 */
function DoorPlanSymbol({ width, height, swing }: { width: number; height: number; swing: DoorSwing }) {
  const geometry = doorSwingGeometry(width, swing)
  return <group position={[0, height / 2, 0]}>
    <mesh renderOrder={9}>
      <boxGeometry args={[width, 0.03, JAMB_DEPTH]} />
      <meshBasicMaterial color={DOOR_GAP} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
    {[-width / 2, width / 2].map((x) => <mesh key={x} position={[x, 0.02, 0]} renderOrder={10}>
      <boxGeometry args={[0.045, 0.02, JAMB_DEPTH]} />
      <meshBasicMaterial color={DOOR_LINE} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>)}
    <Stroke from={geometry.hinge} to={geometry.leafEnd} thickness={LEAF_THICKNESS} y={0.04} order={11} />
    {geometry.arc.slice(1).map((point, index) => <Stroke key={index} from={geometry.arc[index]} to={point} thickness={ARC_THICKNESS} y={0.035} order={11} />)}
  </group>
}

export function PlanWallSymbol({ kind, width, height, shape, color, swing }: PlanWallSymbolProps) {
  const door = kind === 'door'
  if (door) return <DoorPlanSymbol width={width} height={height} swing={doorSwingOf({ swing })} />
  const glazing = shape === 'rectangular' || shape === 'circular'
  const decoration = !glazing
  const border = glazing ? '#a27347' : isMirror(shape) ? '#6f8692' : '#594b3f'
  const inset = glazing ? '#bcdbe3' : isMirror(shape) ? '#daeaf1' : color
  const barWidth = Math.max(0.005, width - 0.10)
  return <group position={[0, height / 2, 0]}>
    <mesh renderOrder={9}>
      <boxGeometry args={[width + 0.04, 0.03, decoration ? 0.33 : 0.31]} />
      <meshBasicMaterial color={border} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
    <mesh position={[0, 0.02, 0]} renderOrder={10}>
      <boxGeometry args={[barWidth, 0.032, 0.20]} />
      <meshBasicMaterial color={inset} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
    {glazing && <mesh position={[0, 0.041, 0]} renderOrder={11}>
      <boxGeometry args={[barWidth, 0.009, 0.04]} />
      <meshBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>}
    {decoration && <mesh position={[0, 0.042, -0.12]} renderOrder={11}>
      <boxGeometry args={[barWidth, 0.025, isPicture(shape) ? 0.025 : 0.05]} />
      <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>}
  </group>
}
