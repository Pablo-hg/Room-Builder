import * as THREE from 'three'

type Position = { x: number; y: number; z: number }

/** Mantiene el desplazamiento inicial del cursor sobre el objeto para evitar saltos. */
export type WallSurfaceDrag = {
  plane: THREE.Plane
  pointerOffset: THREE.Vector3
}

/** Plano vertical paralelo a la pared de fijación: permite deslizar y elevar con un solo gesto. */
export function beginWallSurfaceDrag(ray: THREE.Ray, yaw: number, origin: Position): WallSurfaceDrag | null {
  const wallNormal = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    wallNormal, new THREE.Vector3(origin.x, origin.y, origin.z),
  )
  const hit = ray.intersectPlane(plane, new THREE.Vector3())
  if (!hit) return null
  return {
    plane,
    pointerOffset: hit.sub(new THREE.Vector3(origin.x, origin.y, origin.z)),
  }
}

/** Proyecta el ratón sobre la pared sin alterar la coordenada perpendicular a ella. */
export function moveWallSurfaceDrag(ray: THREE.Ray, drag: WallSurfaceDrag): Position | null {
  const hit = ray.intersectPlane(drag.plane, new THREE.Vector3())
  if (!hit) return null
  return hit.sub(drag.pointerOffset)
}
