import type { PlanWallStrip } from './planWallGeometry'
import { selectSceneObject } from './sceneInteraction'

/** Top-view walls are selectable; traces remain excluded from 3D exports. */
export function PlanWallLines({ strips }: { strips: readonly PlanWallStrip[] }) {
  return <group name="plan-wall-traces">
    {strips.map((strip) => <mesh
      key={strip.id}
      position={[strip.x, strip.y, strip.z]}
      rotation={[0, strip.yaw, 0]}
      renderOrder={5}
      userData={{ wallId: strip.wallId }}
      onPointerDown={(event) => {
        event.stopPropagation()
        selectSceneObject(strip.wallId, event.nativeEvent)
      }}
    >
      <boxGeometry args={[strip.length, 0.018, strip.thickness]} />
      <meshBasicMaterial color={strip.color} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>)}
  </group>
}
