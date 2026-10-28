import { useEffect, type RefObject } from 'react'
import type * as THREE from 'three'
import { exportGlb } from './exportGlb'

export function SceneExportController({
  modelRootRef,
  exportRequest,
  exportDesignName,
  onExportComplete,
}: {
  modelRootRef: RefObject<THREE.Group | null>
  exportRequest: number
  exportDesignName: string
  onExportComplete: (error?: Error) => void
}) {
  useEffect(() => {
    if (exportRequest === 0) return
    const root = modelRootRef.current
    if (!root) {
      onExportComplete(new Error('La escena 3D todavía no está lista.'))
      return
    }

    exportGlb(root, exportDesignName, onExportComplete)
  }, [exportDesignName, exportRequest, modelRootRef, onExportComplete])

  return null
}
