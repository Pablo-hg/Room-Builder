import { expect, test } from '@playwright/test'

test('el paso 1 ilumina desde Raíz hasta el slider de Altura y sitúa el texto a su izquierda', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  const roomToggle = page.locator('.room-section__toggle')
  await roomToggle.click()
  await expect(roomToggle).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Ver guía de primer uso' }).click()
  await expect(roomToggle).toHaveAttribute('aria-expanded', 'true')

  const dialog = page.getByRole('dialog', { name: 'Empieza por las medidas' })
  const target = page.locator('[data-tour="room-dimensions"]')
  const spotlight = page.locator('.first-use-guide__spotlight')

  await expect(dialog).toBeVisible()
  await expect(dialog).not.toContainText('La habitación ya existe')
  await expect(target).toBeVisible()
  await expect(target).toContainText('Raíz')
  await expect(target.getByRole('slider', { name: 'Anchura' })).toBeVisible()
  await expect(target.getByRole('slider', { name: 'Profundidad' })).toBeVisible()
  await expect(target.getByRole('slider', { name: 'Altura' })).toBeVisible()
  await expect(target).toContainText('270 cm')

  const targetBox = await target.boundingBox()
  const spotlightBox = await spotlight.boundingBox()
  const cardBox = await dialog.boundingBox()
  expect(targetBox).not.toBeNull()
  expect(spotlightBox).not.toBeNull()
  expect(cardBox).not.toBeNull()
  expect(spotlightBox!.x).toBeLessThanOrEqual(targetBox!.x)
  expect(spotlightBox!.x + spotlightBox!.width).toBeGreaterThanOrEqual(targetBox!.x + targetBox!.width)
  expect(spotlightBox!.y).toBeLessThanOrEqual(targetBox!.y)
  expect(spotlightBox!.y + spotlightBox!.height).toBeGreaterThanOrEqual(targetBox!.y + targetBox!.height)
  expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(spotlightBox!.x)
  expect(targetBox!.y).toBeGreaterThanOrEqual(0)
  expect(targetBox!.y + targetBox!.height).toBeLessThanOrEqual(900)
  expect(cardBox!.y).toBeGreaterThanOrEqual(0)
  expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(900)
})

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
    'Explora Diseño',
    'Organiza la escena',
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
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: 'Guardado', exact: true })).toBeDisabled()
  await page.reload()
  await expect(invitation).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ver guía de primer uso' })).toBeVisible()
})

test('los usuarios con diseños anteriores no reciben la invitación', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Guardar' }).click()
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

test('la guía explica Diseño y Escena y despliega ambos apartados si estaban minimizados', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  const sidebar = page.getByRole('complementary', { name: 'Catálogo de objetos' })

  // Deja minimizados Diseño, su Catálogo y Escena antes de iniciar el recorrido.
  const catalog = sidebar.getByRole('button', { name: 'Catálogo', exact: true })
  await catalog.click()
  await expect(catalog).toHaveAttribute('aria-expanded', 'false')
  await sidebar.getByRole('button', { name: 'Minimizar Diseño' }).click()
  await expect(sidebar.getByRole('button', { name: 'Mostrar Diseño' })).toBeVisible()
  await sidebar.getByRole('button', { name: 'Minimizar escena' }).click()
  await expect(sidebar.getByRole('button', { name: 'Mostrar escena' })).toBeVisible()

  await page.getByRole('button', { name: 'Ver guía de primer uso' }).click()
  const dialog = page.getByRole('dialog', { name: 'Empieza por las medidas' })
  await page.getByRole('button', { name: 'Siguiente' }).click()

  const design = sidebar.locator('[data-tour="design"]')
  await expect(dialog).toContainText('Explora Diseño')
  await expect(design).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Minimizar Diseño' })).toBeVisible()
  await expect(catalog).toHaveAttribute('aria-expanded', 'true')
  await expect(sidebar.locator('#catalog-items-list').getByRole('button', { name: 'Construcción', exact: true })).toBeVisible()
  await expect(sidebar.locator('#catalog-items-list').getByRole('button', { name: 'Aperturas', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Siguiente' }).click()
  const scene = sidebar.locator('[data-tour="scene"]')
  await expect(dialog).toContainText('Organiza la escena')
  await expect(scene).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Minimizar escena' })).toBeVisible()
  await expect(sidebar.getByRole('heading', { name: 'Elementos en la habitación' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Crear carpeta de elementos' })).toBeVisible()
})

