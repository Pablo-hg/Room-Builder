import { useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { wallObjectAvailableAxes, wallObjectBox, wallObjectSelectionFrame, wallObjects } from '../domain/wallObjectPlacement'
import { nearestWallSnap, openingRoomFrame, wallBelongsTo } from '../domain/catalogDrag'
import { boxOutsideBuilding } from '../domain/buildingVolume'
import type { DoorSwing, RoomConfig, StructurePack, WindowConfig } from '../domain/types'
import { moveFromOrigin } from '../domain/measurements'
import { useRoomStore } from '../state/useRoomStore'
import { OpeningDetail } from './Openings'
import { PlanWallSymbol } from './PlanWallSymbol'
import { SelectionBounds } from './SelectionBounds'
import { WallObjectGizmo } from './WallObjectGizmo'
import { useHistoryGesture } from '../state/useHistoryGesture'
import { releasePointer, usePointerCancellation } from './usePointerCancellation'
import { selectSceneObject } from './sceneInteraction'
import { openingHasSupport, openingWallRun, physicalWalls, worldOpenings } from '../domain/wallConnections'

function WorldWallObject({ room, packs, window, pack, collision, exportMode, cleanView, kind = 'window' }: { room: RoomConfig; packs: StructurePack[]; window: WindowConfig; pack?: StructurePack; collision: boolean; exportMode: boolean; cleanView: boolean; kind?: 'window' | 'door' }) {
  const selected = useRoomStore((state) => state.selectedIds.includes(window.id))
  const multiple = useRoomStore((state) => state.selectedIds.length > 1)
  const locked = useRoomStore((state) => state.lockedElementIds.includes(window.id) || !!pack && state.lockedElementIds.includes(pack.id))
  const view = useRoomStore((state) => state.view)
  const move = useRoomStore((state) => state.moveWallObject)
  const { camera } = useThree()
  const gesture = useHistoryGesture(window.id)
  const selectionFrame = wallObjectSelectionFrame(room, window, pack)
  const position = selectionFrame.position
  const availableAxes = { ...wallObjectAvailableAxes(room, window, pack), y: kind !== 'door' }
  const movementLocks = { x: !availableAxes.x || !!window.axisLocks?.x, y: !availableAxes.y || !!window.axisLocks?.y, z: !availableAxes.z || !!window.axisLocks?.z }
  const drag = useRef<{ point: THREE.Vector3; plane: THREE.Plane; origin: typeof position; offset: number; sill: number; vertical: boolean; inWallPlane: boolean } | null>(null)
  // Plano de la propia pared a la altura del centro del objeto: arrastrar el cuerpo de un objeto fijado lo mueve
  // libre en sus dos ejes (a lo largo y en altura), igual que un mueble se mueve libre por el suelo.
  const wallPlaneAt = (frame: { x: number; y: number; z: number; yaw: number }) => new THREE.Plane().setFromNormalAndCoplanarPoint(
    new THREE.Vector3(Math.sin(frame.yaw), 0, Math.cos(frame.yaw)), new THREE.Vector3(frame.x, frame.y + window.height / 2, frame.z))
  // Pared junto a la que estaba el objeto al empezar el gesto: no se refija a ella hasta salir del alcance del imán
  // (así se puede alejar un objeto recién despegado con la casilla).
  const snapBlockedWall = useRef<string | null>(null)
  const wallSnapFor = () => {
    const state = useRoomStore.getState()
    const entry = wallObjects(state).find((item) => item.window.id === window.id)
    const free = entry?.window.freePosition
    if (!entry || !free) return null
    const frame = openingRoomFrame(state.room, entry.pack)
    const walls = physicalWalls(state).filter((wall) => wallBelongsTo(wall, entry.pack?.id ?? null))
    return nearestWallSnap(walls, frame.center, frame.floorY, { x: free.x, y: free.y + entry.window.height / 2, z: free.z }, entry.window.height)
  }
  const end = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    drag.current = null
    gesture.commit()
    document.body.classList.remove('can-grab')
    releasePointer(event)
  }
  const capture = usePointerCancellation((event) => { gesture.cancel(); end(event) })
  const start = (event: ThreeEvent<PointerEvent>) => {
    if (cleanView) return
    event.stopPropagation()
    if (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey || event.nativeEvent.shiftKey && !selected) { selectSceneObject(window.id, event.nativeEvent); return }
    if (!selected) { useRoomStore.getState().selectElement(window.id); return }
    if (multiple) { useRoomStore.getState().selectElement(window.id); return }
    if (locked || view === 'pov' || event.button !== 0) return
    const vertical = event.nativeEvent.shiftKey
    // En Plano la pared se ve de canto: ahí se sigue moviendo solo a lo largo de ella.
    const inWallPlane = !window.freePosition && !vertical && view !== 'front' && view !== 'top'
    const normal = vertical || view === 'front' ? camera.getWorldDirection(new THREE.Vector3()) : new THREE.Vector3(0, 1, 0)
    const plane = inWallPlane ? wallPlaneAt(position) : new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(position.x, position.y + window.height / 2, position.z))
    const point = event.ray.intersectPlane(plane, new THREE.Vector3())
    if (!point) return
    drag.current = { point, plane, origin: position, offset: window.offset, sill: window.sill, vertical, inWallPlane }
    snapBlockedWall.current = wallSnapFor()?.wall.id ?? null
    gesture.begin()
    capture(event)
    document.body.classList.add('can-grab')
  }
  const moving = (event: ThreeEvent<PointerEvent>) => {
    const current = drag.current
    if (!current || !gesture.isActive()) return
    event.stopPropagation()
    const point = event.ray.intersectPlane(current.plane, new THREE.Vector3())
    if (!point) return
    const delta = point.sub(current.point)
    if (!window.freePosition) {
      const update = {
        ...(!current.vertical ? { offset: moveFromOrigin(current.offset + delta.x * Math.cos(current.origin.yaw) - delta.z * Math.sin(current.origin.yaw), current.offset) } : {}),
        ...(kind !== 'door' && (current.vertical || current.inWallPlane || view === 'front') ? { sill: moveFromOrigin(current.sill + delta.y, current.sill) } : {}),
      }
      if (kind === 'door') {
        if (window.id === 'door') useRoomStore.getState().setDoor(update)
        else useRoomStore.getState().setStructureDoor(window.id, update)
      } else useRoomStore.getState().updateWindow(window.id, update)
      return
    }
    const pointer = point.clone().add(current.point)
    for (const axis of ['x', 'y', 'z'] as const) {
      if (!availableAxes[axis]) continue
      if (current.vertical && axis !== 'y') continue
      if (!current.vertical && view !== 'front' && axis === 'y') continue
      move(window.id, axis, moveFromOrigin(current.origin[axis] + delta[axis], current.origin[axis]))
    }
    // Un objeto de pared libre se fija solo al acercarlo a una pared de su habitación (Alt lo evita, como el imán).
    // Desde ese momento se desliza por la pared; solo la casilla «Fijar a pared» lo despega.
    if (kind === 'door' || event.nativeEvent.altKey) return
    const snap = wallSnapFor()
    if (!snap) { snapBlockedWall.current = null; return }
    if (snap.wall.id === snapBlockedWall.current) return
    const state = useRoomStore.getState()
    state.updateWindow(window.id, { wall: snap.wall.side, offset: snap.offset, sill: snap.sill })
    const attached = wallObjects(useRoomStore.getState()).find((entry) => entry.window.id === window.id)
    if (!attached || attached.window.freePosition) return
    // El arrastre continúa ya como objeto fijado: nuevo origen en la pared, sin saltos.
    const origin = wallObjectSelectionFrame(room, attached.window, attached.pack).position
    const inWallPlane = !current.vertical && view !== 'front' && view !== 'top'
    const plane = inWallPlane ? wallPlaneAt(origin) : current.plane
    drag.current = { ...current, plane, inWallPlane, point: event.ray.intersectPlane(plane, new THREE.Vector3()) ?? pointer, origin, offset: attached.window.offset, sill: attached.window.sill }
  }
  const outside = !!window.freePosition && boxOutsideBuilding({ room, structurePacks: packs }, wallObjectBox(room, window, pack))
  return <>
    <group position={[position.x, position.y, position.z]} rotation={[0, position.yaw, 0]} userData={{ elementId: window.id }} onPointerDown={start} onPointerMove={moving} onPointerUp={end} onPointerCancel={(event) => { gesture.cancel(); end(event) }}>
      {view === 'top' && !exportMode
        ? <PlanWallSymbol kind={kind} width={window.width} height={window.height} shape={window.shape} color={window.material?.color ?? window.color ?? '#c88f58'} swing={kind === 'door' ? (window as { swing?: DoorSwing }).swing : undefined} />
        : <OpeningDetail room={room} opening={{ ...window, kind, offset: 0, bottom: 0, color: window.color ?? '#c88f58' }} wall={window.wall} selected={false} locked interactive={false} />}
      {!cleanView && <mesh position={[0, window.height / 2, 0]}><boxGeometry args={[window.width, window.height, 0.16]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
      {!cleanView && (selected || collision || outside) && <group position={selectionFrame.localCenter} rotation={[0, 0, window.rotation]}><SelectionBounds width={window.width} height={window.height} depth={selectionFrame.depth} collision={collision || outside} focused={selected} /></group>}
    </group>
    {!cleanView && selected && !multiple && !locked && view !== 'pov' && <WallObjectGizmo id={window.id} position={position} anchor={selectionFrame.handleBase} height={window.height} locks={movementLocks} />}
  </>
}

export function WorldWallObjects({ room, structurePacks, collisionIds, exportMode, cleanView = exportMode, level, levelHeight, focusedView, frontVisibleWalls, freeVisibleWalls, strictLevel = false }: { room: RoomConfig; structurePacks: StructurePack[]; collisionIds: ReadonlySet<string>; exportMode: boolean; cleanView?: boolean; level: number; levelHeight: number; focusedView: boolean; frontVisibleWalls?: ReadonlySet<string>; freeVisibleWalls?: ReadonlySet<string>; /** Copias de otras plantas en Plano: no incluir la selección de otra planta. */ strictLevel?: boolean }) {
  const hidden = useRoomStore((state) => state.hiddenElementIds)
  const selected = useRoomStore((state) => state.selectedIds)
  const world = { room, structurePacks }
  return <>{worldOpenings(world).filter((opening) => {
    if (hidden.includes(opening.id)) return false
    const supports = openingWallRun(world, opening)
    if (freeVisibleWalls && supports.length && supports.every((wall) => !freeVisibleWalls.has(wall.id))) return false
    if (frontVisibleWalls && !opening.object.freePosition && supports.length && supports.every((wall) => !frontVisibleWalls.has(wall.id))) return false
    if (!freeVisibleWalls && supports.length && supports.every((wall) => hidden.includes(wall.id) || !!wall.packId && hidden.includes(wall.packId))) return false
    if (!supports.length && opening.packId && hidden.includes(opening.packId)) return false
    const position = opening.position
    return !focusedView || (!cleanView && !strictLevel && selected.includes(opening.id)) || position.y + opening.height > level - 0.01 && position.y < level + levelHeight
  }).map((opening) => {
    const pack = structurePacks.find((pack) => pack.id === opening.packId)
    const window: WindowConfig = { ...opening.object, id: opening.id, shape: opening.shape ?? 'rectangular', sill: 'sill' in opening.object ? Number(opening.object.sill) : 0 }
    return <WorldWallObject key={opening.id} room={room} packs={structurePacks} window={window} pack={pack} kind={opening.kind} collision={collisionIds.has(opening.id) || !openingHasSupport(world, opening)} exportMode={exportMode} cleanView={cleanView} />
  })}</>
}
