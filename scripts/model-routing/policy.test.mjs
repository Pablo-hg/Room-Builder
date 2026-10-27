import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyTask, ROUTES } from './policy.mjs'

const scenarios = [
  ['corrige una errata del README.md', ROUTES.quick],
  ['actualiza la documentación del componente', ROUTES.quick],
  ['corrige un bug en el panel de muebles y añade pruebas', ROUTES.balanced],
  ['continúa el R0: tests de hasUnsavedChanges', ROUTES.balanced],
  ['reorganiza la cámara isométrica y sus gizmos 3D', ROUTES.deep],
  ['separa persistencia de Zustand con migraciones', ROUTES.deep],
  ['diseña R4 y la arquitectura multihabitación', ROUTES.deep],
  ['ajusta el README pero corrige el renderizado 3D', ROUTES.deep],
  ['#modelo:sol corrige un tooltip', ROUTES.deep],
  ['#modelo:astra revisa un fallo', ROUTES.critical],
  ['#modelo:luna revisa cámaras', ROUTES.quick],
  ['continúa', null],
  ['#modelo:manual depura las cámaras', null],
  ['/gratis corrige el renderizado 3D', null],
  ['Usa únicamente este modelo gratuito', null],
]
for (const [prompt, expected] of scenarios) {
  test(prompt, () => assert.equal(classifyTask(prompt).model, expected))
}
