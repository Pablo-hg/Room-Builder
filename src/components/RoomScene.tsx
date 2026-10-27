import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { WALL_SIDES } from '../domain/constants'
import { openingsForWall } from '../domain/geometry'
import { useRoomStore } from '../state/useRoomStore'
import { OrbitPointerController } from '../scene/OrbitPointerController'
export { FreeCameraCompass3D, RoomCompass3D } from '../scene/Compass'
import { CameraRig } from '../scene/CameraRig'
import type { SceneProps } from '../scene/types'
import { wallVisibility } from '../scene/wallVisibility'
import { SoftWall } from '../scene/Walls'
import { RoomShell, StudioLight, WallIdentityLabel } from '../scene/RoomShell'
import { recordSceneInteraction } from '../scene/sceneInteraction'
import { PlanOpening } from '../scene/Openings'
import { FurnitureObject } from '../scene/FurnitureObject'
import { StructureSurfaceObject } from '../scene/StructureSurface'

function RoomWorld({ modelRootRef, ...props }: SceneProps & { modelRootRef: RefObject<THREE.Group | null> }) {
  const selectedId = useRoomStore((state) => state.selectedId)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const selectElement = useRoomStore((state) => state.selectElement)
  const cameraRoom = {
    ...props.room,
    height: Math.max(props.room.height, ...props.structurePacks.map((pack) => pack.y + props.room.height)),
  }
  const { hidden, labeledWalls, gridWalls } = wallVisibility(props)

  return (
    <>
      <CameraRig room={cameraRoom} view={props.view} orientation={props.orientation} isoAngle={props.isoAngle} isIsoOrbitDragging={props.isIsoOrbitDragging} freeAzimuth={props.freeAzimuth} freeElevation={props.freeElevation} isFreeOrbitDragging={props.isFreeOrbitDragging} cameraZoom={props.cameraZoom} wallView={props.wallView} frontCameraHeight={props.frontCameraHeight} povYaw={props.povYaw} />
      <color attach="background" args={['#e8dfd3']} />
      <ambientLight intensity={1.35} />
      <StudioLight room={props.room} />
      <hemisphereLight args={['#ddecf0', '#bd9170', 0.75]} />

      <RoomShell room={props.room} modelRootRef={modelRootRef} showFloorGrid={!props.exportMode && props.gridVisibility.floor}>
        {WALL_SIDES.map((wall) => (
          <SoftWall
            key={wall}
            room={props.room}
            wall={wall}
            hidden={hidden.includes(wall)}
            showOpeningDetails={props.exportMode || props.view !== 'top'}
            showGrid={gridWalls.includes(wall) && props.gridVisibility[wall]}
            exportMode={props.exportMode}
          />
        ))}
        {labeledWalls.map((wall) => <WallIdentityLabel key={`label-${wall}`} room={props.room} wall={wall} view={props.view} wallView={props.wallView} />)}
        {props.structurePacks.map((pack) => (
          <group key={pack.id} position={[pack.x, pack.y, pack.z]} visible={!hiddenElementIds.includes(pack.id)}>
            {pack.surfaces.map((surface) => {
              const surfaceId = `structure-surface:${pack.id}:${surface.id}`
              const independentSurface = pack.id.startsWith('floor-object-') || pack.id.startsWith('wall-object-')
              return (
                <StructureSurfaceObject
                  key={surface.id}
                  room={props.room}
                  packId={pack.id}
                  packName={pack.name}
                  surface={surface}
                  hidden={hiddenElementIds.includes(surfaceId) || (!independentSurface && surface.kind === 'wall' && surface.wall !== undefined && hidden.includes(surface.wall))}
                  selected={!props.exportMode && selectedId === surfaceId}
                  onSelect={() => selectElement(surfaceId)}
                />
              )
            })}
          </group>
        ))}
        {!props.exportMode && props.view === 'top' && WALL_SIDES.flatMap((wall) =>
          openingsForWall(props.room, wall)
            .filter((opening) => !hiddenElementIds.includes(opening.id))
            .map((opening) => <PlanOpening key={`${wall}-${opening.id}`} room={props.room} opening={opening} wall={wall} />),
        )}
        {props.furniture.filter((item) => !hiddenElementIds.includes(item.id)).map((item) => (
          <FurnitureObject
            key={item.id}
            item={item}
            selected={!props.exportMode && item.id === selectedId}
            canDrag={props.view !== 'pov'}
            planView={props.view === 'top'}
            frontWall={props.view === 'front' ? props.wallView ?? 'north' : null}
          />
        ))}
      </RoomShell>
    </>
  )
}

export default function RoomScene(props: SceneProps) {
  const perspective = props.view === 'pov' || props.view === 'free'
  const selectElement = useRoomStore((state) => state.selectElement)
  const modelRootRef = useRef<THREE.Group>(null)
  return (
    <Canvas
      key={perspective ? 'perspective' : 'orthographic'}
      className={props.view === 'isometric' || props.view === 'free' ? 'room-scene-canvas--orbit' : 'room-scene-canvas'}
      orthographic={!perspective}
      camera={perspective ? { fov: 62, near: 0.05, far: 80 } : { near: 0.1, far: 80, zoom: 55 }}
      shadows
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
      <SceneExportController
        modelRootRef={modelRootRef}
        exportRequest={props.exportRequest}
        exportDesignName={props.exportDesignName}
        onExportComplete={props.onExportComplete}
      />
    </Canvas>
  )
}

function SceneExportController({
  modelRootRef,
  exportRequest,
  exportDesignName,
  onExportComplete,
}: {
  modelRootRef: RefObject<THREE.Group | null>
  exportRequest: number
  exportDesignName: string
  onExportComplete: (error?: Error) => void
}) {
  useEffect(() => {
    if (exportRequest === 0) return
    const root = modelRootRef.current
    if (!root) {
      onExportComplete(new Error('La escena 3D todavía no está lista.'))
      return
    }

    const exportRoot = root.clone(true)
    exportRoot.visible = true
    exportRoot.updateMatrixWorld(true)
    const removeFromExport: THREE.Object3D[] = []
    exportRoot.traverse((object) => {
      const invisibleHitArea = object instanceof THREE.Mesh
        && (Array.isArray(object.material) ? object.material : [object.material]).some((material) => !material.colorWrite)
      if (
        object instanceof THREE.Line
        || object instanceof THREE.Sprite
        || object instanceof THREE.Camera
        || object instanceof THREE.Light
        || invisibleHitArea
      ) {
        removeFromExport.push(object)
      }
    })
    removeFromExport.forEach((object) => object.parent?.remove(object))

    try {
      new GLTFExporter().parse(
        exportRoot,
        (result) => {
          if (!(result instanceof ArrayBuffer)) {
            onExportComplete(new Error('No se pudo crear el archivo GLB.'))
            return
          }
          const url = URL.createObjectURL(new Blob([result], { type: 'model/gltf-binary' }))
          const link = document.createElement('a')
          link.href = url
          link.download = `${exportDesignName}-${new Date().toISOString().slice(0, 10)}.glb`
          link.click()
          window.setTimeout(() => URL.revokeObjectURL(url), 1000)
          recordSceneInteraction('model.exported', { format: 'glb' })
          onExportComplete()
        },
        (error) => {
          recordSceneInteraction('model.export-failed', {
            message: error instanceof Error ? error.message : 'Error al exportar el modelo 3D.',
          })
          onExportComplete(error instanceof Error ? error : new Error('Error al exportar el modelo 3D.'))
        },
        { binary: true, onlyVisible: true },
      )
    } catch (error) {
      const exportError = error instanceof Error ? error : new Error('Error al exportar el modelo 3D.')
      recordSceneInteraction('model.export-failed', { message: exportError.message })
      onExportComplete(exportError)
    }
  }, [exportDesignName, exportRequest, modelRootRef, onExportComplete])

  return null
}
