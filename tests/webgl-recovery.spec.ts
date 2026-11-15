import { expect, test } from '@playwright/test'

test('el editor conserva el guardado si WebGL no está disponible', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null
      return original.apply(this, [type, ...args] as Parameters<typeof original>)
    } as typeof original
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  await expect(page.getByRole('alert')).toContainText('No se puede mostrar la escena 3D')
  await page.getByRole('button', { name: 'Asientos', exact: true }).click()
  await page.getByRole('button', { name: 'Silla ＋ Añadir' }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Diseño guardado' })).toBeVisible()
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).focus()
  await page.keyboard.press('Shift+F10')
  await page.getByRole('menuitem', { name: /Descargar 3D/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'No se puede exportar el modelo 3D' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: 'Diseño recuperado' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('No se puede mostrar la escena 3D')
})
