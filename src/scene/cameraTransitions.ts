import * as THREE from 'three'

export function spatialCameraOrbit(fromPosition: THREE.Vector3, toPosition: THREE.Vector3, fromCenter: THREE.Vector3, toCenter: THREE.Vector3) {
  const from = new THREE.Spherical().setFromVector3(fromPosition.clone().sub(fromCenter))
  const to = new THREE.Spherical().setFromVector3(toPosition.clone().sub(toCenter))
  // At a pole the azimuth is arbitrary. Preserve the other endpoint's azimuth
  // only there; replacing it off-axis would make the final position jump.
  const atPole = (phi: number) => Math.abs(Math.sin(phi)) < 1e-7
  const fromTheta = atPole(from.phi) ? to.theta : from.theta
  const toTheta = atPole(to.phi) ? fromTheta : to.theta
  const delta = Math.atan2(Math.sin(toTheta - fromTheta), Math.cos(toTheta - fromTheta))
  return { fromCenter: fromCenter.clone(), toCenter: toCenter.clone(),
    fromRadius: from.radius, toRadius: to.radius, fromPhi: from.phi, toPhi: to.phi,
    fromTheta, toTheta: fromTheta + delta }
}

export function spatialCameraPosition(orbit: ReturnType<typeof spatialCameraOrbit>, progress: number) {
  const center = new THREE.Vector3().lerpVectors(orbit.fromCenter, orbit.toCenter, progress)
  return new THREE.Vector3().setFromSpherical(new THREE.Spherical(
    THREE.MathUtils.lerp(orbit.fromRadius, orbit.toRadius, progress),
    THREE.MathUtils.lerp(orbit.fromPhi, orbit.toPhi, progress),
    THREE.MathUtils.lerp(orbit.fromTheta, orbit.toTheta, progress),
  )).add(center)
}

type FrontTarget = { view: string; wallView: string | null; activeRoomId: string | null; roomX: number; roomY: number; roomZ: number }

export function shouldOrbitFront(previous: FrontTarget, next: FrontTarget) {
  return previous.view === 'front' && next.view === 'front'
    && previous.wallView !== next.wallView
    && previous.activeRoomId === next.activeRoomId
    && previous.roomX === next.roomX && previous.roomY === next.roomY && previous.roomZ === next.roomZ
}
