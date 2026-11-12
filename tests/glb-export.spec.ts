import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { expandAllCatalogCategories } from './helpers/catalog'

async function readGlb(path: string) {
  const data = await readFile(path)
  expect(data.toString('ascii', 0, 4)).toBe('glTF')
  expect(data.readUInt32LE(4)).toBe(2)
  expect(data.readUInt32LE(8)).toBe(data.length)
  expect(data.toString('ascii', 16, 20)).toBe('JSON')
  return JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)).trim())
}

test('descarga la escena real en GLB con el nombre y la fecha actuales', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  const date = await page.evaluate(() => new Date().toISOString().slice(0, 10))
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click({ button: 'right' })
  const pending = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Descargar 3D/ }).click()
  const download = await pending
  expect(download.suggestedFilename()).toBe(`room-builder-${date}.glb`)
  const path = await download.path()
  if (!path) throw new Error('No se descargó el GLB')
  const gltf = await readGlb(path)
  expect(gltf.asset.version).toBe('2.0')
  expect(gltf.meshes.length).toBeGreaterThan(0)
  expect(gltf.cameras).toBeUndefined()
  expect(gltf.meshes.every((mesh: { primitives: { mode: number }[] }) => mesh.primitives.every((primitive) => primitive.mode === 4))).toBe(true)
  await expect(page.locator('.toast')).toContainText('Modelo 3D descargado en formato GLB')
})

test('el adaptador excluye ocultos, líneas, sprites, cámaras, luces y hit areas del GLB', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  const pending = page.waitForEvent('download')
  await page.evaluate(async () => {
    const adapterPath = '/src/scene/exportGlb.ts'
    const threePath = '/node_modules/.vite/deps/three.js'
    const { exportGlb } = await import(adapterPath)
    const THREE = await import(threePath)
    const root = new THREE.Group()
    root.visible = false
    const visible = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
    visible.name = 'modelo-visible'
    const hidden = visible.clone()
    hidden.visible = false
    hidden.name = 'modelo-oculto'
    const helpers = [new THREE.Line(), new THREE.Sprite(), new THREE.PerspectiveCamera(), new THREE.AmbientLight(),
      new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ colorWrite: false }))]
    helpers.forEach((object, index) => { object.name = `helper-${index}` })
    root.add(visible, hidden, ...helpers)
    await new Promise<void>((resolve, reject) => exportGlb(root, 'adaptador-r2', (error?: Error) => error ? reject(error) : resolve()))
  })
  const path = await (await pending).path()
  if (!path) throw new Error('No se descargó el GLB del adaptador')
  const gltf = await readGlb(path)
  expect(gltf.nodes.map((node: { name?: string }) => node.name).filter(Boolean)).toEqual(['modelo-visible'])
  expect(gltf.meshes).toHaveLength(1)
  expect(gltf.cameras).toBeUndefined()
})
