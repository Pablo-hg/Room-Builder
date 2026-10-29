import type { FurnitureItem, RoomConfig, StructurePack, StructureSurface } from './types'
import { structureSurfaceElementId } from './elementIds'

type Box = { id: string; x: number; y: number; z: number; width: number; height: number; depth: number; rotation: number }
type World = { room: RoomConfig; furniture: FurnitureItem[]; structurePacks: StructurePack[] }
const epsilon = 1e-7

function furnitureBox(item: FurnitureItem): Box {
  return { id: item.id, x: item.x, y: item.y + 0.02 + item.height / 2, z: item.z, width: item.width, height: item.height, depth: item.depth, rotation: item.rotation }
}

function surfaceBox(room: RoomConfig, pack: StructurePack, surface: StructureSurface): Box {
  const wall = surface.wall ?? 'north'
  return {
    id: structureSurfaceElementId(pack.id, surface.id),
    x: pack.x + surface.x + (surface.kind === 'wall' ? wall === 'east' ? room.width / 2 : wall === 'west' ? -room.width / 2 : 0 : 0),
    y: pack.y + surface.y + (surface.kind === 'wall' ? room.height / 2 : surface.kind === 'ceiling' ? room.height : 0),
    z: pack.z + surface.z + (surface.kind === 'wall' ? wall === 'north' ? -room.depth / 2 : wall === 'south' ? room.depth / 2 : 0 : 0),
    width: surface.width, height: surface.height, depth: surface.depth,
    rotation: surface.kind === 'wall' ? ({ north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 }[wall] + surface.rotation) : 0,
  }
}

function independentSurfaces(world: World) {
  return world.structurePacks.filter((pack) => pack.id.startsWith('floor-object-') || pack.id.startsWith('wall-object-'))
    .flatMap((pack) => pack.surfaces.map((surface) => surfaceBox(world.room, pack, surface)))
}

function allSurfaces(world: World) {
  return world.structurePacks.flatMap((pack) => pack.surfaces.map((surface) => ({ surface, box: surfaceBox(world.room, pack, surface) })))
}

function axes(box: Box) {
  return [{ x: Math.cos(box.rotation), z: -Math.sin(box.rotation) }, { x: Math.sin(box.rotation), z: Math.cos(box.rotation) }]
}

function radius(box: Box, axis: { x: number; z: number }) {
  const basis = axes(box)
  return box.width / 2 * Math.abs(basis[0].x * axis.x + basis[0].z * axis.z) + box.depth / 2 * Math.abs(basis[1].x * axis.x + basis[1].z * axis.z)
}

function overlaps(a: Box, b: Box) {
  if (Math.abs(a.y - b.y) >= (a.height + b.height) / 2 - epsilon) return false
  return [...axes(a), ...axes(b)].every((axis) => Math.abs((b.x - a.x) * axis.x + (b.z - a.z) * axis.z) < radius(a, axis) + radius(b, axis) - epsilon)
}

function sameShape(a: Box, b: Box) {
  return a.width === b.width && a.height === b.height && a.depth === b.depth && a.rotation === b.rotation
}

/** Continuous collision for translations, so even a large gesture cannot jump through a thin wall. */
function crossed(a0: Box, a1: Box, b0: Box, b1: Box) {
  if (!sameShape(a0, a1) || !sameShape(b0, b1)) return false
  const dx = b0.x - a0.x, dy = b0.y - a0.y, dz = b0.z - a0.z
  const vx = (b1.x - b0.x) - (a1.x - a0.x), vy = (b1.y - b0.y) - (a1.y - a0.y), vz = (b1.z - b0.z) - (a1.z - a0.z)
  let start = 0, end = 1
  const interval = (distance: number, velocity: number, limit: number) => {
    limit -= epsilon
    if (Math.abs(velocity) < epsilon) return Math.abs(distance) < limit
    const t0 = (-limit - distance) / velocity, t1 = (limit - distance) / velocity
    start = Math.max(start, Math.min(t0, t1))
    end = Math.min(end, Math.max(t0, t1))
    return start < end
  }
  if (!interval(dy, vy, (a0.height + b0.height) / 2)) return false
  return [...axes(a0), ...axes(b0)].every((axis) => interval(dx * axis.x + dz * axis.z, vx * axis.x + vz * axis.z, radius(a0, axis) + radius(b0, axis)))
}

const sweepAngleStep = Math.PI / 90
const sweepSizeStep = 0.05

function interpolateBox(from: Box, to: Box, amount: number): Box {
  const rotation = Math.atan2(Math.sin(to.rotation - from.rotation), Math.cos(to.rotation - from.rotation))
  const value = (start: number, end: number) => start + (end - start) * amount
  return {
    id: from.id,
    x: value(from.x, to.x),
    y: value(from.y, to.y),
    z: value(from.z, to.z),
    width: value(from.width, to.width),
    height: value(from.height, to.height),
    depth: value(from.depth, to.depth),
    rotation: from.rotation + rotation * amount,
  }
}

function sweepSteps(from: Box, to: Box) {
  const rotation = Math.abs(Math.atan2(Math.sin(to.rotation - from.rotation), Math.cos(to.rotation - from.rotation)))
  const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z)
  const size = Math.max(Math.abs(to.width - from.width), Math.abs(to.height - from.height), Math.abs(to.depth - from.depth))
  return Math.min(90, Math.max(1, Math.ceil(Math.max(rotation / sweepAngleStep, distance / sweepSizeStep, size / sweepSizeStep))))
}

/** Rotations and resizes keep their centre, so an endpoint test can step over a thin piece of furniture. */
function sweepsOver(a0: Box, a1: Box, b0: Box, b1: Box) {
  const steps = Math.max(sweepSteps(a0, a1), sweepSteps(b0, b1))
  for (let step = 1; step < steps; step += 1) {
    const amount = step / steps
    if (overlaps(interpolateBox(a0, a1, amount), interpolateBox(b0, b1, amount))) return true
  }
  return false
}

/**
 * Existing intersections from saved designs are left intact and can be separated.
 * Surfaces created in this update are exempt too: independent floors and walls are born at the
 * centre of the room, where a piece of furniture may already be placed, and can be moved apart.
 */
function introducesCollision(before: World, after: World, continuous: boolean) {
  const oldFurniture = new Map(before.furniture.map((item) => [item.id, furnitureBox(item)]))
  const oldSurfaces = new Map(independentSurfaces(before).map((surface) => [surface.id, surface]))
  const newSurfaces = independentSurfaces(after)
  for (const item of after.furniture) for (const surface of newSurfaces) {
    const oldItem = oldFurniture.get(item.id), oldSurface = oldSurfaces.get(surface.id)
    if (!oldSurface) continue
    if (oldItem && overlaps(oldItem, oldSurface)) continue
    const furniture = furnitureBox(item)
    if (overlaps(furniture, surface)) return true
    if (continuous && oldItem && (crossed(oldItem, furniture, oldSurface, surface) || (!sameShape(oldSurface, surface) && sweepsOver(oldSurface, surface, oldItem, furniture)))) return true
  }
  return false
}

export function introducesStructureFurnitureCollision(before: World, after: World) {
  return introducesCollision(before, after, true)
}

/**
 * Endpoint-only check used when a surface drag finishes: passing through furniture while
 * dragging is allowed, but the released position cannot be a new intersection.
 */
export function introducesEndpointStructureFurnitureCollision(before: World, after: World) {
  return introducesCollision(before, after, false)
}

export function canPlaceAgainstIndependentSurfaces(world: World, item: FurnitureItem) {
  return !independentSurfaces(world).some((surface) => overlaps(furnitureBox(item), surface))
}

export function surfaceIntersectsFurniture(world: World, surfaceId: string) {
  const entry = allSurfaces(world).find(({ box }) => box.id === surfaceId)
  return !!entry && world.furniture.some((item) => surfaceOverlapsFurniture(entry.surface, entry.box, item))
}

export function independentSurfaceHasSpatialWarning(world: World, surfaceId: string) {
  const entry = allSurfaces(world).find(({ box }) => box.id === surfaceId)
  if (!entry) return false
  const isIndependent = world.structurePacks.some((pack) => (pack.id.startsWith('floor-object-') || pack.id.startsWith('wall-object-')) && pack.surfaces.some((surface) => structureSurfaceElementId(pack.id, surface.id) === surfaceId))
  if (!isIndependent) return world.furniture.some((item) => surfaceOverlapsFurniture(entry.surface, entry.box, item))
  const rooms = [{ x: 0, y: 0, z: 0 }, ...world.structurePacks.filter((pack) => pack.id.startsWith('floor-pack-'))]
  const { box } = entry
  const inside = rooms.some((room) => Math.abs(box.x - room.x) + radius(box, { x: 1, z: 0 }) <= world.room.width / 2 + epsilon
    && Math.abs(box.z - room.z) + radius(box, { x: 0, z: 1 }) <= world.room.depth / 2 + epsilon
    && box.y - box.height / 2 >= room.y - epsilon
    && box.y + box.height / 2 <= room.y + world.room.height + epsilon)
  return !inside || world.furniture.some((item) => surfaceOverlapsFurniture(entry.surface, box, item))
}

function surfaceOverlapsFurniture(surface: StructureSurface, box: Box, item: FurnitureItem) {
  // Furniture rests at floor level; the floor slab is centred on that level and extends slightly above it.
  if (surface.kind === 'floor' && item.y >= box.y - epsilon) return false
  if (surface.kind === 'ceiling' && item.y + item.height <= box.y + epsilon) return false
  return overlaps(furnitureBox(item), box)
}

/** Visual warning only: contacts with floors and walls do not prevent placement. */
export function furnitureHasSpatialWarning(world: World, item: FurnitureItem) {
  const box = furnitureBox(item)
  const rooms = [{ x: 0, y: 0, z: 0 }, ...world.structurePacks.filter((pack) => pack.id.startsWith('floor-pack-'))]
  const halfX = radius(box, { x: 1, z: 0 })
  const halfZ = radius(box, { x: 0, z: 1 })
  const insideRoom = rooms.some((room) =>
    Math.abs(item.x - room.x) + halfX <= world.room.width / 2 + epsilon
    && Math.abs(item.z - room.z) + halfZ <= world.room.depth / 2 + epsilon
    && item.y >= room.y - epsilon
    && item.y + item.height <= room.y + world.room.height + epsilon,
  )
  return !insideRoom
    || allSurfaces(world).some(({ surface, box: surfaceBounds }) => surfaceOverlapsFurniture(surface, surfaceBounds, item))
    || world.furniture.some((other) => other.id !== item.id && overlaps(box, furnitureBox(other)))
}
