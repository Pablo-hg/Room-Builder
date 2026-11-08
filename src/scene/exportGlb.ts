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

export function exportGlb(root: THREE.Group, exportDesignName: string, onExportComplete: (error?: Error) => void) {
  const operationId = diagnostics.nextOperation()
  diagnostics.emit({ action: 'model.export-glb', operationId, phase: 'started' })
  const failed = (reason: string) => diagnostics.emit({ action: 'model.export-glb', operationId, category: 'errors', level: 'error', result: 'failed', data: { reason } })
  try {
    const exportRoot = createGlbExportRoot(root)
    new GLTFExporter().parse(
      exportRoot,
      (result) => {
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
        failed('export-failed')
        onExportComplete(error instanceof Error ? error : new Error('Error al exportar el modelo 3D.'))
      },
      { binary: true, onlyVisible: true },
    )
  } catch (error) {
    const exportError = error instanceof Error ? error : new Error('Error al exportar el modelo 3D.')
    failed('export-failed')
    onExportComplete(exportError)
  }
}
