import type { Intersection, Object3D } from 'three'

function isTransformControl(object: Object3D) {
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (current.userData.selectionGizmo || current.userData.structureSurfaceGizmo) return true
  }
  return false
}

/** Transform handles take precedence over surfaces that overlap them on screen. */
export function prioritizeTransformControls(items: Intersection[]) {
  return [...items].sort((a, b) => Number(isTransformControl(b.object)) - Number(isTransformControl(a.object)))
}
