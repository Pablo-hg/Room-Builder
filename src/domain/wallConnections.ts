import { WALL_SIDES, ROOM_LIMITS } from './constants'
import { structureSurfaceElementId } from './elementIds'
import { surfacePosition } from './roomEditing'
import { findAvailableOpeningOffset, isWallMountedDecoration } from './geometry'
import { convexHull, intersectPolygon, polygonArea, uncoveredPolygons, wallRectangle, type WallPolygon } from './connectedWallGeometry'
import type { DoorConfig, RoomConfig, StructurePack, WallOpening, WallSide, WindowConfig } from './types'

export type WallWorld = { room: RoomConfig; structurePacks: StructurePack[] }
export type WallPosition = NonNullable<WindowConfig['wallPosition']>
export interface ConnectedWall {
  id: string; packId?: string; side: WallSide
  x: number; y: number; z: number; yaw: number; width: number; height: number; depth: number
}
export interface WorldOpening {
  id: string; kind: 'door' | 'window'; packId?: string
  object: (DoorConfig | WindowConfig) & { freePosition?: WindowConfig['freePosition'] }
  position: WallPosition; shape?: WindowConfig['shape']; width: number; height: number; rotation: number
}
const epsilon = 1e-6
type GeometryCache = { walls?: ConnectedWall[]; openings?: WorldOpening[]; runs: Map<string, ConnectedWall[]>; cuts: Map<string, WallOpening[]> }
const worldCaches = new WeakMap<RoomConfig, WeakMap<StructurePack[], GeometryCache>>()
function cache(world: WallWorld): GeometryCache {
  let rooms = worldCaches.get(world.room)
  if (!rooms) { rooms = new WeakMap(); worldCaches.set(world.room, rooms) }
  let entry = rooms.get(world.structurePacks)
  if (!entry) { entry = { runs: new Map(), cuts: new Map() }; rooms.set(world.structurePacks, entry) }
  return entry
}
export const wallYaw = (side: WallSide) => ({ north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 })[side]

/** Physical walls, including independent walls. Visibility never changes support. */
export function physicalWalls(world: WallWorld): ConnectedWall[] {
  const entry = cache(world)
  if (entry.walls) return entry.walls
  return entry.walls = [...WALL_SIDES.map((side) => ({ id: `room-wall:${side}`, side,
    x: side === 'east' ? world.room.width / 2 : side === 'west' ? -world.room.width / 2 : 0,
    y: 0, z: side === 'north' ? -world.room.depth / 2 : side === 'south' ? world.room.depth / 2 : 0,
    yaw: wallYaw(side), width: side === 'north' || side === 'south' ? world.room.width : world.room.depth,
    height: world.room.height, depth: 0.12 })), ...world.structurePacks.flatMap((pack) => pack.surfaces.flatMap((surface) => {
      if (surface.kind !== 'wall' || !surface.wall) return []
      const [x, y, z] = surfacePosition(world.room, surface)
      return [{ id: structureSurfaceElementId(pack.id, surface.id), packId: pack.id, side: surface.wall,
        x: pack.x + x, y: pack.y + y - surface.height / 2, z: pack.z + z,
        yaw: wallYaw(surface.wall) + surface.rotation, width: surface.width, height: surface.height, depth: surface.depth }]
    }))]
}

export function ownerWall(world: WallWorld, side: WallSide, packId?: string): ConnectedWall | undefined {
  return physicalWalls(world).find((wall) => wall.side === side && wall.packId === packId)
}

export function openingPosition(world: WallWorld, object: DoorConfig | WindowConfig, packId?: string): WallPosition {
  if ('freePosition' in object && object.freePosition) return object.freePosition
  if (object.wallPosition) return object.wallPosition
  const wall = ownerWall(world, object.wall, packId)
  const yaw = wall?.yaw ?? wallYaw(object.wall)
  return { x: (wall?.x ?? 0) + Math.cos(yaw) * object.offset,
    y: (wall?.y ?? 0) + ('sill' in object ? object.sill : 0),
    z: (wall?.z ?? 0) - Math.sin(yaw) * object.offset, yaw,
    ...(wall ? { supportId: wall.id, depth: wall.depth } : {}) }
}

export function worldOpenings(world: WallWorld): WorldOpening[] {
  const entry = cache(world)
  if (entry.openings) return entry.openings
  const make = (object: DoorConfig | WindowConfig, id: string, packId?: string): WorldOpening => ({
    id, kind: 'shape' in object ? 'window' : 'door', packId, object,
    position: openingPosition(world, object, packId), shape: 'shape' in object ? object.shape : undefined,
    width: object.width, height: object.height, rotation: object.rotation,
  })
  return entry.openings = [make(world.room.door, 'door'), ...(world.room.extraDoors ?? []).map((door) => make(door, door.id)),
    ...world.room.windows.map((window) => make(window, window.id)),
    ...world.structurePacks.flatMap((pack) => [...(pack.doors ?? []).map((door) => make(door, door.id, pack.id)),
      ...(pack.windows ?? []).map((window) => make(window, window.id, pack.id))])]
}

const localX = (point: { x: number; z: number }, wall: { x: number; z: number; yaw: number }) =>
  (point.x - wall.x) * Math.cos(wall.yaw) - (point.z - wall.z) * Math.sin(wall.yaw)
const normalDistance = (a: { x: number; z: number }, b: { x: number; z: number; yaw: number }) =>
  Math.abs((a.x - b.x) * Math.sin(b.yaw) + (a.z - b.z) * Math.cos(b.yaw))
const parallel = (a: { yaw: number }, b: { yaw: number }) => Math.abs(Math.sin(a.yaw - b.yaw)) < epsilon

/** Touching solids with a common horizontal run; T junctions are not a run. */
export function wallsConnected(a: ConnectedWall, b: ConnectedWall): boolean {
  if (!parallel(a, b)) return false
  const overlaps = [(a.depth + b.depth) / 2 - normalDistance(a, b),
    (a.width + b.width) / 2 - Math.abs(localX(a, b)),
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)]
  // A shared face is continuity; a point/edge between solids is not a wall run.
  return overlaps.every((overlap) => overlap >= -epsilon) && overlaps.filter((overlap) => overlap > epsilon).length >= 2
}

/** Restrict to solids intersecting the aperture plane. Prevents transitive depth drift. */
export function openingWallRun(world: WallWorld, opening: WorldOpening): ConnectedWall[] {
  if (opening.object.freePosition) return []
  const entry = cache(world)
  const found = entry.runs.get(opening.id)
  if (found) return found
  const candidates = physicalWalls(world).filter((wall) => parallel(wall, opening.position)
    && normalDistance(opening.position, wall) <= (wall.depth + (opening.position.depth ?? 0.12)) / 2 + epsilon)
  const original = candidates.find((wall) => (opening.position.supportId ? wall.id === opening.position.supportId : wall.packId === opening.packId && wall.side === opening.object.wall)
    && normalDistance(opening.position, wall) <= wall.depth / 2 + epsilon)
  // The world anchor is sufficient after its original wall has been removed.
  const seed = original ?? candidates.filter((wall) => normalDistance(opening.position, wall) <= (wall.depth + (opening.position.depth ?? 0.12)) / 2 + epsilon
    && Math.abs(localX(opening.position, wall)) <= wall.width / 2 + epsilon
    && opening.position.y < wall.y + wall.height && opening.position.y + opening.height > wall.y)
    .sort((a, b) => normalDistance(opening.position, a) - normalDistance(opening.position, b))[0]
  if (!seed) return []
  const result = [seed], seen = new Set([seed.id])
  for (let index = 0; index < result.length; index++) for (const wall of candidates) {
    if (!seen.has(wall.id) && wallsConnected(result[index], wall)) { seen.add(wall.id); result.push(wall) }
  }
  entry.runs.set(opening.id, result)
  return result
}

/** Construction edits may leave an orphan visible; new opening edits must be supported. */
export function connectedOpeningError(world: WallWorld, ids?: ReadonlySet<string>): string | null {
  const openings = worldOpenings(world).filter((opening) => !opening.object.freePosition)
  for (const opening of openings) {
    if (ids && !ids.has(opening.id)) continue
    if (![opening.position.x, opening.position.y, opening.position.z, opening.position.yaw, opening.width, opening.height, opening.rotation, opening.object.offset].every(Number.isFinite)
      || opening.width <= 0 || opening.height <= 0) return 'Datos de apertura inválidos.'
    if (!openingHasSupport(world, opening)) return 'La apertura excede el soporte de las paredes conectadas.'
    // Las colisiones entre objetos/aperturas son avisos visuales. Los huecos
    // se recortan por la unión de polígonos en wallSolidGeometry; solo los
    // límites físicos y la geometría inválida bloquean la transformación.
  }
  return null
}

/**
 * Prioridad de colocación inicial: intenta un hueco que no esté ocupado.
 * No es una restricción de edición: el usuario puede superponer aperturas
 * y el detector de escena mostrará la colisión en rojo.
 * Funciona tanto con huecos reales como con cuadros, espejos y estanterías.
 */
export function openingOverlapsExisting(world: WallWorld, id: string): boolean {
  const openings = worldOpenings(world)
  const current = openings.find((opening) => opening.id === id)
  if (!current || current.object.freePosition) return false
  const run = new Set(openingWallRun(world, current).map((wall) => wall.id))
  const polygon = aperturePolygon(current)
  for (const other of openings) {
    if (other.id === id || other.object.freePosition
      || !openingWallRun(world, other).some((wall) => run.has(wall.id))) continue
    const direction = Math.cos(other.position.yaw - current.position.yaw) < 0 ? -1 : 1
    const deltaX = localX(other.position, current.position)
    const deltaY = other.position.y - current.position.y
    const otherPolygon = aperturePolygon(other)
      .map(([x, y]): [number, number] => [deltaX + direction * x, deltaY + y])
    if (polygonArea(intersectPolygon(polygon, otherPolygon)) > 1e-8) return true
  }
  return false
}

export function aperturePolygon(opening: Pick<WorldOpening, 'width' | 'height' | 'rotation' | 'shape'>): WallPolygon {
  const source: WallPolygon = opening.shape === 'circular'
    ? Array.from({ length: 48 }, (_, i) => [Math.cos(i * Math.PI / 24) * opening.width / 2, Math.sin(i * Math.PI / 24) * opening.height / 2])
    : wallRectangle(-opening.width / 2, opening.width / 2, -opening.height / 2, opening.height / 2)
  return source.map(([x, y]) => [x * Math.cos(opening.rotation) - y * Math.sin(opening.rotation),
    opening.height / 2 + x * Math.sin(opening.rotation) + y * Math.cos(opening.rotation)])
}

/** Coverage against the real 2D union, not the bounding box of the connected run. */
export function openingHasSupport(world: WallWorld, opening: WorldOpening): boolean {
  if (opening.object.freePosition) return true
  const run = openingWallRun(world, opening)
  const margin = opening.kind === 'door' ? 0.12 : ROOM_LIMITS.edgeMargin
  const polygon = convexHull(aperturePolygon(opening).flatMap(([x, y]) =>
    [[x - margin, y], [x + margin, y], [x - margin, y + 0.08], [x + margin, y + 0.08]] as WallPolygon))
  const supports = run.map((wall) => {
    const along = localX(wall, opening.position)
    return wallRectangle(along - wall.width / 2, along + wall.width / 2,
      wall.y - opening.position.y, wall.y + wall.height - opening.position.y)
  })
  return uncoveredPolygons(polygon, supports).reduce((sum, part) => sum + polygonArea(part), 0) < 1e-7
}

/** One local cut per intersected wall. The editable object itself is never copied. */
export function wallDerivedOpenings(world: WallWorld, wall: ConnectedWall): WallOpening[] {
  const entry = cache(world)
  const found = entry.cuts.get(wall.id)
  if (found) return found
  const result = worldOpenings(world).flatMap((opening): WallOpening[] => {
    if (opening.object.freePosition || isWallMountedDecoration(opening.shape)
      || !openingWallRun(world, opening).some((candidate) => candidate.id === wall.id)) return []
    const offset = localX(opening.position, wall)
    if (Math.abs(offset) > (wall.width + Math.hypot(opening.width, opening.height)) / 2) return []
    const reverse = Math.cos(opening.position.yaw - wall.yaw) < 0
    const cut: WallOpening = { id: opening.id, kind: opening.kind, shape: opening.shape, offset,
      bottom: opening.position.y - wall.y, width: opening.width, height: opening.height,
      rotation: reverse ? -opening.rotation : opening.rotation, color: opening.object.color ?? '#c88f58' }
    const polygon = aperturePolygon(cut).map(([x, y]) => [x + cut.offset, y + cut.bottom] as [number, number])
    if (polygonArea(intersectPolygon(polygon, wallRectangle(-wall.width / 2, wall.width / 2, 0, wall.height))) < 1e-8) return []
    return [cut]
  })
  entry.cuts.set(wall.id, result)
  return result
}

/** Conservative box projection, using the same cut union as rendered geometry. */
export function wallIntersectionIsCut(world: WallWorld, wallId: string, box: { x: number; y: number; z: number; width: number; height: number; depth: number; rotation: number }): boolean {
  const wall = physicalWalls(world).find((item) => item.id === wallId)
  if (!wall) return false
  const x = localX(box, wall)
  const half = (box.width * Math.abs(Math.cos(box.rotation - wall.yaw)) + box.depth * Math.abs(Math.sin(box.rotation - wall.yaw))) / 2
  const left = Math.max(-wall.width / 2, x - half), right = Math.min(wall.width / 2, x + half)
  const bottom = Math.max(0, box.y - box.height / 2 - wall.y), top = Math.min(wall.height, box.y + box.height / 2 - wall.y)
  if (right - left <= epsilon || top - bottom <= epsilon) return true
  const cuts = wallDerivedOpenings(world, wall).map((cut) => aperturePolygon(cut).map(([x, y]) => [x + cut.offset, y + cut.bottom] as [number, number]))
  return uncoveredPolygons(wallRectangle(left, right, bottom, top), cuts).reduce((area, polygon) => area + polygonArea(polygon), 0) < 1e-7
}

/** Structural overlap across owners/faces, measured in actual cut polygons. */
export function openingCutsOverlap(world: WallWorld, firstId: string, secondId: string): boolean {
  for (const wall of physicalWalls(world)) {
    const cuts = wallDerivedOpenings(world, wall)
    const first = cuts.find((cut) => cut.id === firstId), second = cuts.find((cut) => cut.id === secondId)
    if (!first || !second) continue
    const polygon = (cut: WallOpening) => aperturePolygon(cut).map(([x, y]) => [x + cut.offset, y + cut.bottom] as [number, number])
    const intersection = intersectPolygon(intersectPolygon(polygon(first), polygon(second)), wallRectangle(-wall.width / 2, wall.width / 2, 0, wall.height))
    if (polygonArea(intersection) > 1e-8) return true
  }
  return false
}

/** Continuous translation: a large pointer step cannot jump an unsupported gap. */
export function openingTranslationSupported(world: WallWorld, from: WorldOpening, to: WorldOpening): boolean {
  if (to.object.freePosition || from.object.freePosition || from.width !== to.width || from.height !== to.height || from.rotation !== to.rotation
    || !parallel(from.position, to.position)) return true
  const dx = localX(from.position, to.position), dy = from.position.y - to.position.y
  const margin = to.kind === 'door' ? 0.12 : ROOM_LIMITS.edgeMargin
  const points = aperturePolygon(to)
  const swept = convexHull([...points, ...points.map(([x, y]) => [x + dx, y + dy] as [number, number])]
    .flatMap(([x, y]) => [[x - margin, y], [x + margin, y], [x - margin, y + 0.08], [x + margin, y + 0.08]] as WallPolygon))
  const supports = openingWallRun(world, to).map((wall) => {
    const x = localX(wall, to.position)
    return wallRectangle(x - wall.width / 2, x + wall.width / 2, wall.y - to.position.y, wall.y + wall.height - to.position.y)
  })
  return !uncoveredPolygons(swept, supports).length
}

export function openingRunBounds(world: WallWorld, id: string) {
  const opening = worldOpenings(world).find((item) => item.id === id)
  if (!opening) return null
  const run = openingWallRun(world, opening)
  if (!run.length) return null
  const spans = run.map((wall) => ({ center: localX(wall, opening.position), half: wall.width / 2 }))
  const margin = (opening.kind === 'door' ? 0.12 : ROOM_LIMITS.edgeMargin) + opening.width / 2
  return { min: Math.min(...spans.map((span) => span.center - span.half)) + margin,
    max: Math.max(...spans.map((span) => span.center + span.half)) - margin }
}

/** Keep the previous nearest-slot behaviour when explicitly switching support. */
export function fitOpeningToConnectedRun(world: WallWorld, id: string): WallWorld | null {
  const opening = worldOpenings(world).find((item) => item.id === id)
  const bounds = openingRunBounds(world, id)
  if (!opening || !bounds) return null
  const at = (offset: number): WallWorld => {
    const delta = offset - opening.object.offset
    const change = <T extends DoorConfig | WindowConfig>(object: T): T => ({ ...object, offset,
      wallPosition: { ...opening.position, x: opening.position.x + delta * Math.cos(opening.position.yaw), z: opening.position.z - delta * Math.sin(opening.position.yaw) } })
    return { room: { ...world.room, door: id === 'door' ? change(world.room.door) : world.room.door,
      ...(world.room.extraDoors ? { extraDoors: world.room.extraDoors.map((item) => item.id === id ? change(item) : item) } : {}),
      windows: world.room.windows.map((item) => item.id === id ? change(item) : item) },
      structurePacks: world.structurePacks.map((pack) => ({ ...pack,
        ...(pack.doors ? { doors: pack.doors.map((item) => item.id === id ? change(item) : item) } : {}),
        ...(pack.windows ? { windows: pack.windows.map((item) => item.id === id ? change(item) : item) } : {}) })) }
  }
  const margin = opening.kind === 'door' ? 0.12 : ROOM_LIMITS.edgeMargin
  const extent = Math.max(Math.abs(opening.object.offset + bounds.min), Math.abs(opening.object.offset + bounds.max))
  const offset = findAvailableOpeningOffset(2 * (extent + opening.width / 2 + margin), opening.width, opening.object.offset,
    (value) => !connectedOpeningError(at(value), new Set([id])), margin)
  return offset === null ? null : at(offset)
}

/** Anchor every attached opening without changing world geometry or IDs. */
export function anchorWallOpenings(world: WallWorld): WallWorld {
  const door = <T extends DoorConfig>(object: T, packId?: string): T =>
    object.wallPosition ? object : { ...object, wallPosition: openingPosition(world, object, packId) }
  const window = (object: WindowConfig, packId?: string): WindowConfig =>
    object.freePosition || object.wallPosition ? object : { ...object, wallPosition: openingPosition(world, object, packId) }
  return { room: { ...world.room, door: door(world.room.door),
    ...(world.room.extraDoors ? { extraDoors: world.room.extraDoors.map((item) => door(item)) } : {}),
    windows: world.room.windows.map((item) => window(item)) },
    structurePacks: world.structurePacks.map((pack) => ({ ...pack,
      ...(pack.doors ? { doors: pack.doors.map((item) => door(item, pack.id)) } : {}),
      ...(pack.windows ? { windows: pack.windows.map((item) => window(item, pack.id)) } : {}) })) }
}

/** Translate local editing deltas into the one world anchor. Wall changes reattach. */
export function reconcileWallOpeningPositions(before: WallWorld, after: WallWorld): WallWorld {
  const old = new Map(worldOpenings(before).map((opening) => [opening.id, opening]))
  const patch = <T extends DoorConfig | WindowConfig>(object: T, id: string, packId?: string): T => {
    if ('freePosition' in object && object.freePosition) {
      const { wallPosition: _wallPosition, ...free } = object
      return free as T
    }
    const previous = old.get(id)
    if (!previous || !object.wallPosition || object.wall !== previous.object.wall || previous.object.freePosition) {
      const { wallPosition: _wallPosition, ...local } = object
      return { ...object, wallPosition: openingPosition(after, local as T, packId) }
    }
    // Explicit world movements already carry their final position.
    if (object.wallPosition !== previous.object.wallPosition) return object
    const delta = object.offset - previous.object.offset
    const sill = 'sill' in object ? object.sill - ('sill' in previous.object ? Number(previous.object.sill) : 0) : 0
    let position = previous.position
    const previousWall = physicalWalls(before).find((wall) => wall.id === position.supportId)
    const nextWall = physicalWalls(after).find((wall) => wall.id === position.supportId)
    if (previousWall && nextWall) {
      const along = localX(position, previousWall)
      const normal = (position.x - previousWall.x) * Math.sin(previousWall.yaw) + (position.z - previousWall.z) * Math.cos(previousWall.yaw)
      position = { ...position, x: nextWall.x + along * Math.cos(nextWall.yaw) + normal * Math.sin(nextWall.yaw),
        y: position.y + nextWall.y - previousWall.y,
        z: nextWall.z - along * Math.sin(nextWall.yaw) + normal * Math.cos(nextWall.yaw),
        yaw: position.yaw + nextWall.yaw - previousWall.yaw, depth: nextWall.depth }
    }
    return Math.abs(delta) + Math.abs(sill) < 1e-9 && JSON.stringify(position) === JSON.stringify(previous.position) ? object : { ...object,
      wallPosition: { ...position, x: position.x + delta * Math.cos(position.yaw),
        y: position.y + sill, z: position.z - delta * Math.sin(position.yaw) } }
  }
  return { room: { ...after.room, door: patch(after.room.door, 'door'),
    ...(after.room.extraDoors ? { extraDoors: after.room.extraDoors.map((item) => patch(item, item.id)) } : {}),
    windows: after.room.windows.map((item) => patch(item, item.id)) },
    structurePacks: after.structurePacks.map((pack) => ({ ...pack,
      ...(pack.doors ? { doors: pack.doors.map((item) => patch(item, item.id, pack.id)) } : {}),
      ...(pack.windows ? { windows: pack.windows.map((item) => patch(item, item.id, pack.id)) } : {}) })) }
}
