import { expect, test, type Page } from '@playwright/test'
import { expandAllCatalogCategories, expandCatalogCategories } from './helpers/catalog'

async function planWithChairs(page: Page, count: number) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await expandCatalogCategories(page, ['Asientos'])
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  for (let index = 0; index < count; index += 1) await page.getByRole('button', { name: 'Sillón ＋ Añadir', exact: true }).click()
  const canvas = await page.locator('.scene-panel canvas').first().boundingBox()
  if (!canvas) throw new Error('Canvas no disponible')
  return canvas
}

test('Mayús + arrastrar sobre el fondo selecciona varios objetos y Escape los deselecciona', { tag: '@smoke' }, async ({ page }) => {
  const canvas = await planWithChairs(page, 3)
  const cx = canvas.x + canvas.width / 2
  const cy = canvas.y + canvas.height / 2
  await page.keyboard.down('Shift')
  await page.mouse.move(canvas.x + 12, canvas.y + 12)
  await page.mouse.down()
  await page.mouse.move(cx, cy, { steps: 8 })
  await expect(page.locator('.marquee-box')).toBeVisible()
  await page.mouse.move(cx + 120, cy + 120, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect(page.locator('.marquee-box')).toBeHidden()
  await expect(page.getByRole('heading', { name: /elementos seleccionados/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: /elementos seleccionados/ })).toHaveCount(0)
})

test('Ctrl+A selecciona todo lo disponible y Escape lo deselecciona', async ({ page }) => {
  await planWithChairs(page, 2)
  await page.keyboard.press('Control+a')
  await expect(page.getByRole('heading', { name: /elementos seleccionados/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: /elementos seleccionados/ })).toHaveCount(0)
})

test('la herramienta Selección por área funciona con pantalla táctil', async ({ page, context }) => {
  const canvas = await planWithChairs(page, 3)
  await page.getByRole('button', { name: /Selección por área/ }).click()
  await expect(page.getByRole('button', { name: /Selección por área/ })).toHaveAttribute('aria-pressed', 'true')
  const cx = canvas.x + canvas.width / 2
  const cy = canvas.y + canvas.height / 2
  const client = await context.newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: canvas.x + 12, y: canvas.y + 12 }] })
  for (let step = 1; step <= 10; step += 1) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: canvas.x + 12 + (cx + 120 - canvas.x - 12) * step / 10, y: canvas.y + 12 + (cy + 120 - canvas.y - 12) * step / 10 }] })
    await page.waitForTimeout(20)
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
  await expect(page.getByRole('heading', { name: /elementos seleccionados/ })).toBeVisible()
})

test('mantener el botón derecho activa la selección por área solo durante el gesto', async ({ page }) => {
  const canvas = await planWithChairs(page, 3)
  const tool = page.getByRole('button', { name: /Selección por área/ })
  const cx = canvas.x + canvas.width / 2
  const cy = canvas.y + canvas.height / 2
  await expect(tool).toHaveAttribute('aria-pressed', 'false')
  await page.mouse.move(canvas.x + 12, canvas.y + 12)
  await page.mouse.down({ button: 'right' })
  await expect(tool).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.move(cx + 120, cy + 120, { steps: 10 })
  await expect(page.locator('.marquee-box')).toBeVisible()
  await page.mouse.up({ button: 'right' })
  await expect(tool).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.marquee-box')).toBeHidden()
  await expect(page.getByRole('heading', { name: /elementos seleccionados/ })).toBeVisible()
})

test('el arrastre derecho respeta la herramienta manual y el clic derecho selecciona', async ({ page }) => {
  const canvas = await planWithChairs(page, 1)
  const tool = page.getByRole('button', { name: /Selección por área/ })
  await page.getByRole('button', { name: 'Carpeta Raíz', exact: true }).click()
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2, { button: 'right' })
  await expect(page.getByRole('button', { name: 'Sillón Asientos' })).toHaveAttribute('aria-pressed', 'true')
  await expect(tool).toHaveAttribute('aria-pressed', 'false')
  await tool.click()
  await page.mouse.move(canvas.x + 12, canvas.y + 12)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(canvas.x + canvas.width / 2 + 80, canvas.y + canvas.height / 2 + 80, { steps: 8 })
  await page.mouse.up({ button: 'right' })
  await expect(tool).toHaveAttribute('aria-pressed', 'true')
})

test('arrastrar con el derecho desde un objeto selecciona sin moverlo', async ({ page }) => {
  const canvas = await planWithChairs(page, 2)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('room-builder:v0.1:designs')!)[0].data.furniture)
  const cx = canvas.x + canvas.width / 2
  const cy = canvas.y + canvas.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(cx + 120, cy + 120, { steps: 8 })
  await expect(page.locator('.marquee-box')).toBeVisible()
  await page.mouse.up({ button: 'right' })
  await expect(page.getByRole('button', { name: /Selección por área/ })).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Control+g')
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('room-builder:v0.1:designs')!)[0].data.furniture)
  expect(after).toEqual(before)
})

test('el gesto derecho funciona en Isométrica y se cancela al perder el foco', async ({ page }) => {
  await planWithChairs(page, 1)
  await page.getByRole('button', { name: 'Isométrica', exact: true }).click()
  const canvas = page.locator('.scene-panel canvas').first()
  const bounds = (await canvas.boundingBox())!
  const tool = page.getByRole('button', { name: /Selección por área/ })
  await page.mouse.move(bounds.x + 12, bounds.y + 12)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(bounds.x + 90, bounds.y + 90, { steps: 4 })
  await expect(page.locator('.marquee-box')).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(tool).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.marquee-box')).toBeHidden()
  await page.mouse.up({ button: 'right' })
})

test('un elemento bloqueado no entra en la selección por área ni se elimina con Suprimir', async ({ page }) => {
  const canvas = await planWithChairs(page, 2)
  const locks = page.locator('.element-lock')
  await locks.last().click()
  const cx = canvas.x + canvas.width / 2
  const cy = canvas.y + canvas.height / 2
  await page.keyboard.down('Shift')
  await page.mouse.move(canvas.x + 12, canvas.y + 12)
  await page.mouse.down()
  await page.mouse.move(cx + 120, cy + 120, { steps: 10 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  const rows = page.locator('.element-select')
  const before = await rows.count()
  await page.keyboard.press('Delete')
  await expect(rows).toHaveCount(before)
})
