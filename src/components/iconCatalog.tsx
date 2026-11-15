import React, { type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { FURNITURE_CATALOG, isWallPictureKind, OPENING_CATALOG, type StandaloneOpeningKind } from '../domain/objectCatalog'
import type { FurnitureItem, FurnitureKind } from '../domain/types'
import { FurnitureModel } from '../scene/FurnitureModels'
import { standaloneOpeningModel } from '../scene/WallObjectModels'
import { ICON_VIEWBOX, projectModelIcon, type IconPolygon } from './modelIcon'

type WallPictureKind = 'pictureSmall' | 'pictureMedium' | 'pictureLarge'
/**
 * Iconos aún dibujados a mano: objetos de pared cuya geometría sigue en Openings.tsx
 * y todavía no se puede proyectar (cuadros en 2D por decisión del propietario).
 * El mobiliario y la estantería de pared usan iconos generados desde su modelo 3D.
 */
type IconKind = WallPictureKind

type IconPart =
  | { type: 'rect'; x: number; y: number; width: number; height: number; fill?: string; stroke?: string; strokeWidth?: number; rx?: number }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; stroke?: string; strokeWidth?: number }
  | { type: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: 'path'; d: string; fill?: string; stroke?: string; strokeWidth?: number }

interface IconDefinition {
  background?: string
  parts: readonly IconPart[]
}

const wood = '#795640'
const darkGreen = '#50695f'
const paleFabric = '#f5e9d3'

const rect = (x: number, y: number, width: number, height: number, fill = 'currentColor', stroke = wood, rx = 1): IconPart => (
  { type: 'rect', x, y, width, height, fill, stroke, strokeWidth: 1.8, rx }
)
const circle = (cx: number, cy: number, r: number, fill = '#f0ca82', stroke = wood): IconPart => (
  { type: 'circle', cx, cy, r, fill, stroke, strokeWidth: 1 }
)
/** Lienzo interior de un cuadro (dentro del marco): el paisaje no puede salirse de él. */
export function pictureCanvas(width: number, height: number) {
  return { x: (48 - width) / 2 + 3, y: (42 - height) / 2 + 3, width: width - 6, height: height - 6 }
}

const pictureParts = (width: number, height: number): IconPart[] => {
  const inner = pictureCanvas(width, height)
  const at = (fx: number, fy: number) => `${Math.round((inner.x + inner.width * fx) * 100) / 100} ${Math.round((inner.y + inner.height * fy) * 100) / 100}`
  return [
    rect((48 - width) / 2, (42 - height) / 2, width, height, wood, wood, 1),
    rect(inner.x, inner.y, inner.width, inner.height, paleFabric, '#d3c4ad'),
    circle(inner.x + inner.width * 0.3, inner.y + inner.height * 0.3, Math.min(inner.width, inner.height) * 0.13, '#f0c17e', 'none'),
    // Montañas con coordenadas absolutas, todas dentro del lienzo interior.
    { type: 'path', d: `M${at(0, 1)} L${at(0.32, 0.5)} L${at(0.52, 0.68)} L${at(0.78, 0.38)} L${at(1, 0.7)} L${at(1, 1)} Z`, fill: 'currentColor' },
  ]
}

export const ICON_CATALOG: Record<IconKind, IconDefinition> = {
  pictureSmall: { parts: pictureParts(23, 24) },
  pictureMedium: { parts: pictureParts(31, 30) },
  pictureLarge: { parts: pictureParts(39, 36) },
}

function renderPart(part: IconPart, index: number): ReactNode {
  if (part.type === 'rect') {
    const { type: _type, ...attributes } = part
    return <rect key={index} {...attributes} strokeLinecap="round" strokeLinejoin="round" />
  }
  if (part.type === 'line') {
    const { type: _type, ...attributes } = part
    return <line key={index} {...attributes} strokeLinecap="round" />
  }
  if (part.type === 'circle') {
    const { type: _type, ...attributes } = part
    return <circle key={index} {...attributes} />
  }
  const { type: _type, ...attributes } = part
  return <path key={index} {...attributes} strokeLinecap="round" strokeLinejoin="round" />
}

function ObjectIcon({ kind, color }: { kind: IconKind; color: string }) {
  const definition = ICON_CATALOG[kind]
  const style: CSSProperties & { '--object-color': string; '--icon-background': string } = {
    '--object-color': color,
    '--icon-background': definition.background ?? `color-mix(in srgb, ${color} 16%, white)`,
  }

  return (
    <svg className="object-icon" viewBox="0 0 48 42" style={style} aria-hidden="true" focusable="false">
      {definition.parts.map(renderPart)}
    </svg>
  )
}

const modelIconCache = new Map<string, IconPolygon[]>()

function cachedModelIcon(key: string, model: () => ReactElement): IconPolygon[] {
  const cached = modelIconCache.get(key)
  if (cached) return cached
  const polygons = projectModelIcon(model())
  modelIconCache.set(key, polygons)
  return polygons
}

/** Polígonos del icono de un mueble, proyectados desde su modelo 3D con las medidas del catálogo. */
export function furnitureModelIcon(kind: FurnitureKind, color: string): IconPolygon[] {
  return cachedModelIcon(`${kind}|${color}`, () => {
    const item: FurnitureItem = { ...FURNITURE_CATALOG[kind].base, color, id: 'icon', x: 0, y: 0, z: 0, rotation: 0 }
    return FurnitureModel({ item })
  })
}

/** Objetos de pared independientes: todos tienen modelo puro en WallObjectModels.tsx. */
export const MODEL_ICON_OPENINGS = ['door', 'window', 'circularWindow', 'wallShelf', 'mirrorRectangular', 'mirrorCircular', 'wallSconce'] as const satisfies readonly StandaloneOpeningKind[]

/** Polígonos del icono de un objeto de pared, proyectados desde el mismo modelo que dibuja la escena. */
export function openingModelIcon(kind: StandaloneOpeningKind, color: string): IconPolygon[] {
  return cachedModelIcon(`${kind}|${color}`, () => standaloneOpeningModel(kind, color))
}

function ModelIcon({ polygons, color }: { polygons: IconPolygon[]; color: string }) {
  const style: CSSProperties & { '--object-color': string; '--icon-background': string } = {
    '--object-color': color,
    '--icon-background': `color-mix(in srgb, ${color} 16%, white)`,
  }
  return (
    <svg className="object-icon object-icon--model" viewBox={`0 0 ${ICON_VIEWBOX.width} ${ICON_VIEWBOX.height}`} style={style} aria-hidden="true" focusable="false">
      {polygons.map((polygon, index) => (
        // El trazo del mismo color tapa las juntas entre triángulos al rasterizar.
        <polygon key={index} points={polygon.points} fill={polygon.fill} stroke={polygon.fill} strokeWidth={0.3} strokeLinejoin="round" />
      ))}
    </svg>
  )
}

export function FurnitureIcon({ kind, color }: { kind: FurnitureKind; color?: string }) {
  const resolved = color ?? FURNITURE_CATALOG[kind].base.color
  if (isWallPictureKind(kind)) return <ObjectIcon kind={kind} color={resolved} />
  return <ModelIcon polygons={furnitureModelIcon(kind, resolved)} color={resolved} />
}

// Mismos colores por defecto que los objetos nuevos en la escena (constructionActions,
// structureDoorActions), para que el icono del catálogo sea el del objeto que se añade.
const OPENING_ICON_COLORS: Record<StandaloneOpeningKind, string> = {
  door: '#ac704b',
  window: '#c88f58',
  circularWindow: '#c88f58',
  wallShelf: '#c88f58',
  mirrorRectangular: '#9a8067',
  mirrorCircular: '#9a8067',
  wallSconce: '#d3a755',
}

export function OpeningIcon({ kind, color }: { kind: StandaloneOpeningKind; color?: string }) {
  const resolved = color ?? OPENING_ICON_COLORS[kind]
  return <ModelIcon polygons={openingModelIcon(kind, resolved)} color={resolved} />
}

export function StructurePackIcon() {
  return (
    <svg className="catalog-icon" viewBox="0 0 48 42" aria-hidden="true" focusable="false">
      <path d="M8 14 24 5l16 9v17l-16 7-16-7z" fill="#e8eee8" stroke={darkGreen} strokeWidth="2" strokeLinejoin="round" />
      <path d="m8 14 16 9 16-9M24 23v15M15 10l16 9v17" fill="none" stroke={wood} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M15 19v9l5 3v-9m8 1v9l5-2v-9" fill="none" stroke={darkGreen} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function StructureSurfaceIcon({ kind }: { kind: 'floor' | 'wall' }) {
  return kind === 'floor' ? (
    <svg className="catalog-icon" viewBox="0 0 48 42" aria-hidden="true" focusable="false">
      <path d="m6 27 18-10 18 10-18 10z" fill="#c99c72" stroke={wood} strokeWidth="2" strokeLinejoin="round" />
      <path d="m6 27 18 10v-5L6 22zm36 0L24 37v-5l18-10z" fill="#a97955" stroke={wood} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="m15 22 18 10m-9-15v20" stroke="#ead9c6" strokeWidth="1.2" />
    </svg>
  ) : (
    <svg className="catalog-icon" viewBox="0 0 48 42" aria-hidden="true" focusable="false">
      <path d="m10 10 24-4 5 4v27l-24 3-5-4z" fill="#e8eee8" stroke={darkGreen} strokeWidth="2" strokeLinejoin="round" />
      <path d="m15 13 19-3v21l-19 3z" fill="#d2ddd6" stroke={wood} strokeWidth="1.6" />
      <path d="m10 10 5 3m19-3 5 0" stroke={wood} strokeWidth="1.5" />
    </svg>
  )
}
