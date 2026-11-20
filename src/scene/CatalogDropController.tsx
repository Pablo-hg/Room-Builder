import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import {
  cameraSeesInside, catalogDragPlacement, createdCatalogElement, inwardNormal, nearestWallSnap, openingOwner, outsideWallDistance,
  structureObjectSurfaceId, wallBelongsTo, wallIdFromMesh, wallPlacementAt, type CatalogDragItem,
} from '../domain/catalogDrag'
import { persistedDesign } from '../domain/designV1'
import { OPENING_CATALOG, openingKindForShape } from '../domain/objectCatalog'
import { focusedCreationTarget } from '../domain/roomEditing'
import { physicalWalls } from '../domain/wallConnections'
import { wallObjectPosition, wallObjects } from '../domain/wallObjectPlacement'
import type { HistoryGestureToken } from '../state/types'
import { useRoomStore } from '../state/useRoomStore'
import { registerCatalogDropTarget } from '../components/editor/catalogDragSession'

type Session = { item: CatalogDragItem; token: HistoryGestureToken | null; id: string | null }

function createFromCatalog(item: CatalogDragItem) {
  const state = useRoomStore.getState()
  if (item.type === 'furniture') state.addFurniture(item.kind)
  else if (item.type === 'wall-object') state.addWindow(item.shape)
  else if (item.type === 'door') state.addStructureDoor()
  else state.addStructureObject(item.kind)
}

function wallIdOf(object: THREE.Object3D | null): string | null {
  for (let current = object; current; current = current.parent) {
    const id = wallIdFromMesh(current.userData?.wallId)
    if (id) return id
  }
  return null
}

/**
 * Destino del arrastre desde el catálogo: proyecta el cursor sobre el suelo de la habitación enfocada
 * (muebles y construcción) o sobre una pared suya (aperturas y objetos de pared). El objeto se crea al
 * entrar en la vista; crear y mover forman un único paso de deshacer, y cancelar lo revierte sin rastro.
 */
export function CatalogDropController() {
  const { camera, gl, scene } = useThree()
  useEffect(() => {
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const floor = new THREE.Plane()
    const plane = new THREE.Plane()
    const hit = new THREE.Vector3()
    let session: Session | null = null

    const overCanvas = (clientX: number, clientY: number) => {
      const element = document.elementFromPoint(clientX, clientY)
      return !!element && (element === gl.domElement || !!gl.domElement.parentElement?.contains(element))
    }

    const placeOnFloor = (current: Session) => {
      const state = useRoomStore.getState()
      floor.set(new THREE.Vector3(0, 1, 0), -focusedCreationTarget(state).center.y)
      if (!raycaster.ray.intersectPlane(floor, hit)) return
      if (current.item.type === 'structure') {
        state.moveStructurePack(current.id!, 'x', hit.x)
        state.moveStructurePack(current.id!, 'z', hit.z)
      } else state.moveFurniture(current.id!, hit.x, hit.z, 'pointer')
    }

    // Puertas: siempre en una pared; saltan a la pared de su habitación que haya bajo el cursor.
    const placeDoor = (current: Session) => {
      const state = useRoomStore.getState()
      const owner = openingOwner(state, current.id!)
      if (owner === undefined) return
      const walls = new Map(physicalWalls(state).map((wall) => [wall.id, wall]))
      for (const intersection of raycaster.intersectObjects(scene.children, true)) {
        const wall = walls.get(wallIdOf(intersection.object) ?? '')
        if (!wall || !wallBelongsTo(wall, owner)) continue
        const pack = owner === null ? undefined : state.structurePacks.find((candidate) => candidate.id === owner)
        const door = [...(state.room.extraDoors ?? []), ...(pack?.doors ?? [])].find((item) => item.id === current.id)
        if (!door) return
        const { offset } = wallPlacementAt(wall, intersection.point, focusedCreationTarget(state).center.y, door.height)
        state.setStructureDoor(current.id!, { wall: wall.side, offset })
        return
      }
    }

    /**
     * Objetos de pared: se mueven en el plano (prolongado) de la pared visible de su habitación más cercana al
     * cursor, ya orientados como en ella. Sobre la pared real se fijan (casilla marcada); fuera quedan libres.
     */
    const placeWallObject = (current: Session) => {
      const state = useRoomStore.getState()
      const owner = openingOwner(state, current.id!)
      if (owner === undefined) return
      const pack = owner === null ? undefined : state.structurePacks.find((candidate) => candidate.id === owner)
      const window = [...state.room.windows, ...(pack?.windows ?? [])].find((item) => item.id === current.id)
      if (!window) return
      const target = focusedCreationTarget(state)
      const floorY = target.center.y
      const walls = physicalWalls(state).filter((wall) => wallBelongsTo(wall, owner))
      if (!walls.length) return
      const visible = walls.filter((wall) => cameraSeesInside(wall, inwardNormal(wall, target.center), camera.position))
      let best: { wall: (typeof walls)[number]; offset: number; sill: number; rawSill: number; distance: number } | null = null
      for (const wall of visible.length ? visible : walls) {
        const n = inwardNormal(wall, target.center)
        plane.set(new THREE.Vector3(n.x, 0, n.z), -(n.x * wall.x + n.z * wall.z))
        // Casi paralelo (p. ej. Plano, mirando desde arriba): el plano de la pared no sirve para seguir al cursor.
        if (Math.abs(raycaster.ray.direction.x * n.x + raycaster.ray.direction.z * n.z) < 0.08) continue
        if (!raycaster.ray.intersectPlane(plane, hit)) continue
        const placement = wallPlacementAt(wall, hit, floorY, window.height)
        const distance = outsideWallDistance(wall, placement, window.height)
        if (!best || distance < best.distance) best = { wall, ...placement, distance }
      }
      if (!best) {
        // Plano: se sigue al cursor en planta a la altura por defecto y se fija al acercarse a una pared.
        const definition = OPENING_CATALOG[openingKindForShape(window.shape)]
        const centreY = floorY + definition.defaultBottom + window.height / 2
        floor.set(new THREE.Vector3(0, 1, 0), -centreY)
        if (!raycaster.ray.intersectPlane(floor, hit)) return
        const snap = nearestWallSnap(walls, target.center, floorY, hit, window.height)
        if (snap) {
          state.updateWindow(current.id!, { wall: snap.wall.side, offset: snap.offset, sill: snap.sill })
          return
        }
        const nearest = walls.reduce((a, b) => Math.abs((hit.x - a.x) * Math.sin(a.yaw) + (hit.z - a.z) * Math.cos(a.yaw))
          <= Math.abs((hit.x - b.x) * Math.sin(b.yaw) + (hit.z - b.z) * Math.cos(b.yaw)) ? a : b)
        const yaw = wallObjectPosition(state.room, { ...window, wall: nearest.side, freePosition: undefined, wallPosition: undefined }, pack).yaw
        state.setWallObjectFreePosition(current.id!, { x: hit.x, y: hit.y - window.height / 2, z: hit.z, yaw })
        return
      }
      if (best.distance === 0) {
        state.updateWindow(current.id!, { wall: best.wall.side, offset: best.offset, sill: best.sill })
        const after = wallObjects(useRoomStore.getState()).find((entry) => entry.window.id === current.id)?.window
        if (after && !after.freePosition && after.wall === best.wall.side) return
      }
      // En la prolongación de la pared (o sin hueco válido en ella): libre, orientado como esa pared.
      const onPlane = { ...window, wall: best.wall.side, offset: best.offset, sill: best.rawSill, freePosition: undefined, wallPosition: undefined }
      state.setWallObjectFreePosition(current.id!, wallObjectPosition(state.room, onPlane, pack))
    }

    const unregister = registerCatalogDropTarget({
      move: (item, clientX, clientY) => {
        if (!overCanvas(clientX, clientY)) return false
        const rect = gl.domElement.getBoundingClientRect()
        pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
        raycaster.setFromCamera(pointer, camera)
        if (!session) {
          // Se crea primero y el gesto se abre después: crear selecciona el objeto nuevo y eso cerraría un gesto ya abierto.
          const before = persistedDesign(useRoomStore.getState())
          createFromCatalog(item)
          const id = createdCatalogElement(before, persistedDesign(useRoomStore.getState()))
          session = { item, id, token: id ? useRoomStore.getState().continueHistoryGesture(before, null) : null }
        }
        // Si la creación se rechazó (sin hueco), el aviso del editor ya lo explica; no se reintenta en cada movimiento.
        if (!session.id) return true
        if (item.type === 'door') placeDoor(session)
        else if (catalogDragPlacement(item) === 'wall') placeWallObject(session)
        else placeOnFloor(session)
        return true
      },
      finish: (commit) => {
        const current = session
        session = null
        if (!current) return
        const state = useRoomStore.getState()
        if (commit && current.id) {
          if (current.token) state.commitHistoryGesture(current.token)
          state.selectElement(current.item.type === 'structure' ? structureObjectSurfaceId(current.id, current.item.kind) : current.id)
        } else if (current.token) state.revertHistoryGesture(current.token)
      },
    })
    return () => {
      if (session?.token) useRoomStore.getState().revertHistoryGesture(session.token)
      session = null
      unregister()
    }
  }, [camera, gl, scene])
  return null
}
