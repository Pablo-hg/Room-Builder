/** Los niveles del catálogo se deducen del ID del patrón guardado en el diseño. */
export const MATERIAL_FAMILIES = {
  paint: 'Pintura', wood: 'Madera', ceramic: 'Cerámica', stone: 'Piedra',
  masonry: 'Mampostería', wallpaper: 'Papel pintado', fabric: 'Tejido',
} as const

const finishes = {
  smooth: 'Lisa', textured: 'Texturada', planks: 'Tablones', parquet: 'Parqué',
  tiles: 'Baldosas', blocks: 'Bloques', composite: 'Compuesto', printed: 'Estampado',
  woven: 'Tejido', ribbed: 'Acanalado',
} as const

export const MATERIAL_CATALOG = [
  { id: 'paint', family: 'paint', finish: 'smooth', name: 'Pintura lisa', textured: false },
  { id: 'wood', family: 'wood', finish: 'planks', name: 'Veta sencilla', textured: true },
  { id: 'tile', family: 'ceramic', finish: 'tiles', name: 'Baldosa cuadrada', textured: true },
  { id: 'stone', family: 'stone', finish: 'blocks', name: 'Piedra en bloques', textured: true },
  { id: 'wallpaper', family: 'wallpaper', finish: 'printed', name: 'Lunares', textured: true },
  { id: 'fabric', family: 'fabric', finish: 'woven', name: 'Trama fina', textured: true },
  { id: 'stucco', family: 'paint', finish: 'textured', name: 'Estuco', textured: true },
  { id: 'herringbone', family: 'wood', finish: 'parquet', name: 'Espiga', textured: true },
  { id: 'hydraulic-tile', family: 'ceramic', finish: 'tiles', name: 'Hidráulica', textured: true },
  { id: 'terrazzo', family: 'stone', finish: 'composite', name: 'Terrazo', textured: true },
  { id: 'botanical', family: 'wallpaper', finish: 'printed', name: 'Botánico', textured: true },
  { id: 'corduroy', family: 'fabric', finish: 'ribbed', name: 'Pana', textured: true },
  { id: 'pine', family: 'wood', finish: 'planks', name: 'Veta de pino', textured: true },
  { id: 'oak', family: 'wood', finish: 'planks', name: 'Veta de roble', textured: true },
  { id: 'popcorn', family: 'paint', finish: 'textured', name: 'Gotelé', textured: true },
  { id: 'brick', family: 'masonry', finish: 'blocks', name: 'Ladrillo', textured: true },
  { id: 'glazed-ceramic', family: 'ceramic', finish: 'tiles', name: 'Cerámica esmaltada', textured: true, defaultColor: '#9a9a9a' },
] as const satisfies readonly { id: string; family: keyof typeof MATERIAL_FAMILIES; finish: keyof typeof finishes; name: string; textured: boolean; defaultColor?: string }[]

type MaterialDefinition = (typeof MATERIAL_CATALOG)[number]
export type MaterialId = MaterialDefinition['id']
export const materialFinishLabel = (finish: keyof typeof finishes) => finishes[finish]

export function materialDefinition(id: unknown): MaterialDefinition | undefined {
  return MATERIAL_CATALOG.find((material) => material.id === id)
}

export interface MaterialFinish {
  id: MaterialId
  color: string
  /** Tamaño relativo del motivo; 1 es el tamaño original. */
  scale: number
  /** Orientación en grados. */
  rotation: number
}

/** Validación estricta para no aceptar recursos o parámetros desconocidos al importar. */
export function parseMaterialFinish(value: unknown): MaterialFinish | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  const definition = materialDefinition(candidate.id)
  if (!definition || typeof candidate.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(candidate.color)
    || typeof candidate.scale !== 'number' || !Number.isFinite(candidate.scale) || candidate.scale < 0.1 || candidate.scale > 10
    || typeof candidate.rotation !== 'number' || !Number.isFinite(candidate.rotation) || candidate.rotation < 0 || candidate.rotation >= 360) return null
  return { id: definition.id, color: candidate.color, scale: candidate.scale, rotation: candidate.rotation }
}

/** Convierte colores hexadecimales antiguos sin modificar el dato guardado.
 * Otros formatos devuelven null: el llamador debe conservar el color original. */
export function finishFromLegacyColor(color: string): MaterialFinish | null {
  const shortHex = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color)
  const expanded = shortHex ? `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}` : color
  return parseMaterialFinish({ id: 'paint', color: expanded, scale: 1, rotation: 0 })
}

type MaterialEntity = { material?: unknown }
type MaterialOpenings = { doors?: ReadonlyArray<MaterialEntity>; windows?: ReadonlyArray<MaterialEntity> }
type MaterialDesign = {
  room: { floorMaterial?: unknown; wallMaterials?: unknown; door?: MaterialEntity; extraDoors?: ReadonlyArray<MaterialEntity>; windows?: ReadonlyArray<MaterialEntity> }
  furniture: ReadonlyArray<MaterialEntity>
  structurePacks?: ReadonlyArray<MaterialOpenings & { surfaces: ReadonlyArray<MaterialEntity> }>
}

export function designHasMaterials(design: MaterialDesign): boolean {
  const { room, furniture, structurePacks } = design
  const hasFinish = (item: MaterialEntity) => item.material !== undefined
  return room.floorMaterial !== undefined
    || !!room.wallMaterials && Object.keys(room.wallMaterials).length > 0
    || room.door?.material !== undefined
    || !!room.extraDoors?.some(hasFinish)
    || !!room.windows?.some(hasFinish)
    || furniture.some(hasFinish)
    || !!structurePacks?.some((pack) => pack.surfaces.some(hasFinish) || pack.doors?.some(hasFinish) || pack.windows?.some(hasFinish))
}

/** Un acabado válido se puede aplicar a cualquier elemento individual. */
export function validateDesignMaterials(design: MaterialDesign & { version: number }): void {
  const validate = (value: unknown) => {
    if (value === undefined) return
    if (design.version < 15) throw new Error('Los materiales requieren un diseño v15.')
    const parsed = parseMaterialFinish(value)
    if (!parsed || Object.keys(value as object).some((key) => !['id', 'color', 'scale', 'rotation'].includes(key))) {
      throw new Error('El acabado no es válido.')
    }
  }
  validate(design.room.floorMaterial)
  const walls = design.room.wallMaterials
  if (walls !== undefined) {
    if (!walls || typeof walls !== 'object' || Array.isArray(walls)) throw new Error('Los materiales de pared no son válidos.')
    for (const [side, finish] of Object.entries(walls)) {
      if (!['north', 'east', 'south', 'west'].includes(side) || finish === undefined) throw new Error('Los materiales de pared no son válidos.')
      validate(finish)
    }
  }
  validate(design.room.door?.material)
  for (const item of [...design.furniture, ...(design.room.extraDoors ?? []), ...(design.room.windows ?? [])]) {
    validate(item.material)
  }
  for (const pack of design.structurePacks ?? []) {
    for (const item of [...pack.surfaces, ...(pack.doors ?? []), ...(pack.windows ?? [])]) validate(item.material)
  }
}
