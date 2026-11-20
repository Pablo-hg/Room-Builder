import React, { type ReactElement } from 'react'
import * as THREE from 'three'
import type { FurnitureItem, FurnitureKind } from '../domain/types'
import { FURNITURE_PRESETS } from '../domain/objectCatalog'
import { colorTone } from './colorTone'
import { pictureModel } from './WallObjectModels'

type ModelContext = {
  item: FurnitureItem
  material: ReactElement
  texture?: THREE.Texture | null
  darkColor: string
  deeperColor: string
  lightColor: string
  paleColor: string
}
type ModelRenderer = (context: ModelContext) => ReactElement

function renderArmchair({ item, material, darkColor }: ModelContext) {
  const armWidth = 0.15
  const backDepth = 0.16
  return (
    <group>
      <mesh position={[0, 0.34, 0]} castShadow><boxGeometry args={[item.width * 0.74, 0.32, item.depth * 0.68]} />{material}</mesh>
      <mesh position={[0, 0.65, -item.depth / 2 + backDepth / 2]} castShadow><boxGeometry args={[item.width, 0.55, backDepth]} />{material}</mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * (item.width - armWidth) / 2, 0.46, 0]} castShadow><boxGeometry args={[armWidth, 0.42, item.depth]} />{material}</mesh>)}
      {[-1, 1].map((side) => <mesh key={`leg-${side}`} position={[side * item.width * 0.32, 0.11, -item.depth * 0.2]}><boxGeometry args={[0.08, 0.22, 0.08]} /><meshStandardMaterial color={darkColor} /></mesh>)}
    </group>
  )
}

function renderSofa({ item, material, darkColor, deeperColor }: ModelContext) {
  const armWidth = 0.14
  return (
    <group>
      <mesh position={[0, 0.34, 0]} castShadow><boxGeometry args={[item.width * 0.86, 0.3, item.depth * 0.72]} />{material}</mesh>
      <mesh position={[0, 0.64, -item.depth / 2 + 0.09]} castShadow><boxGeometry args={[item.width, 0.54, 0.18]} />{material}</mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * (item.width - armWidth) / 2, 0.45, 0]} castShadow><boxGeometry args={[armWidth, 0.4, item.depth]} />{material}</mesh>)}
      <mesh position={[0, 0.5, -0.03]} castShadow><boxGeometry args={[0.045, 0.3, item.depth * 0.56]} /><meshStandardMaterial color={darkColor} roughness={0.82} /></mesh>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * item.width * 0.4, 0.09, z * item.depth * 0.28]}><boxGeometry args={[0.08, 0.18, 0.08]} /><meshStandardMaterial color={deeperColor} /></mesh>))}
    </group>
  )
}

function renderTable({ item, material, darkColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, item.height - 0.08, 0]} castShadow><boxGeometry args={[item.width, 0.16, item.depth]} />{material}</mesh>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
        <mesh key={`${x}-${z}`} position={[x * item.width * 0.38, item.height / 2 - 0.08, z * item.depth * 0.34]} castShadow>
          <boxGeometry args={[0.1, item.height - 0.16, 0.1]} /><meshStandardMaterial color={darkColor} />
        </mesh>
      )))}
    </group>
  )
}

function renderCoffeeTable({ item, material, darkColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, item.height - 0.06, 0]} castShadow><boxGeometry args={[item.width, 0.12, item.depth]} />{material}</mesh>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
        <mesh key={`${x}-${z}`} position={[x * item.width * 0.4, item.height / 2 - 0.06, z * item.depth * 0.36]} castShadow>
          <boxGeometry args={[0.07, item.height - 0.12, 0.07]} /><meshStandardMaterial color={darkColor} />
        </mesh>
      )))}
    </group>
  )
}

function renderDesk({ item, material, darkColor, deeperColor, lightColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, item.height - 0.06, 0]} castShadow><boxGeometry args={[item.width, 0.12, item.depth]} />{material}</mesh>
      <mesh position={[-item.width * 0.29, item.height * 0.47, 0]} castShadow><boxGeometry args={[item.width * 0.32, item.height * 0.65, item.depth * 0.72]} /><meshStandardMaterial color={darkColor} /></mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * item.width * 0.42, item.height / 2 - 0.06, 0]} castShadow><boxGeometry args={[0.07, item.height - 0.12, item.depth * 0.84]} /><meshStandardMaterial color={deeperColor} /></mesh>)}
      <mesh position={[-item.width * 0.29, item.height * 0.47, item.depth * 0.38]}><boxGeometry args={[item.width * 0.25, item.height * 0.21, 0.025]} /><meshStandardMaterial color={lightColor} /></mesh>
    </group>
  )
}

function renderDeskChair({ item, material, darkColor, deeperColor }: ModelContext) {
  const casterAngles = Array.from({ length: 5 }, (_, index) => index * Math.PI * 2 / 5)
  return (
    <group>
      <mesh position={[0, 0.47, 0.03]} castShadow><cylinderGeometry args={[item.width * 0.39, item.width * 0.39, 0.12, 28]} />{material}</mesh>
      <mesh position={[0, 0.66, -item.depth * 0.35]} castShadow><boxGeometry args={[item.width * 0.82, 0.36, 0.1]} />{material}</mesh>
      <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.035, 0.045, 0.32, 16]} /><meshStandardMaterial color={darkColor} metalness={0.25} roughness={0.5} /></mesh>
      <mesh position={[0, 0.08, 0]} castShadow><cylinderGeometry args={[0.065, 0.065, 0.07, 20]} /><meshStandardMaterial color={deeperColor} metalness={0.2} roughness={0.55} /></mesh>
      {casterAngles.map((angle) => (
        <group key={angle} rotation={[0, angle, 0]}>
          <mesh position={[0, 0.075, 0.1]} castShadow><boxGeometry args={[0.045, 0.04, 0.2]} /><meshStandardMaterial color={deeperColor} /></mesh>
          <mesh position={[0, 0.045, 0.21]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.04, 0.04, 0.035, 16]} /><meshStandardMaterial color={darkColor} /></mesh>
        </group>
      ))}
    </group>
  )
}

// Perfil del jarrón (radio, altura) en metros para la medida base de 0,5 m: base cerrada
// apoyada en el suelo, cuerpo ancho, cuello estrecho y boca algo abierta.
const VASE_PROFILE = [[0, 0], [0.13, 0], [0.17, 0.04], [0.2, 0.15], [0.19, 0.27], [0.13, 0.37], [0.085, 0.42], [0.09, 0.47], [0.11, 0.5]]

function renderVase({ material, darkColor, lightColor }: ModelContext) {
  return (
    <group>
      <mesh castShadow><latheGeometry args={[VASE_PROFILE.map(([radius, height]) => new THREE.Vector2(radius, height)), 24]} />{material}</mesh>
      {/* Franja decorativa a la altura del vientre, apenas más ancha que el cuerpo. */}
      <mesh position={[0, 0.21, 0]}><cylinderGeometry args={[0.2, 0.2, 0.035, 24]} /><meshStandardMaterial color={lightColor} roughness={0.8} /></mesh>
      {/* Interior de la boca, para que no se vea a través del jarrón. */}
      <mesh position={[0, 0.485, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.1, 24]} /><meshStandardMaterial color={darkColor} roughness={0.9} /></mesh>
    </group>
  )
}

// Las pantallas son superficies abiertas: se dibujan por las dos caras para que se vea
// su parte trasera e interior. Las lámparas no emiten luz (decisión del propietario).
function shadeMaterial(item: FurnitureItem, texture?: THREE.Texture | null) {
  return <meshStandardMaterial key={texture ? 'textured' : undefined} color={item.material?.color ?? item.color} map={texture} roughness={0.78} side={THREE.DoubleSide} />
}

function renderTableLamp({ item, texture, darkColor, deeperColor, lightColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, 0.035, 0]} castShadow><cylinderGeometry args={[0.19, 0.22, 0.07, 24]} /><meshStandardMaterial color={darkColor} metalness={0.2} roughness={0.55} /></mesh>
      <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.025, 0.035, 0.32, 16]} /><meshStandardMaterial color={deeperColor} metalness={0.25} roughness={0.5} /></mesh>
      <mesh position={[0, 0.44, 0]} castShadow><cylinderGeometry args={[0.11, 0.24, 0.3, 28, 1, true]} />{shadeMaterial(item, texture)}</mesh>
      <mesh position={[0, 0.29, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.11, 24]} /><meshStandardMaterial color={lightColor} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

function renderCeilingLamp({ item, texture, darkColor, deeperColor, lightColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, item.height - 0.025, 0]} castShadow><cylinderGeometry args={[0.18, 0.18, 0.05, 24]} /><meshStandardMaterial color={darkColor} metalness={0.2} roughness={0.55} /></mesh>
      <mesh position={[0, item.height * 0.58, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, item.height * 0.78, 12]} /><meshStandardMaterial color={deeperColor} metalness={0.25} roughness={0.5} /></mesh>
      <mesh position={[0, item.height * 0.2, 0]} castShadow><cylinderGeometry args={[0.13, 0.27, item.height * 0.38, 28, 1, true]} />{shadeMaterial(item, texture)}</mesh>
      <mesh position={[0, item.height * 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.13, 24]} /><meshStandardMaterial color={lightColor} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

function renderTvStand({ item, material, darkColor, deeperColor, lightColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, item.height * 0.48, 0]} castShadow><boxGeometry args={[item.width * 0.96, item.height * 0.72, item.depth * 0.88]} />{material}</mesh>
      <mesh position={[0, item.height - 0.04, 0]} castShadow><boxGeometry args={[item.width, 0.08, item.depth]} /><meshStandardMaterial color={darkColor} /></mesh>
      <mesh position={[0, item.height * 0.43, item.depth * 0.45]}><boxGeometry args={[item.width * 0.035, item.height * 0.55, 0.025]} /><meshStandardMaterial color={darkColor} /></mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * item.width * 0.34, item.height * 0.48, item.depth * 0.46]}><boxGeometry args={[item.width * 0.24, item.height * 0.38, 0.025]} /><meshStandardMaterial color={lightColor} /></mesh>)}
      {[-1, 1].map((side) => <mesh key={`leg-${side}`} position={[side * item.width * 0.4, 0.055, 0]}><boxGeometry args={[0.08, 0.11, item.depth * 0.75]} /><meshStandardMaterial color={deeperColor} /></mesh>)}
    </group>
  )
}

function renderTelevision({ item, texture, darkColor, deeperColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, item.height * 0.58, 0]} castShadow><boxGeometry args={[item.width, item.height * 0.78, 0.07]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={item.material?.color ?? deeperColor} map={texture} roughness={0.48} /></mesh>
      <mesh position={[0, item.height * 0.58, 0.041]}><boxGeometry args={[item.width * 0.91, item.height * 0.68, 0.012]} /><meshStandardMaterial color={darkColor} roughness={0.32} metalness={0.12} /></mesh>
      <mesh position={[0, item.height * 0.12, 0]}><boxGeometry args={[0.07, item.height * 0.24, 0.07]} /><meshStandardMaterial color={deeperColor} /></mesh>
      <mesh position={[0, item.height * 0.025, 0.015]}><boxGeometry args={[item.width * 0.34, 0.035, item.depth * 0.68]} /><meshStandardMaterial color={darkColor} /></mesh>
    </group>
  )
}

function renderRug({ item, material, darkColor, paleColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, 0.012, 0]} receiveShadow><boxGeometry args={[item.width, 0.02, item.depth]} /><meshStandardMaterial color={darkColor} roughness={0.96} /></mesh>
      <mesh position={[0, 0.024, 0]} receiveShadow><boxGeometry args={[item.width * 0.96, 0.004, item.depth * 0.96]} />{material}</mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * item.width * 0.28, 0.027, 0]}><boxGeometry args={[0.035, 0.002, item.depth * 0.72]} /><meshStandardMaterial color={paleColor} roughness={0.95} /></mesh>)}
      <mesh position={[0, 0.027, 0]}><boxGeometry args={[item.width * 0.62, 0.002, 0.035]} /><meshStandardMaterial color={paleColor} roughness={0.95} /></mesh>
    </group>
  )
}

function renderCircularRug({ item, material, paleColor }: ModelContext) {
  const radius = Math.min(item.width, item.depth) / 2
  return (
    <group>
      {item.attachmentPolicy === 'by-type' ? (
        <mesh position={[0, 0.0155, 0]} receiveShadow><cylinderGeometry args={[radius, radius, 0.031, 64]} />{material}</mesh>
      ) : (
        <mesh position={[0, 0.031, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[radius, 64]} />{material}</mesh>
      )}
      <mesh position={[0, 0.033, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.68, radius * 0.72, 64]} />
        <meshStandardMaterial color={paleColor} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.033, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.28, radius * 0.32, 48]} />
        <meshStandardMaterial color={paleColor} roughness={0.95} />
      </mesh>
    </group>
  )
}

function renderPlant({ item, texture, darkColor, deeperColor, lightColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} castShadow><cylinderGeometry args={[item.width * 0.36, item.width * 0.28, 0.32, 24]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={item.material?.color ?? darkColor} map={texture} roughness={0.82} /></mesh>
      <mesh position={[0, 0.325, 0]}><cylinderGeometry args={[item.width * 0.36, item.width * 0.36, 0.035, 24]} /><meshStandardMaterial color={deeperColor} /></mesh>
      <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[item.width * 0.3, item.width * 0.3, 0.02, 24]} /><meshStandardMaterial color="#59493c" roughness={1} /></mesh>
      <mesh position={[0, 0.71, 0]} castShadow><cylinderGeometry args={[0.018, 0.025, 0.72, 10]} /><meshStandardMaterial color={deeperColor} /></mesh>
      {[[-0.1, 0.68, 0], [0.1, 0.76, 0.02], [0, 0.88, 0.02], [-0.08, 0.91, 0.01], [0.09, 0.59, 0.02]].map(([x, y, z], index) => (
        <mesh key={index} position={[x, y, z]} rotation={[0.2, index * 0.7, (index % 2 ? 1 : -1) * 0.3]} castShadow>
          <sphereGeometry args={[0.15, 16, 12]} /><meshStandardMaterial color={index % 2 ? lightColor : item.color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function renderBedsideTable({ item, material, darkColor, deeperColor, paleColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, 0.325, 0]} castShadow><boxGeometry args={[item.width * 0.9, 0.38, item.depth * 0.9]} />{material}</mesh>
      {[0.41, 0.25].map((drawerY) => (
        <group key={drawerY}>
          <mesh position={[0, drawerY, item.depth * 0.46]} castShadow><boxGeometry args={[item.width * 0.78, 0.13, 0.035]} /><meshStandardMaterial color={darkColor} /></mesh>
          <mesh position={[0, drawerY, item.depth * 0.5 + 0.02]}><sphereGeometry args={[0.025, 12, 12]} /><meshStandardMaterial color={paleColor} metalness={0.35} /></mesh>
        </group>
      ))}
      <mesh position={[0, item.height - 0.035, 0]} castShadow><boxGeometry args={[item.width, 0.07, item.depth]} /><meshStandardMaterial color={darkColor} /></mesh>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * item.width * 0.4, 0.06, z * item.depth * 0.4]}><boxGeometry args={[0.055, 0.12, 0.055]} /><meshStandardMaterial color={deeperColor} /></mesh>))}
    </group>
  )
}

function renderChair({ item, material, darkColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, 0.46, 0]} castShadow><boxGeometry args={[item.width, 0.1, item.depth]} />{material}</mesh>
      <mesh position={[0, 0.64, -item.depth / 2 + 0.045]} castShadow><boxGeometry args={[item.width, 0.42, 0.09]} />{material}</mesh>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
        <mesh key={`${x}-${z}`} position={[x * item.width * 0.38, 0.22, z * item.depth * 0.36]} castShadow>
          <boxGeometry args={[0.055, 0.44, 0.055]} /><meshStandardMaterial color={darkColor} />
        </mesh>
      )))}
    </group>
  )
}

function renderBed({ item, material, darkColor, deeperColor, paleColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, 0.13, 0]} castShadow><boxGeometry args={[item.width, 0.26, item.depth]} /><meshStandardMaterial color={deeperColor} roughness={0.86} /></mesh>
      <mesh position={[0, 0.34, -item.depth * 0.03]} castShadow><boxGeometry args={[item.width * 0.94, 0.22, item.depth * 0.88]} />{material}</mesh>
      <mesh position={[0, 0.46, -item.depth * 0.28]} castShadow><boxGeometry args={[item.width * 0.72, 0.14, item.depth * 0.22]} /><meshStandardMaterial color={paleColor} roughness={0.95} /></mesh>
      <mesh position={[0, item.height * 0.62, -item.depth / 2 + 0.055]} castShadow><boxGeometry args={[item.width, item.height * 1.05, 0.11]} /><meshStandardMaterial color={darkColor} roughness={0.82} /></mesh>
    </group>
  )
}

function renderWardrobe({ item, material, darkColor, deeperColor, lightColor, paleColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, item.height / 2, 0]} castShadow><boxGeometry args={[item.width, item.height, item.depth]} />{material}</mesh>
      <mesh position={[0, item.height / 2, item.depth / 2 + 0.012]}><boxGeometry args={[0.045, item.height * 0.91, 0.025]} /><meshStandardMaterial color={darkColor} /></mesh>
      <mesh position={[0, item.height - 0.09, item.depth / 2 + 0.014]}><boxGeometry args={[item.width * 0.9, 0.06, 0.03]} /><meshStandardMaterial color={lightColor} /></mesh>
      {[-0.12, 0.12].map((x) => <mesh key={x} position={[x, item.height * 0.52, item.depth / 2 + 0.04]}><capsuleGeometry args={[0.018, 0.11, 6, 10]} /><meshStandardMaterial color={paleColor} metalness={0.4} roughness={0.4} /></mesh>)}
      <mesh position={[0, 0.055, 0]}><boxGeometry args={[item.width * 0.94, 0.11, item.depth * 0.9]} /><meshStandardMaterial color={deeperColor} /></mesh>
    </group>
  )
}

// Libros por balda: [inicio como fracción del ancho interior, ancho m, alto m, tono].
// Alturas por debajo del hueco libre entre baldas (0,35 m) para no atravesarlas.
const BOOKSHELF_BOOKS: readonly (readonly [number, number, number, number])[][] = [
  [[0.04, 0.06, 0.27, 0], [0.11, 0.05, 0.24, 1], [0.17, 0.07, 0.29, 2], [0.26, 0.05, 0.25, 0], [0.62, 0.06, 0.28, 1], [0.7, 0.07, 0.25, 2]],
  [[0.06, 0.07, 0.26, 2], [0.15, 0.05, 0.29, 0], [0.22, 0.06, 0.23, 1], [0.55, 0.05, 0.27, 0], [0.62, 0.06, 0.24, 2], [0.7, 0.05, 0.28, 1], [0.77, 0.06, 0.26, 0]],
  [[0.08, 0.06, 0.28, 1], [0.16, 0.06, 0.25, 0], [0.24, 0.05, 0.27, 2], [0.31, 0.07, 0.24, 1]],
  [[0.45, 0.06, 0.26, 0], [0.53, 0.05, 0.29, 2], [0.6, 0.07, 0.25, 1], [0.69, 0.05, 0.27, 0], [0.76, 0.06, 0.24, 2]],
]

function renderBookshelf({ item, material, deeperColor, lightColor, paleColor }: ModelContext) {
  const board = 0.07
  const back = 0.035
  const innerWidth = item.width - board * 2
  const shelfHeights = [0.05, 0.47, 0.89, 1.31, 1.73].map((height) => Math.min(height, item.height - board / 2))
  const bookTones = [lightColor, paleColor, colorTone(item.color, -0.12)]
  // Las piezas se encajan sin solaparse (fondo y baldas entre los laterales, baldas
  // delante del fondo) para evitar caras coplanares que parpadean al mover la cámara.
  return (
    <group>
      <mesh position={[0, item.height / 2, -item.depth / 2 + back / 2]} castShadow><boxGeometry args={[innerWidth, item.height, back]} /><meshStandardMaterial color={deeperColor} roughness={0.88} /></mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * (item.width - board) / 2, item.height / 2, 0]} castShadow><boxGeometry args={[board, item.height, item.depth]} />{material}</mesh>)}
      {shelfHeights.map((height) => <mesh key={height} position={[0, height, back / 2]} castShadow><boxGeometry args={[innerWidth, board, item.depth - back]} />{material}</mesh>)}
      {BOOKSHELF_BOOKS.map((row, level) => row.map(([start, width, height, tone]) => (
        <mesh key={`${level}-${start}`} position={[-innerWidth / 2 + start * innerWidth + width / 2, shelfHeights[level] + board / 2 + height / 2, back / 2]} castShadow>
          <boxGeometry args={[width, height, (item.depth - back) * 0.72]} /><meshStandardMaterial color={bookTones[tone]} roughness={0.85} />
        </mesh>
      )))}
    </group>
  )
}

function renderWastebasket({ item, texture, darkColor, deeperColor }: ModelContext) {
  const topRadius = item.width * 0.43
  return (
    <group>
      <mesh position={[0, item.height / 2, 0]} castShadow><cylinderGeometry args={[topRadius, item.width * 0.35, item.height, 28, 1, true]} /><meshStandardMaterial key={texture ? 'textured' : undefined} color={item.material?.color ?? item.color} map={texture} roughness={0.78} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.025, 0]}><cylinderGeometry args={[item.width * 0.35, item.width * 0.35, 0.05, 28]} /><meshStandardMaterial color={darkColor} /></mesh>
      <mesh position={[0, item.height - 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[topRadius - 0.025, 32]} /><meshStandardMaterial color={deeperColor} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, item.height + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[topRadius - 0.028, topRadius, 32]} /><meshStandardMaterial color={darkColor} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

// Los cuadros se dibujan en la escena como objetos de pared (Openings.tsx). Si alguno llega
// como mueble (diseños antiguos antes de migrar), se usa el mismo modelo: una sola fuente.
function renderPicture({ item, texture }: ModelContext) {
  return <group position={[0, 1.4, 0]}>{pictureModel({ width: item.width, height: item.height, color: item.color, finishColor: item.material?.color, texture })}</group>
}

function renderLamp({ item, texture, darkColor, deeperColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, 0.055, 0]} castShadow><cylinderGeometry args={[0.22, 0.25, 0.11, 28]} /><meshStandardMaterial color={darkColor} metalness={0.25} roughness={0.55} /></mesh>
      <mesh position={[0, item.height * 0.48, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, item.height * 0.88, 16]} /><meshStandardMaterial color={deeperColor} metalness={0.35} roughness={0.45} /></mesh>
      <mesh position={[0, item.height * 0.88, 0]} castShadow><coneGeometry args={[0.28, 0.42, 28, 1, true]} />{shadeMaterial(item, texture)}</mesh>
    </group>
  )
}

function renderCabinet({ item, material, darkColor, deeperColor, paleColor }: ModelContext) {
  return (
    <group>
      <mesh position={[0, item.height / 2, 0]} castShadow>{material}<boxGeometry args={[item.width, item.height, item.depth]} /></mesh>
      <mesh position={[0, item.height / 2, item.depth / 2 + 0.012]}><boxGeometry args={[0.035, item.height * 0.86, 0.02]} /><meshStandardMaterial color={darkColor} /></mesh>
      {[-0.15, 0.15].map((x) => <mesh key={x} position={[x, item.height / 2, item.depth / 2 + 0.028]}><sphereGeometry args={[0.027, 12, 12]} /><meshStandardMaterial color={paleColor} metalness={0.25} /></mesh>)}
      {[-1, 1].map((x) => <mesh key={x} position={[x * item.width * 0.38, 0.06, 0]}><boxGeometry args={[0.09, 0.12, item.depth * 0.72]} /><meshStandardMaterial color={deeperColor} /></mesh>)}
    </group>
  )
}

export const FURNITURE_MODELS: Record<FurnitureKind, ModelRenderer> = {
  armchair: renderArmchair,
  sofa: renderSofa,
  table: renderTable,
  chair: renderChair,
  bed: renderBed,
  singleBed: renderBed,
  bedsideTable: renderBedsideTable,
  cabinet: renderCabinet,
  bookshelf: renderBookshelf,
  wardrobe: renderWardrobe,
  wastebasket: renderWastebasket,
  pictureSmall: renderPicture,
  pictureMedium: renderPicture,
  pictureLarge: renderPicture,
  lamp: renderLamp,
  coffeeTable: renderCoffeeTable,
  desk: renderDesk,
  deskChair: renderDeskChair,
  tvStand: renderTvStand,
  television: renderTelevision,
  rug: renderRug,
  circularRug: renderCircularRug,
  plant: renderPlant,
  vase: renderVase,
  tableLamp: renderTableLamp,
  ceilingLamp: renderCeilingLamp,
}

export function FurnitureModel({ item, texture }: { item: FurnitureItem; texture?: THREE.Texture | null }) {
  const color = item.material?.color ?? item.color
  const material = <meshStandardMaterial key={texture ? 'textured' : undefined} color={color} map={texture ?? undefined} roughness={0.78} />
  const darkColor = colorTone(color, -0.2)
  const deeperColor = colorTone(color, -0.34)
  const lightColor = colorTone(color, 0.28)
  const paleColor = colorTone(color, 0.42)
  const renderModel = typeof item.kind === 'string' && Object.prototype.hasOwnProperty.call(FURNITURE_MODELS, item.kind)
    ? FURNITURE_MODELS[item.kind]
    : renderCabinet
  const preset = Object.hasOwn(FURNITURE_PRESETS, item.kind) ? FURNITURE_PRESETS[item.kind] : undefined
  if (!preset) return renderModel({ item, material, texture, darkColor, deeperColor, lightColor, paleColor })
  const base = { ...item, width: preset.width, height: preset.height, depth: preset.depth }
  const model = renderModel({ item: base, material, texture, darkColor, deeperColor, lightColor, paleColor })
  if (item.width === preset.width && item.height === preset.height && item.depth === preset.depth) return model
  return <group scale={[item.width / preset.width, item.height / preset.height, item.depth / preset.depth]}>{model}</group>
}
