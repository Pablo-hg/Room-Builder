// Accesibilidad, teclado y uso táctil (F1 · #31). Cada test cubre una corrección de la
// auditoría (docs/progress/F1_A11Y_AUDIT.md) con menos de 10 gestos.
import { expect, test, type Page } from '@playwright/test'

const FOCUS_RING = 'rgb(66, 85, 71)'

async function dismissInvitationWithKeyboard(page: Page) {
  await page.getByRole('button', { name: 'Ahora no' }).focus()
  await page.keyboard.press('Enter')
}

test('flujo P0 solo con teclado: añadir, guardar y exportar JSON @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await dismissInvitationWithKeyboard(page)
  await page.getByRole('button', { name: 'Asientos', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary', { name: 'Inspector y configuración detallada' }).getByRole('heading', { name: 'Sillón' })).toBeVisible()
  await page.keyboard.press('Control+g')
  await expect(page.getByRole('status').filter({ hasText: 'Diseño guardado' })).toBeVisible()
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).focus()
  await page.keyboard.press('Shift+F10')
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Exportar diseño/ }).focus()
  await page.keyboard.press('Enter')
  expect((await download).suggestedFilename()).toMatch(/\.json$/)
})

test('cerrar el aviso o la guía con teclado deja el foco en «Ver guía de primer uso»', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await dismissInvitationWithKeyboard(page)
  const restart = page.getByRole('button', { name: 'Ver guía de primer uso' })
  await expect(restart).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(restart).toBeFocused()
})

test('Escape en el menú contextual de la lista no deselecciona y devuelve el foco a la fila', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  const row = page.getByRole('button', { name: /^Pared A Superficie/ })
  await row.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Shift+F10')
  // El foco entra en el menú (primer elemento activo; en una pared, «Copiar» está desactivado).
  await expect(page.locator('[role="menu"] :focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(row).toBeFocused()
  await expect(row).toHaveAttribute('aria-pressed', 'true')
})

test('el anillo de foco es sólido y la fila de la escena lo muestra en su caja completa', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  const toggle = page.getByRole('button', { name: 'Construcción', exact: true })
  await toggle.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(toggle).toHaveCSS('outline-color', FOCUS_RING)
  const row = page.locator('.element-row').filter({ has: page.getByRole('button', { name: /^Suelo/ }) })
  await row.locator('.element-select').focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(row).toHaveCSS('outline-color', FOCUS_RING)
  await expect(row.locator('.element-select')).toHaveCSS('outline-style', 'none')
})

test('las alternativas de teclado de la brújula se ven al recibir el foco', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  const option = page.getByRole('button', { name: 'Ver en isométrica las paredes A y B' })
  await option.focus()
  const box = await option.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(24)
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(24)
})

test('el menú de diseños guardados se cierra al salir de él con Tab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#saved-designs-popup')).toBeVisible()
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('Tab')
  await expect(page.locator('#saved-designs-popup')).toHaveCount(0)
})

test('el error de una medida queda enlazado a su campo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  const width = page.getByRole('textbox', { name: 'Introducir anchura en metros' })
  await width.fill('abc')
  await width.press('Enter')
  const errorId = await width.getAttribute('aria-describedby')
  expect(errorId).toBeTruthy()
  await expect(page.locator(`[id="${errorId}"]`)).toHaveAttribute('role', 'alert')
})

test.describe('móvil táctil', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })

  test('cabecera compacta, sin desplazamiento horizontal y zonas táctiles de al menos 32 px', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Ahora no' }).tap()
    const header = await page.locator('.topbar').boundingBox()
    expect(header?.height ?? 999).toBeLessThanOrEqual(130)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
    const smallest = await page.evaluate(() => {
      const selectors = '.catalog-family__toggle, .element-action, .element-folder__collapse, .measurement-stepper button, .switch'
      return Math.min(...[...document.querySelectorAll<HTMLElement>(selectors)]
        .filter((element) => element.offsetParent !== null)
        .map((element) => { const rect = element.getBoundingClientRect(); return Math.min(rect.width, rect.height) }))
    })
    expect(smallest).toBeGreaterThanOrEqual(32)
  })
})
