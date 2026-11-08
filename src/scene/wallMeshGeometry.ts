import * as THREE from 'three'
import type { ConnectedWall } from '../domain/wallConnections'
import type { WallFace, WallVertex } from '../domain/wallSolidGeometry'

/** World union boundary -> the physical wall's existing local render frame. */
export function wallMeshGeometry(faces: readonly WallFace[], wall: ConnectedWall): THREE.BufferGeometry {
  const positions: number[] = [], normals: number[] = []
  const local = ([x, y, z]: WallVertex): WallVertex => [(x - wall.x) * Math.cos(wall.yaw) - (z - wall.z) * Math.sin(wall.yaw),
    y - wall.y, (x - wall.x) * Math.sin(wall.yaw) + (z - wall.z) * Math.cos(wall.yaw)]
  for (const face of faces) {
    const [x, y, z] = face.normal
    const normal = [x * Math.cos(wall.yaw) - z * Math.sin(wall.yaw), y, x * Math.sin(wall.yaw) + z * Math.cos(wall.yaw)]
    for (let i = 1; i + 1 < face.points.length; i++) {
      const [a, b, c] = [face.points[0], face.points[i], face.points[i + 1]]
      const u = b.map((value, axis) => value - a[axis]), v = c.map((value, axis) => value - a[axis])
      if (Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) < 1e-12) continue
      for (const point of [a, b, c]) { positions.push(...local(point)); normals.push(...normal) }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.computeBoundingSphere()
  return geometry
}
