import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('avisa antes de descartar la edición al cambiar de diseño y permite cancelar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Guardar como' }).click()
  const selector = page.getByRole('button', { name: 'Seleccionar diseño guardado' })
  await selector.click()
  await page.getByRole('button', { name: /Crear diseño/ }).click()
  await page.getByLabel('Nombre del diseño').fill('Segundo')
  await page.getByRole('button', { name: 'Crear en blanco' }).click()
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await expect(page.locator('.save-state')).toContainText('Cambios sin guardar')
  await selector.click()
  await page.getByRole('button', { name: 'Diseño 1', exact: true }).click()
  const modal = page.getByRole('dialog', { name: '¿Descartar los cambios sin guardar?' })
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: 'Cancelar' }).click()
  await expect(selector).toContainText('Segundo')
  await expect(page.locator('.save-state')).toContainText('Cambios sin guardar')
  await page.getByRole('button', { name: 'Diseño 1', exact: true }).click()
  await modal.getByRole('button', { name: 'Descartar y continuar' }).click()
  await expect(selector).toContainText('Diseño 1')
  await expect(page.locator('.save-state')).not.toContainText('Cambios sin guardar')
})

test('exportar incluye cambios sin guardar sin alterar el diseño persistido', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar como' }).click()
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
  await expect(page.locator('.save-state')).toContainText('Cambios sin guardar')
})

test('dos pestañas no sobrescriben silenciosamente los cambios de la biblioteca', async ({ page, context }) => {
  await page.goto('/')
  const other = await context.newPage()
  await other.goto('/')
  await page.getByRole('button', { name: 'Guardar como' }).click()
  await other.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await other.getByRole('button', { name: 'Guardar como' }).click()
  await expect(other.locator('.toast')).toContainText('otra pestaña')
  await expect(other.locator('.save-state')).toContainText('Cambios sin guardar')
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('room-builder:v0.1:designs')!))
  expect(stored).toHaveLength(1)
  expect(stored[0].data.furniture).toHaveLength(0)
})


test('cancelar una importación no altera ni el diseño abierto ni localStorage', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar como' }).click()
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

test('un error de descarga informa sin guardar ni modificar el diseño', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Guardar como' }).click()
  const before = await page.evaluate(() => localStorage.getItem('room-builder:v0.1:designs'))
  await page.evaluate(() => { URL.createObjectURL = () => { throw new Error('Descarga bloqueada') } })
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await page.getByRole('button', { name: 'Más opciones de Diseño 1' }).click()
  await page.getByRole('menuitem', { name: /Exportar diseño/ }).click()
  await expect(page.getByRole('alert')).toContainText('Descarga bloqueada')
  expect(await page.evaluate(() => localStorage.getItem('room-builder:v0.1:designs'))).toEqual(before)
})
