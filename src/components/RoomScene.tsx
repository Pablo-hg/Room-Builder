import { Canvas, events } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { WALL_SIDES } from '../domain/constants'
import { useRoomStore } from '../state/useRoomStore'
import { OverlapFocus } from '../scene/OverlapFocus'
import { MarqueeSelection } from '../scene/MarqueeSelection'
import { OrbitPointerController } from '../scene/OrbitPointerController'
export { FreeCameraCompass3D, RoomCompass3D } from '../scene/Compass'
import { SceneExportController } from '../scene/SceneExportController'
import { CameraRig } from '../scene/CameraRig'
import type { SceneProps } from '../scene/types'
import { wallVisibility } from '../scene/wallVisibility'
import { SoftWall } from '../scene/Walls'
import { RoomShell, StudioLight, WallIdentityLabel } from '../scene/RoomShell'
import { RoomNameLabel } from '../scene/RoomNameLabel'
import { CatalogDropController } from '../scene/CatalogDropController'
import { PaintTool } from '../scene/PaintTool'
import { recordSceneInteraction } from '../scene/sceneInteraction'
import { FurnitureObject } from '../scene/FurnitureObject'
import { StructureSurfaceObject } from '../scene/StructureSurface'
import { MultiFurnitureGizmo } from '../scene/MultiFurnitureGizmo'
import { multiSelectionItems } from '../domain/multiSelection'
import { prioritizeTransformControls } from '../scene/interactionPriority'
import { FreeCameraKeyboard } from '../scene/FreeCameraKeyboard'
import { baseWallId, folderSelectionId, ROOT_ROOM_FOLDER } from '../domain/elementFolders'
import { packRoomBox, worldRoomBoxes } from '../domain/roomEditing'
import { roomLabelAnchor, roomLabelHeight } from '../domain/roomLabelAnchor'
import { WorldWallObjects } from '../scene/WorldWallObjects'
import { physicalWalls } from '../domain/wallConnections'
import { wallUnionFaces } from '../domain/wallSolidGeometry'
import { planWallStrips } from '../scene/planWallGeometry'
import { PlanWallLines } from '../scene/PlanWallLines'
import { PlanDimensions } from '../scene/PlanDimensions'
import { MeasureEditor, MeasureTool, PlanMeasures } from '../scene/PlanMeasures'
import { DragGuidesOverlay } from '../scene/DragGuidesOverlay'
import { PlanFloorSheet } from '../scene/PlanFloorSheet'
import { planFloorGroups, planSheetPlacements } from '../scene/planSheet'
import { roundFloorLevel } from '../domain/floorLevels'
import { PlanPanSurface } from '../scene/PlanPanSurface'
import { PlanWheelPan } from '../scene/PlanWheelPan'
import { automatedBrowser } from '../scene/renderQuality'
import { planRoomDimensions } from '../domain/planDimensions'
import { planOpeningDimensions } from '../domain/planDimensionDetails'
import { PlanFurnitureDistances } from '../scene/PlanMeasures'
import { PhotoCaptureController, type PhotoCapture } from '../scene/PhotoCapture'
import type { FreeVisibilityOverrides } from './editor/FreeVisibility'
import { BASE_FLOOR_ID } from '../domain/elementFolders'

type PhotoSceneOptions = {
  background: string
  annotations: boolean
  captureRef: RefObject<PhotoCapture | null>
}

function RoomWorld({ modelRootRef, photo, freeVisibility, freeLabelsVisible, ...props }: SceneProps & { modelRootRef: RefObject<THREE.Group | null>; collisionIds: ReadonlySet<string>; photo?: PhotoSceneOptions; freeVisibility: FreeVisibilityOverrides; freeLabelsVisible: boolean }) {
  const cleanView = props.exportMode || !!photo
  const showLabels = !props.exportMode && (!photo || photo.annotations)
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
  const showFreeLabels = props.view !== 'free' || freeLabelsVisible
  const visibleInFree = (id: string, fallback: boolean) => props.view === 'free' && !cleanView ? freeVisibility[id] ?? fallback : fallback
  const renderedPacks = props.structurePacks.filter((pack) => !focusedView || (pack.id.startsWith('floor-pack-') ? Math.abs(pack.y - level) < 0.01 : pack.surfaces.some((surface) => { const y = pack.y + surface.y + (surface.kind === 'wall' ? props.room.height / 2 : surface.kind === 'ceiling' ? props.room.height : 0); return y >= level - 0.01 && y < level + props.room.height })))
  const packVisible = (pack: typeof renderedPacks[number]) => !hiddenElementIds.includes(pack.id) || (props.view === 'free' && !cleanView && pack.surfaces.some((surface) => freeVisibility[`structure-surface:${pack.id}:${surface.id}`] === true))
  const renderedPackIds = new Set(renderedPacks.filter(packVisible).map((pack) => pack.id))
  const wallFrames = physicalWalls({ room: props.room, structurePacks: props.structurePacks })
  const visibleWallIds = new Set(wallFrames.filter((wall) => {
    if (!wall.packId) return showBase && visibleInFree(wall.id, !hiddenElementIds.includes(wall.id) && !hidden.includes(wall.side))
    if (!renderedPackIds.has(wall.packId)) return false
    const independent = wall.packId.startsWith('floor-object-') || wall.packId.startsWith('wall-object-')
    return visibleInFree(wall.id, !hiddenElementIds.includes(wall.packId) && !hiddenElementIds.includes(wall.id) && (independent || !hidden.includes(wall.side)))
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
  // Hoja de plantas: solo en Plano y con más de una planta. La planta
  // enfocada se edita en su sitio real; las demás son copias desplazadas.
  const planSheet = useMemo(() => {
    if (props.view !== 'top' || cleanView || !focusedView) return null
    const groups = planFloorGroups(props.room, props.structurePacks)
    if (groups.length < 2) return null
    const focusedKey = activeRoom ? roundFloorLevel(activeRoom.y) : 0
    return { groups, focusedKey, placements: planSheetPlacements(groups, focusedKey, props.orientation) }
  }, [props.view, cleanView, focusedView, props.room, props.structurePacks, activeRoom, props.orientation])
  // «Plano detallado»: capa visual sobre el mismo plano, nunca en exportación
  // ni fuera de Plano. Acota las paredes visibles en el Plano de todas las
  // habitaciones (raíz y adicionales); las paredes independientes no.
  const planDetailsVisible = useRoomStore((state) => state.planDetailsVisible)
  const planDetailCategories = useRoomStore((state) => state.planDetailCategories)
  const planDetailsOn = (photo ? photo.annotations : planDetailsVisible) && props.view === 'top' && !props.exportMode
  // Cada categoría se filtra por separado; con «Paredes» apagado, vuelven las etiquetas normales de pared.
  const showPlanDimensions = planDetailsOn && (!!photo || planDetailCategories.walls)
  const showOpeningChains = planDetailsOn && (!!photo || planDetailCategories.openings)
  const lengthUnit = useRoomStore((state) => state.lengthUnit)
  const openingChains = useMemo(() => showOpeningChains
    ? planOpeningDimensions({ room: props.room, structurePacks: props.structurePacks }, (wall) => planVisibleWallIds.has(wall.id))
    : [], [showOpeningChains, props.room, props.structurePacks, planSignature, lengthUnit])
  const planDimensions = useMemo(() => showPlanDimensions
    ? planRoomDimensions({ room: props.room, structurePacks: props.structurePacks }, (wall) => planVisibleWallIds.has(wall.id))
    : [], [showPlanDimensions, props.room, props.structurePacks, planSignature, lengthUnit])
  // Con detalles, la letra «PARED X» se desplaza por detrás de su cota.
  const baseWallLabels = showBase && !activeRoom && showLabels && props.view !== 'free'
    ? labeledWalls.filter((wall) => !hiddenElementIds.includes(baseWallId(wall)))
    : []
  const activeRoomWallLabelIds = activeRoom && showLabels && props.view !== 'free'
    ? activeRoom.surfaces.filter((surface) => surface.kind === 'wall' && surface.wall && labeledWalls.includes(surface.wall))
      .map((surface) => `structure-surface:${activeRoom.id}:${surface.id}`).filter((id) => !hiddenElementIds.includes(id))
    : []
  const planDimensionWallLabels = new Set(showPlanDimensions ? [...baseWallLabels.map(baseWallId), ...activeRoomWallLabelIds] : [])

  return (
    <>
      <CameraRig room={cameraRoom} view={props.view} orientation={props.orientation} isoAngle={props.isoAngle} isIsoOrbitDragging={props.isIsoOrbitDragging} freeAzimuth={props.freeAzimuth} freeElevation={props.freeElevation} isFreeOrbitDragging={props.isFreeOrbitDragging} cameraZoom={props.cameraZoom} wallView={props.wallView} frontCameraHeight={props.frontCameraHeight} povYaw={props.povYaw} instant={!!photo} planPadding={photo?.annotations ? 3.8 : undefined} />
      <color attach="background" args={[photo?.background ?? '#e8dfd3']} />
      <ambientLight intensity={1.35} />
      <StudioLight room={props.room} />
      <hemisphereLight args={['#ddecf0', '#bd9170', 0.75]} />

      <RoomShell room={props.room} modelRootRef={modelRootRef} showBase={showBase} showSelection={!cleanView} floorVisible={props.view === 'free' && !cleanView ? freeVisibility[BASE_FLOOR_ID] : undefined} showFloorGrid={!cleanView && props.gridVisibility.floor}>
        {showBase && WALL_SIDES.map((wall) => (
          <SoftWall
            key={wall}
            room={props.room}
            wall={wall}
            skinFaces={wallSkins.get(baseWallId(wall)) ?? []}
            hidden={!visibleInFree(baseWallId(wall), !hidden.includes(wall) && !hiddenElementIds.includes(baseWallId(wall)))}
            showOpeningDetails={props.exportMode || props.view !== 'top'}
            showGrid={!cleanView && (props.view === 'free' || gridWalls.includes(wall)) && props.gridVisibility[wall]}
            exportMode={cleanView}
            groupSelected={groupSelected}
            collisionIds={props.collisionIds}
          />
        ))}
        {!showPlanDimensions && baseWallLabels.map((wall) => wallFrames.find((frame) => frame.id === baseWallId(wall))).filter((frame) => frame !== undefined).map((frame) => <WallIdentityLabel key={`base-label-${frame.id}`} frame={frame} view={props.view} />)}
        {renderedPacks.map((pack) => (
          <group key={pack.id} position={[pack.x, pack.y, pack.z]} visible={packVisible(pack)}>
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
                  hidden={!visibleInFree(surfaceId, !hiddenElementIds.includes(pack.id) && !hiddenElementIds.includes(surfaceId) && !(!independentSurface && surface.kind === 'wall' && surface.wall !== undefined && hidden.includes(surface.wall)))}
                  selected={!cleanView && selectedId === surfaceId}
                  outlined={!cleanView && !groupSelected && selectedIds.includes(surfaceId)}
                  locked={lockedElementIds.includes(surfaceId)}
                  showGrid={!cleanView && (independentSurface || pack.id.startsWith('floor-pack-'))}
                  showCollision={!cleanView}
                  colliding={!cleanView && props.collisionIds.has(surfaceId)}
                  collisionIds={props.collisionIds}
                  onSelect={() => selectElement(surfaceId)}
                />
                </group>
              )
            })}
          </group>
        ))}
        {props.view === 'top' && !props.exportMode && <PlanWallLines strips={planStrips} />}
        <WorldWallObjects room={props.room} structurePacks={props.structurePacks} collisionIds={props.collisionIds} exportMode={props.exportMode} cleanView={cleanView} level={level} levelHeight={levelHeight} focusedView={focusedView} frontVisibleWalls={props.view === 'front' && !props.exportMode ? visibleWallIds : undefined} freeVisibleWalls={props.view === 'free' && !cleanView ? visibleWallIds : undefined} />
        {props.furniture.filter((item) => !hiddenElementIds.includes(item.id) && (!focusedView || (item.y >= level - 0.01 && item.y < level + levelHeight))).map((item) => (
          <FurnitureObject
            key={item.id}
            item={item}
            selected={!cleanView && item.id === selectedId}
            outlined={!cleanView && !groupSelected && selectedIds.includes(item.id)}
            canDrag={!photo && props.view !== 'pov' && !lockedElementIds.includes(item.id)}
            planView={props.view === 'top'}
            showCollision={!cleanView}
            colliding={!cleanView && props.collisionIds.has(item.id)}
            frontWall={props.view === 'front' ? props.wallView ?? 'north' : null}
          />
        ))}
        {!cleanView && groupSelected && <MultiFurnitureGizmo items={multiItems} locked={[...selectedIds, ...multiItems.map((item) => item.id)].some((id) => lockedElementIds.includes(id))} view={props.view} wall={props.wallView} />}
      </RoomShell>
      {!cleanView && !showPlanDimensions && activeRoomWallLabelIds.map((id) => wallFrames.find((frame) => frame.id === id)).filter((frame) => frame !== undefined).map((frame) => <WallIdentityLabel key={`pack-label-${frame.id}`} frame={frame} view={props.view} />)}
      {!cleanView && props.view === 'free' && showFreeLabels && wallFrames.filter((frame) => visibleWallIds.has(frame.id) && (!frame.packId || frame.packId.startsWith('floor-pack-'))).map((frame) => <WallIdentityLabel key={`free-label-${frame.id}`} frame={frame} view={props.view} />)}
      {!cleanView && showFreeLabels && showBase && folders.filter((folder) => folder.id === ROOT_ROOM_FOLDER).map((folder) => {
        // Con otra habitación encima, el nombre va en su propio suelo (ver roomLabelAnchor).
        const rootBox = { x: 0, y: 0, z: 0, width: props.room.width, depth: props.room.depth, height: props.room.height }
        const boxes = worldRoomBoxes(props.room, props.structurePacks)
        return <RoomNameLabel key={folder.id} folderId={folder.id} name={folder.name} position={[0, roomLabelHeight(rootBox, boxes), 0]} extent={props.room} anchor={roomLabelAnchor(rootBox, boxes)} />
      })}
      {!cleanView && showFreeLabels && renderedPacks.filter((pack) => pack.id.startsWith('floor-pack-') && packVisible(pack)).map((pack) => {
        const box = packRoomBox(pack, props.room)
        const folder = folders.find((item) => item.id === assignments[pack.id])
        if (!box || !folder) return null
        const worldBox = { x: pack.x + box.x, y: pack.y + box.y, z: pack.z + box.z, width: box.width, depth: box.depth, height: box.height }
        const boxes = worldRoomBoxes(props.room, props.structurePacks)
        return <RoomNameLabel key={folder.id} folderId={folder.id} name={folder.name} position={[worldBox.x, roomLabelHeight(worldBox, boxes), worldBox.z]} extent={box} anchor={roomLabelAnchor(worldBox, boxes)} />
      })}
      {/* Plano: el fondo vacío también permite desplazar la vista. */}
      {props.view === 'top' && !cleanView && <PlanPanSurface y={level - 1} />}
      {props.view === 'top' && !cleanView && <PlanWheelPan />}
      {!cleanView && <CatalogDropController />}
      {!cleanView && <PaintTool />}
      {/* Plano: las demás plantas se dibujan a izquierda y derecha, como en una lámina de arquitectura. */}
      {planSheet && <PlanFloorSheet groups={planSheet.groups} placements={planSheet.placements} focusedKey={planSheet.focusedKey} room={props.room} structurePacks={props.structurePacks} furniture={props.furniture} orientation={props.orientation} />}
      {props.view === 'top' && (!cleanView || photo?.annotations) && <PlanMeasures y={level + levelHeight + 0.06} photo={!!photo} />}
      {props.view === 'top' && !cleanView && <MeasureEditor y={level + levelHeight + 0.06} planeY={level + levelHeight + 3} />}
      {props.view === 'top' && !cleanView && <MeasureTool y={level + levelHeight + 0.06} planeY={level + levelHeight + 3} />}
      {showOpeningChains && <PlanDimensions dimensions={openingChains} y={level + levelHeight + 0.05} wallLabels={noWallLabels} />}
      {!photo && planDetailsOn && planDetailCategories.furniture && <PlanFurnitureDistances y={level + levelHeight + 0.07} />}
      {!cleanView && <DragGuidesOverlay y={level + 0.04} />}
      {showPlanDimensions && <PlanDimensions dimensions={planDimensions} y={level + levelHeight + 0.05} wallLabels={planDimensionWallLabels} />}
    </>
  )
}

const noWallLabels: ReadonlySet<string> = new Set()

export default function RoomScene(props: SceneProps & { collisionIds: ReadonlySet<string>; onRightAreaHeld: (held: boolean) => void; photo?: PhotoSceneOptions; freeVisibility: FreeVisibilityOverrides; freeLabelsVisible: boolean }) {
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
      shadows={!automatedBrowser}
      events={(store) => ({ ...events(store), filter: prioritizeTransformControls })}
      dpr={[1, 1.7]}
      style={props.photo ? { pointerEvents: 'none' } : undefined}
      gl={{ antialias: !automatedBrowser, toneMapping: THREE.ACESFilmicToneMapping }}
      onPointerMissed={props.photo ? undefined : (event) => {
        recordSceneInteraction('pointer-missed', {
          target: event.target instanceof Element ? event.target.tagName.toLowerCase() : 'canvas',
          x: Math.round(event.clientX),
          y: Math.round(event.clientY),
        })
        selectElement(null)
      }}
    >
      <RoomWorld {...props} modelRootRef={modelRootRef} />
      <MarqueeSelection enabled={!props.exportMode && !props.photo} onRightHeld={props.onRightAreaHeld} />
      <OverlapFocus enabled={!props.exportMode && !props.photo} />
      <OrbitPointerController view={!props.photo && (props.view === 'isometric' || props.view === 'free') ? props.view : null} />
      <FreeCameraKeyboard active={props.view === 'free' && !props.exportMode && !props.photo} />
      {props.photo && <PhotoCaptureController captureRef={props.photo.captureRef} view={props.view} />}
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
