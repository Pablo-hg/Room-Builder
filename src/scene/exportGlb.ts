import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { diagnostics } from '../diagnostics/engine'

export function createGlbExportRoot(root: THREE.Group) {
  const exportRoot = root.clone(true)
  exportRoot.visible = true
  exportRoot.updateMatrixWorld(true)
  const removeFromExport: THREE.Object3D[] = []
  exportRoot.traverse((object) => {
    const invisibleHitArea = object instanceof THREE.Mesh
      && (Array.isArray(object.material) ? object.material : [object.material]).some((material) => !material.colorWrite)
    if (
      object instanceof THREE.Line
      || object instanceof THREE.Sprite
      || object instanceof THREE.Camera
      || object instanceof THREE.Light
      || invisibleHitArea
    ) {
      removeFromExport.push(object)
    }
  })
  removeFromExport.forEach((object) => object.parent?.remove(object))
  return exportRoot
}

/** Escribe la transformación en los UV de la copia para que funcione también
 * en visores sin KHR_texture_transform. */
function bakeFinishUvs(root: THREE.Group, resources: Array<{ dispose(): void }>) {
  const materials = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>()
  const point = new THREE.Vector2()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return
    const source = object.material
    const map = source.map
    if (!map?.userData.roomFinish || !object.geometry.getAttribute('uv')) return
    let material = materials.get(source)
    if (!material) {
      material = source.clone()
      const texture = map.clone()
      texture.offset.set(0, 0)
      texture.repeat.set(1, 1)
      texture.center.set(0, 0)
      texture.rotation = 0
      texture.updateMatrix()
      material.map = texture
      materials.set(source, material)
      resources.push(material, texture)
    }
    const geometry = object.geometry.clone()
    const uv = geometry.getAttribute('uv')
    map.updateMatrix()
    for (let index = 0; index < uv.count; index++) {
      point.set(uv.getX(index), uv.getY(index)).applyMatrix3(map.matrix)
      uv.setXY(index, point.x, point.y)
    }
    object.geometry = geometry
    object.material = material
    resources.push(geometry)
  })
}

export function exportGlb(root: THREE.Group, exportDesignName: string, onExportComplete: (error?: Error) => void) {
  const operationId = diagnostics.nextOperation()
  diagnostics.emit({ action: 'model.export-glb', operationId, phase: 'started' })
  const failed = (reason: string) => diagnostics.emit({ action: 'model.export-glb', operationId, category: 'errors', level: 'error', result: 'failed', data: { reason } })
  const resources: Array<{ dispose(): void }> = []
  const disposeExportResources = () => {
    for (const resource of resources) resource.dispose()
    resources.length = 0
  }
  try {
    const exportRoot = createGlbExportRoot(root)
    bakeFinishUvs(exportRoot, resources)
    new GLTFExporter().parse(
      exportRoot,
      (result) => {
        disposeExportResources()
        if (!(result instanceof ArrayBuffer)) {
          failed('invalid-export-result')
          onExportComplete(new Error('No se pudo crear el archivo GLB.'))
          return
        }
        const url = URL.createObjectURL(new Blob([result], { type: 'model/gltf-binary' }))
        const link = document.createElement('a')
        link.href = url
        link.download = `${exportDesignName}-${new Date().toISOString().slice(0, 10)}.glb`
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        diagnostics.emit({ action: 'model.export-glb', operationId, result: 'completed', data: { downloadRequested: true } })
        onExportComplete()
      },
      (error) => {
        disposeExportResources()
        failed('export-failed')
        onExportComplete(error instanceof Error ? error : new Error('Error al exportar el modelo 3D.'))
      },
      { binary: true, onlyVisible: true },
    )
  } catch (error) {
    disposeExportResources()
    const exportError = error instanceof Error ? error : new Error('Error al exportar el modelo 3D.')
    failed('export-failed')
    onExportComplete(exportError)
  }
}
