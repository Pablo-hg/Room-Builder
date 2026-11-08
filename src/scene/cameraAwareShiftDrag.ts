import * as THREE from 'three'

type Position = { x: number; y: number; z: number }

/**
 * Shift-drag: screen horizontal motion uses the camera's dominant world
 * horizontal axis (X or Z). The other horizontal axis stays fixed; screen
 * vertical motion changes Y. Axis locks remain enforced by the store actions.
 */
export function cameraAwareShiftDrag(
  camera: THREE.Camera,
  viewport: { width: number; height: number },
  start: { clientX: number; clientY: number; position: Position },
  pointer: { clientX: number; clientY: number },
) {
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
  const horizontalAxis = Math.abs(right.x) >= Math.abs(right.z) ? 'x' as const : 'z' as const
  const horizontalSign = Math.sign(right[horizontalAxis]) || 1
  const worldPerPixel = camera instanceof THREE.OrthographicCamera
    ? (camera.top - camera.bottom) / camera.zoom / Math.max(viewport.height, 1)
    : camera instanceof THREE.PerspectiveCamera
      ? 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * Math.max(camera.position.distanceTo(new THREE.Vector3(start.position.x, start.position.y, start.position.z)), 0.1) / Math.max(viewport.height, 1)
      : 0.01
  const horizontal = (pointer.clientX - start.clientX) * worldPerPixel * horizontalSign
  const vertical = -(pointer.clientY - start.clientY) * worldPerPixel
  return {
    axis: horizontalAxis,
    x: start.position.x + (horizontalAxis === 'x' ? horizontal : 0),
    y: start.position.y + vertical,
    z: start.position.z + (horizontalAxis === 'z' ? horizontal : 0),
  }
}
