import { expect, test } from '@playwright/test'
import { expandCatalogCategories } from './helpers/catalog'
import { expandAllCatalogCategories } from './helpers/catalog'

for (const label of ['Encima', 'Debajo', 'Pared A', 'Pared B', 'Pared C', 'Pared D']) {
  test(`dirección ocupada se deshabilita y se actualiza con undo/redo: ${label}`, async ({ page }) => {
    await page.goto('/')
    await expandAllCatalogCategories(page)
  await expandCatalogCategories(page, ['Construcción'])
    const open = page.getByRole('button', { name: /Nueva habitación vacía/ })
    await open.click()
    await page.getByRole('button', { name: label, exact: true }).click()
    await page.getByLabel('Cámara enfocada en…').selectOption('')
    await page.getByRole('button', { name: 'Carpeta Raíz', exact: true }).click()
    await open.click()
    const choice = page.getByRole('button', { name: new RegExp(`^${label}(?: · Ocupado)?$`) })
    await expect(choice).toBeDisabled()
    await expect(choice).toHaveAttribute('title', 'Otra habitación ya ocupa ese espacio.')
    await page.getByRole('button', { name: 'Deshacer el último cambio', exact: true }).click()
    await expect(choice).toBeEnabled()
    await page.getByRole('button', { name: 'Rehacer el último cambio deshecho', exact: true }).click()
    await expect(choice).toBeDisabled()
  })
}

for (const width of [375, 1280]) {
  for (const view of ['Plano', 'Isométrica', 'Frontal', 'POV', 'Libre']) {
    test(`foco válido tras deshacer y borrar habitación: ${view}, ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')
      await expandAllCatalogCategories(page)
  await expandCatalogCategories(page, ['Construcción'])
      await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
      await page.getByRole('button', { name: 'Pared B', exact: true }).click()
      const selector = page.getByLabel('Cámara enfocada en…')
      const previous = await selector.inputValue()
      await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
      await page.getByRole('button', { name: 'Encima', exact: true }).click()
      await page.getByRole('button', { name: view, exact: true }).click()
      await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
      await expect(page.locator('.room-section__heading')).toContainText('Habitación 2')
      if (view !== 'Libre') await expect(selector).toHaveValue(previous)
      await page.getByRole('button', { name: 'Rehacer el último cambio deshecho', exact: true }).click()
      await expect(page.locator('.room-section__heading')).toContainText('Habitación 2')
      if (view === 'Libre') await page.getByRole('button', { name: 'Isométrica', exact: true }).click()
      const restored = await selector.locator('option').filter({ hasText: 'Habitación 3' }).getAttribute('value')
      await selector.selectOption(restored!)
      if (view === 'Libre') await page.getByRole('button', { name: 'Libre', exact: true }).click()
      const folder = page.getByRole('button', { name: 'Carpeta Habitación 3', exact: true })
      await folder.click({ button: 'right' })
      await page.getByRole('menuitem', { name: /Borrar/ }).click()
      await expect(folder).toHaveCount(0)
      await expect(page.locator('.room-section__heading')).toContainText('Habitación 2')
      if (view !== 'Libre') await expect(selector).toHaveValue(previous)
      await page.locator('.scene-panel').screenshot({ path: testInfo.outputPath(`foco-${view}-${width}.png`) })
    })
  }
}

for (const direction of ['Encima', 'Debajo']) {
  test(`creación ${direction} con altura personalizada: comparación visual frontal`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expandAllCatalogCategories(page)
  await expandCatalogCategories(page, ['Construcción'])
    const height = page.getByRole('textbox', { name: 'Introducir altura en metros', exact: true })
    await height.fill('4')
    await height.press('Enter')
    await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
    await page.getByRole('button', { name: direction, exact: true }).click()
    await page.getByRole('button', { name: 'Frontal', exact: true }).click()
    await expect(page.locator('.room-section__heading')).toContainText('Habitación 2')
    await expect(height).toHaveValue('4.00')
    await page.locator('.scene-panel').screenshot({ path: testInfo.outputPath(`nivel-${direction}.png`) })
    await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
    await expect(page.locator('.room-section__heading')).toContainText('Raíz')
  })
}
