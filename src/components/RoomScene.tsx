import { Canvas, events } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { WALL_SIDES } from '../domain/constants'
import { useRoomStore } from '../state/useRoomStore'
import { OrbitPointerController } from '../scene/OrbitPointerController'
export { FreeCameraCompass3D, RoomCompass3D } from '../scene/Compass'
import { SceneExportController } from '../scene/SceneExportController'
import { CameraRig } from '../scene/CameraRig'
import type { SceneProps } from '../scene/types'
import { wallVisibility } from '../scene/wallVisibility'
import { SoftWall } from '../scene/Walls'
import { RoomShell, StudioLight, WallIdentityLabel } from '../scene/RoomShell'
import { recordSceneInteraction } from '../scene/sceneInteraction'
import { FurnitureObject } from '../scene/FurnitureObject'
import { StructureSurfaceObject } from '../scene/StructureSurface'
import { MultiFurnitureGizmo } from '../scene/MultiFurnitureGizmo'
import { multiSelectionItems } from '../domain/multiSelection'
import { prioritizeTransformControls } from '../scene/interactionPriority'
import { FreeCameraKeyboard } from '../scene/FreeCameraKeyboard'
import { baseWallId, folderSelectionId, ROOT_ROOM_FOLDER } from '../domain/elementFolders'
import { packRoomBox } from '../domain/roomEditing'
import { WorldWallObjects } from '../scene/WorldWallObjects'
import { physicalWalls } from '../domain/wallConnections'
import { wallUnionFaces } from '../domain/wallSolidGeometry'
import { planWallStrips } from '../scene/planWallGeometry'
import { PlanWallLines } from '../scene/PlanWallLines'

function RoomWorld({ modelRootRef, ...props }: SceneProps & { modelRootRef: RefObject<THREE.Group | null>; collisionIds: ReadonlySet<string> }) {
  const selectedId = useRoomStore((state) => state.selectedId)
  const selectedIds = useRoomStore((state) => state.selectedIds)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const lockedElementIds = useRoomStore((state) => state.lockedElementIds)
  const selectElement = useRoomStore((state) => state.selectElement)
  const folders = useRoomStore((state) => state.elementFolders)
  const assignments = useRoomStore((state) => state.elementFolderAssignments)
  const activeRoomId = useRoomStore((state) => state.activeRoomId)
  const activeRoom = props.structurePacks.find((pack) => pack.id === activeRoomId && pack.id.startsWith('floor-pack-'))
  const activeBox = activeRoom && packRoomBox(activeRoom, props.room)
  const focusedView = !props.exportMode && props.structurePacks.some((pack) => pack.id.startsWith('floor-pack-')) && (props.view === 'top' || props.view === 'pov')
  const level = (activeRoom?.y ?? 0) + (activeBox?.y ?? 0)
  const levelHeight = activeBox?.height ?? props.room.height
  const showBase = !focusedView || Math.abs(level) < 0.01
  const multiItems = multiSelectionItems({ room: props.room, furniture: props.furniture, structurePacks: props.structurePacks, elementFolders: folders, elementFolderAssignments: assignments, selectedIds }).filter((item) => !focusedView || (item.min.y >= level - 0.15 && item.min.y < level + levelHeight))
  const groupSelected = !(selectedIds.length === 1 && selectedIds[0] === folderSelectionId(ROOT_ROOM_FOLDER)) && multiItems.length > 1 && (selectedIds.length > 1 || selectedIds.some((id) => id.startsWith('folder:')))
  const cameraRoom = {
    ...props.room,
    ...(activeBox ? { width: activeBox.width, depth: activeBox.depth } : {}),
    height: focusedView || props.view === 'front' ? activeBox?.height ?? props.room.height : Math.max(props.room.height, ...props.structurePacks.filter((pack) => pack.id.startsWith('floor-pack-')).map((pack) => pack.y + (packRoomBox(pack, props.room)?.height ?? props.room.height))),
  }
  const { hidden, labeledWalls, gridWalls } = wallVisibility(props)
  const renderedPacks = props.structurePacks.filter((pack) => !focusedView || (pack.id.startsWith('floor-pack-') ? Math.abs(pack.y - level) < 0.01 : pack.surfaces.some((surface) => { const y = pack.y + surface.y + (surface.kind === 'wall' ? props.room.height / 2 : surface.kind === 'ceiling' ? props.room.height : 0); return y >= level - 0.01 && y < level + props.room.height })))
  const renderedPackIds = new Set(renderedPacks.filter((pack) => !hiddenElementIds.includes(pack.id)).map((pack) => pack.id))
  const visibleWallIds = new Set(physicalWalls({ room: props.room, structurePacks: props.structurePacks }).filter((wall) => {
    if (hiddenElementIds.includes(wall.id)) return false
    if (!wall.packId) return showBase && !hidden.includes(wall.side)
    if (!renderedPackIds.has(wall.packId)) return false
    const independent = wall.packId.startsWith('floor-object-') || wall.packId.startsWith('wall-object-')
    return independent || !hidden.includes(wall.side)
  }).map((wall) => wall.id))
  const visibleSignature = JSON.stringify([...visibleWallIds].sort())
  const wallSkins = useMemo(() => wallUnionFaces({ room: props.room, structurePacks: props.structurePacks }, visibleWallIds), [props.room, props.structurePacks, visibleSignature])
  // In top view the 3D walls are intentionally hidden. Their plan traces
  // must therefore use physical visibility, not wallVisibility.hidden.
  const planVisibleWallIds = new Set(physicalWalls({ room: props.room, structurePacks: props.structurePacks }).filter((wall) => {
    if (hiddenElementIds.includes(wall.id)) return false
    return wall.packId ? renderedPackIds.has(wall.packId) : showBase
  }).map((wall) => wall.id))
  const planSignature = JSON.stringify([...planVisibleWallIds].sort())
  const planStrips = useMemo(() => props.view === 'top' && !props.exportMode
    ? planWallStrips({ room: props.room, structurePacks: props.structurePacks }, planVisibleWallIds)
    : [], [props.room, props.structurePacks, props.view, props.exportMode, planSignature])

  return (
    <>
      <CameraRig room={cameraRoom} view={props.view} orientation={props.orientation} isoAngle={props.isoAngle} isIsoOrbitDragging={props.isIsoOrbitDragging} freeAzimuth={props.freeAzimuth} freeElevation={props.freeElevation} isFreeOrbitDragging={props.isFreeOrbitDragging} cameraZoom={props.cameraZoom} wallView={props.wallView} frontCameraHeight={props.frontCameraHeight} povYaw={props.povYaw} />
      <color attach="background" args={['#e8dfd3']} />
      <ambientLight intensity={1.35} />
      <StudioLight room={props.room} />
      <hemisphereLight args={['#ddecf0', '#bd9170', 0.75]} />

      <RoomShell room={props.room} modelRootRef={modelRootRef} showBase={showBase} showSelection={!props.exportMode} showFloorGrid={!props.exportMode && props.gridVisibility.floor}>
        {showBase && WALL_SIDES.map((wall) => (
          <SoftWall
            key={wall}
            room={props.room}
            wall={wall}
            skinFaces={wallSkins.get(baseWallId(wall)) ?? []}
            hidden={hidden.includes(wall) || hiddenElementIds.includes(baseWallId(wall))}
            showOpeningDetails={props.exportMode || props.view !== 'top'}
            showGrid={gridWalls.includes(wall) && props.gridVisibility[wall]}
            exportMode={props.exportMode}
            groupSelected={groupSelected}
            collisionIds={props.collisionIds}
          />
        ))}
        {showBase && !activeRoom && !props.exportMode && labeledWalls.filter((wall) => !hiddenElementIds.includes(baseWallId(wall))).map((wall) => <WallIdentityLabel key={`base-label-${wall}`} room={props.room} wall={wall} view={props.view} wallView={props.wallView} />)}
        {renderedPacks.map((pack) => (
          <group key={pack.id} position={[pack.x, pack.y, pack.z]} visible={!hiddenElementIds.includes(pack.id)}>
            {pack.surfaces.map((surface) => {
              const surfaceId = `structure-surface:${pack.id}:${surface.id}`
              const independentSurface = pack.id.startsWith('floor-object-') || pack.id.startsWith('wall-object-')
              return (
                <group key={surface.id}>
                <StructureSurfaceObject
                  room={props.room}
                  packId={pack.id}
                  packName={pack.name}
                  surface={surface}
                  skinFaces={wallSkins.get(surfaceId) ?? []}
                  hidden={hiddenElementIds.includes(surfaceId) || (!independentSurface && surface.kind === 'wall' && surface.wall !== undefined && hidden.includes(surface.wall))}
                  selected={!props.exportMode && selectedId === surfaceId}
                  outlined={!props.exportMode && !groupSelected && selectedIds.includes(surfaceId)}
                  locked={lockedElementIds.includes(surfaceId)}
                  showGrid={!props.exportMode && (independentSurface || pack.id.startsWith('floor-pack-'))}
                  showCollision={!props.exportMode}
                  colliding={!props.exportMode && props.collisionIds.has(surfaceId)}
                  collisionIds={props.collisionIds}
                  onSelect={() => selectElement(surfaceId)}
                />
                {pack.id === activeRoom?.id && !props.exportMode && surface.kind === 'wall' && surface.wall && labeledWalls.includes(surface.wall) && !hiddenElementIds.includes(surfaceId) && <group position={[surface.x, surface.y, surface.z]}><WallIdentityLabel room={props.room} wall={surface.wall} view={props.view} wallView={props.wallView} /></group>}
                </group>
              )
            })}
          </group>
        ))}
        {props.view === 'top' && !props.exportMode && <PlanWallLines strips={planStrips} />}
        <WorldWallObjects room={props.room} structurePacks={props.structurePacks} collisionIds={props.collisionIds} exportMode={props.exportMode} level={level} levelHeight={levelHeight} focusedView={focusedView} />
        {props.furniture.filter((item) => !hiddenElementIds.includes(item.id) && (!focusedView || (item.y >= level - 0.01 && item.y < level + levelHeight))).map((item) => (
          <FurnitureObject
            key={item.id}
            item={item}
            selected={!props.exportMode && item.id === selectedId}
            outlined={!props.exportMode && !groupSelected && selectedIds.includes(item.id)}
            canDrag={props.view !== 'pov' && !lockedElementIds.includes(item.id)}
            planView={props.view === 'top'}
            showCollision={!props.exportMode}
            colliding={!props.exportMode && props.collisionIds.has(item.id)}
            frontWall={props.view === 'front' ? props.wallView ?? 'north' : null}
          />
        ))}
        {!props.exportMode && groupSelected && <MultiFurnitureGizmo items={multiItems} locked={[...selectedIds, ...multiItems.map((item) => item.id)].some((id) => lockedElementIds.includes(id))} view={props.view} wall={props.wallView} />}
      </RoomShell>
    </>
  )
}

export default function RoomScene(props: SceneProps & { collisionIds: ReadonlySet<string> }) {
  const perspective = props.view === 'pov' || props.view === 'free'
  const selectElement = useRoomStore((state) => state.selectElement)
  const modelRootRef = useRef<THREE.Group>(null)
  // Sobrevive al cambio de cámara, que vuelve a montar el Canvas.
  const handledExportRequest = useRef(0)
  return (
    <Canvas
      key={perspective ? 'perspective' : 'orthographic'}
      className={props.view === 'isometric' || props.view === 'free' ? 'room-scene-canvas--orbit' : 'room-scene-canvas'}
      orthographic={!perspective}
      camera={perspective ? { fov: 62, near: 0.05, far: 80 } : { near: 0.1, far: 80, zoom: 55 }}
      shadows
      events={(store) => ({ ...events(store), filter: prioritizeTransformControls })}
      dpr={[1, 1.7]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onPointerMissed={(event) => {
        recordSceneInteraction('pointer-missed', {
          target: event.target instanceof Element ? event.target.tagName.toLowerCase() : 'canvas',
          x: Math.round(event.clientX),
          y: Math.round(event.clientY),
        })
        selectElement(null)
      }}
    >
      <RoomWorld {...props} modelRootRef={modelRootRef} />
      <OrbitPointerController view={props.view === 'isometric' || props.view === 'free' ? props.view : null} />
      <FreeCameraKeyboard active={props.view === 'free' && !props.exportMode} />
      <SceneExportController
        modelRootRef={modelRootRef}
        exportRequest={props.exportRequest}
        exportMode={props.exportMode}
        handledRequest={handledExportRequest}
        exportDesignName={props.exportDesignName}
        onExportComplete={props.onExportComplete}
      />
    </Canvas>
  )
}
