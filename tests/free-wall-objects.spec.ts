import { expect, test, type Page } from '@playwright/test'
import { expandCatalogCategories } from './helpers/catalog'
import { expandAllCatalogCategories } from './helpers/catalog'

const inspector = (page: Page) => page.locator('.selection-section--inspector')
async function move(page: Page, axis: string, value: string) {
  const input = inspector(page).getByRole('textbox', { name: `Introducir ${axis} en metros`, exact: true })
  await input.fill(value)
  await input.press('Enter')
}

for (const width of [375, 1280]) {
  test(`una ventana sale al vacío por Y y deshacer recupera su posición, ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expandAllCatalogCategories(page)
  await expandCatalogCategories(page, ['Aperturas'])
    await page.locator('#catalog-grid-openings').getByRole('button', { name: 'Ventana ＋ Añadir', exact: true }).click()
    await inspector(page).getByRole('button', { name: 'Despegar de la pared', exact: true }).click()
    await move(page, 'Z', '0')
    await move(page, 'X', '0')
    await move(page, 'Y', '0.3')
    await expect(page.locator('.scene-collision-panel').getByText(/está fuera de la vivienda/)).toHaveCount(0)
    // XYZ admite hasta 20 m; 30 se rechaza y el objeto no sale.
    await move(page, 'Y', '15')
    await expect(page.locator('.scene-collision-panel')).toContainText('está fuera de la vivienda, en el vacío')
    await expect(inspector(page).getByRole('button', { name: /Volver a colocar en la pared/ })).toBeVisible()
    await page.getByRole('button', { name: 'Deshacer el último cambio', exact: true }).click()
    await page.getByRole('button', { name: /^Ventana 2 Apertura/ }).click()
    await expect(inspector(page).getByRole('textbox', { name: 'Introducir Y en metros', exact: true })).toHaveValue('0.30')
    await expect(page.locator('.scene-collision-panel').getByText(/está fuera de la vivienda/)).toHaveCount(0)
    await page.locator('.scene-panel').screenshot({ path: testInfo.outputPath(`ventana-libre-${width}.png`) })
  })

  test(`una ventana creada en un pack pasa a Raíz sin perder selección, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expandAllCatalogCategories(page)
  await expandCatalogCategories(page, ['Construcción', 'Aperturas'])
    await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
    await page.getByRole('button', { name: 'Pared B', exact: true }).click()
    await page.locator('#catalog-grid-openings').getByRole('button', { name: 'Ventana ＋ Añadir', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Ventana Apertura/ })).toHaveCount(1)
    await inspector(page).getByRole('button', { name: 'Despegar de la pared', exact: true }).click()
    await move(page, 'Z', '0')
    await move(page, 'X', '0')
    await expect(page.getByRole('button', { name: /^Ventana 2 Apertura/ })).toHaveCount(1)
    await expect(inspector(page).getByRole('textbox', { name: 'Introducir X en metros', exact: true })).toHaveValue('0.00')
    await page.getByRole('button', { name: 'Deshacer el último cambio', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Ventana Apertura/ })).toHaveCount(1)
    await page.getByRole('button', { name: 'Rehacer el último cambio deshecho', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Ventana 2 Apertura/ })).toHaveCount(1)
  })
}

test('la puerta conserva su posición vertical bloqueada', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await expandCatalogCategories(page, ['Aperturas'])
  await page.getByRole('button', { name: 'Puerta Apertura', exact: true }).click()
  await expect(inspector(page).getByRole('textbox', { name: 'Introducir Y en metros', exact: true })).toBeDisabled()
})

test('el eje perpendicular cambia con la pared y se libera solo al despegar', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await expandCatalogCategories(page, ['Aperturas'])
  await page.locator('#catalog-grid-openings').getByRole('button', { name: 'Ventana ＋ Añadir', exact: true }).click()
  const x = inspector(page).getByRole('textbox', { name: 'Introducir X en metros', exact: true })
  const y = inspector(page).getByRole('textbox', { name: 'Introducir Y en metros', exact: true })
  const z = inspector(page).getByRole('textbox', { name: 'Introducir Z en metros', exact: true })
  await expect(x).toBeEnabled()
  await expect(y).toBeEnabled()
  await expect(z).toBeDisabled()
  await expect(inspector(page).getByRole('checkbox', { name: 'Bloquear eje Z', exact: true })).toBeDisabled()
  await inspector(page).getByRole('group', { name: 'Pared', exact: true }).getByRole('button', { name: 'B', exact: true }).click()
  await expect(x).toBeDisabled()
  await expect(z).toBeEnabled()
  await inspector(page).getByRole('button', { name: 'Despegar de la pared', exact: true }).click()
  await expect(x).toBeEnabled()
  await expect(z).toBeEnabled()
  await inspector(page).getByRole('button', { name: 'Volver a colocar en la pared B', exact: true }).click()
  await expect(x).toBeDisabled()
  await expect(z).toBeEnabled()
})
