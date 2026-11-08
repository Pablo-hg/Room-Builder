import { structureWindowFrame } from './structureWindows'
import { worldRoomBoxes } from './roomEditing'
import type { RoomConfig, StructurePack, WindowConfig } from './types'

export type WallObjectWorld = { room: RoomConfig; structurePacks: StructurePack[] }
export function wallObjects(world: WallObjectWorld) {
  return [...world.room.windows.map((window) => ({ window, pack: undefined as StructurePack | undefined })),
    ...world.structurePacks.flatMap((pack) => (pack.windows ?? []).map((window) => ({ window, pack })))]
}

/** A single world-space base centre for inspector, scene, diagnostics and transfers. */
export function wallObjectPosition(room: RoomConfig, window: WindowConfig, pack?: StructurePack) {
  if (window.freePosition) return window.freePosition
  const frame = pack ? structureWindowFrame(room, pack, window.wall) : null
  const yaw = frame?.yaw ?? ({ north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 }[window.wall])
  const x = frame?.x ?? (window.wall === 'east' ? room.width / 2 : window.wall === 'west' ? -room.width / 2 : 0)
  const z = frame?.z ?? (window.wall === 'north' ? -room.depth / 2 : window.wall === 'south' ? room.depth / 2 : 0)
  return { x: x + Math.cos(yaw) * window.offset, y: (frame?.floorY ?? 0) + window.sill,
    z: z - Math.sin(yaw) * window.offset, yaw }
}

/** Only axes lying in the supporting wall plane are editable while attached. */
export function wallObjectAvailableAxes(room: RoomConfig, window: WindowConfig, pack?: StructurePack) {
  if (window.freePosition) return { x: true, y: true, z: true }
  const { yaw } = wallObjectPosition(room, window, pack)
  return { x: Math.abs(Math.sin(yaw)) < 1e-7, y: true, z: Math.abs(Math.cos(yaw)) < 1e-7 }
}

/** Selection and handles use the same base + sill as the model, including pack-local floors. */
export function wallObjectSelectionFrame(room: RoomConfig, window: WindowConfig, pack?: StructurePack) {
  const position = wallObjectPosition(room, window, pack)
  const depthOffset = 0.05
  return { position, localCenter: [0, window.height / 2, depthOffset] as [number, number, number],
    depth: window.shape === 'wallShelf' ? 0.3 : 0.18,
    handleBase: { x: position.x + Math.sin(position.yaw) * depthOffset, y: position.y, z: position.z + Math.cos(position.yaw) * depthOffset } }
}

export function wallObjectBox(room: RoomConfig, window: WindowConfig, pack?: StructurePack) {
  const position = wallObjectPosition(room, window, pack)
  const cosine = Math.abs(Math.cos(window.rotation)), sine = Math.abs(Math.sin(window.rotation))
  const depth = window.shape === 'wallShelf' || window.shape === 'wallSconce' ? 0.3 : 0.18
  const inset = depth / 2 - 0.04
  return { id: window.id, x: position.x + Math.sin(position.yaw) * inset,
    y: position.y + window.height / 2, z: position.z + Math.cos(position.yaw) * inset,
    width: window.width * cosine + window.height * sine, height: window.height * cosine + window.width * sine,
    depth, rotation: position.yaw }
}

export function wallObjectLocksAllow(room: RoomConfig, before: WindowConfig, after: WindowConfig, pack?: StructurePack) {
  const from = wallObjectPosition(room, before, pack), to = wallObjectPosition(room, after, pack)
  return (['x', 'y', 'z'] as const).every((axis) => !before.axisLocks?.[axis] || Math.abs(from[axis] - to[axis]) < 1e-9)
}

/** Rehome detached elements after a world-space group movement, without changing coordinates. */
export function rehomeFreeWallObjects(world: WallObjectWorld): WallObjectWorld {
  let room = world.room, structurePacks = world.structurePacks
  const roomPacks = world.structurePacks.filter((pack) => pack.id.startsWith('floor-pack-'))
  const boxes = worldRoomBoxes(world.room, world.structurePacks)
  for (const { window, pack } of wallObjects(world)) {
    if (!window.freePosition) continue
    const point = { ...window.freePosition, y: window.freePosition.y + window.height / 2 }
    const matches = boxes.map((box, index) => ({ box, index })).filter(({ box }) =>
      Math.abs(point.x - box.x) < box.width / 2 - 1e-5 && Math.abs(point.z - box.z) < box.depth / 2 - 1e-5
      && point.y > box.y + 1e-5 && point.y < box.y + box.height - 1e-5)
    if (matches.length !== 1) continue
    const target = matches[0].index ? roomPacks[matches[0].index - 1] : undefined
    if (target?.id === pack?.id) continue
    room = { ...room, windows: room.windows.filter((item) => item.id !== window.id) }
    if (!target) room.windows.push(window)
    structurePacks = structurePacks.map((candidate) => candidate.id === pack?.id || candidate.id === target?.id
      ? { ...candidate, windows: [...(candidate.windows ?? []).filter((item) => item.id !== window.id), ...(candidate.id === target?.id ? [window] : [])] } : candidate)
  }
  return { room, structurePacks }
}
