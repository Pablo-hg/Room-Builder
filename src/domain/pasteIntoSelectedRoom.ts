import { folderIdFromSelection } from './elementFolders'
import { makeId, structureSurfaceElementId } from './elementIds'
import { canPlaceFurniture, findAvailableOpeningOffset, findFreeFurniturePosition, furnitureHalfExtents } from './geometry'
import { snapMeasurement } from './measurements'
import { validateFurnitureWallAttachments } from './furnitureWalls'
import { packRoomBox, type selectedEditableRoom } from './roomEditing'
import { anchorWallOpenings, connectedOpeningError, openingOverlapsExisting, physicalWalls, worldOpenings } from './wallConnections'
import type { FurnitureItem, WindowConfig } from './types'
import type { RoomState } from '../state/types'

type Origin = { x: number; y: number; z: number }
type Target = NonNullable<ReturnType<typeof selectedEditableRoom>>

/** Atomic paste into the explicitly selected room, independent of camera focus. */
export function pasteIntoSelectedRoom(state: RoomState, target: Target, copies: (FurnitureItem | WindowConfig)[], origins: Record<string, Origin>, cut: boolean):
  { update: Partial<RoomState> } | { error: string } {
  const folder = folderIdFromSelection(state.selectedId)
  const targetPack = target.packId ? state.structurePacks.find((pack) => pack.id === target.packId) : undefined
  const box = targetPack ? packRoomBox(targetPack, state.room) : null
  if (!folder || (targetPack && !box) || (target.packId && !targetPack)) return { error: 'No se pudo identificar la habitación de destino.' }
  if (targetPack && state.lockedElementIds.includes(targetPack.id)) return { error: 'La habitación de destino está bloqueada.' }
  const center = { x: (targetPack?.x ?? 0) + (box?.x ?? 0), y: (targetPack?.y ?? 0) + (box?.y ?? 0), z: (targetPack?.z ?? 0) + (box?.z ?? 0) }
  const size = box ?? state.room
  let furniture = [...state.furniture]
  let room = state.room
  let packs = state.structurePacks
  const assignments = { ...state.elementFolderAssignments }
  const ids: string[] = []
  const existing = new Set([...furniture.map((item) => item.id), ...worldOpenings(state).map((item) => item.id)])
  for (const copy of copies) {
    const id = cut && !existing.has(copy.id) ? copy.id : makeId('kind' in copy ? copy.kind : 'window')
    existing.add(id)
    const origin = origins[copy.id] ?? { x: 0, y: 0, z: 0 }
    const delta = { x: center.x - origin.x, y: center.y - origin.y, z: center.z - origin.z }
    if ('kind' in copy) {
      let item: FurnitureItem = { ...copy, id, x: snapMeasurement(copy.x + delta.x), y: snapMeasurement(copy.y + delta.y), z: snapMeasurement(copy.z + delta.z) }
      if (item.wallAttachment && (delta.x || delta.y || delta.z)) {
        const sourceWall = physicalWalls(state).find((wall) => wall.id === item.wallAttachment!.wallId)
        const destinationWall = sourceWall && physicalWalls(state).find((wall) => wall.side === sourceWall.side && (targetPack ? wall.packId === targetPack.id : !wall.packId))
        if (!destinationWall) return { error: 'No se puede trasladar la fijación de pared a la habitación seleccionada.' }
        item = { ...item, wallAttachment: { ...item.wallAttachment, wallId: destinationWall.id } }
      }
      const { halfWidth, halfDepth } = furnitureHalfExtents(item)
      const fits = (candidate: FurnitureItem) => Math.abs(candidate.x - center.x) + halfWidth <= size.width / 2 + 1e-8
        && Math.abs(candidate.z - center.z) + halfDepth <= size.depth / 2 + 1e-8
        && candidate.y >= center.y - 1e-8 && candidate.y + candidate.height <= center.y + size.height + 1e-8
      if (!fits(item) || !canPlaceFurniture(item, furniture)) {
        if (item.wallAttachment) return { error: 'No hay espacio libre para el objeto fijado en la habitación seleccionada.' }
        const localFurniture = furniture.map((entry) => ({ ...entry, x: entry.x - center.x, z: entry.z - center.z }))
        const position = findFreeFurniturePosition({ ...item, x: item.x - center.x, z: item.z - center.z }, { ...state.room, width: size.width, depth: size.depth }, localFurniture,
          (candidate) => fits({ ...candidate, x: candidate.x + center.x, z: candidate.z + center.z }))
        if (!position) return { error: 'No hay espacio libre en la habitación seleccionada.' }
        item = { ...item, x: snapMeasurement(position.x + center.x), z: snapMeasurement(position.z + center.z) }
      }
      if (item.wallAttachment) {
        try { validateFurnitureWallAttachments({ room, structurePacks: packs, furniture: [item] }, 12) }
        catch { return { error: 'No se puede conservar la fijación de pared en la habitación seleccionada.' } }
      }
      furniture.push(item)
    } else {
      const targetWallId = targetPack ? structureSurfaceElementId(targetPack.id, `wall-${copy.wall}`) : `room-wall:${copy.wall}`
      if (state.lockedElementIds.includes(targetWallId) || state.hiddenElementIds.includes(targetWallId)) return { error: 'La pared de destino está bloqueada u oculta.' }
      const { wallPosition: _wallPosition, freePosition, ...base } = copy
      let pasted: WindowConfig = { ...base, id }
      if (freePosition) {
        const position = { ...freePosition, x: snapMeasurement(freePosition.x + delta.x), y: snapMeasurement(freePosition.y + delta.y), z: snapMeasurement(freePosition.z + delta.z) }
        if (Math.abs(position.x - center.x) > size.width / 2 || Math.abs(position.z - center.z) > size.depth / 2
          || position.y < center.y || position.y + copy.height > center.y + size.height) return { error: 'El objeto mural no cabe en la habitación seleccionada.' }
        pasted = { ...pasted, freePosition: position }
      }
      const insert = (window: WindowConfig) => targetPack
        ? { room, structurePacks: packs.map((pack) => pack.id === targetPack.id ? { ...pack, windows: [...(pack.windows ?? []), window] } : pack) }
        : { room: { ...room, windows: [...room.windows, window] }, structurePacks: packs }
      if (!freePosition) {
        const wall = physicalWalls({ room, structurePacks: packs }).find((entry) => entry.side === copy.wall && (targetPack ? entry.packId === targetPack.id : !entry.packId))
        if (!wall) return { error: 'No existe una pared compatible en la habitación seleccionada.' }
        const find = (avoidOverlap: boolean) => findAvailableOpeningOffset(wall.width, copy.width, copy.offset, (offset) => {
          const world = anchorWallOpenings(insert({ ...pasted, offset }))
          return !connectedOpeningError(world, new Set([id])) && (!avoidOverlap || !openingOverlapsExisting(world, id))
        })
        const offset = find(true) ?? find(false)
        if (offset === null) return { error: 'No hay espacio válido en la pared de destino.' }
        pasted = { ...pasted, offset }
      }
      const world = insert(pasted)
      room = world.room
      packs = world.structurePacks
    }
    assignments[id] = folder
    ids.push(id)
  }
  return { update: { room, structurePacks: packs, furniture, elementFolderAssignments: assignments,
    selectedId: ids.length === 1 ? ids[0] : null, selectedIds: ids, selectionAnchor: ids[0] ?? null,
    notice: ids.length === 1 ? 'Elemento pegado en la habitación seleccionada.' : `${ids.length} elementos pegados en la habitación seleccionada.` } }
}
