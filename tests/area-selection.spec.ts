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
