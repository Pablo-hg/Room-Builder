import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { BoxGeometry, Color, Matrix3, Vector2 } from 'three'
import type { PersistedDesign, SavedDesign } from '../src/domain/designV1'
import { MATERIAL_CATALOG, MATERIAL_FAMILIES, materialDefinition } from '../src/domain/materials'
import { ROOT_FLOOR_THICKNESS } from '../src/domain/constants'
import { applyWorldUv } from '../src/scene/worldUv'

const file = fileURLToPath(new URL('./fixtures/materials/muestrario-acabados.json', import.meta.url))
const fixture: { design: SavedDesign } = JSON.parse(await readFile(file, 'utf8'))
const designName = fixture.design.name
const original = fixture.design.data
const sofa = original.furniture.find((item) => item.kind === 'sofa')!

async function importSample(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const designs = page.getByRole('button', { name: 'Seleccionar diseño guardado' })
  await designs.click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Importar diseño/ }).click()
  await (await chooser).setFiles(file)
  await page.getByRole('dialog', { name: `Importar «${designName}»` }).getByRole('button', { name: 'Confirmar importación' }).click()
  await expect(designs).toContainText(designName)
  await expect(page.locator('.scene-panel canvas').first()).toBeVisible()
  return designs
}

type MaterialWorld = Pick<PersistedDesign, 'room' | 'furniture' | 'structurePacks'>

function currentDesign(page: Page): Promise<MaterialWorld> {
  return page.evaluate(async () => {
    const storePath = '/src/state/useRoomStore.ts'
    const { useRoomStore } = await import(storePath)
    const { room, furniture, structurePacks } = useRoomStore.getState()
    return { room, furniture, structurePacks }
  })
}

function finishes(data: MaterialWorld) {
  return [
    data.room.floorMaterial, ...Object.values(data.room.wallMaterials ?? {}),
    data.room.door.material, ...data.room.windows.map((window) => window.material),
    ...(data.room.extraDoors ?? []).map((door) => door.material),
    ...data.furniture.map((item) => item.material),
    ...(data.structurePacks ?? []).flatMap((pack) => pack.surfaces.map((surface) => surface.material)),
  ].filter((finish) => finish !== undefined).sort((a, b) => a.color.localeCompare(b.color))
}

test('el muestrario conserva sus acabados al editar, deshacer, guardar, recargar y exportar JSON', async ({ page }) => {
  test.setTimeout(60_000)
  const designs = await importSample(page)
  const initial = await currentDesign(page)
  expect(finishes(initial)).toEqual(finishes(original))
  expect(new Set(finishes(initial).map((finish) => finish.id))).toEqual(new Set(MATERIAL_CATALOG.map((entry) => entry.id)))
  await page.locator('.element-row').getByText(sofa.name, { exact: true }).click()
  await expect(page.getByLabel('Patrón', { exact: true })).toHaveValue('fabric')
  const scale = page.getByRole('slider', { name: 'Escala del acabado' })
  await scale.press('ArrowRight')
  const edited = await currentDesign(page)
  expect(edited.furniture.find((item) => item.id === sofa.id)).toEqual({
    ...initial.furniture.find((item) => item.id === sofa.id), material: { ...sofa.material, scale: 1.9 },
  })
  await page.getByRole('button', { name: 'Deshacer el último cambio', exact: true }).click()
  expect(finishes(await currentDesign(page))).toEqual(finishes(initial))
  await page.getByRole('button', { name: 'Rehacer el último cambio deshecho', exact: true }).click()
  expect(finishes(await currentDesign(page))).toEqual(finishes(edited))
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.reload()
  await expect(designs).toContainText(designName)
  expect(finishes(await currentDesign(page))).toEqual(finishes(edited))
  await designs.click({ button: 'right' })
  const pending = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Exportar diseño/ }).click()
  const exported = JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
  expect(exported.design.data.version).toBe(15)
  expect(finishes(exported.design.data)).toEqual(finishes(edited))
})

test('el GLB del muestrario incluye los acabados y conserva el patrón girado del suelo', async ({ page }) => {
  const designs = await importSample(page)
  await designs.click({ button: 'right' })
  const pending = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Descargar 3D/ }).click()
  const data = await readFile((await (await pending).path())!)
  expect(data.toString('ascii', 0, 4)).toBe('glTF')
  const jsonEnd = 20 + data.readUInt32LE(12)
  const gltf = JSON.parse(data.toString('utf8', 20, jsonEnd))
  expect(gltf.images.length).toBeGreaterThan(0)
  expect(gltf.images.every((entry: { bufferView?: number }) => Number.isInteger(entry.bufferView))).toBe(true)
  const patterns = new Map<string, string>()
  const binaryStart = jsonEnd + 8
  for (const finish of finishes(original)) {
    const color = new Color(finish.color).toArray()
    const textured = materialDefinition(finish.id)?.textured
    const materialIndex = gltf.materials.findIndex((entry: { pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: unknown } }) => {
      const pbr = entry.pbrMetallicRoughness
      return Boolean(pbr?.baseColorTexture) === textured
        && color.every((channel, index) => Math.abs(channel - (pbr?.baseColorFactor?.[index] ?? 1)) < 1e-6)
    })
    expect(materialIndex, `${finish.id} ${finish.color}`).toBeGreaterThanOrEqual(0)
    if (!textured) continue
    const map = gltf.materials[materialIndex].pbrMetallicRoughness.baseColorTexture
    const image = gltf.images[gltf.textures[map.index].source]
    const imageView = gltf.bufferViews[image.bufferView]
    const imageStart = binaryStart + (imageView.byteOffset ?? 0)
    const png = data.subarray(imageStart, imageStart + imageView.byteLength)
    expect(png.toString('ascii', 1, 4)).toBe('PNG')
    const checksum = createHash('sha256').update(png).digest('hex')
    if (patterns.has(finish.id)) expect(checksum).toBe(patterns.get(finish.id))
    patterns.set(finish.id, checksum)
    expect(map.extensions?.KHR_texture_transform).toBeUndefined()
    if (finish !== original.room.floorMaterial) continue
    // El suelo es una caja con las medidas de la habitación y UV en metros (applyWorldUv, como en la escena).
    // Compara cada par escrito en el binario con la escala y la rotación alrededor del centro de la escena.
    const primitive = gltf.meshes.flatMap((mesh: { primitives: unknown[] }) => mesh.primitives)
      .find((entry: { material: number }) => entry.material === materialIndex)
    const accessor = gltf.accessors[primitive.attributes.TEXCOORD_0]
    const bufferView = gltf.bufferViews[accessor.bufferView]
    const start = binaryStart + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const expected = new Matrix3().setUvTransform(0, 0, 1 / finish.scale, 1 / finish.scale, finish.rotation * Math.PI / 180, 0.5, 0.5)
    const box = applyWorldUv(new BoxGeometry(original.room.width, ROOT_FLOOR_THICKNESS, original.room.depth))
    const uv = box.getAttribute('uv')
    expect(accessor.count).toBe(uv.count)
    expect(accessor.componentType).toBe(5126)
    for (let index = 0; index < uv.count; index++) {
      const point = new Vector2(uv.getX(index), uv.getY(index)).applyMatrix3(expected)
      const offset = start + index * (bufferView.byteStride ?? 8)
      expect(data.readFloatLE(offset)).toBeCloseTo(point.x, 6)
      expect(data.readFloatLE(offset + 4)).toBeCloseTo(point.y, 6)
    }
    box.dispose()
  }
  expect(patterns.size).toBe(MATERIAL_CATALOG.filter((entry) => entry.textured).length)
  expect(new Set(patterns.values()).size).toBe(patterns.size)
})

test('el inspector muestra solo las familias en el primer selector y navega en dos niveles', async ({ page }) => {
  test.setTimeout(60_000)
  await importSample(page)
  const initial = await currentDesign(page)
  await page.locator('.element-row').getByText(sofa.name, { exact: true }).click()
  const family = page.getByLabel('Familia', { exact: true })
  const pattern = page.getByLabel('Patrón', { exact: true })
  await expect(family.locator('option')).toHaveText(['Color original', ...Object.values(MATERIAL_FAMILIES)])
  await page.getByRole('slider', { name: 'Orientación del acabado' }).press('ArrowRight')
  await page.getByLabel('Color del acabado', { exact: true }).fill('#765c96')
  expect((await currentDesign(page)).furniture.find((item) => item.id === sofa.id)).toEqual({
    ...initial.furniture.find((item) => item.id === sofa.id),
    material: { ...sofa.material, rotation: 16, color: '#765c96' },
  })
  await family.selectOption('wood')
  // Familia y Patrón: los patrones de la familia, agrupados por acabado (Tablones, Parqué).
  await expect(pattern).toHaveValue('wood')
  await expect(pattern.locator('option')).toHaveText(['Veta sencilla', 'Veta de pino', 'Veta de roble', 'Espiga'])
  await pattern.selectOption('herringbone')
  await expect(pattern).toHaveValue('herringbone')
  await family.selectOption('wallpaper')
  await pattern.selectOption('botanical')
  expect((await currentDesign(page)).furniture.find((item) => item.id === sofa.id)?.material)
    .toMatchObject({ id: 'botanical', color: '#765c96', rotation: 16 })
  await family.selectOption('wood')
  await pattern.selectOption('oak')
  await expect(pattern).toHaveValue('oak')
  await family.selectOption('paint')
  await expect(page.getByRole('slider', { name: 'Orientación del acabado' })).toHaveCount(0)
  await family.selectOption('')
  const { material: _finish, ...originalSofa } = initial.furniture.find((item) => item.id === sofa.id)!
  expect((await currentDesign(page)).furniture.find((item) => item.id === sofa.id)).toEqual(originalSofa)
  await page.locator('.element-row').getByRole('button', { name: 'Puerta Apertura', exact: true }).click()
  await expect(family.locator('option')).toHaveText(['Color original', ...Object.values(MATERIAL_FAMILIES)])
})
