import { expect, test } from '@playwright/test'
import { expandCatalogCategories } from './helpers/catalog'

test('el título de la habitación selecciona su carpeta y refleja el nombre sin mover la cámara', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  await expandCatalogCategories(page, ['Construcción'])
  await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
  await page.getByRole('button', { name: 'Pared B', exact: true }).click()
  const label = page.getByRole('button', { name: 'Seleccionar habitación Habitación 2', exact: true })
  const camera = page.getByLabel('Cámara enfocada en…')
  const focused = await camera.inputValue()
  await page.getByRole('button', { name: 'Carpeta Raíz', exact: true }).click()
  await label.click()
  await expect(label).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Carpeta Habitación 2', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(camera).toHaveValue(focused)
  await page.keyboard.press('F2')
  const name = page.getByRole('textbox', { name: 'Nuevo nombre para Habitación 2' })
  await name.fill('Cocina')
  await name.press('Enter')
  await expect(page.getByRole('button', { name: 'Seleccionar habitación Cocina', exact: true })).toBeVisible()
})

test('el título visible permanece dentro del canvas en pantalla pequeña', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  const label = page.getByRole('button', { name: 'Seleccionar habitación Raíz', exact: true })
  await expect(label).toBeVisible()
  const labelBox = (await label.boundingBox())!
  const canvasBox = (await page.locator('.scene-panel canvas').first().boundingBox())!
  expect(labelBox.x).toBeGreaterThanOrEqual(canvasBox.x)
  expect(labelBox.y).toBeGreaterThanOrEqual(canvasBox.y)
  expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width)
  expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height)
})

test('en Plano el título no tapa el centro de la habitación, donde queda el mobiliario y sus gizmos', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  const label = page.getByRole('button', { name: 'Seleccionar habitación Raíz', exact: true })
  await expect(label).toBeVisible()
  const labelBox = (await label.boundingBox())!
  const canvasBox = (await page.locator('.scene-panel canvas').first().boundingBox())!
  const centre = { x: canvasBox.x + canvasBox.width / 2, y: canvasBox.y + canvasBox.height / 2 }
  // Margen de 40 px alrededor del centro: cubre el cuerpo y el arranque de los gizmos.
  const covers = labelBox.x < centre.x + 40 && labelBox.x + labelBox.width > centre.x - 40
    && labelBox.y < centre.y + 40 && labelBox.y + labelBox.height > centre.y - 40
  expect(covers).toBe(false)
  expect(labelBox.x).toBeGreaterThanOrEqual(canvasBox.x)
  expect(labelBox.y).toBeGreaterThanOrEqual(canvasBox.y)
})
