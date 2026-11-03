import { projectFurnitureIds, staleLayoutIds, type FurnitureInstanceV2, type LayoutV2, type ProjectV2 } from './projectV2'

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function cloneFurniture(furniture: FurnitureInstanceV2[]): FurnitureInstanceV2[] {
  return furniture.map((item) => ({ ...item }))
}

function nextLayoutId(project: ProjectV2): string {
  const used = new Set(project.layouts.map((layout) => layout.id))
  let index = project.layouts.length + 1
  while (used.has(`layout-${index}`)) index += 1
  return `layout-${index}`
}

/** ID único para un mueble nuevo dentro del proyecto. */
export function nextFurnitureId(project: ProjectV2, prefix = 'furniture'): string {
  const used = projectFurnitureIds(project)
  let index = used.size + 1
  while (used.has(`${prefix}-${index}`)) index += 1
  return `${prefix}-${index}`
}

/**
 * Crea una variante de mobiliario sobre la misma estructura.
 *
 * La variante Original no se modifica. Los muebles copiados conservan su ID
 * como «mismo mueble lógico», de modo que selección, candados, carpetas y orden
 * pueden referirse a ellos; los muebles nuevos deben recibir un ID único.
 * La copia conserva la revisión de origen; duplicar no confirma la estructura.
 */
export function duplicateLayoutAsAlternative(project: ProjectV2, sourceLayoutId = project.activeLayoutId, name?: string): ProjectV2 {
  const source = project.layouts.find((layout) => layout.id === sourceLayoutId)
  if (!source) throw new Error('source layout not found')
  const id = nextLayoutId(project)
  const alternatives = project.layouts.filter((layout) => layout.kind === 'alternative').length
  const alternative: LayoutV2 = {
    id,
    name: name?.trim() || `Alternativa ${alternatives + 1}`,
    kind: 'alternative',
    basedOnLayoutId: source.id,
    structureRevision: source.structureRevision,
    furniture: cloneFurniture(source.furniture),
  }
  return {
    ...project,
    layouts: [...project.layouts, alternative],
    activeLayoutId: alternative.id,
  }
}

/** Sustituye el mobiliario de una variante sin tocar las demás ni la estructura. */
export function replaceLayoutFurniture(project: ProjectV2, layoutId: string, furniture: FurnitureInstanceV2[]): ProjectV2 {
  if (!project.layouts.some((layout) => layout.id === layoutId)) throw new Error('layout not found')
  const ids = new Set<string>()
  const normalized = furniture.map((item) => {
    if (!item || !isFiniteNumber(item.x) || !isFiniteNumber(item.y) || !isFiniteNumber(item.z)) throw new Error('invalid furniture position')
    if (ids.has(item.id)) throw new Error('duplicate furniture id in layout')
    ids.add(item.id)
    return { ...item }
  })
  return {
    ...project,
    layouts: project.layouts.map((layout) => layout.id === layoutId ? { ...layout, furniture: normalized } : layout),
  }
}

/** Añade un mueble nuevo; su ID no puede existir ya en ninguna variante. */
export function addFurnitureToLayout(project: ProjectV2, layoutId: string, item: FurnitureInstanceV2): ProjectV2 {
  const layout = project.layouts.find((candidate) => candidate.id === layoutId)
  if (!layout) throw new Error('layout not found')
  if (projectFurnitureIds(project).has(item.id)) throw new Error('duplicate furniture id in project')
  return replaceLayoutFurniture(project, layoutId, [...layout.furniture, item])
}

/** Quita un mueble solo de la variante indicada. */
export function removeFurnitureFromLayout(project: ProjectV2, layoutId: string, furnitureId: string): ProjectV2 {
  const layout = project.layouts.find((candidate) => candidate.id === layoutId)
  if (!layout) throw new Error('layout not found')
  return replaceLayoutFurniture(project, layoutId, layout.furniture.filter((item) => item.id !== furnitureId))
}

/**
 * Aplica un cambio estructural explícito. Las variantes existentes conservan su
 * revisión anterior y quedan marcadas como obsoletas hasta aceptar el cambio.
 */
export function reviseStructure(
  project: ProjectV2,
  change: Pick<ProjectV2, 'floors' | 'rooms' | 'walls' | 'openings'> & Partial<Pick<ProjectV2, 'legacyStructurePacks'>>,
  updatedAt = project.metadata.updatedAt,
): ProjectV2 {
  return {
    ...project,
    ...change,
    structureRevision: project.structureRevision + 1,
    metadata: { ...project.metadata, updatedAt },
  }
}

/** Confirma de forma explícita que las variantes se reinterpretan sobre la estructura nueva. */
export function rebaseLayoutsOnStructure(project: ProjectV2): ProjectV2 {
  return {
    ...project,
    layouts: project.layouts.map((layout) => ({ ...layout, structureRevision: project.structureRevision })),
  }
}

export function switchActiveLayout(project: ProjectV2, layoutId: string): ProjectV2 {
  if (!project.layouts.some((layout) => layout.id === layoutId)) throw new Error('layout not found')
  return { ...project, activeLayoutId: layoutId }
}

export function currentLayout(project: ProjectV2): LayoutV2 {
  const layout = project.layouts.find((candidate) => candidate.id === project.activeLayoutId)
  if (!layout) throw new Error('active layout not found')
  return layout
}

export function layoutIsStale(project: ProjectV2, layoutId: string): boolean {
  return staleLayoutIds(project).includes(layoutId)
}

export function variantsShareStructure(project: ProjectV2): boolean {
  if (project.layouts.length === 0) return false
  return project.layouts.every((layout) => layout.structureRevision === project.structureRevision)
}
