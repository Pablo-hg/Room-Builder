import { expect, test } from '@playwright/test'

test('permite cambiar vistas, añadir un objeto y guardar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Room Builder', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Plano' }).click()
  await expect(page.getByRole('button', { name: 'Plano' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Sillón/ }).click()
  await expect(page.getByText('Sillón', { exact: true }).last()).toBeVisible()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Diseño guardado')
})

test('ofrece las cuatro orientaciones isométricas sin mover los datos', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Mesa/ }).click()
  const coordinates = page.getByText('0.00, 0.00 m', { exact: true })
  await expect(coordinates).toBeVisible()
  const right = page.getByRole('button', { name: 'Girar a la derecha' })
  await right.click({ clickCount: 4, delay: 100 })
  await expect(coordinates).toBeVisible()
  await expect(page.getByRole('button', { name: 'Isométrica' })).toHaveAttribute('aria-pressed', 'true')
})
