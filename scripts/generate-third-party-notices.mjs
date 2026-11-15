import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

// Se ejecuta SOLO dentro de `npm run build`: recorre las dependencias de
// ejecución (no las de desarrollo) y publica sus licencias junto a la app,
// porque el bundle minificado no conserva los avisos de copyright (#32).
const root = process.cwd()
const output = join(root, 'dist', 'THIRD_PARTY_LICENSES.txt')

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

// Resolución de Node: primero node_modules anidado del paquete que lo pide, luego los superiores.
function resolvePackageDir(name, fromDir) {
  let dir = fromDir
  for (;;) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

// Paquetes solo de tipos (TypeScript): no llegan al JavaScript publicado.
function typesOnly(pkg) {
  return pkg.name.startsWith('@types/') || (!pkg.main && !pkg.module && !pkg.exports && Boolean(pkg.types || pkg.typings))
}

const rootPackage = await readJson(join(root, 'package.json'))
const found = new Map()
const pending = Object.keys(rootPackage.dependencies ?? {}).map((name) => ({ name, from: root }))
while (pending.length) {
  const { name, from } = pending.pop()
  const dir = resolvePackageDir(name, from)
  if (!dir) throw new Error(`Dependencia de ejecución no instalada: ${name}`)
  const pkg = await readJson(join(dir, 'package.json'))
  const key = `${pkg.name}@${pkg.version}`
  if (found.has(key) || typesOnly(pkg)) continue
  found.set(key, { pkg, dir })
  for (const dependency of Object.keys(pkg.dependencies ?? {})) pending.push({ name: dependency, from: dir })
}

function repositoryUrl(repository) {
  const url = typeof repository === 'string' ? repository : repository?.url
  return url?.replace(/^git\+/, '').replace(/\.git$/, '') ?? ''
}

const sections = []
for (const [key, { pkg, dir }] of [...found].sort(([a], [b]) => a.localeCompare(b))) {
  const license = typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? pkg.licenses ?? 'Sin declarar')
  const file = (await readdir(dir)).find((entry) => /^(licen[cs]e|copying)(\.|$)/i.test(entry))
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
  const header = [`${key}`, `Licencia: ${license}`, repositoryUrl(pkg.repository) && `Repositorio: ${repositoryUrl(pkg.repository)}`, author && `Autoría: ${author}`].filter(Boolean).join('\n')
  const text = file
    ? (await readFile(join(dir, file), 'utf8')).trim()
    : `El paquete publicado no incluye archivo de licencia. Se distribuye bajo ${license}; texto completo en su repositorio.`
  sections.push(`${header}\n\n${text}`)
}

const preamble = 'Room Builder incluye el siguiente software de terceros. Se reproducen sus avisos de copyright y licencias.\nGenerado automáticamente en cada build a partir de las dependencias de ejecución instaladas.'
await writeFile(output, `${preamble}\n\n${sections.join(`\n\n${'='.repeat(78)}\n\n`)}\n`, 'utf8')
process.stdout.write(`Licencias: ${found.size} paquetes de terceros en dist/THIRD_PARTY_LICENSES.txt.\n`)
