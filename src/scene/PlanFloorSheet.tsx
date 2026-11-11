import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { DEFAULT_FLOOR_COLOR, ROOT_FLOOR_THICKNESS } from '../domain/constants'
import { BASE_FLOOR_ID } from '../domain/elementFolders'
import { planRoomDimensions } from '../domain/planDimensions'
import { surfacePosition } from '../domain/roomEditing'
import type { FurnitureItem, RoomConfig, StructurePack } from '../domain/types'
import { physicalWalls } from '../domain/wallConnections'
import { useRoomStore } from '../state/useRoomStore'
import { FurnitureObject } from './FurnitureObject'
import { PlanDimensions } from './PlanDimensions'
import { PlanWallLines } from './PlanWallLines'
import { planWallStrips } from './planWallGeometry'
import { extentAlong, packOnLevel, planScreenRight, planScreenUp, type PlanFloorGroup, type PlanSheetPlacement } from './planSheet'
import { WorldWallObjects } from './WorldWallObjects'

/**
 * Hoja de plantas de la vista Plano (#26): además de la planta enfocada, que
 * se edita en su posición real, el resto de plantas se dibujan a su izquierda
 * y derecha como en una lámina de arquitectura. Esas copias son de solo
 * lectura: no reciben el puntero (se puede desplazar el plano sobre ellas),
 * no se exportan y no alteran el diseño. Cada planta lleva su título.
 */

const noRaycast = () => undefined
const NO_COLLISIONS: ReadonlySet<string> = new Set()
const NO_WALL_LABELS: ReadonlySet<string> = new Set()

/** Desactiva el puntero en todo lo que contiene, también en lo que se monte después. */
function NonInteractive({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    group.current?.traverse((object) => { if (object.raycast !== noRaycast) object.raycast = noRaycast })
  })
  return <group ref={group}>{children}</group>
}

function FloorCopy({ group, placement, room, structurePacks, furniture, hiddenElementIds, showDetails }: {
  group: PlanFloorGroup
  placement: PlanSheetPlacement
  room: RoomConfig
  structurePacks: StructurePack[]
  furniture: FurnitureItem[]
  hiddenElementIds: readonly string[]
  showDetails: boolean
}) {
  const hidden = useMemo(() => new Set(hiddenElementIds), [hiddenElementIds])
  const content = useMemo(() => {
    const world = { room, structurePacks }
    const isGround = group.key === 0
    const packs = structurePacks.filter((pack) => !hidden.has(pack.id) && packOnLevel(pack, room, group.level))
    const packIds = new Set(packs.map((pack) => pack.id))
    const wallIds = new Set(physicalWalls(world).filter((wall) => !hidden.has(wall.id)
      && (wall.packId ? packIds.has(wall.packId) : isGround)).map((wall) => wall.id))
    const floors = packs.flatMap((pack) => pack.surfaces.filter((surface) => surface.kind === 'floor'
      && !hidden.has(`structure-surface:${pack.id}:${surface.id}`)).map((surface) => {
      const [x, y, z] = surfacePosition(room, surface)
      return { id: `${pack.id}:${surface.id}`, position: [pack.x + x, pack.y + y, pack.z + z] as [number, number, number], size: [surface.width, surface.height, surface.depth] as [number, number, number], color: surface.color }
    }))
    return {
      floors,
      strips: planWallStrips(world, wallIds),
      dimensions: showDetails ? planRoomDimensions(world, (wall) => wallIds.has(wall.id)) : [],
      items: furniture.filter((item) => !hidden.has(item.id) && item.y >= group.level - 0.01 && item.y < group.level + group.height),
      showRootFloor: isGround && !hidden.has(BASE_FLOOR_ID),
    }
  }, [group, room, structurePacks, furniture, hidden, showDetails])
  return <group position={[placement.offset.x, placement.lift, placement.offset.z]} name={`plan-floor-copy:${group.key}`}>
    <NonInteractive>
      {content.showRootFloor && <mesh raycast={noRaycast}>
        <boxGeometry args={[room.width, ROOT_FLOOR_THICKNESS, room.depth]} />
        <meshStandardMaterial color={room.floorColor ?? DEFAULT_FLOOR_COLOR} roughness={0.94} />
      </mesh>}
      {content.floors.map((floor) => <mesh key={floor.id} position={floor.position} raycast={noRaycast}>
        <boxGeometry args={floor.size} />
        <meshStandardMaterial color={floor.color} roughness={0.9} />
      </mesh>)}
      <PlanWallLines strips={content.strips} />
      <WorldWallObjects room={room} structurePacks={structurePacks} collisionIds={NO_COLLISIONS} exportMode={false} level={group.level} levelHeight={group.height} focusedView strictLevel />
      {content.items.map((item) => <FurnitureObject key={item.id} item={item} selected={false} outlined={false} canDrag={false} planView showCollision={false} frontWall={null} />)}
      {content.dimensions.length > 0 && <PlanDimensions dimensions={content.dimensions} y={group.level + group.height + 0.05} wallLabels={NO_WALL_LABELS} />}
    </NonInteractive>
  </group>
}

const TITLE_HEIGHT_PX = 26
const TITLE_FONT_PX = 14
const TITLE_SCALE = 3

function titleTexture(text: string, focused: boolean) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const font = `800 ${TITLE_FONT_PX * TITLE_SCALE}px Arial, sans-serif`
  let width = text.length * TITLE_FONT_PX * 0.65 * TITLE_SCALE
  if (context) { context.font = font; width = context.measureText(text).width }
  const widthPx = Math.ceil(width / TITLE_SCALE + 26)
  canvas.width = widthPx * TITLE_SCALE
  canvas.height = TITLE_HEIGHT_PX * TITLE_SCALE
  if (context) {
    const s = TITLE_SCALE
    context.beginPath()
    context.roundRect(s, s, canvas.width - 2 * s, canvas.height - 2 * s, 8 * s)
    context.fillStyle = focused ? '#52705d' : 'rgba(255, 253, 249, 0.96)'
    context.fill()
    context.lineWidth = s
    context.strokeStyle = focused ? '#405748' : 'rgba(64, 87, 72, 0.45)'
    context.stroke()
    context.font = font
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = focused ? '#fffdf9' : '#405748'
    context.fillText(text, canvas.width / 2, canvas.height / 2 + s * 0.5)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return { texture, widthPx }
}

/** Título de planta bajo su dibujo, con tamaño constante en pantalla. */
function FloorTitle({ group, placement, focused, orientation, y }: { group: PlanFloorGroup; placement: PlanSheetPlacement; focused: boolean; orientation: number; y: number }) {
  const { camera, size } = useThree()
  const sprite = useRef<THREE.Sprite>(null)
  const label = useMemo(() => titleTexture(group.name, focused), [group.name, focused])
  useEffect(() => () => label.texture.dispose(), [label])
  const anchor = useMemo(() => {
    const right = planScreenRight(orientation)
    const up = planScreenUp(orientation)
    const boxes = group.boxes.map((box) => ({ ...box, x: box.x + placement.offset.x, z: box.z + placement.offset.z }))
    const [minRight, maxRight] = extentAlong(boxes, right)
    const [minUp] = extentAlong(boxes, up)
    const centre = (minRight + maxRight) / 2
    return { right, up, centre, minUp }
  }, [group, placement, orientation])
  useFrame(() => {
    if (!sprite.current || !(camera instanceof THREE.OrthographicCamera)) return
    const unit = (camera.right - camera.left) / Math.max(camera.zoom, 1e-6) / Math.max(size.width, 1)
    // Por debajo del dibujo: deja sitio a la etiqueta «PARED C» y a las cotas.
    const along = anchor.minUp - 1.3 - (TITLE_HEIGHT_PX / 2 + 10) * unit
    sprite.current.position.set(anchor.right.x * anchor.centre + anchor.up.x * along, y, anchor.right.z * anchor.centre + anchor.up.z * along)
    sprite.current.scale.set(label.widthPx * unit, TITLE_HEIGHT_PX * unit, 1)
  })
  return <sprite ref={sprite} renderOrder={31} raycast={noRaycast}>
    <spriteMaterial map={label.texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
  </sprite>
}

export function PlanFloorSheet({ groups, placements, focusedKey, room, structurePacks, furniture, orientation }: {
  groups: readonly PlanFloorGroup[]
  placements: ReadonlyMap<number, PlanSheetPlacement>
  focusedKey: number
  room: RoomConfig
  structurePacks: StructurePack[]
  furniture: FurnitureItem[]
  orientation: number
}) {
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const showDetails = useRoomStore((state) => state.planDetailsVisible)
  const focused = groups.find((group) => group.key === focusedKey)
  const titleY = (focused?.level ?? 0) + Math.max(...groups.map((group) => group.height)) + 0.2
  return <group name="plan-floor-sheet">
    {groups.map((group) => {
      const placement = placements.get(group.key)
      if (!placement) return null
      return <group key={group.key}>
        {group.key !== focusedKey && <FloorCopy group={group} placement={placement} room={room} structurePacks={structurePacks} furniture={furniture} hiddenElementIds={hiddenElementIds} showDetails={showDetails} />}
        <FloorTitle group={group} placement={placement} focused={group.key === focusedKey} orientation={orientation} y={titleY} />
      </group>
    })}
  </group>
}
