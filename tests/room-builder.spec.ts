import { expect, test } from '@playwright/test'

test('permite cambiar vistas, añadir un objeto y guardar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Room Builder', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Plano' }).click()
  await expect(page.getByRole('button', { name: 'Plano' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Sillón/ }).click()
  await expect(page.getByText('Sillón', { exact: true }).last()).toBeVisible()
  const chairVisibility = page.getByRole('checkbox', { name: 'Mostrar Sillón' })
  await expect(chairVisibility).toBeChecked()
  await chairVisibility.click()
  await expect(chairVisibility).not.toBeChecked()
  await chairVisibility.click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.locator('.toast')).toContainText('Diseño guardado')
})

test('lista puerta y ventanas y conserva su visibilidad al recuperar', async ({ page }) => {
  await page.goto('/')
  const doorVisibility = page.getByRole('checkbox', { name: 'Mostrar Puerta' })
  const windowVisibility = page.getByRole('checkbox', { name: 'Mostrar Ventana 1' })
  await expect(doorVisibility).toBeChecked()
  await expect(windowVisibility).toBeChecked()
  await windowVisibility.click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await windowVisibility.click()
  await page.getByRole('button', { name: 'Recuperar' }).click()
  await expect(windowVisibility).not.toBeChecked()
})

test('ofrece las cuatro orientaciones isométricas sin mover los datos', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Mesa/ }).click()
  const coordinates = page.getByText('0.00, 0.00 m', { exact: true })
  await expect(coordinates).toBeVisible()
  await expect(page.getByLabel('Vista diagonal · paredes visibles A y D')).toBeVisible()
  const right = page.getByRole('button', { name: 'Girar a la derecha' })
  await right.click()
  await expect(page.getByLabel('Vista diagonal · paredes visibles A y B')).toBeVisible()
  await right.click({ clickCount: 3, delay: 100 })
  await expect(coordinates).toBeVisible()
  await expect(page.getByLabel('Vista diagonal · paredes visibles A y D')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Isométrica', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('permite volver a seleccionar un mueble después de pulsar fuera', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()

  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  await expect(inspector.getByRole('heading', { name: 'Sillón' })).toBeVisible()

  const canvas = page.locator('.scene-panel canvas').first()
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas de la habitación')

  await page.mouse.click(bounds.x + bounds.width * 0.70, bounds.y + bounds.height * 0.58)
  await expect(inspector.getByRole('heading', { name: 'Nada seleccionado' })).toBeVisible()

  await page.mouse.click(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.51)
  await expect(inspector.getByRole('heading', { name: 'Sillón' })).toBeVisible()
})

test('coloca los muebles nuevos en sectores libres', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Mesa/ }).click()
  await expect(page.getByText('0.00, 0.00 m', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Sillón/ }).click()
  await expect(page.getByText('0.00, 0.00 m', { exact: true })).not.toBeVisible()
  await expect(page.locator('.toast')).toContainText('Sillón añadido')
})

test('incluye puerta y ventana en el catálogo y abre sus propiedades a la izquierda', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.catalog-card')).toHaveCount(10)
  for (const name of ['Sofá', 'Silla', 'Cama', 'Estantería', 'Lámpara']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible()
  }
  await page.getByRole('button', { name: /Puerta Seleccionar/ }).click()
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  await expect(inspector.getByRole('heading', { name: 'Puerta' })).toBeVisible()
  await expect(inspector.getByText('Posición lateral')).toBeVisible()
  await expect(inspector.getByText('1.00 m', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Ventana.*Añadir/ }).click()
  await expect(inspector.getByRole('heading', { name: 'Ventana' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Mostrar Ventana 2' })).toBeChecked()
  await expect(page.locator('.toast')).toContainText('Ventana añadida')
})
