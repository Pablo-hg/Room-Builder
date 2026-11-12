import { expect, test } from '@playwright/test'
import { expandCatalogCategories } from './helpers/catalog'
import { expandAllCatalogCategories } from './helpers/catalog'

for (const width of [375, 1280]) {
  for (const secondary of [false, true]) {
    test(`ventanas en pared visible con selección y coordenadas coherentes: ${secondary ? 'secundaria' : 'raíz'}, ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')
      await expandAllCatalogCategories(page)
  await expandCatalogCategories(page, ['Construcción', 'Aperturas'])
      if (secondary) {
        await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
        await page.getByRole('button', { name: 'Encima', exact: true }).click()
      }
      // At orientation 2, A is hidden and B/C are visible. The old fixed order chose A.
      await page.getByRole('button', { name: 'Girar a la izquierda', exact: true }).click()
      await page.getByRole('button', { name: 'Girar a la izquierda', exact: true }).click()
      for (const name of ['Ventana', 'Ventana circular']) {
        await page.locator('#catalog-grid-openings').getByRole('button', { name: `${name} ＋ Añadir`, exact: true }).click()
        const inspector = page.locator('.selection-section--inspector')
        await expect(inspector.getByRole('heading', { name, exact: true })).toBeVisible()
        await expect(inspector.getByRole('group', { name: 'Pared', exact: true }).getByRole('button', { name: 'B', exact: true })).toHaveAttribute('aria-pressed', 'true')
        const y = Number(await inspector.getByRole('textbox', { name: 'Introducir Y en metros', exact: true }).inputValue())
        expect(y).toBeCloseTo(secondary ? 3.765 : 1, 6)
        await page.locator('.scene-panel').screenshot({ path: testInfo.outputPath(`seleccion-${name}-${secondary ? 'pack' : 'raiz'}-${width}.png`) })
      }
    })
  }
}
