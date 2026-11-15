// Genera la matriz de inventario del catálogo (#30) a partir del código real.
// Uso: npx tsx scripts/catalog-inventory.ts [--check]
//   sin argumentos: escribe docs/progress/F1_CATALOG_INVENTORY.md
//   --check: falla si el archivo está desactualizado respecto al catálogo.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FURNITURE_CATALOG, FURNITURE_FAMILIES, OPENING_CATALOG, isWallPictureKind, STANDALONE_OPENING_MENU, type OpeningKind, type StandaloneOpeningKind } from '../src/domain/objectCatalog'
import type { ObjectCapabilities } from '../src/domain/objectCatalog'
import type { FurnitureKind } from '../src/domain/types'
import { furnitureModelIcon, ICON_CATALOG, openingModelIcon } from '../src/components/iconCatalog'
import { FURNITURE_MODELS } from '../src/scene/FurnitureModels'

const output = resolve('docs/progress/F1_CATALOG_INVENTORY.md')
const m = (value: number) => String(Number(value.toFixed(3))).replace('.', ',')
const familyLabel = new Map(FURNITURE_FAMILIES.map((f) => [f.id, f.label]))

function resize(c: ObjectCapabilities) {
  if (!c.resize) return 'No'
  const dims = Object.keys(c.resize.dimensions).map((d) => ({ width: 'an', depth: 'pr', height: 'al' })[d as 'width']).join('/')
  return `${dims}${c.resize.diameter ? ' (diámetro)' : ''}`
}
function rotation(c: ObjectCapabilities) {
  return c.rotation.enabled ? `${c.rotation.axis === 'wall-normal' ? 'normal a la pared' : 'eje vertical'}` : 'No'
}
const attachmentLabel = { free: 'Suelo (libre en altura)', floor: 'Suelo (fijo)', ceiling: 'Techo', wall: 'Pared' } as const

// Ubicación en el menú Catálogo: misma fuente que usa ObjectCatalogSection.tsx.
const menuOf = (kind: StandaloneOpeningKind) => {
  const group = STANDALONE_OPENING_MENU.find((entry) => entry.kind === kind)?.group
  return group === 'openings' ? 'Aperturas' : group ? familyLabel.get(group) ?? 'SIN MENÚ' : 'SIN MENÚ'
}

// Validación visual humana registrada por el propietario. Un objeto nuevo queda
// «Pendiente» hasta que se revise y se añada aquí con su fecha.
const VALIDATED_ON = '15/11/2026'
const VALIDATED = new Set([
  'armchair', 'sofa', 'chair', 'table', 'bedsideTable', 'bed', 'singleBed', 'cabinet', 'bookshelf', 'wardrobe', 'lamp',
  'wastebasket', 'vase', 'tableLamp', 'ceilingLamp', 'coffeeTable', 'desk', 'deskChair', 'tvStand', 'television', 'rug',
  'circularRug', 'plant', 'pictureSmall', 'pictureMedium', 'pictureLarge',
  'door', 'window', 'circularWindow', 'wallShelf', 'mirrorRectangular', 'mirrorCircular', 'wallSconce',
])
const review = (kind: string) => VALIDATED.has(kind) ? `Validado (propietario, ${VALIDATED_ON})` : 'Pendiente'

/** Icono generado desde el modelo: comprueba que se proyecta sin errores y con caras. */
const generated = (count: () => number) => { try { return count() > 0 ? 'Generado del modelo' : 'FALTA' } catch { return 'FALTA' } }

const header = '| Clave | Nombre | Menú | Medidas an×pr×al (m) | Anclaje | Rotación | Redimensión | Icono | Modelo | Color base | Revisión |\n|---|---|---|---|---|---|---|---|---|---|---|'
const rows: string[] = []
const issues: string[] = []

for (const kind of Object.keys(FURNITURE_CATALOG) as FurnitureKind[]) {
  const d = FURNITURE_CATALOG[kind]
  const b = d.base
  const icon = isWallPictureKind(kind) ? (kind in ICON_CATALOG ? '2D a mano' : 'FALTA') : generated(() => furnitureModelIcon(kind, b.color).length)
  const model = isWallPictureKind(kind) ? 'WallObjectModels.tsx (pictureModel)' : kind in FURNITURE_MODELS ? 'FurnitureModels.tsx' : 'FALTA'
  if (icon === 'FALTA') issues.push(`${kind}: sin icono`)
  if (model === 'FALTA') issues.push(`${kind}: sin modelo`)
  rows.push(`| \`${kind}\` | ${b.name} | ${familyLabel.get(d.family)} | ${m(b.width)}×${m(b.depth)}×${m(b.height)} | ${attachmentLabel[d.capabilities.attachment]} | ${rotation(d.capabilities)} | ${resize(d.capabilities)} | ${icon} | ${model} | \`${b.color}\` | ${review(kind)} |`)
}
for (const kind of Object.keys(OPENING_CATALOG) as OpeningKind[]) {
  if (kind === 'pictureSmall' || kind === 'pictureMedium' || kind === 'pictureLarge') continue
  const d = OPENING_CATALOG[kind]
  const icon = generated(() => openingModelIcon(kind as StandaloneOpeningKind, '#c88f58').length)
  if (icon === 'FALTA') issues.push(`${kind}: sin icono`)
  rows.push(`| \`${kind}\` | ${d.name} | ${menuOf(kind as StandaloneOpeningKind)} | ${m(d.width)}×—×${m(d.height)} | ${attachmentLabel[d.capabilities.attachment]} (base ${m(d.defaultBottom)} m) | ${rotation(d.capabilities)} | ${resize(d.capabilities)} | ${icon} | WallObjectModels.tsx | — | ${review(kind)} |`)
}

const names = [...Object.values(FURNITURE_CATALOG).map((d) => d.base.name), ...Object.entries(OPENING_CATALOG).filter(([k]) => !k.startsWith('picture')).map(([, d]) => d.name)]
const duplicated = names.filter((n, i) => names.indexOf(n) !== i)
if (duplicated.length) issues.push(`Nombres visibles duplicados: ${duplicated.join(', ')}`)

const content = `# Inventario del catálogo (F1 · #30)

> **Generado** por \`npx tsx scripts/catalog-inventory.ts\` desde \`src/domain/objectCatalog.ts\`, \`iconCatalog.tsx\`, \`FurnitureModels.tsx\` y \`WallObjectModels.tsx\`. Los iconos «Generado del modelo» se proyectan desde el propio modelo 3D. No editar a mano: la columna «Revisión» sale de la lista \`VALIDATED\` del script (validación visual humana); un objeto nuevo queda «Pendiente» hasta revisarlo.
> Convención de pivote de muebles (verificada en \`FurnitureObject.tsx\`): origen en el centro de la base (x, z) y y = suelo. Medidas internas en metros; aquí con coma decimal.
> Origen y licencia de modelos e iconos: primitivas Three.js definidas en el propio repositorio (iconos proyectados desde ellas); no hay assets de terceros.

${rows.length} entradas (${Object.keys(FURNITURE_CATALOG).length} muebles, incluidos 3 cuadros murales, y ${rows.length - Object.keys(FURNITURE_CATALOG).length} aperturas/elementos murales independientes).

${header}
${rows.join('\n')}

## Comprobaciones automáticas del generador

${issues.length ? issues.map((i) => `- ❌ ${i}`).join('\n') : '- ✅ Todas las entradas tienen icono y modelo, y no hay nombres visibles duplicados.'}
`

if (process.argv.includes('--check')) {
  let current = ''
  try { current = readFileSync(output, 'utf8') } catch { /* ausente */ }
  if (current !== content) { console.error('F1_CATALOG_INVENTORY.md está desactualizado.'); process.exit(1) }
} else {
  writeFileSync(output, content)
  console.log(`Escrito ${output} (${rows.length} entradas, ${issues.length} incidencias)`)
}
