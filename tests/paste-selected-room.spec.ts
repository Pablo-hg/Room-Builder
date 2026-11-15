import { expect, test } from '@playwright/test'
import { expandCatalogCategories } from './helpers/catalog'

test('Ctrl+X y Ctrl+V pegan en la habitación elegida en Escena sin cambiar el foco de cámara', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  await expandCatalogCategories(page, ['Construcción', 'Asientos'])
  await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
  await page.getByRole('button', { name: 'Pared B', exact: true }).click()
  const camera = page.getByLabel('Cámara enfocada en…')
  await camera.selectOption({ label: 'Raíz' })
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await page.keyboard.press('Control+x')
  await page.getByRole('button', { name: 'Carpeta Habitación 2', exact: true }).click()
  await page.keyboard.press('Control+v')
  const folder = page.locator('.element-folder').filter({ has: page.getByRole('button', { name: 'Carpeta Habitación 2', exact: true }) }).first()
  await expect(folder.getByRole('button', { name: 'Silla Asientos' })).toBeVisible()
  await expect(camera.locator('option:checked')).toHaveText('Raíz')
  await expect(page.getByRole('status').filter({ hasText: 'habitación seleccionada' })).toBeVisible()
})
