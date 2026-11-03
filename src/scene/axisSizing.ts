import * as THREE from 'three'

const forward = new THREE.Vector3()
const cameraPosition = new THREE.Vector3()
const offset = new THREE.Vector3()

/** World size for a roughly 90-pixel control, bounded for extreme zoom and distance. */
export function axisControlScale(camera: THREE.Camera, height: number, worldPosition: THREE.Vector3) {
  if (height <= 0) return 1
  let worldPerPixel = 0.01
  if (camera instanceof THREE.OrthographicCamera) {
    worldPerPixel = (camera.top - camera.bottom) / camera.zoom / height
  } else if (camera instanceof THREE.PerspectiveCamera) {
    camera.getWorldDirection(forward)
    camera.getWorldPosition(cameraPosition)
    const depth = Math.max(0.05, offset.copy(worldPosition).sub(cameraPosition).dot(forward))
    worldPerPixel = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / camera.zoom / height
  }
  return THREE.MathUtils.clamp(worldPerPixel * 90, 0.16, 3)
}
