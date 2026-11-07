import * as THREE from 'three'
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
  const collision = useRoomStore((state) => showCollision && independentSurfaceHasSpatialWarning(state, surfaceId))
  const pack = useRoomStore((state) => state.structurePacks.find((candidate) => candidate.id === packId))
  const selectedId = useRoomStore((state) => state.selectedId)
  const hiddenIds = useRoomStore((state) => state.hiddenElementIds)
  const openings = pack ? structureDoorOpenings(pack, surface) : []
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
    if (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey || event.nativeEvent.shiftKey) {
      selectSceneObject(clickedSurfaceId, event.nativeEvent)
      return
    }
    if (!selectedBefore) onSelect()
  }
  return (
    <>
      {openings.length ? <group position={position} rotation={[0, baseRotation + surface.rotation, 0]}>
        <group position={[0, -surface.height / 2, 0]}>
          <WallBody length={surface.width} height={surface.height} openings={openings} color={surface.color} depth={surface.depth} onPointerDown={selectSurface} />
          {openings.filter((opening) => !hiddenIds.includes(opening.id)).map((opening) => <group key={opening.id}>
            <OpeningDetail room={room} wall={wall} opening={opening} selected={false} locked />
            {showCollision && selectedId === opening.id && <group position={[opening.offset, opening.height / 2, 0]}><SelectionBounds width={opening.width} height={opening.height} depth={surface.depth + 0.08} /></group>}
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
    </>
  )
}

export function StructureDoorPlan({ room, packId, surface }: { room: RoomConfig; packId: string; surface: StructureSurface }) {
  const pack = useRoomStore((state) => state.structurePacks.find((candidate) => candidate.id === packId))
  const selectedId = useRoomStore((state) => state.selectedId)
  const hiddenIds = useRoomStore((state) => state.hiddenElementIds)
  if (!pack || surface.kind !== 'wall' || !surface.wall) return null
  const [x, y, z] = surfacePosition(room, surface)
  const angle = { north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 }[surface.wall] + surface.rotation
  return <group position={[x, y - surface.height / 2 + 0.05, z]} rotation={[0, angle, 0]}>
    {structureDoorOpenings(pack, surface).filter((door) => !hiddenIds.includes(door.id)).map((door) => <mesh key={door.id} position={[door.offset, 0, 0]} onPointerDown={(event) => { event.stopPropagation(); selectSceneObject(door.id, event.nativeEvent) }}>
      <boxGeometry args={[door.width, 0.06, surface.depth + 0.08]} /><meshBasicMaterial color={selectedId === door.id ? '#ea6f4c' : '#e9895b'} />
    </mesh>)}
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
