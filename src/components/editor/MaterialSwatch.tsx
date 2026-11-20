import { useEffect, useMemo, useRef } from 'react'
import { formatLength } from '../../domain/lengthUnit'
import { materialDefinition, type MaterialFinish, type MaterialId } from '../../domain/materials'
import { useRoomStore } from '../../state/useRoomStore'
import { drawMaterialPattern } from '../../scene/materialTexture'

const SWATCH_PX = 48
const MAX_CACHED = 128
const cache = new Map<string, string>()

/**
 * Miniatura de un acabado: el MISMO patrón que se dibuja en la escena (`drawMaterialPattern`), teñido con el color y recortado
 * al centro de la repetición para que se distinga su estructura. Devuelve `null` si no hay canvas (el color liso hace de respaldo).
 */
export function swatchImage(id: MaterialId, color: string, scale?: number, rotation?: number): string | null {
  if (!materialDefinition(id)?.textured) return null
  const key = `${id}|${color}|${scale ?? ''}|${rotation ?? ''}`
  const hit = cache.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return null
  try {
    const source = document.createElement('canvas')
    source.width = source.height = 128
    const sourceContext = source.getContext('2d')
    const output = document.createElement('canvas')
    output.width = output.height = SWATCH_PX
    const context = output.getContext('2d')
    if (!sourceContext || !context) return null
    drawMaterialPattern(sourceContext, id)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, SWATCH_PX, SWATCH_PX)
    if (scale !== undefined && rotation !== undefined) {
      const pattern = context.createPattern(source, 'repeat')
      if (!pattern) return null
      pattern.setTransform(new DOMMatrix().translateSelf(SWATCH_PX / 2, SWATCH_PX / 2).rotateSelf(-rotation).scaleSelf(SWATCH_PX * scale / 128))
      context.fillStyle = pattern
      context.fillRect(0, 0, SWATCH_PX, SWATCH_PX)
    } else {
      context.drawImage(source, 16, 16, 96, 96, 0, 0, SWATCH_PX, SWATCH_PX)
    }
    // Igual que en la escena: el patrón en grises multiplica al color del acabado.
    context.globalCompositeOperation = 'multiply'
    context.fillStyle = color
    context.fillRect(0, 0, SWATCH_PX, SWATCH_PX)
    const url = output.toDataURL('image/png')
    cache.set(key, url)
    if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string)
    return url
  } catch {
    return null
  }
}

/** Cuadrado con la miniatura (decorativo si no lleva `label`). */
export function MaterialSwatch({ id, color, label, scale, rotation }: { id: MaterialId; color: string; label?: string; scale?: number; rotation?: number }) {
  const url = useMemo(() => swatchImage(id, color, scale, rotation), [id, color, scale, rotation])
  return <span
    className="material-swatch"
    {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    style={{ backgroundColor: color, ...(url ? { backgroundImage: `url(${url})` } : {}) }}
  />
}

/** Lienzo de 128 px con el patrón de un acabado (1 m de repetición a escala 1), reutilizado por la muestra grande. */
const tiles = new Map<string, HTMLCanvasElement>()
function patternTile(id: MaterialId): HTMLCanvasElement | null {
  const hit = tiles.get(id)
  if (hit) return hit
  const tile = document.createElement('canvas')
  tile.width = tile.height = 128
  const context = tile.getContext('2d')
  if (!context) return null
  drawMaterialPattern(context, id)
  tiles.set(id, tile)
  return tile
}

/** Ancho real que representa la muestra grande. */
const SAMPLE_WIDTH_M = 2.5

/**
 * Muestra grande y en vivo del acabado, como se vería sobre una pared: mismo patrón que la escena, con su color, su escala
 * (1 = una repetición por metro) y su orientación. Se redibuja al cambiar cualquiera de ellos.
 */
export function MaterialPreview({ finish }: { finish: MaterialFinish }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useRoomStore((state) => state.lengthUnit) // el pie de la muestra sigue la unidad elegida
  const definition = materialDefinition(finish.id)
  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const width = element.clientWidth || 260, height = element.clientHeight || 140
    const ratio = window.devicePixelRatio || 1
    element.width = Math.round(width * ratio)
    element.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.globalCompositeOperation = 'source-over'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    const tile = definition?.textured ? patternTile(finish.id) : null
    const pattern = tile ? context.createPattern(tile, 'repeat') : null
    if (pattern) {
      const pixelsPerMetre = width / SAMPLE_WIDTH_M
      const scale = pixelsPerMetre * finish.scale / 128
      pattern.setTransform(new DOMMatrix().translateSelf(width / 2, height / 2).rotateSelf(-finish.rotation).scaleSelf(scale))
      context.fillStyle = pattern
      context.fillRect(0, 0, width, height)
    }
    // Igual que en la escena: el patrón en grises multiplica al color del acabado.
    context.globalCompositeOperation = 'multiply'
    context.fillStyle = finish.color
    context.fillRect(0, 0, width, height)
    context.globalCompositeOperation = 'source-over'
  }, [definition, finish.id, finish.color, finish.scale, finish.rotation])
  return <figure className="material-preview">
    <canvas ref={canvas} role="img" aria-label={`Muestra de ${definition?.name ?? 'acabado'} con escala ${finish.scale.toFixed(1)} y orientación ${finish.rotation}°`} />
    <figcaption>{definition?.name ?? 'Acabado'} · muestra de {formatLength(SAMPLE_WIDTH_M)} de ancho</figcaption>
  </figure>
}
