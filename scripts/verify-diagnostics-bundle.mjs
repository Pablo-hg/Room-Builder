import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Runs ONLY as part of the existing production build; never starts a build or CI itself.
const forbidden = ['Diagnósticos de desarrollo', 'Importar diagnóstico o histórico', '/__room-builder/interaction-log', '.diagnostic-viewer', 'startFileMirror']
for (const file of await readdir('dist/assets')) {
  if (!/\.(js|css)$/.test(file)) continue
  const contents = await readFile(join('dist/assets', file), 'utf8')
  if (forbidden.some((token) => contents.includes(token))) throw new Error(`Herramientas de diagnóstico de desarrollo incluidas en producción: ${file}`)
}
process.stdout.write('Diagnósticos: herramientas de desarrollo ausentes del bundle público.\n')
