import type { FurnitureItem } from './types'
import { furnitureAxisLocks } from './axisLocks'
import { furnitureVisualYOffset } from './objectCatalog'
import { physicalWalls, wallIntersectionIsCut, type ConnectedWall, type WallWorld } from './wallConnections'

export interface FurnitureWallAttachment {
  wallId: string
  side: -1 | 1
  /** Compatibilidad v11: ya no bloquea el desplazamiento sobre la pared. */
  lockLateral: boolean
}
type World = WallWorld & { furniture: FurnitureItem[]; lockedElementIds?: string[] }
const epsilon = 1e-7
const contactTolerance = 0.015
const magnetRange = 0.06
const magnetRearmDistance = 0.12
type MagnetContact = { side: -1 | 1; bypass: boolean; intent: { x: number; y: number; z: number } }
/** Editor-session state only; never persisted or included in undo snapshots. */
export type FurnitureWallMagnets = Map<string, Map<string, MagnetContact>>
const tangent = (wall: ConnectedWall) => ({ x: Math.cos(wall.yaw), z: -Math.sin(wall.yaw) })
const normal = (wall: ConnectedWall) => ({ x: Math.sin(wall.yaw), z: Math.cos(wall.yaw) })
const dot = (a: { x: number; z: number }, b: { x: number; z: number }) => a.x * b.x + a.z * b.z
const local = (item: FurnitureItem, wall: ConnectedWall) => ({
  u: dot({ x: item.x - wall.x, z: item.z - wall.z }, tangent(wall)),
  v: dot({ x: item.x - wall.x, z: item.z - wall.z }, normal(wall)),
})
function radius(item: FurnitureItem, axis: { x: number; z: number }) {
  return item.width / 2 * Math.abs(Math.cos(item.rotation) * axis.x - Math.sin(item.rotation) * axis.z)
    + item.depth / 2 * Math.abs(Math.sin(item.rotation) * axis.x + Math.cos(item.rotation) * axis.z)
}
function box(item: FurnitureItem, world: WallWorld) {
  return { ...item, y: item.y + furnitureVisualYOffset(item, world) + item.height / 2 }
}
const sameShape = (a: FurnitureItem, b: FurnitureItem) =>
  a.rotation === b.rotation && a.width === b.width && a.height === b.height && a.depth === b.depth

export function validateFurnitureWallAttachment(value: unknown): void {
  if (value === undefined) return
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Fijación de mueble inválida.')
  const item = value as Record<string, unknown>
  if (Object.keys(item).length !== 3 || typeof item.wallId !== 'string' || !item.wallId.trim()
    || item.wallId.length > 250 || (item.side !== -1 && item.side !== 1) || typeof item.lockLateral !== 'boolean') {
    throw new Error('Fijación de mueble inválida.')
  }
}

export function furnitureWallAxes(world: WallWorld, item: FurnitureItem) {
  const locks = furnitureAxisLocks(item)
  if (!item.wallAttachment) return { x: !locks.x, y: !locks.y, z: !locks.z }
  const wall = physicalWalls(world).find((wall) => wall.id === item.wallAttachment!.wallId)
  if (!wall) return { x: !locks.x, y: !locks.y, z: !locks.z }
  // Un mueble fijado solo puede desplazarse lateralmente (tangente) y en altura.
  // La coordenada perpendicular no se edita; para despegarlo se desmarca el check.
  const t = tangent(wall)
  return { x: !locks.x && Math.abs(t.x) > epsilon, y: !locks.y,
    z: !locks.z && Math.abs(t.z) > epsilon }
}

/** Only actual wall faces can support furniture; openings and wall ends cannot. */
export function furnitureWallContact(world: WallWorld, item: FurnitureItem) {
  const centre = box(item, world)
  return physicalWalls(world).map((wall) => {
    const { u, v } = local(item, wall)
    const gap = Math.abs(v) - wall.depth / 2 - radius(item, normal(wall))
    const along = radius(item, tangent(wall))
    if (Math.abs(gap) > contactTolerance || Math.abs(u) + along > wall.width / 2 + epsilon
      || centre.y - item.height / 2 < wall.y - epsilon
      || centre.y + item.height / 2 > wall.y + wall.height + epsilon
      || wallIntersectionIsCut(world, wall.id, centre)) return null
    return { wall, side: (v < 0 ? -1 : 1) as -1 | 1, gap: Math.abs(gap) }
  }).filter((contact) => contact !== null).sort((a, b) => a.gap - b.gap)[0] ?? null
}

/** v1-v10 are left untouched; only explicit v11 anchors introduce wall constraints on load. */
export function validateFurnitureWallAttachments(world: World, version: number): void {
  const walls = physicalWalls(world)
  for (const item of world.furniture) {
    validateFurnitureWallAttachment(item.wallAttachment)
    if (!item.wallAttachment) continue
    if (version < 11) throw new Error('La fijación de muebles requiere un diseño v11.')
    const wall = walls.find((wall) => wall.id === item.wallAttachment!.wallId)
    if (!wall) throw new Error('La pared de fijación no existe.')
    const { u, v } = local(item, wall), centre = box(item, world)
    const expected = item.wallAttachment.side * (wall.depth / 2 + radius(item, normal(wall)))
    if (Math.abs(v - expected) > contactTolerance || Math.abs(u) + radius(item, tangent(wall)) > wall.width / 2 + epsilon
      || centre.y - item.height / 2 < wall.y - epsilon || centre.y + item.height / 2 > wall.y + wall.height + epsilon
      || wallIntersectionIsCut(world, wall.id, centre)) throw new Error('El mueble no está apoyado en su pared de fijación.')
  }
}

/** Encuentra una pared real apta y sitúa el mueble apoyado en su cara más cercana.
 * La acción de fijar funciona también aunque el objeto no esté tocando la pared.
 * Las aberturas y los extremos se siguen validando mediante furnitureWallContact.
 */
export function snapFurnitureToWall(world: WallWorld, item: FurnitureItem): { item: FurnitureItem; wallId: string; side: -1 | 1 } | null {
  let best: { item: FurnitureItem; wallId: string; side: -1 | 1; distance: number } | null = null
  for (const wall of physicalWalls(world)) {
    const t = tangent(wall), n = normal(wall)
    const position = local(item, wall)
    const limit = wall.width / 2 - radius(item, t)
    const verticalOffset = furnitureVisualYOffset(item, world)
    const minY = wall.y - verticalOffset
    const maxY = wall.y + wall.height - item.height - verticalOffset
    if (limit < 0 || maxY < minY) continue
    const start = Math.max(-limit, Math.min(limit, position.u))
    const offsets = [start, start - 0.5, start + 0.5, start - 1, start + 1, -limit, limit]
      .map((value) => Math.max(-limit, Math.min(limit, value)))
    const sides: Array<-1 | 1> = position.v < 0 ? [-1, 1] : [1, -1]
    for (const side of sides) {
      const v = side * (wall.depth / 2 + radius(item, n))
      for (const u of offsets) {
        const candidate: FurnitureItem = {
          ...item, x: wall.x + t.x * u + n.x * v,
          y: Math.max(minY, Math.min(maxY, item.y)),
          z: wall.z + t.z * u + n.z * v,
        }
        const contact = furnitureWallContact(world, candidate)
        if (contact?.wall.id !== wall.id || contact.side !== side) continue
        const distance = Math.hypot(candidate.x - item.x, candidate.y - item.y, candidate.z - item.z)
        if (!best || distance < best.distance) best = { item: candidate, wallId: wall.id, side, distance }
      }
    }
  }
  return best ? { item: best.item, wallId: best.wallId, side: best.side } : null
}

/** A soft contact holds one position, then yields to continued normal movement. */
function softWallSnap(world: WallWorld, old: FurnitureItem, item: FurnitureItem, magnets: FurnitureWallMagnets, source?: 'pointer'): FurnitureItem {
  if (old.x === item.x && old.z === item.z) return item
  const contacts = magnets.get(item.id) ?? new Map<string, MagnetContact>()
  magnets.set(item.id, contacts)
  const locks = furnitureAxisLocks(item)
  const candidates: Array<{ wall: ConnectedWall; n: { x: number; z: number }; correction: number; distance: number }> = []
  const centre = box(item, world)
  for (const wall of physicalWalls(world)) {
    if (item.wallAttachment?.wallId === wall.id) {
      // A second corner face may adjust the tangent, never pull an attached item off its support.
      candidates.push({ wall, n: normal(wall), correction: 0, distance: 0 })
      continue
    }
    const n = normal(wall), p = local(item, wall)
    const reach = wall.depth / 2 + radius(item, n)
    const previous = contacts.get(wall.id)
    const side = previous?.side ?? (local(old, wall).v < 0 ? -1 : 1)
    const correction = side * reach - p.v
    if (previous && Math.abs(p.v) > reach + magnetRearmDistance) {
      contacts.delete(wall.id)
      continue
    }
    if (previous?.bypass) continue
    if (previous) {
      const normalIntent = dot({ x: item.x - previous.intent.x, z: item.z - previous.intent.z }, n)
      const repeatedStep = (['x', 'y', 'z'] as const).every((axis) => Math.abs(item[axis] - previous.intent[axis]) < epsilon)
        && Math.abs(dot({ x: item.x - old.x, z: item.z - old.z }, n)) > epsilon
      // Pointer events repeat the same 5 cm target. Hold exact contact until
      // the pointer actually leaves the magnetic band; 1 cm controls yield on the next push.
      const release = source === 'pointer'
        ? Math.abs(correction) > magnetRange
        : Math.abs(normalIntent) > epsilon || repeatedStep
      if (release) {
        contacts.set(wall.id, { ...previous, bypass: true, intent: { x: item.x, y: item.y, z: item.z } })
        continue
      }
    }
    if (Math.abs(correction) > magnetRange || Math.abs(p.u) + radius(item, tangent(wall)) > wall.width / 2 + epsilon
      || centre.y + item.height / 2 <= wall.y || centre.y - item.height / 2 >= wall.y + wall.height
      || wallIntersectionIsCut(world, wall.id, centre)) continue
    const freeNormal = (locks.x ? 0 : n.x * n.x) + (locks.z ? 0 : n.z * n.z)
    if (freeNormal < epsilon) continue
    candidates.push({ wall, n, correction, distance: Math.abs(correction) })
    contacts.set(wall.id, { side, bypass: false, intent: { x: item.x, y: item.y, z: item.z } })
  }
  candidates.sort((a, b) => a.distance - b.distance)
  const first = candidates[0]
  if (!first) return item
  const freeNormal = (locks.x ? 0 : first.n.x ** 2) + (locks.z ? 0 : first.n.z ** 2)
  let dx = locks.x ? 0 : first.n.x * first.correction / freeNormal
  let dz = locks.z ? 0 : first.n.z * first.correction / freeNormal
  const second = candidates.find((candidate) => Math.abs(first.n.x * candidate.n.z - first.n.z * candidate.n.x) > 0.2)
  if (second && !locks.x && !locks.z) {
    // Solve both faces together: a corner must snap on X and Z in the same edit.
    const determinant = first.n.x * second.n.z - first.n.z * second.n.x
    dx = (first.correction * second.n.z - second.correction * first.n.z) / determinant
    dz = (first.n.x * second.correction - second.n.x * first.correction) / determinant
  }
  return { ...item, x: item.x + dx, z: item.z + dz }
}

/** Apply a requested move in wall coordinates, retaining the chosen face. */
function onWall(world: WallWorld, old: FurnitureItem, candidate: FurnitureItem, wall: ConnectedWall): FurnitureItem | null {
  const attachment = candidate.wallAttachment!
  const before = local(old, wall), requested = local(candidate, wall)
  const extent = radius(candidate, tangent(wall))
  const limit = wall.width / 2 - extent
  if (limit < 0) return null
  const locks = furnitureAxisLocks(old)
  const t = tangent(wall), n = normal(wall)
  const dx = candidate.x - old.x, dz = candidate.z - old.z
  // A numeric X/Z edit must reach that coordinate while the other coordinate follows the wall.
  const along = Math.abs(dx) > epsilon && Math.abs(dz) < epsilon
    ? Math.abs(t.x) > epsilon ? before.u + dx / t.x : before.u
    : Math.abs(dz) > epsilon && Math.abs(dx) < epsilon
      ? Math.abs(t.z) > epsilon ? before.u + dz / t.z : before.u
      : requested.u
  let u = Math.max(-limit, Math.min(limit, along))
  if ((locks.x && Math.abs(t.x) > epsilon) || (locks.z && Math.abs(t.z) > epsilon)) u = before.u
  if (Math.abs(u) > limit + epsilon) return null
  const v = attachment.side * (wall.depth / 2 + radius(candidate, normal(wall)))
  const offset = furnitureVisualYOffset(candidate, world)
  const y = Math.max(wall.y, Math.min(wall.y + wall.height - candidate.height, candidate.y + offset)) - offset
  const result = { ...candidate, x: wall.x + t.x * u + n.x * v, y, z: wall.z + t.z * u + n.z * v }
  if (candidate.height > wall.height || (['x', 'y', 'z'] as const).some((axis) => locks[axis] && Math.abs(old[axis] - result[axis]) > epsilon)
    || wallIntersectionIsCut(world, wall.id, box(result, world))) return null
  return result
}

/** Shared guard for inspector, pointer, keyboard, groups, rotation and resize. Loading/undo bypass it. */
export function constrainFurnitureWalls(before: World, after: World, magnets: FurnitureWallMagnets = new Map(), source?: 'pointer'): { furniture: FurnitureItem[]; notice?: string } | null {
  const oldItems = new Map(before.furniture.map((item) => [item.id, item]))
  const oldWalls = new Map(physicalWalls(before).map((wall) => [wall.id, wall]))
  const walls = physicalWalls(after)
  let failed = false
  const explicitlyMoved = after.furniture.filter((item) => {
    const old = oldItems.get(item.id)
    return old && (old.x !== item.x || old.y !== item.y || old.z !== item.z)
  }).length
  let furniture = after.furniture.map<FurnitureItem>((item) => {
    const old = oldItems.get(item.id)
    if (!old) return item
    if (!item.wallAttachment) return item
    const wall = walls.find((wall) => wall.id === item.wallAttachment!.wallId)
    if (!wall) { const { wallAttachment: _attachment, ...detached } = item; return detached }
    if (old.wallAttachment && item.rotation !== old.rotation) { failed = true; return item }
    const previousWall = oldWalls.get(wall.id)
    let candidate = item, origin = old
    if (previousWall && (previousWall.x !== wall.x || previousWall.y !== wall.y || previousWall.z !== wall.z || previousWall.yaw !== wall.yaw)) {
      const p = local(old, previousWall), t = tangent(wall), n = normal(wall)
      origin = { ...old, x: wall.x + t.x * p.u + n.x * p.v, z: wall.z + t.z * p.u + n.z * p.v, y: old.y + wall.y - previousWall.y }
      candidate = { ...item, x: origin.x, y: origin.y, z: origin.z, rotation: item.rotation + wall.yaw - previousWall.yaw }
      if (before.lockedElementIds?.includes(item.id)) failed = true
      if ((['x', 'y', 'z'] as const).some((axis) => furnitureAxisLocks(old)[axis] && Math.abs(candidate[axis] - old[axis]) > epsilon)) failed = true
    }
    const attached = onWall(after, origin, candidate, wall)
    if (!attached) failed = true
    if (attached && before.lockedElementIds?.includes(item.id)
      && (['x', 'y', 'z', 'rotation'] as const).some((axis) => Math.abs(attached[axis] - old[axis]) > epsilon)) failed = true
    // A mixed selection must keep its spacing; do not project only one member onto a wall.
    const stationarySupport = previousWall && (['x', 'y', 'z', 'yaw'] as const).every((key) => previousWall[key] === wall[key])
    if (attached && explicitlyMoved > 1 && stationarySupport
      && (['x', 'y', 'z'] as const).some((axis) => Math.abs(attached[axis] - item[axis]) > epsilon)) failed = true
    return attached ?? item
  })
  if (failed) return null
  const moved = furniture.filter((item) => {
    const old = oldItems.get(item.id)
    return old && sameShape(old, item) && (old.x !== item.x || old.y !== item.y || old.z !== item.z)
  })
  const snapped = moved.map((item) => ({ item, result: softWallSnap(after, oldItems.get(item.id)!, item, magnets, source) }))
  if (moved.length > 1) {
    // A group receives one common correction; its members never drift apart.
    const correction = snapped.find(({ item, result }) => Math.hypot(result.x - item.x, result.z - item.z) > epsilon)
    if (correction) {
      const dx = correction.result.x - correction.item.x, dz = correction.result.z - correction.item.z
      const ids = new Set(moved.map((item) => item.id))
      const allowed = moved.every((item) => {
        const locks = furnitureAxisLocks(item)
        const support = item.wallAttachment && walls.find((wall) => wall.id === item.wallAttachment!.wallId)
        return !(locks.x && Math.abs(dx) > epsilon) && !(locks.z && Math.abs(dz) > epsilon)
          && !(support && Math.abs(dot({ x: dx, z: dz }, normal(support))) > epsilon)
      })
      if (allowed) furniture = furniture.map((item) => ids.has(item.id) ? { ...item, x: item.x + dx, z: item.z + dz } : item)
    }
  } else if (snapped.length) {
    furniture = furniture.map((item) => item.id === snapped[0].item.id ? snapped[0].result : item)
  }
  for (const id of magnets.keys()) if (!after.furniture.some((item) => item.id === id)) magnets.delete(id)
  return { furniture }
}
