import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useRoomStore } from '../state/useRoomStore'

export const freeMovementSpeed = (fast: boolean) => fast ? 6 : 3

export function FreeCameraKeyboard({ active }: { active: boolean }) {
  const keys = useRef(new Set<string>())
  const { camera } = useThree()
  useEffect(() => {
    if (!active) return
    const down = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable) || event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'shift') { keys.current.add(key); return }
      if (!['w', 'a', 's', 'd'].includes(key)) return
      keys.current.add(key)
      event.preventDefault()
    }
    const up = (event: KeyboardEvent) => { keys.current.delete(event.key.toLowerCase()) }
    const clear = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); clear() }
  }, [active])
  useFrame((_, delta) => {
    if (!active || !keys.current.size) return
    const forward = Number(keys.current.has('w')) - Number(keys.current.has('s'))
    const sideways = Number(keys.current.has('d')) - Number(keys.current.has('a'))
    if (!forward && !sideways) return
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    direction.multiplyScalar(forward).addScaledVector(right, sideways).normalize().multiplyScalar(Math.min(delta, 0.1) * freeMovementSpeed(keys.current.has('shift')))
    useRoomStore.getState().moveFreeCamera(direction.x, direction.y, direction.z)
  })
  return null
}
