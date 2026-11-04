import { useEffect, type RefObject } from 'react'
import type * as THREE from 'three'
import { exportGlb } from './exportGlb'

export function SceneExportController({
  modelRootRef,
  exportRequest,
  exportMode,
  handledRequest,
  exportDesignName,
  onExportComplete,
}: {
  modelRootRef: RefObject<THREE.Group | null>
  exportRequest: number
  exportMode: boolean
  handledRequest: RefObject<number>
  exportDesignName: string
  onExportComplete: (error?: Error) => void
}) {
  useEffect(() => {
    if (!exportMode || exportRequest === 0 || handledRequest.current === exportRequest) return
    // Un cambio de nombre o una actualización de la escena no es una nueva descarga.
    handledRequest.current = exportRequest
    const root = modelRootRef.current
    if (!root) {
      onExportComplete(new Error('La escena 3D todavía no está lista.'))
      return
    }

    exportGlb(root, exportDesignName, onExportComplete)
  }, [exportDesignName, exportMode, exportRequest, handledRequest, modelRootRef, onExportComplete])

  return null
}
