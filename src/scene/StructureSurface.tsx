import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import type { RoomConfig, StructureSurface } from '../domain/types'
import { useRoomStore } from '../state/useRoomStore'
import { structureGridElementId, structureSurfaceElementId } from '../domain/elementIds'
import { FloorGrid } from './FloorGrid'
import { WallGrid } from './WallGrid'
import { recordSceneInteraction, selectSceneObject } from './sceneInteraction'
import { StructureSurfaceTransformGizmo } from './StructureSurfaceGizmo'
import { SelectionBounds } from './SelectionBounds'
import { independentSurfaceHasSpatialWarning } from '../domain/structureCollisions'
import { structureDoorOpenings } from '../domain/structureDoors'
import { WallBody } from './Walls'
import { OpeningDetail } from './Openings'
import { surfacePosition } from '../domain/roomEditing'
import { useHistoryGesture } from '../state/useHistoryGesture'
import { releasePointer, usePointerCancellation } from './usePointerCancellation'
import { cameraAwareShiftDrag } from './cameraAwareShiftDrag'
import { moveFromOrigin } from '../domain/measurements'

export function StructureSurfaceObject({
  room,
  packId,
  packName,
  surface,
  hidden,
  selected,
  outlined,
  locked,
  showGrid,
  showCollision = true,
  colliding = false,
  collisionIds,
  onSelect,
}: {
  room: RoomConfig
  packName: string
  surface: StructureSurface
  hidden: boolean
  selected: boolean
  outlined: boolean
  locked: boolean
  showGrid: boolean
  showCollision?: boolean
  colliding?: boolean
  collisionIds: ReadonlySet<string>
  onSelect: () => void
  packId: string
}) {
  const wall = surface.wall ?? 'north'
  const position = structureSurfacePosition(room, surface)
  const baseRotation = wall === 'north' ? 0 : wall === 'east' ? -Math.PI / 2 : wall === 'south' ? Math.PI : Math.PI / 2
  const moveStructureSurface = useRoomStore((state) => state.moveStructureSurface)
  const setStructureSurfaceRotation = useRoomStore((state) => state.setStructureSurfaceRotation)
  const surfaceId = structureSurfaceElementId(packId, surface.id)
  const gridHidden = useRoomStore((state) => state.hiddenElementIds.includes(structureGridElementId(packId, surface.id)))
  const spatialWarning = useRoomStore((state) => showCollision && independentSurfaceHasSpatialWarning(state, surfaceId))
  const collision = spatialWarning || colliding
  const pack = useRoomStore((state) => state.structurePacks.find((candidate) => candidate.id === packId))
  const selectedId = useRoomStore((state) => state.selectedId)
  const hiddenIds = useRoomStore((state) => state.hiddenElementIds)
  const openings = pack ? structureDoorOpenings(pack, surface) : []
  const isIndependent = packId.startsWith('floor-object-') || packId.startsWith('wall-object-')
  const view = useRoomStore((state) => state.view)
  const { camera, size } = useThree()
  const gesture = useHistoryGesture(surfaceId)
  const groundPlane = useMemo(() => new THREE.Plane(), [])
  const pointerPoint = useMemo(() => new THREE.Vector3(), [])
  const dragStart = useRef<{
    clientX: number; clientY: number
    x: number; y: number; z: number
    worldX: number; worldZ: number
  } | null>(null)
  const cancelDirectDrag = () => {
    if (!dragStart.current) return
    dragStart.current = null
    gesture.cancel()
    document.body.classList.remove('can-grab')
  }
  const captureDirectDrag = usePointerCancellation(cancelDirectDrag)
  const directMove = (event: ThreeEvent<PointerEvent>) => {
    const start = dragStart.current
    if (!start || !gesture.isActive()) return
    event.stopPropagation()
    if (event.nativeEvent.shiftKey || view === 'front') {
      const target = cameraAwareShiftDrag(camera, size, { clientX: start.clientX, clientY: start.clientY, position: { x: start.x, y: start.y, z: start.z } }, event.nativeEvent)
      moveStructureSurface(packId, surface.id, target.axis, moveFromOrigin(target[target.axis], start[target.axis]))
      moveStructureSurface(packId, surface.id, 'y', moveFromOrigin(target.y, start.y))
      return
    }
    if (event.ray.intersectPlane(groundPlane, pointerPoint)) {
      moveStructureSurface(packId, surface.id, 'x', moveFromOrigin(start.x + pointerPoint.x - start.worldX, start.x))
      moveStructureSurface(packId, surface.id, 'z', moveFromOrigin(start.z + pointerPoint.z - start.worldZ, start.z))
    }
  }
  const endDirectDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragStart.current) return
    event.stopPropagation()
    dragStart.current = null
    gesture.commit()
    document.body.classList.remove('can-grab')
    releasePointer(event)
  }
  if (hidden) return null
  const selectSurface = (event: ThreeEvent<PointerEvent>) => {
    if (selected && event.intersections.some(({ object }) => {
      let isGizmo = false
      object.traverseAncestors((ancestor) => { if (ancestor.userData.structureSurfaceGizmo === surfaceId) isGizmo = true })
      return isGizmo
    })) return
    event.stopPropagation()
    const clickedId = event.object.userData.structureSurfaceId
    const clickedSurfaceId = typeof clickedId === 'string' ? clickedId : surfaceId
    const selectedBefore = useRoomStore.getState().selectedId === clickedSurfaceId
    recordSceneInteraction('structure-surface.pointer-down', {
      surfaceId: clickedSurfaceId,
      name: packName,
      kind: surface.kind,
      selectedBefore,
    })
    if (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey || (event.nativeEvent.shiftKey && !isIndependent)) {
      selectSceneObject(clickedSurfaceId, event.nativeEvent)
      return
    }
    if (!selectedBefore) onSelect()
    if (!isIndependent || locked || (event.nativeEvent.button !== 0 && event.nativeEvent.pointerType !== 'touch')) return
    const worldY = (pack?.y ?? 0) + position[1]
    groundPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, worldY, 0))
    const hasIntersection = event.ray.intersectPlane(groundPlane, pointerPoint) !== null
    if (!hasIntersection && view !== 'front' && !event.nativeEvent.shiftKey) return
    dragStart.current = {
      clientX: event.nativeEvent.clientX,
      clientY: event.nativeEvent.clientY,
      x: surface.x, y: surface.y, z: surface.z,
      worldX: hasIntersection ? pointerPoint.x : (pack?.x ?? 0) + position[0],
      worldZ: hasIntersection ? pointerPoint.z : (pack?.z ?? 0) + position[2],
    }
    gesture.begin()
    document.body.classList.add('can-grab')
    captureDirectDrag(event)
  }
  return (
    <group onPointerMove={directMove} onPointerUp={endDirectDrag} onPointerCancel={cancelDirectDrag}>
      {openings.length ? <group position={position} rotation={[0, baseRotation + surface.rotation, 0]}>
        <group position={[0, -surface.height / 2, 0]}>
          <WallBody length={surface.width} height={surface.height} openings={openings} color={surface.color} depth={surface.depth} onPointerDown={selectSurface} />
          {openings.filter((opening) => !hiddenIds.includes(opening.id)).map((opening) => <group key={opening.id}>
            <OpeningDetail room={room} wall={wall} opening={opening} selected={false} locked />
            {showCollision && (selectedId === opening.id || collisionIds.has(opening.id)) && <group position={[opening.offset, opening.height / 2, 0]}><SelectionBounds width={opening.width} height={opening.height} depth={surface.depth + 0.08} collision={collisionIds.has(opening.id)} /></group>}
          </group>)}
        </group>
      </group> : <mesh
        position={position}
        rotation={surface.kind === 'wall' ? [0, baseRotation + surface.rotation, 0] : [0, 0, 0]}
        userData={{ structureSurfaceId: surfaceId }}
        onPointerDown={selectSurface}
      >
        <boxGeometry args={[surface.width, surface.height, surface.depth]} />
        <meshStandardMaterial
          color={surface.color}
          emissive={selected ? '#dba771' : '#000000'}
          emissiveIntensity={selected ? 0.14 : 0}
          roughness={0.9}
        />
      </mesh>}
      {(outlined || collision) && <group position={position} rotation={surface.kind === 'wall' ? [0, baseRotation + surface.rotation, 0] : [0, 0, 0]}>
        <SelectionBounds width={surface.width} height={surface.height} depth={surface.depth} collision={collision} />
      </group>}
      {showGrid && !gridHidden && (surface.kind === 'floor' ? (
        <group position={[position[0], position[1] + surface.height / 2 - 0.04, position[2]]}>
          <FloorGrid room={{ ...room, width: surface.width, depth: surface.depth }} visible />
        </group>
      ) : surface.kind === 'wall' ? (
        <group position={position} rotation={[0, baseRotation + surface.rotation, 0]}>
          {[0, Math.PI].map((rotation) => <group key={rotation} rotation={[0, rotation, 0]} position={[0, -surface.height / 2, 0]}>
            <group position={[0, 0, surface.depth / 2 - 0.06]}><WallGrid length={surface.width} height={surface.height} openings={rotation ? openings.map((opening) => ({ ...opening, offset: -opening.offset })) : openings} /></group>
          </group>)}
        </group>
      ) : null)}
      {selected && !locked && (
        <StructureSurfaceTransformGizmo
          packId={packId}
          name={packName}
          surface={surface}
          position={position}
          move={moveStructureSurface}
          rotate={setStructureSurfaceRotation}
        />
      )}
    </group>
  )
}

export function StructureDoorPlan({ room, packId, surface, collisionIds }: { room: RoomConfig; packId: string; surface: StructureSurface; collisionIds: ReadonlySet<string> }) {
  const pack = useRoomStore((state) => state.structurePacks.find((candidate) => candidate.id === packId))
  const selectedId = useRoomStore((state) => state.selectedId)
  const hiddenIds = useRoomStore((state) => state.hiddenElementIds)
  if (!pack || surface.kind !== 'wall' || !surface.wall) return null
  const [x, y, z] = surfacePosition(room, surface)
  const angle = { north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 }[surface.wall] + surface.rotation
  return <group position={[x, y - surface.height / 2 + 0.05, z]} rotation={[0, angle, 0]}>
    {structureDoorOpenings(pack, surface).filter((door) => !hiddenIds.includes(door.id)).map((door) => <group key={door.id} position={[door.offset, 0, 0]}>
      <mesh onPointerDown={(event) => { event.stopPropagation(); selectSceneObject(door.id, event.nativeEvent) }}>
        <boxGeometry args={[door.width, 0.06, surface.depth + 0.08]} /><meshBasicMaterial color={selectedId === door.id ? '#ea6f4c' : '#e9895b'} />
      </mesh>
      {collisionIds.has(door.id) && <SelectionBounds width={door.width} height={0.08} depth={surface.depth + 0.08} collision />}
    </group>)}
  </group>
}

function structureSurfacePosition(room: RoomConfig, surface: StructureSurface): [number, number, number] {
  if (surface.kind !== 'wall') {
    return [surface.x, (surface.kind === 'ceiling' ? room.height : 0) + surface.y, surface.z]
  }
  const wall = surface.wall ?? 'north'
  if (wall === 'north') return [surface.x, room.height / 2 + surface.y, -room.depth / 2 + surface.z]
  if (wall === 'south') return [surface.x, room.height / 2 + surface.y, room.depth / 2 + surface.z]
  if (wall === 'east') return [room.width / 2 + surface.x, room.height / 2 + surface.y, surface.z]
  return [-room.width / 2 + surface.x, room.height / 2 + surface.y, surface.z]
}
