import type { ThreeEvent } from '@react-three/fiber'
import { useRoomStore } from '../state/useRoomStore'
import { recordSceneInteraction } from './sceneInteraction'
import { usePlanPan } from './usePlanPan'

/** Lado del fondo invisible: cubre cualquier desplazamiento razonable del Plano. */
const SURFACE_SIZE = 4000

/**
 * Fondo invisible de la vista Plano, por debajo de todas las plantas.
 * Permite desplazar el plano arrastrando fuera de las habitaciones y conserva
 * el comportamiento de antes al pulsar en vacío (deseleccionar). Solo actúa
 * cuando es lo primero bajo el puntero: muebles, paredes, puertas y suelos
 * siguen recibiendo sus eventos. No se dibuja ni se exporta.
 */
export function PlanPanSurface({ y }: { y: number }) {
  const { startPan, movePan, endPan, lostPan, leavePan, updatePanCursor } = usePlanPan()
  const nearest = (event: ThreeEvent<PointerEvent>) => event.intersections[0]?.object === event.object
  return <mesh
    name="plan-pan-surface"
    position={[0, y, 0]}
    rotation={[-Math.PI / 2, 0, 0]}
    userData={{ planPannable: true }}
    onPointerDown={(event) => {
      if (!nearest(event)) return
      event.stopPropagation()
      recordSceneInteraction('background.pointer-down', { target: 'plan-background' })
      useRoomStore.getState().selectElement(null)
      startPan(event)
    }}
    onPointerMove={(event) => {
      updatePanCursor(event)
      movePan(event)
    }}
    onPointerUp={endPan}
    onPointerCancel={endPan}
    onLostPointerCapture={lostPan}
    onPointerOut={leavePan}
  >
    <planeGeometry args={[SURFACE_SIZE, SURFACE_SIZE]} />
    <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
  </mesh>
}
