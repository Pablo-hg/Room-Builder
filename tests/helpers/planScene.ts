import type { Page } from '@playwright/test'

/** Read the same Vite modules used by the app, without exposing a production test hook. */
export async function readPlanScene(page: Page) {
  return page.evaluate(async () => {
    const storePath = '/src/state/useRoomStore.ts'
    const { useRoomStore } = await import(/* @vite-ignore */ storePath)
    const transformedScene = await (await fetch('/src/components/RoomScene.tsx')).text()
    const fiberPath = transformedScene.match(/from\s*["']([^"']*react-three_fiber[^"']*)["']/)?.[1]
    if (!fiberPath) throw new Error('No se pudo resolver el módulo de la escena')
    const { _roots } = await import(/* @vite-ignore */ fiberPath)
    const canvas = document.querySelector<HTMLCanvasElement>('.scene-panel canvas')!
    const sceneState = _roots.get(canvas)?.store.getState()
    if (!sceneState) throw new Error('La escena todavía no está montada')
    const { camera, scene, size } = sceneState
    const state = useRoomStore.getState()
    const dimensions: Array<{ id: string; length: number }> = []
    scene.traverse((object: { name: string; userData: { planDimension?: string; length: number } }) => {
      if (object.userData.planDimension) dimensions.push({ id: object.name, length: object.userData.length })
    })
    const rect = canvas.getBoundingClientRect()
    const pack = state.structurePacks.find((pack: { id: string }) => pack.id === state.activeRoomId)
    const floor = pack?.surfaces.find((surface: { kind: string }) => surface.kind === 'floor')
    // Interior point away from the floor's selection gizmo at its centre.
    const point = camera.position.clone().set(
      (pack?.x ?? 0) + (floor?.x ?? 0) + (floor?.width ?? state.room.width) * 0.2,
      (pack?.y ?? 0) + (floor?.y ?? 0) + (floor?.height ?? 0.08) / 2,
      (pack?.z ?? 0) + (floor?.z ?? 0) + (floor?.depth ?? state.room.depth) * 0.2,
    ).project(camera)
    const ray = new sceneState.raycaster.constructor()
    ray.setFromCamera({ x: point.x, y: point.y }, camera)
    const floorHits = ray.intersectObjects(sceneState.internal.interaction, true).slice(0, 10).map((hit: { object: { name: string; userData: Record<string, unknown>; traverseAncestors: (visit: (object: { userData: Record<string, unknown> }) => void) => void }; distance: number }) => {
      const controls: unknown[] = []
      hit.object.traverseAncestors((object) => { if (object.userData.structureSurfaceGizmo) controls.push(object.userData.structureSurfaceGizmo) })
      return { name: hit.object.name, surface: hit.object.userData.structureSurfaceId, pannable: !!hit.object.userData.planPannable, controls, distance: hit.distance }
    })
    return {
      view: state.view, activeRoomId: state.activeRoomId,
      selectedId: state.selectedId, selectedIds: state.selectedIds,
      undoCount: state.undoCount, redoCount: state.redoCount,
      width: state.room.width, depth: state.room.depth,
      topCameraX: state.topCameraX, topCameraZ: state.topCameraZ, cameraZoom: state.cameraZoom,
      room: structuredClone(state.room), structurePacks: structuredClone(state.structurePacks),
      camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), zoom: camera.zoom },
      dimensions,
      floorPoint: { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 },
      viewportReady: Math.abs(size.width - rect.width) < 1 && Math.abs(size.height - rect.height) < 1,
      floorHits,
    }
  })
}
