import { useLayoutEffect, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { OrthographicCamera, PerspectiveCamera, Vector2 } from 'three'
import type { ViewMode } from '../domain/types'
import { validatePhotoResolution, type PhotoResolution } from './photoResolution'

export type PhotoCapture = {
  view: ViewMode
  matchesPreview: (resolution: PhotoResolution) => boolean
  render: (resolution: PhotoResolution) => Promise<Blob>
}

export function PhotoCaptureController({ captureRef, view }: { captureRef: RefObject<PhotoCapture | null>; view: ViewMode }) {
  const { gl, scene, camera } = useThree()

  useLayoutEffect(() => {
    const logicalSize = new Vector2()
    const matchesPreview: PhotoCapture['matchesPreview'] = ({ width, height }) => {
      const { x, y } = gl.getSize(logicalSize)
      const ratio = width / height
      return x > 0 && y > 0 && Math.abs(x - y * ratio) <= Math.max(1, ratio)
    }
    const render: PhotoCapture['render'] = async ({ width, height }) => {
      const context = gl.getContext()
      if (context.isContextLost()) throw new Error('Se ha perdido la conexión con WebGL.')
      const viewport = context.getParameter(context.MAX_VIEWPORT_DIMS) as Int32Array
      validatePhotoResolution(width, height, Math.min(viewport[0], viewport[1], context.getParameter(context.MAX_RENDERBUFFER_SIZE)))

      const size = gl.getSize(new Vector2())
      if (size.x < 1 || size.y < 1) throw new Error('La vista previa aún no está lista.')
      const pixelRatio = gl.getPixelRatio()
      const photoCamera = camera.clone()
      // La previsualización y el PNG comparten el campo vertical. El ajuste
      // horizontal solo compensa el redondeo de tamaño del contenedor CSS.
      if (photoCamera instanceof PerspectiveCamera) photoCamera.aspect = width / height
      if (photoCamera instanceof OrthographicCamera) {
        const center = (photoCamera.left + photoCamera.right) / 2
        const halfWidth = (photoCamera.top - photoCamera.bottom) * width / height / 2
        photoCamera.left = center - halfWidth
        photoCamera.right = center + halfWidth
      }
      photoCamera.updateProjectionMatrix()

      const image = document.createElement('canvas')
      image.width = width
      image.height = height
      const pixels = image.getContext('2d')
      if (!pixels) throw new Error('El navegador no ha podido preparar la imagen.')

      try {
        gl.setDrawingBufferSize(width, height, 1)
        if (context.drawingBufferWidth !== width || context.drawingBufferHeight !== height) {
          throw new Error('El dispositivo no admite este tamaño. Elige una resolución menor.')
        }
        gl.render(scene, photoCamera)
        if (context.isContextLost()) throw new Error('Se ha perdido la conexión con WebGL.')
        // Copiar en el mismo turno en que se dibuja. El búfer de WebGL se
        // puede borrar antes de que se ejecute el codificador PNG.
        pixels.drawImage(gl.domElement, 0, 0)
      } finally {
        gl.setDrawingBufferSize(size.x, size.y, pixelRatio)
        if (!context.isContextLost()) gl.render(scene, camera)
      }

      if (!hasVisibleDetail(image)) throw new Error('La captura solo contiene un color. Comprueba el encuadre y vuelve a intentarlo.')
      return new Promise<Blob>((resolve, reject) => {
        image.toBlob((blob) => {
          if (blob?.size) resolve(blob)
          else reject(new Error('El navegador no ha podido crear el PNG. Prueba una resolución menor.'))
        }, 'image/png')
      })
    }
    const capture = { view, matchesPreview, render }
    captureRef.current = capture
    return () => { if (captureRef.current === capture) captureRef.current = null }
  }, [camera, captureRef, gl, scene, view])

  return null
}

function hasVisibleDetail(image: HTMLCanvasElement) {
  const sample = document.createElement('canvas')
  sample.width = Math.min(64, image.width)
  sample.height = Math.min(64, image.height)
  const context = sample.getContext('2d')
  if (!context) throw new Error('El navegador no ha podido comprobar la captura.')
  context.drawImage(image, 0, 0, sample.width, sample.height)
  const { data } = context.getImageData(0, 0, sample.width, sample.height)
  for (let i = 4; i < data.length; i += 4) {
    if (data[i] !== data[0] || data[i + 1] !== data[1] || data[i + 2] !== data[2] || data[i + 3] !== data[3]) return true
  }
  return false
}
