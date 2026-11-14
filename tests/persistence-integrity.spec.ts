import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { expandAllCatalogCategories } from './helpers/catalog'

test('avisa antes de descartar la edición al cambiar de diseño y permite cancelar', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  const selector = page.getByRole('button', { name: 'Seleccionar diseño guardado' })
  await selector.click()
  await page.getByRole('button', { name: /Crear diseño/ }).click()
  await page.getByLabel('Nombre del diseño').fill('Segundo')
  await page.getByRole('button', { name: 'Crear en blanco' }).click()
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await expect(page.locator('.statusbar__save')).toContainText('Cambios sin guardar')
  await selector.click()
  await page.getByRole('button', { name: 'Diseño 1', exact: true }).click()
  const modal = page.getByRole('dialog', { name: '¿Descartar los cambios sin guardar?' })
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: 'Cancelar' }).click()
  await expect(selector).toContainText('Segundo')
  await expect(page.locator('.statusbar__save')).toContainText('Cambios sin guardar')
  await page.getByRole('button', { name: 'Diseño 1', exact: true }).click()
  await modal.getByRole('button', { name: 'Descartar y continuar' }).click()
  await expect(selector).toContainText('Diseño 1')
  await expect(page.locator('.statusbar__save')).not.toContainText('Cambios sin guardar')
})

test('exportar incluye cambios sin guardar sin alterar el diseño persistido', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  const storedBefore = await page.evaluate(() => localStorage.getItem('room-builder:v0.1:designs'))
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  const selector = page.getByRole('button', { name: 'Seleccionar diseño guardado' })
  await selector.click()
  await page.getByRole('button', { name: 'Más opciones de Diseño 1' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Exportar diseño/ }).click()
  const file = await downloadPromise
  const exported = JSON.parse(await readFile((await file.path())!, 'utf8'))
  expect(exported.design.data.furniture).toHaveLength(2)
  expect(await page.evaluate(() => localStorage.getItem('room-builder:v0.1:designs'))).toBe(storedBefore)
  await expect(page.locator('.statusbar__save')).toContainText('Cambios sin guardar')
})

test('dos pestañas no sobrescriben silenciosamente los cambios de la biblioteca', async ({ page, context }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  const other = await context.newPage()
  await other.goto('/')
  await expandAllCatalogCategories(other)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await other.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await other.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(other.locator('.toast')).toContainText('otra pestaña')
  await expect(other.locator('.statusbar__save')).toContainText('Cambios sin guardar')
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('room-builder:v0.1:designs')!))
  expect(stored).toHaveLength(1)
  expect(stored[0].data.furniture).toHaveLength(0)
})


test('cancelar una importación no altera ni el diseño abierto ni localStorage', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  const before = await page.evaluate(() => localStorage.getItem('room-builder:v0.1:designs'))
  const json = JSON.stringify({
    format: 'room-builder-design', schemaVersion: 5, exportedAt: new Date().toISOString(),
    design: JSON.parse(before!)[0],
  })
  const selector = page.getByRole('button', { name: 'Seleccionar diseño guardado' })
  await selector.click()
  await page.locator('input[type=file]').setInputFiles({ name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(json) })
  const dialog = page.getByRole('dialog', { name: 'Importar «Diseño 1»' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  expect(await page.evaluate(() => localStorage.getItem('room-builder:v0.1:designs'))).toEqual(before)
  await expect(selector).toContainText('Diseño 1')
})

test('exportar e importar conserva carpetas anidadas y deja una selección válida', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  const furnitureIds = await page.evaluate(async () => {
    const { useRoomStore } = await import(/* @vite-ignore */ '/src/state/useRoomStore.ts')
    const store = useRoomStore.getState()
    store.addFurniture('chair')
    const firstId = useRoomStore.getState().selectedId!
    store.addFurniture('chair')
    const secondId = useRoomStore.getState().selectedId!
    store.createElementFolder('Nivel superior')
    const parent = useRoomStore.getState().elementFolders.find((folder) => folder.name === 'Nivel superior')!
    store.createElementFolder('Subnivel', undefined, parent.id)
    const child = useRoomStore.getState().elementFolders.find((folder) => folder.name === 'Subnivel')!
    store.moveElementToFolder(firstId, parent.id)
    store.moveElementToFolder(secondId, child.id)
    return [firstId, secondId]
  })

  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  const selector = page.getByRole('button', { name: 'Seleccionar diseño guardado' })
  await selector.click()
  await page.getByRole('button', { name: 'Más opciones de Diseño 1' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Exportar diseño/ }).click()
  const download = await downloadPromise
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'))

  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await selector.click().catch(() => {})
  if (!(await page.getByRole('button', { name: /Importar diseño/ }).isVisible())) await selector.click()
  await page.locator('input[type=file]').setInputFiles({
    name: 'habitacion-anidada.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  })
  const modal = page.getByRole('dialog', { name: 'Importar «Diseño 1»' })
  await expect(modal).toContainText('copia independiente')
  await modal.getByRole('button', { name: 'Confirmar importación' }).click()

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('room-builder:v0.1:designs')!))
  const imported = stored.find((design: { id: string }) => design.id !== exported.design.id)
  expect(imported).toBeDefined()
  expect(imported.data.elementFolders).toEqual(exported.design.data.elementFolders)
  expect(imported.data.elementFolderAssignments).toEqual(exported.design.data.elementFolderAssignments)
  expect(imported.data.sceneElementOrder).toEqual(exported.design.data.sceneElementOrder)
  expect(imported.data.furniture.map((item: { id: string }) => item.id)).toEqual(furnitureIds)

  const selectionAfterImport = await page.evaluate(async () => {
    const { useRoomStore } = await import(/* @vite-ignore */ '/src/state/useRoomStore.ts')
    const state = useRoomStore.getState()
    const before = { selectedId: state.selectedId, selectedIds: state.selectedIds, selectionAnchor: state.selectionAnchor }
    state.selectElement(state.furniture[0]?.id ?? null)
    return {
      before,
      selectedIdAfterSelectingRestoredFurniture: useRoomStore.getState().selectedId,
      selectedIdsAfterSelectingRestoredFurniture: useRoomStore.getState().selectedIds,
    }
  })
  expect(selectionAfterImport.before).toEqual({ selectedId: null, selectedIds: [], selectionAnchor: null })
  expect(selectionAfterImport.selectedIdAfterSelectingRestoredFurniture).toBe(furnitureIds[0])
  expect(selectionAfterImport.selectedIdsAfterSelectingRestoredFurniture).toEqual([furnitureIds[0]])
})

test('un error de descarga informa sin guardar ni modificar el diseño', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  const before = await page.evaluate(() => localStorage.getItem('room-builder:v0.1:designs'))
  await page.evaluate(() => { URL.createObjectURL = () => { throw new Error('Descarga bloqueada') } })
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await page.getByRole('button', { name: 'Más opciones de Diseño 1' }).click()
  await page.getByRole('menuitem', { name: /Exportar diseño/ }).click()
  await expect(page.getByRole('alert')).toContainText('Descarga bloqueada')
  expect(await page.evaluate(() => localStorage.getItem('room-builder:v0.1:designs'))).toEqual(before)
})
