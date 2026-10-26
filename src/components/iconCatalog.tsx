import React, { type CSSProperties, type ReactNode } from 'react'
import { FURNITURE_CATALOG } from '../domain/objectCatalog'
import type { FurnitureKind } from '../domain/types'

type StandaloneOpeningKind = 'door' | 'window' | 'circularWindow' | 'wallShelf' | 'mirrorRectangular' | 'mirrorCircular' | 'wallSconce'
type IconKind = FurnitureKind | StandaloneOpeningKind

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
const upholsteryEdge = '#b96a53'

const rect = (x: number, y: number, width: number, height: number, fill = 'currentColor', stroke = wood, rx = 1): IconPart => (
  { type: 'rect', x, y, width, height, fill, stroke, strokeWidth: 1.8, rx }
)
const line = (x1: number, y1: number, x2: number, y2: number, stroke = wood, strokeWidth = 2): IconPart => (
  { type: 'line', x1, y1, x2, y2, stroke, strokeWidth }
)
const circle = (cx: number, cy: number, r: number, fill = '#f0ca82', stroke = wood): IconPart => (
  { type: 'circle', cx, cy, r, fill, stroke, strokeWidth: 1 }
)
const pictureParts = (width: number, height: number): IconPart[] => [
  rect((48 - width) / 2, (42 - height) / 2, width, height, wood, wood, 1),
  rect((48 - width) / 2 + 3, (42 - height) / 2 + 3, width - 6, height - 6, paleFabric, '#d3c4ad'),
  circle(21, 17, Math.min(width, height) * 0.12, '#f0c17e', 'none'),
  { type: 'path', d: `M${(48 - width) / 2 + 5} ${(42 - height) / 2 + height - 5} l${width * 0.3} ${-height * 0.32} l${width * 0.18} ${height * 0.13} l${width * 0.25} ${-height * 0.26} l${width * 0.15} ${height * 0.45} Z`, fill: 'currentColor' },
]

export const ICON_CATALOG: Record<IconKind, IconDefinition> = {
  armchair: { parts: [
    { type: 'path', d: 'M11 5 L35 15 L35 25 L11 15 Z', fill: 'currentColor', stroke: upholsteryEdge, strokeWidth: 1 },
    { type: 'path', d: 'M12 20 L25 13 L38 20 L25 28 Z', fill: 'currentColor', stroke: upholsteryEdge, strokeWidth: 1 },
    { type: 'path', d: 'M12 20 L25 28 L25 33 L12 25 Z', fill: 'currentColor', stroke: upholsteryEdge, strokeWidth: 1 },
    { type: 'path', d: 'M25 28 L38 20 L38 25 L25 33 Z', fill: 'currentColor', stroke: upholsteryEdge, strokeWidth: 1 },
    { type: 'path', d: 'M7 15 L13 12 L20 16 L14 20 L14 32 L8 29 Z', fill: 'currentColor', stroke: upholsteryEdge, strokeWidth: 1 },
    { type: 'path', d: 'M34 16 L40 12 L44 14 L44 28 L38 32 L38 20 Z', fill: 'currentColor', stroke: upholsteryEdge, strokeWidth: 1 },
    line(17, 31, 17, 37, wood, 2), line(35, 30, 35, 36, wood, 2),
  ] },
  sofa: { parts: [
    rect(6, 7, 36, 17, 'currentColor', wood, 4),
    rect(4, 16, 7, 13, wood, wood, 2),
    rect(37, 16, 7, 13, wood, wood, 2),
    rect(11, 18, 26, 8, 'currentColor', wood, 2),
    line(23, 8, 23, 17, wood, 1.4),
    line(14, 26, 13, 35), line(34, 26, 35, 35),
  ], background: '#f0dcd6' },
  table: { parts: [
    rect(5, 7, 38, 7, 'currentColor', wood, 2),
    line(11, 14, 11, 35), line(37, 14, 37, 35),
  ] },
  chair: { parts: [
    rect(15, 3, 18, 15, 'currentColor', wood, 3),
    rect(9, 17, 30, 6, 'currentColor', wood, 2),
    line(13, 22, 13, 37), line(35, 22, 35, 37),
    line(18, 22, 18, 36, '#9a7659', 1.5), line(30, 22, 30, 36, '#9a7659', 1.5),
  ] },
  bed: { parts: [
    rect(5, 4, 38, 34, 'currentColor', darkGreen, 3),
    rect(9, 8, 30, 9, '#dce7e3', '#d3c4ad', 3),
    rect(9, 20, 30, 14, 'currentColor', darkGreen, 2),
    line(24, 20, 24, 33, '#dce7e3', 1.2),
  ], background: '#e2ebea' },
  singleBed: { parts: [
    rect(9, 4, 30, 34, 'currentColor', darkGreen, 3),
    rect(13, 8, 22, 9, '#dce7e3', '#d3c4ad', 3),
    rect(13, 20, 22, 14, 'currentColor', darkGreen, 2),
  ], background: '#e2ebea' },
  bedsideTable: { parts: [
    rect(8, 8, 32, 23, 'currentColor', wood, 2),
    rect(11, 11, 26, 8, 'currentColor', wood, 1),
    rect(11, 20, 26, 8, 'currentColor', wood, 1),
    circle(24, 15, 1.5), circle(24, 24, 1.5),
    line(12, 31, 11, 38, wood, 2.2), line(36, 31, 37, 38, wood, 2.2),
  ] },
  cabinet: { parts: [
    rect(5, 7, 38, 26, 'currentColor', darkGreen, 2),
    line(24, 8, 24, 32, darkGreen, 1.5),
    circle(21, 20, 1.4), circle(27, 20, 1.4),
    line(10, 33, 10, 37, darkGreen, 2), line(38, 33, 38, 37, darkGreen, 2),
  ], background: '#dbe5e1' },
  bookshelf: { parts: [
    rect(8, 3, 32, 36, 'none', wood, 1),
    line(9, 14, 39, 14), line(9, 25, 39, 25), line(9, 36, 39, 36),
    rect(13, 6, 5, 7, '#718b84', 'none'), rect(22, 6, 5, 7, '#d59a65', 'none'),
    rect(31, 16, 5, 7, '#8f7094', 'none'), rect(15, 27, 5, 7, '#d4b45f', 'none'),
    rect(25, 27, 5, 7, '#718b84', 'none'),
  ], background: '#eadfd5' },
  wardrobe: { parts: [
    rect(7, 2, 34, 37, 'currentColor', darkGreen, 2),
    line(24, 4, 24, 37, darkGreen, 1.7),
    circle(21, 21, 1.5), circle(27, 21, 1.5),
  ] },
  lamp: { parts: [
    { type: 'path', d: 'M13 4 H35 L41 20 H7 Z', fill: 'currentColor', stroke: wood, strokeWidth: 1.5 },
    line(24, 20, 24, 34, wood, 2.5),
    { type: 'path', d: 'M14 35 Q24 31 34 35 L37 38 H11 Z', fill: wood },
  ], background: '#f2ead6' },
  tableLamp: { parts: [
    { type: 'path', d: 'M16 5 H32 L37 19 H11 Z', fill: 'currentColor', stroke: wood, strokeWidth: 1.5 },
    line(24, 19, 24, 33, wood, 2.5),
    { type: 'path', d: 'M15 34 Q24 30 33 34 L36 38 H12 Z', fill: wood },
  ], background: '#f2ead6' },
  ceilingLamp: { parts: [
    line(24, 2, 24, 12, wood, 2.5),
    rect(19, 2, 10, 3, wood, wood, 1),
    { type: 'path', d: 'M11 14 H37 L32 31 H16 Z', fill: 'currentColor', stroke: wood, strokeWidth: 1.5 },
    { type: 'path', d: 'M16 31 Q24 35 32 31 L35 35 Q24 40 13 35 Z', fill: paleFabric, stroke: wood, strokeWidth: 1 },
  ], background: '#f2ead6' },
  coffeeTable: { parts: [
    { type: 'path', d: 'M7 14 L24 7 L42 14 L24 21 Z', fill: 'currentColor', stroke: wood, strokeWidth: 1.5 },
    line(11, 16, 11, 31), line(37, 16, 37, 31), line(19, 19, 19, 34), line(29, 19, 29, 34),
  ] },
  desk: { parts: [
    rect(5, 9, 38, 7, 'currentColor', wood, 2),
    rect(8, 17, 13, 12, 'currentColor', wood, 1),
    line(8, 29, 8, 38), line(40, 16, 40, 38),
    circle(15, 22, 1.2, paleFabric, wood),
  ] },
  deskChair: { parts: [
    rect(12, 4, 24, 15, 'currentColor', darkGreen, 5),
    rect(12, 18, 24, 7, 'currentColor', darkGreen, 3),
    line(24, 25, 24, 33, wood, 2.5),
    line(24, 32, 8, 37, wood, 2), line(24, 32, 16, 39, wood, 2),
    line(24, 32, 32, 39, wood, 2), line(24, 32, 40, 37, wood, 2),
    line(24, 32, 24, 40, wood, 2),
    circle(8, 37, 1.5, wood, wood), circle(16, 39, 1.5, wood, wood),
    circle(32, 39, 1.5, wood, wood), circle(40, 37, 1.5, wood, wood),
    circle(24, 40, 1.5, wood, wood),
  ] },
  tvStand: { parts: [
    rect(5, 18, 38, 16, 'currentColor', wood, 2),
    line(24, 19, 24, 33, wood, 1.5),
    rect(8, 21, 12, 9, 'none', wood, 1), rect(28, 21, 12, 9, 'none', wood, 1),
    line(9, 35, 8, 39), line(39, 35, 40, 39),
  ] },
  television: { parts: [
    rect(5, 4, 38, 27, 'currentColor', wood, 3),
    rect(9, 8, 30, 19, '#d8e0dc', darkGreen, 1),
    line(24, 31, 24, 36, wood, 2), line(17, 37, 31, 37, wood, 2),
    circle(38, 28, 1, paleFabric, 'none'),
  ], background: '#e1e8e3' },
  rug: { parts: [
    rect(4, 7, 40, 28, 'currentColor', wood, 5),
    rect(9, 12, 30, 18, 'none', paleFabric, 3),
    line(13, 21, 35, 21, paleFabric, 1.5),
    circle(24, 21, 4, 'none', paleFabric),
  ], background: '#f0dfd7' },
  circularRug: { parts: [
    circle(24, 21, 18, 'currentColor', wood),
    circle(24, 21, 13, 'none', paleFabric),
    circle(24, 21, 5, 'none', paleFabric),
    line(24, 7, 24, 35, paleFabric, 1.5),
    line(10, 21, 38, 21, paleFabric, 1.5),
  ], background: '#f0dfd7' },
  plant: { parts: [
    { type: 'path', d: 'M15 25 H33 L30 39 H18 Z', fill: 'currentColor', stroke: wood, strokeWidth: 1.5 },
    line(24, 27, 24, 11, darkGreen, 2),
    { type: 'path', d: 'M23 19 C12 19 11 11 12 8 C20 8 24 12 24 18 Z', fill: darkGreen },
    { type: 'path', d: 'M25 17 C26 8 33 6 37 7 C37 15 33 19 25 20 Z', fill: '#829779' },
    { type: 'path', d: 'M23 24 C15 23 14 18 15 15 C21 16 24 19 25 24 Z', fill: '#9ba982' },
  ], background: '#e4eadf' },
  vase: { parts: [
    { type: 'path', d: 'M20 5 H28 L28 12 C28 17 36 19 36 28 C36 36 31 39 24 39 C17 39 12 36 12 28 C12 19 20 17 20 12 Z', fill: 'currentColor', stroke: wood, strokeWidth: 1.7 },
    line(20, 12, 28, 12, wood, 1.5),
    { type: 'path', d: 'M17 29 Q24 33 31 29', fill: 'none', stroke: paleFabric, strokeWidth: 1.5 },
  ], background: '#f0dfd7' },
  wastebasket: { parts: [
    { type: 'path', d: 'M12 10 H36 L33 36 H15 Z', fill: 'currentColor', stroke: darkGreen, strokeWidth: 1.7 },
    line(13, 9, 35, 9, darkGreen, 2.5),
    line(18, 13, 19, 33, '#c5d1cc', 1.5), line(24, 13, 24, 34, '#c5d1cc', 1.5), line(30, 13, 29, 33, '#c5d1cc', 1.5),
  ], background: '#e2e9e5' },
  pictureSmall: { parts: pictureParts(23, 24) },
  pictureMedium: { parts: pictureParts(31, 30) },
  pictureLarge: { parts: pictureParts(39, 36) },
  door: { background: '#f1e7da', parts: [
    rect(11, 2, 26, 38, 'currentColor', wood, 2),
    rect(15, 6, 18, 29, 'none', '#b37c56', 1),
    circle(30, 21, 1.5, '#fff1c9', 'none'),
  ] },
  window: { background: '#d4ebed', parts: [
    rect(5, 5, 38, 32, '#9fd2d9', '#a8744a', 2),
    line(24, 6, 24, 36, '#a8744a', 2),
    line(6, 21, 42, 21, '#a8744a', 2),
    line(4, 38, 44, 38, '#9b6b45', 2.5),
  ] },
  circularWindow: { background: '#d4ebed', parts: [
    { type: 'circle', cx: 24, cy: 21, r: 15, fill: '#9fd2d9', stroke: '#a8744a', strokeWidth: 3 },
    line(24, 8, 24, 34, '#a8744a', 2),
    line(11, 21, 37, 21, '#a8744a', 2),
  ] },
  wallShelf: { background: '#eadfd5', parts: [
    line(8, 12, 40, 12, wood, 3), line(8, 28, 40, 28, wood, 3),
    line(11, 9, 11, 31, wood, 2), line(37, 9, 37, 31, wood, 2),
    rect(16, 5, 5, 6, '#718b84', 'none'), rect(24, 5, 5, 6, '#d59a65', 'none'),
    rect(21, 20, 5, 6, '#718b84', 'none'), rect(29, 20, 5, 6, '#d59a65', 'none'),
  ] },
  mirrorRectangular: { background: '#e8ece7', parts: [
    rect(12, 2, 24, 38, 'currentColor', wood, 3),
    rect(15, 5, 18, 32, '#dce7e4', '#b8c8c1', 2),
    line(17, 33, 30, 9, '#fffdf9', 2),
  ] },
  mirrorCircular: { background: '#e8ece7', parts: [
    circle(24, 21, 17, 'currentColor', wood),
    circle(24, 21, 13, '#dce7e4', '#b8c8c1'),
    line(17, 30, 29, 12, '#fffdf9', 2),
  ] },
  wallSconce: { background: '#f2ead6', parts: [
    rect(11, 14, 8, 16, wood, wood, 2),
    line(19, 22, 28, 22, wood, 2.5),
    { type: 'path', d: 'M27 10 H40 L36 30 H31 Z', fill: 'currentColor', stroke: wood, strokeWidth: 1.5 },
    line(31, 31, 36, 31, paleFabric, 2),
  ] },
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

export function FurnitureIcon({ kind, color }: { kind: FurnitureKind; color?: string }) {
  return <ObjectIcon kind={kind} color={color ?? FURNITURE_CATALOG[kind].base.color} />
}

const OPENING_ICON_COLORS: Record<StandaloneOpeningKind, string> = {
  door: '#cf8e62',
  window: '#9fd2d9',
  circularWindow: '#9fd2d9',
  wallShelf: '#b9875e',
  mirrorRectangular: '#9a8067',
  mirrorCircular: '#9a8067',
  wallSconce: '#d3a755',
}

export function OpeningIcon({ kind, color }: { kind: StandaloneOpeningKind; color?: string }) {
  return <ObjectIcon kind={kind} color={color ?? OPENING_ICON_COLORS[kind]} />
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
