import type { WindowConfig } from '../domain/types'

type PlanWallSymbolProps = {
  kind: 'door' | 'window'
  width: number
  height: number
  shape: WindowConfig['shape']
  color: string
}

const isPicture = (shape: string) => shape.startsWith('picture')
const isMirror = (shape: string) => shape.startsWith('mirror')

/**
 * True top-view glyphs, drawn after the wall traces without changing the
 * 3D models. Every symbol has a strong visible edge: door leaf, glass in a
 * window, or a coloured object projecting from its wall.
 */
export function PlanWallSymbol({ kind, width, height, shape, color }: PlanWallSymbolProps) {
  const door = kind === 'door'
  const glazing = !door && (shape === 'rectangular' || shape === 'circular')
  const decoration = !door && !glazing
  const border = door ? '#69402c' : glazing ? '#a27347' : isMirror(shape) ? '#6f8692' : '#594b3f'
  const inset = door ? '#f0dbb9' : glazing ? '#bcdbe3' : isMirror(shape) ? '#daeaf1' : color
  const barWidth = Math.max(0.005, width - 0.10)
  return <group position={[0, height / 2, 0]}>
    <mesh renderOrder={9}>
      <boxGeometry args={[width + 0.04, 0.03, door ? 0.32 : decoration ? 0.33 : 0.31]} />
      <meshBasicMaterial color={border} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
    <mesh position={[0, 0.02, 0]} renderOrder={10}>
      <boxGeometry args={[barWidth, 0.032, door ? 0.22 : 0.20]} />
      <meshBasicMaterial color={inset} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
    {glazing && <mesh position={[0, 0.041, 0]} renderOrder={11}>
      <boxGeometry args={[barWidth, 0.009, 0.04]} />
      <meshBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>}
    {door && <>
      <mesh position={[-width / 2 + 0.035, 0.05, 0.12]} renderOrder={11}>
        <boxGeometry args={[0.045, 0.023, 0.33]} />
        <meshBasicMaterial color={border} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[-width / 2 + 0.16, 0.056, 0.28]} renderOrder={11}>
        <boxGeometry args={[0.28, 0.017, 0.025]} />
        <meshBasicMaterial color={border} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </>}
    {decoration && <mesh position={[0, 0.042, -0.12]} renderOrder={11}>
      <boxGeometry args={[barWidth, 0.025, isPicture(shape) ? 0.025 : 0.05]} />
      <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>}
  </group>
}
