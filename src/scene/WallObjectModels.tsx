import React, { type ReactElement } from 'react'
import * as THREE from 'three'
import { colorTone } from './colorTone'
import { mirrorGlint, shelfBooks, wallShelfFrame } from './wallObjectDetails'
import { OPENING_CATALOG, type StandaloneOpeningKind } from '../domain/objectCatalog'

// Modelos puros de objetos de pared: solo primitivas (group/mesh/geometría/material),
// sin hooks ni interacción, en coordenadas locales (x a lo largo de la pared, y hacia
// arriba, z hacia fuera de la pared, centrados en el objeto). Los usa la escena
// (Openings.tsx) y el generador de iconos, así que icono y 3D salen de la misma fuente.

export interface WallObjectModelProps { width: number; height: number; color: string; finishColor?: string; texture?: THREE.Texture | null }

export const WALL_SHELF_DEPTH = 0.25
/** Medida base del aplique: el modelo se escala desde ella. */
export const WALL_SCONCE_BASE = { width: 0.5, height: 0.5 } as const

const openingFrameWidth = (width: number, height: number) => Math.min(0.07, width * 0.12, height * 0.12)

export function wallShelfModel({ width, height, color, finishColor, texture }: WallObjectModelProps): ReactElement {
  const frame = wallShelfFrame(width, height)
  const darkColor = colorTone(color, -0.2)
  return (
    <group>
      <mesh position={[0, 0, 0.015]} castShadow><boxGeometry args={[width, height, 0.05]} /><meshStandardMaterial color={darkColor} roughness={0.88} /></mesh>
      {[-frame.shelfY, frame.shelfY].map((y) => (
        <mesh key={y} position={[0, y, WALL_SHELF_DEPTH / 2]} castShadow><boxGeometry args={[width, frame.shelfThickness, WALL_SHELF_DEPTH]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? color} map={texture} roughness={0.78} /></mesh>
      ))}
      {[-1, 1].map((side) => <mesh key={side} position={[side * frame.sideX, 0, WALL_SHELF_DEPTH / 2]} castShadow><boxGeometry args={[frame.sideWidth, height, WALL_SHELF_DEPTH]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? color} map={texture} roughness={0.78} /></mesh>)}
      {shelfBooks(width, height, WALL_SHELF_DEPTH).map((book) => (
        <mesh key={book.key} position={book.position} castShadow><boxGeometry args={book.size} /><meshStandardMaterial color={colorTone(color, book.tone)} roughness={0.85} /></mesh>
      ))}
    </group>
  )
}

/** Marco de puerta (el hueco lo recorta la pared). Centrado en el hueco. */
export function doorModel({ width, height, color, finishColor, texture }: WallObjectModelProps): ReactElement {
  const frameWidth = 0.07
  const darkColor = colorTone(color, -0.2)
  return (
    <group>
      <mesh position={[-width / 2 + frameWidth / 2, 0, 0.05]}><boxGeometry args={[frameWidth, height, 0.16]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? darkColor} map={texture} /></mesh>
      <mesh position={[width / 2 - frameWidth / 2, 0, 0.05]}><boxGeometry args={[frameWidth, height, 0.16]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? darkColor} map={texture} /></mesh>
      <mesh position={[0, height / 2, 0.05]}><boxGeometry args={[width, 0.08, 0.16]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? darkColor} map={texture} /></mesh>
    </group>
  )
}

export function windowModel({ width, height, color, finishColor, texture }: WallObjectModelProps): ReactElement {
  const frameWidth = openingFrameWidth(width, height)
  const lightColor = colorTone(color, 0.32)
  return (
    <group>
      <mesh><boxGeometry args={[width - frameWidth * 2, height - frameWidth * 2, 0.035]} /><meshStandardMaterial color={lightColor} transparent opacity={0.62} roughness={0.15} /></mesh>
      <mesh position={[0, 0, 0.026]}><boxGeometry args={[Math.min(0.055, width * 0.12), height, 0.07]} /><meshStandardMaterial color={lightColor} /></mesh>
      {[-1, 1].map((side) => <mesh key={`v${side}`} position={[side * (width / 2 - frameWidth / 2), 0, 0.035]}><boxGeometry args={[frameWidth, height, 0.09]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? color} map={texture} /></mesh>)}
      {[-1, 1].map((side) => <mesh key={`h${side}`} position={[0, side * (height / 2 - frameWidth / 2), 0.035]}><boxGeometry args={[width, frameWidth, 0.09]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? color} map={texture} /></mesh>)}
    </group>
  )
}

export function circularWindowModel({ width, height, color, finishColor, texture }: WallObjectModelProps): ReactElement {
  const frameWidth = openingFrameWidth(width, height)
  const radius = Math.min(width, height) / 2
  const lightColor = colorTone(color, 0.32)
  return (
    <group>
      <mesh><circleGeometry args={[radius - frameWidth, 64]} /><meshStandardMaterial color={lightColor} transparent opacity={0.62} roughness={0.15} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0, 0.04]}><ringGeometry args={[radius - frameWidth, radius, 64]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? color} map={texture} roughness={0.72} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0, 0.05]}><boxGeometry args={[frameWidth * 0.72, (radius - frameWidth) * 2, 0.065]} /><meshStandardMaterial color={lightColor} /></mesh>
      <mesh position={[0, 0, 0.05]}><boxGeometry args={[(radius - frameWidth) * 2, frameWidth * 0.72, 0.065]} /><meshStandardMaterial color={lightColor} /></mesh>
    </group>
  )
}

export function mirrorModel({ width, height, color, finishColor, texture, circular }: WallObjectModelProps & { circular: boolean }): ReactElement {
  const frameWidth = Math.min(0.065, width * 0.12, height * 0.12)
  const darkColor = colorTone(color, -0.2)
  if (circular) {
    const radius = Math.min(width, height) / 2
    return (
      <group>
        <mesh castShadow><circleGeometry args={[radius, 48]} /><meshStandardMaterial color={darkColor} roughness={0.78} /></mesh>
        <mesh position={[0, 0, 0.018]}><circleGeometry args={[radius - frameWidth, 48]} /><meshStandardMaterial color="#dce7e4" metalness={0.18} roughness={0.28} /></mesh>
        <mesh position={[0, 0, 0.026]}><ringGeometry args={[radius - frameWidth, radius, 48]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? color} map={texture} roughness={0.8} /></mesh>
        <mesh position={[-radius * 0.2, radius * 0.12, 0.03]} rotation={[0, 0, -0.55]}><planeGeometry args={[frameWidth * 0.65, radius * 1.1]} /><meshStandardMaterial color="#fffdf9" transparent opacity={0.55} /></mesh>
      </group>
    )
  }
  const stripe = frameWidth * 0.65
  const glint = mirrorGlint(width - frameWidth * 2, height - frameWidth * 2, stripe)
  return (
    <group>
      <mesh castShadow><boxGeometry args={[width, height, 0.06]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? darkColor} map={texture} roughness={0.8} /></mesh>
      <mesh position={[0, 0, 0.034]}><boxGeometry args={[width - frameWidth * 2, height - frameWidth * 2, 0.012]} /><meshStandardMaterial color="#dce7e4" metalness={0.18} roughness={0.28} /></mesh>
      {glint && <mesh position={[glint.x, glint.y, 0.043]} rotation={[0, 0, glint.angle]}><planeGeometry args={[stripe, glint.length]} /><meshStandardMaterial color="#fffdf9" transparent opacity={0.55} /></mesh>}
    </group>
  )
}

/** Aplique a su medida base; la escena lo escala al tamaño del objeto. Sin luz propia. */
export function wallSconceModel({ color, finishColor, texture }: Pick<WallObjectModelProps, 'color' | 'finishColor' | 'texture'>): ReactElement {
  const darkColor = colorTone(color, -0.2)
  return (
    <group>
      <mesh position={[0, 0, 0.015]} castShadow><boxGeometry args={[0.16, 0.26, 0.055]} /><meshStandardMaterial color={darkColor} roughness={0.8} /></mesh>
      <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, 0.12, 12]} /><meshStandardMaterial color={darkColor} metalness={0.2} roughness={0.55} /></mesh>
      <mesh position={[0, -0.035, 0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow><coneGeometry args={[0.16, 0.22, 24, 1, true]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? color} map={texture} side={THREE.DoubleSide} roughness={0.72} /></mesh>
    </group>
  )
}

/** Cuadro mural: marco, lienzo y una composición sencilla. */
export function pictureModel({ width, height, color, finishColor, texture }: WallObjectModelProps): ReactElement {
  const frameWidth = openingFrameWidth(width, height)
  return (
    <group>
      <mesh castShadow><boxGeometry args={[width, height, 0.055]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={finishColor ?? colorTone(color, -0.2)} map={texture} roughness={0.78} /></mesh>
      <mesh position={[0, 0, 0.034]}><boxGeometry args={[width - frameWidth * 2, height - frameWidth * 2, 0.014]} /><meshStandardMaterial color={colorTone(color, 0.32)} roughness={0.92} /></mesh>
      <mesh position={[-width * 0.2, height * 0.16, 0.044]}><circleGeometry args={[Math.min(width, height) * 0.17, 24]} /><meshStandardMaterial color={colorTone(color, 0.42)} /></mesh>
      <mesh position={[width * 0.13, -height * 0.1, 0.045]} rotation={[0, 0, 0.2]}><planeGeometry args={[width * 0.42, height * 0.28]} /><meshStandardMaterial color={colorTone(color, -0.08)} /></mesh>
      <mesh position={[-width * 0.13, -height * 0.22, 0.046]} rotation={[0, 0, -0.16]}><planeGeometry args={[width * 0.32, height * 0.16]} /><meshStandardMaterial color={colorTone(color, -0.3)} /></mesh>
    </group>
  )
}

/** Modelo de cada objeto de pared independiente a su medida de catálogo. Lo usan los iconos y los tests. */
export function standaloneOpeningModel(kind: StandaloneOpeningKind, color: string, size: Pick<WallObjectModelProps, 'width' | 'height'> = OPENING_CATALOG[kind]): ReactElement {
  const { width, height } = size
  if (kind === 'door') return doorModel({ width, height, color })
  if (kind === 'window') return windowModel({ width, height, color })
  if (kind === 'circularWindow') return circularWindowModel({ width, height, color })
  if (kind === 'wallShelf') return wallShelfModel({ width, height, color })
  if (kind === 'wallSconce') return wallSconceModel({ color })
  return mirrorModel({ width, height, color, circular: kind === 'mirrorCircular' })
}
