import * as THREE from 'three'
import type { RoomConfig, StructureSurface } from '../domain/types'
import { useRoomStore } from '../state/useRoomStore'
import { structureSurfaceElementId } from '../domain/elementIds'
import { recordSceneInteraction } from './sceneInteraction'
import { StructureSurfaceTransformGizmo } from './StructureSurfaceGizmo'

export function StructureSurfaceObject({
  room,
  packId,
  packName,
  surface,
  hidden,
  selected,
  onSelect,
}: {
  room: RoomConfig
  packName: string
  surface: StructureSurface
  hidden: boolean
  selected: boolean
  onSelect: () => void
  packId: string
}) {
  const wall = surface.wall ?? 'north'
  const position = structureSurfacePosition(room, surface)
  const baseRotation = wall === 'north' ? 0 : wall === 'east' ? -Math.PI / 2 : wall === 'south' ? Math.PI : Math.PI / 2
  const moveStructureSurface = useRoomStore((state) => state.moveStructureSurface)
  const setStructureSurfaceRotation = useRoomStore((state) => state.setStructureSurfaceRotation)
  const surfaceId = structureSurfaceElementId(packId, surface.id)
  if (hidden) return null
  const selectSurface = (event: { stopPropagation: () => void; object: THREE.Object3D }) => {
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
    if (!selectedBefore) onSelect()
  }
  return (
    <>
      <mesh
        position={position}
        rotation={surface.kind === 'wall' ? [0, baseRotation + surface.rotation, 0] : [0, 0, 0]}
        userData={{ freeOrbitSurface: true, structureSurfaceId: surfaceId }}
        onPointerDown={selectSurface}
        onClick={selectSurface}
      >
        <boxGeometry args={[surface.width, surface.height, surface.depth]} />
        <meshStandardMaterial
          color={surface.color}
          emissive={selected ? '#dba771' : '#000000'}
          emissiveIntensity={selected ? 0.14 : 0}
          roughness={0.9}
        />
      </mesh>
      {selected && (
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
