import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { materialDefinition, type MaterialFinish, type MaterialId } from '../domain/materials'

const SIZE = 128

function drawHerringbone(context: CanvasRenderingContext2D) {
  const unit = 8
  const length = 4
  const period = length * 2
  const planks = ['#fafafa', '#ededed', '#e2e2e2', '#f4f4f4']
  const drawPlank = (x: number, y: number, vertical: boolean) => {
    const width = (vertical ? 1 : length) * unit
    const height = (vertical ? length : 1) * unit
    context.fillStyle = '#c9c9c9'
    context.fillRect(x * unit, y * unit, width, height)
    const tone = x * 3 + y * 7 + (vertical ? 2 : 0)
    context.fillStyle = planks[(tone % planks.length + planks.length) % planks.length]
    context.fillRect(x * unit + 1, y * unit + 1, width - 1, height - 1)
  }
  // Los dos conjuntos de tablones se intercalan y repiten cada ocho celdas.
  for (let stripe = 0; stripe < SIZE / unit; stripe++) {
    for (let step = -period; step < SIZE / unit + period; step += period) {
      drawPlank(step + (period - stripe % period) % period, stripe, false)
      drawPlank(stripe, step + (length - stripe % period + period) % period, true)
    }
  }
}

function drawHydraulicTile(context: CanvasRenderingContext2D) {
  const step = SIZE / 2
  for (let y = 0; y < SIZE; y += step) for (let x = 0; x < SIZE; x += step) {
    context.save()
    context.translate(x + step / 2, y + step / 2)
    context.fillStyle = '#cdcdcd'
    context.fillRect(-32, -32, 64, 64)
    context.fillStyle = '#f8f8f8'
    context.fillRect(-31, -31, 62, 62)
    context.strokeStyle = '#aaaaaa'
    context.strokeRect(-27, -27, 54, 54)
    for (let petal = 0; petal < 4; petal++) {
      context.rotate(Math.PI / 2)
      context.fillStyle = '#9a9a9a'
      context.beginPath()
      context.moveTo(0, -5)
      context.quadraticCurveTo(-14, -16, 0, -24)
      context.quadraticCurveTo(14, -16, 0, -5)
      context.fill()
    }
    context.fillStyle = '#777777'
    context.fillRect(-3, -3, 6, 6)
    context.restore()
  }
}

/** Semilla fija y dibujos gemelos al cruzar el borde para que el patrón encaje al repetir. */
function scatter(context: CanvasRenderingContext2D, seed: number, count: number, draw: (radius: number, random: () => number) => void) {
  let state = seed
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
  for (let index = 0; index < count; index++) {
    const x = random() * SIZE
    const y = random() * SIZE
    const radius = random()
    const drawSeed = state
    for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) {
      if (x + dx < -20 || x + dx > SIZE + 20 || y + dy < -20 || y + dy > SIZE + 20) continue
      state = drawSeed
      context.save()
      context.translate(x + dx, y + dy)
      draw(radius, random)
      context.restore()
    }
  }
}

function drawTerrazzo(context: CanvasRenderingContext2D) {
  const tones = ['#a5a5a5', '#bababa', '#d3d3d3', '#e6e6e6']
  scatter(context, 39, 62, (size, random) => {
    const radius = 1.5 + size * 5
    context.rotate(random() * Math.PI)
    context.fillStyle = tones[Math.floor(random() * tones.length)]
    context.beginPath()
    context.moveTo(-radius, -radius * 0.35)
    context.lineTo(-radius * 0.15, -radius * 0.8)
    context.lineTo(radius, -radius * 0.2)
    context.lineTo(radius * 0.4, radius * 0.8)
    context.lineTo(-radius * 0.55, radius * 0.55)
    context.fill()
  })
}

function drawStucco(context: CanvasRenderingContext2D) {
  scatter(context, 154, 125, (size, random) => {
    const radius = 2 + size * 14
    context.scale(1, 0.65)
    context.rotate(random() * Math.PI)
    const wash = context.createRadialGradient(0, 0, 0, 0, 0, radius)
    wash.addColorStop(0, 'rgba(120, 120, 120, 0.18)')
    wash.addColorStop(1, 'rgba(120, 120, 120, 0)')
    context.fillStyle = wash
    context.fillRect(-radius, -radius, radius * 2, radius * 2)
  })
}

function drawBotanical(context: CanvasRenderingContext2D) {
  for (const [x, y, angle] of [[32, 32, -0.45], [96, 32, 0.35], [32, 96, 0.35], [96, 96, -0.45]]) {
    context.save()
    context.translate(x, y)
    context.rotate(angle)
    context.strokeStyle = '#9b9b9b'
    context.beginPath()
    context.moveTo(-5, 22)
    context.quadraticCurveTo(4, 3, 0, -22)
    context.stroke()
    for (const [yLeaf, side] of [[10, -1], [4, 1], [-3, -1], [-10, 1], [-16, -1]]) {
      context.fillStyle = side < 0 ? '#a3a3a3' : '#c1c1c1'
      context.beginPath()
      context.moveTo(0, yLeaf)
      context.quadraticCurveTo(side * 2, yLeaf - 11, side * 14, yLeaf - 10)
      context.quadraticCurveTo(side * 15, yLeaf, 0, yLeaf)
      context.fill()
    }
    context.restore()
  }
}

function drawCorduroy(context: CanvasRenderingContext2D) {
  const step = 8
  for (let x = 0; x < SIZE; x += step) {
    const rib = context.createLinearGradient(x, 0, x + step, 0)
    rib.addColorStop(0, '#b3b3b3')
    rib.addColorStop(0.28, '#e8e8e8')
    rib.addColorStop(0.55, '#fafafa')
    rib.addColorStop(1, '#b3b3b3')
    context.fillStyle = rib
    context.fillRect(x, 0, step, SIZE)
  }
}

function drawWoodGrain(context: CanvasRenderingContext2D, oak: boolean) {
  for (let y = 0; y < SIZE; y += 32) {
    context.fillStyle = y % 64 ? '#f4f4f4' : '#fafafa'
    context.fillRect(0, y, SIZE, 32)
    context.fillStyle = '#c8c8c8'
    context.fillRect(0, y, SIZE, 1)
    const center = y % 64 ? 80 : 38
    for (let index = 0; index < 5; index++) {
      const line = y + 5 + index * 5
      const bend = oak ? 13 - index * 1.5 : (index % 2 ? 4 : -4)
      context.strokeStyle = oak ? '#d2d2d2' : '#e0e0e0'
      context.lineWidth = 0.8
      context.beginPath()
      context.moveTo(0, line)
      context.bezierCurveTo(center * 0.55, line, center - 12, line + bend, center, line + bend)
      context.bezierCurveTo(center + 15, line + bend, SIZE - 15, line, SIZE, line)
      context.stroke()
    }
    if (!oak) {
      for (const radius of [3, 6, 10]) {
        context.strokeStyle = radius === 3 ? '#aaaaaa' : '#c9c9c9'
        context.beginPath()
        context.ellipse(center, y + 16, radius, radius * 0.38, -0.15, 0, Math.PI * 2)
        context.stroke()
      }
    }
  }
}

function drawPopcorn(context: CanvasRenderingContext2D) {
  context.fillStyle = '#f4f4f4'
  context.fillRect(0, 0, SIZE, SIZE)
  scatter(context, 68, 230, (size, random) => {
    const radius = 0.6 + size * 2.1
    const angle = random() * Math.PI
    for (const [dy, shade] of [[0.7, '#c6c6c6'], [-0.35, '#fdfdfd']] as const) {
      context.fillStyle = shade
      context.beginPath()
      context.ellipse(0, dy, radius, radius * 0.73, angle, 0, Math.PI * 2)
      context.fill()
    }
  })
}

function drawBrick(context: CanvasRenderingContext2D) {
  context.fillStyle = '#cecece'
  context.fillRect(0, 0, SIZE, SIZE)
  for (let row = 0; row < 4; row++) {
    const y = row * 32
    const offset = row % 2 ? -32 : 0
    for (let x = offset; x < SIZE; x += 64) {
      context.fillStyle = row % 2 ? '#eeeeee' : '#fafafa'
      context.fillRect(x + 2, y + 2, 61, 29)
      context.fillStyle = '#dedede'
      context.fillRect(x + 5, y + 25, 55, 2)
    }
  }
}

function drawGlazedCeramic(context: CanvasRenderingContext2D) {
  context.fillStyle = '#c5c5c5'
  context.fillRect(0, 0, SIZE, SIZE)
  for (let y = 0; y < SIZE; y += 32) {
    for (let x = 0; x < SIZE; x += 64) {
      const glaze = context.createLinearGradient(x, y, x, y + 32)
      glaze.addColorStop(0, '#ffffff')
      glaze.addColorStop(0.16, '#f1f1f1')
      glaze.addColorStop(0.88, '#e8e8e8')
      glaze.addColorStop(1, '#cccccc')
      context.fillStyle = glaze
      context.fillRect(x + 1, y + 1, 62, 30)
    }
  }
}

const newPatterns = {
  stucco: drawStucco,
  herringbone: drawHerringbone,
  'hydraulic-tile': drawHydraulicTile,
  terrazzo: drawTerrazzo,
  botanical: drawBotanical,
  corduroy: drawCorduroy,
  pine: (context: CanvasRenderingContext2D) => drawWoodGrain(context, false),
  oak: (context: CanvasRenderingContext2D) => drawWoodGrain(context, true),
  popcorn: drawPopcorn,
  brick: drawBrick,
  'glazed-ceramic': drawGlazedCeramic,
}

/** Patrón local y repetible, sin recursos de terceros. El color se aplica en el material. */
export function drawMaterialPattern(context: CanvasRenderingContext2D, id: MaterialId): void {
  const size = SIZE
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size, size)
  context.strokeStyle = '#d8d8d8'
  context.lineWidth = 2
  if (id in newPatterns) {
    newPatterns[id as keyof typeof newPatterns](context)
  } else if (id === 'wood') {
    for (let y = 0; y <= size; y += 32) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(size, y); context.stroke()
      context.beginPath(); context.moveTo(y % 64 === 0 ? 40 : 96, y); context.lineTo(y % 64 === 0 ? 40 : 96, y + 32); context.stroke()
      context.strokeStyle = '#ededed'
      context.beginPath(); context.moveTo(0, y + 10); context.bezierCurveTo(40, y + 4, 85, y + 16, size, y + 10); context.stroke()
      context.strokeStyle = '#d8d8d8'
    }
  } else if (id === 'tile') {
    for (let p = 0; p <= size; p += 32) {
      context.beginPath(); context.moveTo(p, 0); context.lineTo(p, size); context.moveTo(0, p); context.lineTo(size, p); context.stroke()
    }
  } else if (id === 'stone') {
    for (let y = 0; y <= size; y += 32) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(size, y); context.stroke()
      for (let x = y % 64 === 0 ? 0 : -32; x < size; x += 64) {
        context.beginPath(); context.moveTo(x, y); context.lineTo(x, y + 32); context.stroke()
      }
    }
  } else if (id === 'wallpaper') {
    context.fillStyle = '#e7e7e7'
    for (let y = 16; y < size; y += 32) for (let x = 16; x < size; x += 32) {
      context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.fill()
    }
  } else if (id === 'fabric') {
    context.strokeStyle = '#eeeeee'
    for (let p = 0; p < size; p += 8) {
      context.beginPath(); context.moveTo(p, 0); context.lineTo(p, size); context.moveTo(0, p); context.lineTo(size, p); context.stroke()
    }
  }
}

/** Textura por acabado, liberada al dejar de usarla. Pintura y colores legacy no necesitan mapa. */
export function useMaterialTexture(finish?: MaterialFinish): THREE.CanvasTexture | null {
  const id = finish?.id
  const scale = finish?.scale ?? 1
  const rotation = finish?.rotation ?? 0
  const texture = useMemo(() => {
    if (!id || !materialDefinition(id)?.textured) return null
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    const context = canvas.getContext('2d')
    if (!context) return null
    drawMaterialPattern(context, id)
    const result = new THREE.CanvasTexture(canvas)
    result.userData.roomFinish = true
    result.colorSpace = THREE.SRGBColorSpace
    result.wrapS = result.wrapT = THREE.RepeatWrapping
    result.repeat.set(1 / scale, 1 / scale)
    result.center.set(0.5, 0.5)
    result.rotation = rotation * Math.PI / 180
    return result
  }, [id, scale, rotation])
  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}
