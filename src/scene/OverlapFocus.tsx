import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { nextOverlappingId } from '../domain/overlapFocus'
import { useRoomStore } from '../state/useRoomStore'

function elementIdOf(object: THREE.Object3D) {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (typeof current.userData.elementId === 'string') return current.userData.elementId
  }
  return null
}

/** Alt + clic: pasa al siguiente objeto situado bajo el puntero sin mover el que está delante. */
export function OverlapFocus({ enabled }: { enabled: boolean }) {
  const { camera, gl, scene } = useThree()
  useEffect(() => {
    if (!enabled) return
    const canvas = gl.domElement
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || !event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return
      const bounds = canvas.getBoundingClientRect()
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const ids = raycaster.intersectObjects(scene.children, true).filter(({ object }) => !(object instanceof THREE.Line)).flatMap(({ object }) => elementIdOf(object) ?? [])
      const state = useRoomStore.getState()
      const next = nextOverlappingId(ids, state.selectedId)
      if (!next) return
      event.preventDefault()
      event.stopImmediatePropagation()
      state.selectElement(next)
    }
    canvas.addEventListener('pointerdown', onDown, true)
    return () => canvas.removeEventListener('pointerdown', onDown, true)
  }, [camera, enabled, gl, scene])
  return null
}
