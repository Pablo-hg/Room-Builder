import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { paintTargetId } from '../domain/paintTool'
import { useRoomStore } from '../state/useRoomStore'

const HIGHLIGHT_COLOR = '#ea6f4c'

/** Elemento pintable bajo el puntero: el primer objeto visible con identificador; los manipuladores y las líneas no cuentan. */
function targetAt(raycaster: THREE.Raycaster, scene: THREE.Scene): { id: string; object: THREE.Object3D } | null {
  for (const hit of raycaster.intersectObjects(scene.children, true)) {
    if (hit.object instanceof THREE.Line || hit.object instanceof THREE.Sprite) continue
    let blocked = false
    let found: { id: string; object: THREE.Object3D } | null = null
    for (let current: THREE.Object3D | null = hit.object; current; current = current.parent) {
      if (current.userData.selectionGizmo) { blocked = true; break }
      const id = paintTargetId(current.userData)
      if (id && !found) found = { id, object: current }
    }
    if (blocked) continue
    if (found) return found
  }
  return null
}

/**
 * Herramientas Pintar y Cuentagotas dentro de la escena (#39). Con la herramienta activa, pulsar sobre un elemento lo pinta
 * (o copia su acabado, en modo cuentagotas) en lugar de seleccionarlo ni arrastrarlo; pulsar sobre el fondo sigue
 * orbitando. Funciona igual con ratón, lápiz y táctil. Mientras el puntero está sobre un elemento se resalta su caja.
 */
export function PaintTool() {
  const { camera, gl, scene, invalidate } = useThree()
  const active = useRoomStore((state) => state.paintTool !== null)

  useEffect(() => {
    if (!active) return
    const surface = gl.domElement
    // El oyente va en el contenedor, en fase de captura: así se ejecuta antes que el de órbita del lienzo y que los
    // manejadores de la escena, y puede quedarse con el gesto solo cuando hay un elemento bajo el puntero.
    const host = surface.parentElement ?? surface
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const box = new THREE.Box3()
    const helper = new THREE.Box3Helper(box, new THREE.Color(HIGHLIGHT_COLOR))
    helper.renderOrder = 20
    ;(helper.material as THREE.LineBasicMaterial).depthTest = false
    helper.visible = false
    helper.userData.selectionGizmo = true
    scene.add(helper)
    document.body.classList.add('paint-tool')

    const pick = (event: PointerEvent) => {
      const bounds = surface.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return null
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      helper.visible = false // el resaltado no debe interceptar el rayo
      return targetAt(raycaster, scene)
    }
    const show = (target: { id: string; object: THREE.Object3D } | null) => {
      useRoomStore.getState().setPaintHover(target?.id ?? null)
      if (target) { box.setFromObject(target.object); helper.visible = !box.isEmpty() } else helper.visible = false
      invalidate()
    }

    const onMove = (event: PointerEvent) => show(pick(event))
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = pick(event)
      if (!target) return // fondo: la órbita sigue funcionando
      event.preventDefault()
      event.stopImmediatePropagation()
      const state = useRoomStore.getState()
      if (state.paintTool?.mode === 'eyedropper') state.samplePaint(target.id)
      else state.applyPaint(target.id)
      show(target)
    }
    const onLeave = () => show(null)

    host.addEventListener('pointerdown', onDown, true)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerleave', onLeave)
    return () => {
      host.removeEventListener('pointerdown', onDown, true)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      scene.remove(helper)
      helper.geometry.dispose()
      ;(helper.material as THREE.Material).dispose()
      document.body.classList.remove('paint-tool')
      useRoomStore.getState().setPaintHover(null)
      invalidate()
    }
  }, [active, camera, gl, scene, invalidate])

  return null
}
