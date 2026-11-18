import * as THREE from 'three'

/**
 * UV en **metros** por proyección según la normal dominante de cada triángulo (caja / «box mapping»), igual que las
 * paredes (`wallMeshGeometry`). Así un patrón mide lo mismo en cualquier superficie, sin depender de cómo se construyó la
 * malla ni de su tamaño. Requiere `position` y `normal`; no modifica la posición ni el resto de atributos.
 *
 * `matrix` es la transformación de la malla respecto al objeto cuyo tamaño real importa (p. ej. un mueble
 * redimensionado): con ella el patrón se repite con el tamaño real de la pieza en vez de estirarse con ella.
 */
export function applyWorldUv(geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): THREE.BufferGeometry {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  if (!position || !normal) return geometry
  const uv = new Float32Array(position.count * 2)
  const point = new THREE.Vector3(), facing = new THREE.Vector3()
  const normalMatrix = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i)
    facing.fromBufferAttribute(normal, i)
    if (matrix && normalMatrix) { point.applyMatrix4(matrix); facing.applyMatrix3(normalMatrix).normalize() }
    const nx = Math.abs(facing.x), ny = Math.abs(facing.y), nz = Math.abs(facing.z)
    let u: number, v: number
    if (nz >= nx && nz >= ny) { u = facing.z >= 0 ? point.x : -point.x; v = point.y } // cara frontal/trasera
    else if (nx >= ny) { u = facing.x >= 0 ? -point.z : point.z; v = point.y } // laterales
    else { u = point.x; v = facing.y >= 0 ? -point.z : point.z } // tapas superior/inferior
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geometry
}

/**
 * Aplica `applyWorldUv` a las piezas de un modelo cuyo material usa `texture`, midiendo cada una con su transformación
 * dentro de `root` (incluido el redimensionado del mueble).
 */
export function applyWorldUvToTexturedMeshes(root: THREE.Object3D, texture: THREE.Texture): void {
  root.updateWorldMatrix(true, true)
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const relative = new THREE.Matrix4()
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && !Array.isArray(object.material) && (object.material as THREE.MeshStandardMaterial).map === texture) {
      applyWorldUv(object.geometry, relative.multiplyMatrices(inverse, object.matrixWorld))
    }
  })
}
