import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cloneRoom } from '../state/defaults'
import { createStructureSurface } from './structureRules'
import { physicalWalls } from './wallConnections'
import { constrainFurnitureWalls, furnitureWallContact, validateFurnitureWallAttachments, type FurnitureWallMagnets } from './furnitureWalls'
import { planWallStrips } from '../scene/planWallGeometry'
import type { FurnitureItem, StructurePack } from './types'

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)
const item = (patch: Partial<FurnitureItem> = {}): FurnitureItem => ({
  id: 'chair-test', kind: 'chair', name: 'Silla', color: '#abcdef',
  x: 0, y: 0.04, z: 0, width: 0.4, depth: 0.4, height: 0.8, rotation: 0,
  axisLocks: { x: false, y: false, z: false }, ...patch,
})
const world = (furniture = [item()], structurePacks: StructurePack[] = []) => ({ room: { ...cloneRoom(), windows: [] }, furniture, structurePacks })
const northContact = (source: ReturnType<typeof world>) => -source.room.depth / 2 + 0.06 + source.furniture[0].depth / 2

test('se ajusta cerca de la cara y permite atravesar libremente al continuar', () => {
  const before = world()
  const magnets: FurnitureWallMagnets = new Map()
  const result = constrainFurnitureWalls(before, { ...before, furniture: [item({ z: northContact(before) + 0.03 })] }, magnets)!
  close(result.furniture[0].z, northContact(before))
  assert.equal(furnitureWallContact(before, result.furniture[0])?.wall.id, 'room-wall:north')
  const away = constrainFurnitureWalls({ ...before, furniture: result.furniture }, before, magnets)!
  close(away.furniture[0].z, 0)
  close(constrainFurnitureWalls(before, { ...before, furniture: [item({ z: -20 })] }, magnets)!.furniture[0].z, -20)
})

test('usa el volumen girado y la altura: permite pasar por encima de una pared', () => {
  const rotated = item({ rotation: Math.PI / 4, width: 0.8, depth: 0.2 })
  const before = world([rotated])
  const target = -before.room.depth / 2 + 0.06 + Math.SQRT1_2 * 0.5
  const result = constrainFurnitureWalls(before, { ...before, furniture: [{ ...rotated, z: target + 0.03 }] })!
  close(result.furniture[0].z, -before.room.depth / 2 + 0.06 + Math.SQRT1_2 * 0.5)
  const high = world([item({ y: 5 })])
  close(constrainFurnitureWalls(high, { ...high, furniture: [item({ y: 5, z: -20 })] })!.furniture[0].z, -20)
})

test('los pasos repetidos de 1 cm vencen el imán y no se vuelven a enganchar dentro de la pared', () => {
  const source = world(), magnets: FurnitureWallMagnets = new Map()
  let before = world([item({ z: northContact(source) })])
  const firstRequest = before.furniture[0].z - 0.01
  const first = constrainFurnitureWalls(before, { ...before, furniture: [item({ z: firstRequest })] }, magnets)!
  close(first.furniture[0].z, northContact(source))
  before = { ...before, furniture: first.furniture }
  for (let index = 0; index < 70; index++) {
    const next = { ...before.furniture[0], z: before.furniture[0].z - 0.01 }
    before = { ...before, furniture: constrainFurnitureWalls(before, { ...before, furniture: [next] }, magnets)!.furniture }
  }
  close(before.furniture[0].z, northContact(source) - 0.7)
})

test('arrastrar en paralelo mantiene el contacto; empujar normalmente lo libera', () => {
  const source = world(), magnets: FurnitureWallMagnets = new Map(), target = northContact(source)
  const requested = item({ z: target + 0.03 })
  const snapped = constrainFurnitureWalls(source, { ...source, furniture: [requested] }, magnets)!
  const before = { ...source, furniture: snapped.furniture }
  const slide = constrainFurnitureWalls(before, { ...before, furniture: [{ ...requested, x: 0.2 }] }, magnets)!
  close(slide.furniture[0].z, target)
  const pushed = constrainFurnitureWalls({ ...before, furniture: slide.furniture },
    { ...before, furniture: [{ ...requested, x: 0.2, z: target - 0.04 }] }, magnets)!
  close(pushed.furniture[0].z, target - 0.04)
})

test('esquina A-D: el trazo fino conserva las caras interiores sin huecos visuales', () => {
  const source = world(), targetZ = northContact(source), targetX = -source.room.width / 2 + 0.06 + 0.2
  const result = constrainFurnitureWalls(source, { ...source, furniture: [item({ x: targetX + 0.03, z: targetZ + 0.03 })] })!
  const aligned = result.furniture[0]
  close(aligned.x, targetX)
  close(aligned.z, targetZ)
  const walls = physicalWalls(source)
  const strips = planWallStrips(source, new Set(walls.map((wall) => wall.id)))
  const north = strips.find((strip) => strip.wallId === 'room-wall:north')!
  const west = strips.find((strip) => strip.wallId === 'room-wall:west')!
  const northWall = walls.find((wall) => wall.id === north.wallId)!
  const westWall = walls.find((wall) => wall.id === west.wallId)!
  close(aligned.x - aligned.width / 2, westWall.x + westWall.depth / 2)
  close(aligned.z - aligned.depth / 2, northWall.z + northWall.depth / 2)
  close(aligned.x - aligned.width / 2, west.x + west.thickness / 2)
  close(aligned.z - aligned.depth / 2, north.z + north.thickness / 2)
  close(west.thickness, westWall.depth * 0.5)
  close(north.thickness, northWall.depth * 0.5)
})

test('ratón a pasos de 5 cm: contacto exacto con paredes de 13 cm y sin liberación por eventos repetidos', () => {
  const room = cloneRoom()
  const pack: StructurePack = { id: 'floor-pack-offset', name: 'Planta -1', x: 10, y: -3, z: 10,
    surfaces: ['floor', 'wall-north', 'wall-west'].map((key) => createStructureSurface(room, key as 'floor' | 'wall-north' | 'wall-west')) }
  const source = world([item({ x: 10, y: -2.96, z: 10 })], [pack])
  const walls = physicalWalls(source), north = walls.find((wall) => wall.packId && wall.side === 'north')!
  const west = walls.find((wall) => wall.packId && wall.side === 'west')!
  const targetX = west.x + west.depth / 2 + 0.2, targetZ = north.z + north.depth / 2 + 0.2
  assert.equal(north.depth, 0.13)
  const request = item({ x: Math.round(targetX * 20) / 20, y: -2.96, z: Math.round(targetZ * 20) / 20 })
  const magnets: FurnitureWallMagnets = new Map()
  let current = source
  for (let event = 0; event < 20; event++) {
    current = { ...current, furniture: constrainFurnitureWalls(current, { ...current, furniture: [request] }, magnets, 'pointer')!.furniture }
    close(current.furniture[0].x, targetX)
    close(current.furniture[0].z, targetZ)
  }
  const strips = planWallStrips(current, new Set(walls.map((wall) => wall.id)))
  const northStrip = strips.find((strip) => strip.wallId === north.id)!
  const westStrip = strips.find((strip) => strip.wallId === west.id)!
  close(current.furniture[0].x - 0.2, westStrip.x + westStrip.thickness / 2)
  close(current.furniture[0].z - 0.2, northStrip.z + northStrip.thickness / 2)
  const pushed = { ...request, x: request.x - 0.15, z: request.z - 0.15 }
  const released = constrainFurnitureWalls(current, { ...current, furniture: [pushed] }, magnets, 'pointer')!
  close(released.furniture[0].x, pushed.x)
  close(released.furniture[0].z, pushed.z)
})

test('no convierte puertas ni paredes en barreras al atravesarlas', () => {
  const before = world([item({ width: 0.3, height: 0.5 })])
  const moved = { ...before.furniture[0], z: 10 }
  close(constrainFurnitureWalls(before, { ...before, furniture: [moved] })!.furniture[0].z, 10)
  const wide = world([item({ width: 3 })])
  close(constrainFurnitureWalls(wide, { ...wide, furniture: [{ ...wide.furniture[0], z: 10 }] })!.furniture[0].z, 10)
})

test('pared independiente girada: contacto, deslizamiento tangente y bloqueo lateral', () => {
  const room = cloneRoom()
  const pack: StructurePack = { id: 'wall-object-test', name: 'Pared', x: 0, y: 0, z: 0,
    surfaces: [{ ...createStructureSurface(room, 'wall-north'), z: room.depth / 2, width: 4, rotation: Math.PI / 4 }] }
  const before = world([item({ x: 1, z: 1 })], [pack])
  const result = constrainFurnitureWalls(before, { ...before, furniture: [item({ x: 0.26, z: 0.26 })] })!
  const stopped = result.furniture[0], contact = furnitureWallContact(before, stopped)!
  assert.ok(contact.wall.packId)
  const attached = { ...stopped, wallAttachment: { wallId: contact.wall.id, side: contact.side, lockLateral: false } }
  const anchored = { ...before, furniture: [attached] }
  const slide = constrainFurnitureWalls(anchored, { ...anchored, furniture: [{ ...attached, x: attached.x + 0.4, z: attached.z - 0.4 }] })!
  close(slide.furniture[0].x - attached.x, 0.4)
  close(slide.furniture[0].z - attached.z, -0.4)
  const fixed = { ...attached, wallAttachment: { ...attached.wallAttachment, lockLateral: true } }
  const locked = { ...before, furniture: [fixed] }
  const stayed = constrainFurnitureWalls(locked, { ...locked, furniture: [{ ...fixed, x: fixed.x + 0.4, z: fixed.z - 0.4 }] })!
  close(stayed.furniture[0].x, fixed.x)
  close(stayed.furniture[0].z, fixed.z)
})

test('no bloquea solapes entre muebles y conserva intersecciones antiguas recuperables', () => {
  const before = world([item(), item({ id: 'other', x: 1 })])
  const after = { ...before, furniture: [item({ x: 1 }), before.furniture[1]] }
  close(constrainFurnitureWalls(before, after)!.furniture[0].x, 1)
  const legacy = world([item({ z: -cloneRoom().depth / 2 })])
  close(constrainFurnitureWalls(legacy, world())!.furniture[0].z, 0)
})

test('ajusta un grupo con una corrección común y conserva su separación', () => {
  const before = world([item(), item({ id: 'second', x: 1, z: 0.4 })])
  const delta = northContact(before) + 0.03
  const after = { ...before, furniture: before.furniture.map((item) => ({ ...item, z: item.z + delta })) }
  const result = constrainFurnitureWalls(before, after)!
  close(result.furniture[0].z, northContact(before))
  close(result.furniture[1].z - result.furniture[0].z, 0.4)
})

test('anclaje v11: rechaza referencias ausentes y versiones antiguas, sin mutar la entrada', () => {
  const before = world()
  const attached = item({ z: northContact(before), wallAttachment: { wallId: 'room-wall:north', side: 1, lockLateral: false } })
  const saved = { ...before, furniture: [attached] }, original = structuredClone(saved)
  assert.doesNotThrow(() => validateFurnitureWallAttachments(saved, 11))
  assert.throws(() => validateFurnitureWallAttachments(saved, 10))
  assert.throws(() => validateFurnitureWallAttachments({ ...saved, furniture: [{ ...attached, wallAttachment: { ...attached.wallAttachment!, wallId: 'missing' } }] }, 11))
  assert.deepEqual(saved, original)
})

test('sigue la pared al moverla y se despega al borrarla', () => {
  const room = cloneRoom()
  const pack: StructurePack = { id: 'wall-object-test', name: 'Pared', x: 0, y: 0, z: 0,
    surfaces: [{ ...createStructureSurface(room, 'wall-north'), width: 2 }] }
  const before = world([], [pack]), wall = physicalWalls(before).find((wall) => wall.packId)!
  before.furniture = [item({ z: wall.z + wall.depth / 2 + 0.2, wallAttachment: { wallId: wall.id, side: 1, lockLateral: false } })]
  const shifted = { ...before, structurePacks: [{ ...pack, x: 0.3 }] }
  close(constrainFurnitureWalls(before, shifted)!.furniture[0].x, 0.3)
  const removed = constrainFurnitureWalls(before, { ...before, structurePacks: [] })!
  assert.equal(removed.furniture[0].wallAttachment, undefined)
  close(removed.furniture[0].z, before.furniture[0].z)
})

test('rechaza girar un mueble fijado y respeta el bloqueo de altura', () => {
  const source = world(), attached = item({ z: northContact(source), axisLocks: { x: false, y: true, z: false },
    wallAttachment: { wallId: 'room-wall:north', side: 1, lockLateral: false } })
  const before = world([attached])
  assert.equal(constrainFurnitureWalls(before, { ...before, furniture: [{ ...attached, rotation: 1 }] }), null)
  assert.equal(constrainFurnitureWalls(before, { ...before, furniture: [{ ...attached, y: 1 }] }), null)
})
