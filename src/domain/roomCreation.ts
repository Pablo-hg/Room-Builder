import { BASE_ROOM_SURFACE_IDS, ROOT_ROOM_FOLDER } from './elementFolders'
import { structureSurfaceElementId } from './elementIds'
import { packRoomBox, rebasePack, roomVerticalBounds, surfacePosition, worldRoomBoxes } from './roomEditing'
import { createStructureSurface } from './structureRules'
import type { StructurePack, StructureSurfaceKey } from './types'
import type { RoomState } from '../state/types'

export type RoomCreationDirection = 'up' | 'down' | 'north' | 'east' | 'south' | 'west'
type CreationState = Pick<RoomState, 'room' | 'structurePacks' | 'selectedId' | 'activeRoomId' | 'elementFolderAssignments'>
const epsilon = 1e-7

/** Preview and action share reference, geometry and occupancy; no IDs or state are mutated. */
export function planRoomCreation(state: CreationState, direction?: RoomCreationDirection) {
  const selectedFolder = state.selectedId?.startsWith('folder:') ? state.selectedId.slice('folder:'.length) : null
  const rootSelected = selectedFolder === ROOT_ROOM_FOLDER || BASE_ROOM_SURFACE_IDS.includes(state.selectedId ?? '')
  const reference = rootSelected ? undefined : (state.structurePacks.find((pack) => pack.id.startsWith('floor-pack-')
    && (pack.id === state.selectedId || pack.surfaces.some((surface) => structureSurfaceElementId(pack.id, surface.id) === state.selectedId)
      || (selectedFolder !== null && state.elementFolderAssignments[pack.id] === selectedFolder)))
    ?? state.structurePacks.find((pack) => pack.id === state.activeRoomId && pack.id.startsWith('floor-pack-')))
  const referenceBox = reference && packRoomBox(reference, state.room)
  const template = { ...state.room, ...(referenceBox ? { width: referenceBox.width, depth: referenceBox.depth, height: referenceBox.height } : {}) }
  const origin = { x: (reference?.x ?? 0) + (referenceBox?.x ?? 0), y: (reference?.y ?? 0) + (referenceBox?.y ?? 0), z: (reference?.z ?? 0) + (referenceBox?.z ?? 0) }
  const surfaceIds: StructureSurfaceKey[] = ['floor', 'ceiling', 'wall-north', 'wall-east', 'wall-south', 'wall-west']
  const pack: StructurePack = rebasePack({
    id: '__room-preview__', name: '',
    x: origin.x + (direction === 'east' ? template.width : direction === 'west' ? -template.width : 0),
    y: direction ? origin.y : 0,
    z: origin.z + (direction === 'south' ? template.depth : direction === 'north' ? -template.depth : 0),
    surfaces: surfaceIds.map((id) => {
      const surface = createStructureSurface(template, id)
      // The top face of a new ceiling ends at the wall top, not half a slab above.
      return surface.kind === 'ceiling' ? { ...surface, y: -surface.height / 2 } : surface
    }),
  }, template, state.room)
  const bounds = roomVerticalBounds(state.room, { ...pack, y: 0 })
  const referenceBounds = roomVerticalBounds(state.room, reference)
  if (direction === 'up') pack.y = referenceBounds.top - bounds.bottom
  else if (direction === 'down') {
    // Walls and the ceiling's top face reach the underside of the upper support,
    // including when the ceiling is hidden. No empty half-slab is reserved.
    const wallTop = Math.max(...pack.surfaces.filter((surface) => surface.kind === 'wall')
      .map((surface) => surfacePosition(state.room, surface)[1] + surface.height / 2))
    pack.y = referenceBounds.bottom - wallTop
  } else if (!direction) pack.y = Math.max(roomVerticalBounds(state.room).top,
    ...state.structurePacks.filter((candidate) => candidate.id.startsWith('floor-pack-')).map((candidate) => roomVerticalBounds(state.room, candidate).top)) - bounds.bottom

  const candidate = { ...packRoomBox(pack, state.room)!, x: pack.x, y: pack.y, z: pack.z }
  // Compare room volumes, not support slabs: shared boundary contact is normal.
  const occupied = worldRoomBoxes(state.room, state.structurePacks).some((other) =>
    Math.abs(candidate.x - other.x) < (candidate.width + other.width) / 2 - epsilon
    && Math.abs(candidate.z - other.z) < (candidate.depth + other.depth) / 2 - epsilon
    && candidate.y < other.y + other.height - epsilon
    && other.y < candidate.y + candidate.height - epsilon)
  return { pack, occupied }
}
