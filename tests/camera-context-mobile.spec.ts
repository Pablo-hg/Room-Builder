import { expect, test } from '@playwright/test'
import { expandAllCatalogCategories } from './helpers/catalog'

test('una sola tarjeta Puerta añade en la habitación enfocada; panel sigue a la cámara', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  const catalog = page.locator('#catalog-grid-openings')
  await expect(catalog.getByRole('button', { name: /Puerta/ })).toHaveCount(1)
  await catalog.getByRole('button', { name: 'Puerta ＋ Añadir', exact: true }).click()
  await expect(page.locator('.selection-section--inspector').getByRole('heading', { name: 'Puerta', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
  await page.getByRole('button', { name: 'Encima', exact: true }).click()
  await page.getByRole('button', { name: 'Carpeta Raíz', exact: true }).click()
  await expect(page.locator('.room-section__heading')).toContainText('Habitación 2')
  await catalog.getByRole('button', { name: 'Puerta ＋ Añadir', exact: true }).click()
  await expect(page.locator('.selection-section--inspector').getByRole('heading', { name: 'Puerta', exact: true })).toBeVisible()
  await page.getByLabel('Cámara enfocada en…').selectOption({ label: 'Raíz' })
  await expect(page.locator('.room-section__heading')).toContainText('Raíz')
  await expect(page.getByRole('textbox', { name: 'Introducir anchura en metros', exact: true })).toBeEnabled()
})

test('barra de zoom admite teclado y conserva zoom independiente de Libre', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  const zoom = page.getByRole('slider', { name: 'Zoom de la cámara', exact: true })
  await expect(zoom).toHaveValue('1')
  await zoom.focus()
  await zoom.press('ArrowRight')
  await expect(zoom).toHaveValue('1.01')
  await expect(page.locator('.zoom-control output')).toHaveText('101%')
  await page.getByRole('button', { name: 'Libre', exact: true }).click()
  await expect(zoom).toHaveValue('1')
  await page.getByRole('button', { name: 'Isométrica', exact: true }).click()
  await expect(zoom).toHaveValue('1.01')
})

for (const width of [320, 375, 430, 640]) {
  test(`controles separados de la escena a ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expandAllCatalogCategories(page)
    await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
    await page.getByRole('button', { name: 'Encima', exact: true }).click()
    for (const view of ['Isométrica', 'Frontal', 'Libre', 'Plano']) {
      await page.getByRole('button', { name: view, exact: true }).click()
      const header = await page.locator('.scene-header').boundingBox()
      const stage = await page.locator('.scene-stage').boundingBox()
      const controls = await page.locator('.scene-controls').boundingBox()
      expect(header).not.toBeNull()
      expect(stage).not.toBeNull()
      expect(controls).not.toBeNull()
      expect(header!.y + header!.height).toBeLessThanOrEqual(stage!.y + 1)
      expect(stage!.y + stage!.height).toBeLessThanOrEqual(controls!.y + 1)
      const compass = await page.locator('.compass').boundingBox()
      expect(compass!.y).toBeGreaterThanOrEqual(stage!.y)
      expect(compass!.y + compass!.height).toBeLessThanOrEqual(stage!.y + stage!.height)
      const zoom = await page.locator('.zoom-control').boundingBox()
      expect(zoom!.y).toBeGreaterThanOrEqual(controls!.y)
      await page.locator('.scene-panel').screenshot({ path: testInfo.outputPath(`movil-${width}-${view}.png`) })
    }
  })
}
