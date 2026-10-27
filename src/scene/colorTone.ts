import * as THREE from 'three'

export function colorTone(color: string, lightnessOffset: number) {
  const tone = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  tone.getHSL(hsl)
  tone.setHSL(hsl.h, hsl.s, Math.max(0.08, Math.min(0.94, hsl.l + lightnessOffset)))
  return `#${tone.getHexString()}`
}
