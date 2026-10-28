import { expect, test } from '@playwright/test'

test('resuelve la selección del inspector para muebles, aperturas, packs y superficies', async ({ page }) => {
  await page.goto('/')
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })

  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  await expect(inspector.getByRole('heading', { name: 'Sillón', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Puerta Seleccionar/ }).click()
  await expect(inspector.getByRole('heading', { name: 'Puerta', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ventana ＋ Añadir', exact: true }).click()
  await expect(inspector.getByRole('heading', { name: 'Ventana', exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Nuevo piso vacío/ }).click()
  await expect(inspector.getByText('Pack de construcción', { exact: true })).toBeVisible()
  await inspector.getByRole('button', { name: 'Suelo · Editar', exact: true }).click()
  await expect(inspector.getByText('Superficie de construcción', { exact: true })).toBeVisible()
  await expect(inspector.getByRole('heading', { name: 'Suelo', exact: true })).toBeVisible()
  await inspector.getByRole('button', { name: 'Seleccionar pack completo', exact: true }).click()
  await expect(inspector.getByText('Pack de construcción', { exact: true })).toBeVisible()
})
