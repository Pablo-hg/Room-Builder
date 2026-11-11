import { expect, test } from '@playwright/test'

test('ofrece una guía opcional y permite recorrer los seis pasos y repetirla', async ({ page }) => {
  await page.goto('/')
  const invitation = page.getByRole('complementary', { name: 'Invitación a la guía de primer uso' })
  await expect(invitation).toBeVisible()
  await invitation.getByRole('button', { name: 'Empezar guía' }).click()
  const dialog = page.getByRole('dialog', { name: 'Empieza por las medidas' })
  await expect(dialog).toBeVisible()
  await expect(page.locator('.first-use-guide__spotlight')).toBeVisible()
  await expect(dialog).toContainText('Guía de inicio · 1 de 6')

  for (const step of [
    'Añade puertas y ventanas',
    'Amuebla y decora',
    'Edita el elemento seleccionado',
    'Explora las distintas vistas',
    'Guarda tu diseño',
  ]) {
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(page.getByRole('dialog')).toContainText(step)
  }
  await expect(page.getByRole('dialog')).toContainText('Guía de inicio · 6 de 6')
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('room-builder:first-use-guide:v1'))).toBe('seen')

  await page.reload()
  await expect(invitation).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver guía de primer uso' }).click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('saltar la invitación no bloquea el editor y se recuerda tras recargar', async ({ page }) => {
  await page.goto('/')
  const invitation = page.getByRole('complementary', { name: 'Invitación a la guía de primer uso' })
  await invitation.getByRole('button', { name: 'Ahora no' }).click()
  await expect(invitation).toHaveCount(0)
  await page.getByRole('button', { name: 'Guardar como' }).click()
  await expect(page.locator('.save-state')).not.toContainText('Cambios sin guardar')
  await page.reload()
  await expect(invitation).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ver guía de primer uso' })).toBeVisible()
})

test('los usuarios con diseños anteriores no reciben la invitación', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Guardar como' }).click()
  await page.evaluate(() => localStorage.removeItem('room-builder:first-use-guide:v1'))
  await page.reload()
  await expect(page.getByRole('complementary', { name: 'Invitación a la guía de primer uso' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ver guía de primer uso' })).toBeVisible()
})

test('la guía es navegable con teclado y cabe en un móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Empezar guía' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Cerrar la guía' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeFocused()
  const card = await dialog.boundingBox()
  expect(card).not.toBeNull()
  expect(card!.x).toBeGreaterThanOrEqual(0)
  expect(card!.x + card!.width).toBeLessThanOrEqual(390)
  expect(card!.y).toBeGreaterThanOrEqual(0)
  expect(card!.y + card!.height).toBeLessThanOrEqual(844)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})


test('reabrir la guía recupera los paneles necesarios sin tocar el diseño', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  await page.getByRole('button', { name: 'Minimizar panel izquierdo' }).click()
  await expect(page.locator('.workspace')).toHaveClass(/workspace--objects-collapsed/)
  await page.getByRole('button', { name: 'Ver guía de primer uso' }).click()
  await expect(page.locator('.workspace')).not.toHaveClass(/workspace--objects-collapsed/)
  await expect(page.getByRole('dialog', { name: 'Empieza por las medidas' })).toBeVisible()
  await page.getByRole('button', { name: 'Saltar guía' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
