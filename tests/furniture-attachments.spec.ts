import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { expandAllCatalogCategories } from './helpers/catalog'

// Cada tipo se comprueba en una página aislada: los cambios de cámara no
// consumen el timeout de las operaciones de guardado de otros objetos.
for (const { name, kind } of [
  { name: 'Alfombra', kind: 'rug' },
  { name: 'Alfombra circular', kind: 'circularRug' },
  { name: 'Lámpara de techo', kind: 'ceilingLamp' },
] as const) {
  test(`los candados de ${name} permiten elegir Y y conservan su posición al guardar`, async ({ page }, testInfo) => {
    await page.goto('/')
    await expandAllCatalogCategories(page)
    const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
    await page.getByRole('button', { name: `${name} ＋ Añadir`, exact: true }).click()
    await expect(inspector.getByRole('heading', { name, exact: true })).toBeVisible()
    const y = inspector.getByRole('slider', { name: 'Posición Y', exact: true })
    await expect(y).toBeDisabled()

    for (const view of ['Frontal', 'Plano', 'Isométrica']) {
      await page.getByRole('button', { name: view, exact: true }).click()
      await expect(y).toBeDisabled()
    }
    if (kind === 'ceilingLamp') await page.screenshot({ path: testInfo.outputPath('lampara-fijada.png') })

    const lock = inspector.getByRole('checkbox', { name: 'Bloquear eje Y', exact: true })
    await lock.uncheck()
    await expect(y).toBeEnabled()
    const input = inspector.getByRole('textbox', { name: 'Introducir Y en metros', exact: true })
    await input.fill('1.25')
    await input.press('Enter')
    await lock.check()
    await expect(y).toHaveValue('1.25')
    await expect(y).toBeDisabled()

    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem('room-builder:v0.1:designs')!)[0].data)
    expect(data.furniture).toHaveLength(1)
    expect(data.furniture[0].kind).toBe(kind)
    expect(data.furniture[0].attachmentPolicy).toBe('by-type')
    expect(data.furniture[0].y).toBe(1.25)
    expect(data.furniture[0].axisLocks).toEqual({ x: false, y: true, z: false })
  })
}

test('las lámparas libres permiten mover Y un centímetro y conservarlo al guardar', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  for (const name of ['Lámpara', 'Lámpara de mesa']) {
    await page.getByRole('button', { name: `${name} ＋ Añadir`, exact: true }).click()
    await expect(inspector.getByRole('heading', { name, exact: true })).toBeVisible()
    const y = inspector.getByRole('slider', { name: 'Posición Y', exact: true })
    await expect(y).toBeVisible()
    await y.focus()
    await y.press('ArrowRight')
    await expect(y).toHaveValue('0.03')
  }

  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('room-builder:v0.1:designs')!)[0].data)
  expect(data.furniture).toHaveLength(2)
  expect(data.furniture.every((item: { attachmentPolicy?: string }) => item.attachmentPolicy === 'by-type')).toBe(true)
  expect(data.furniture.every((item: { y: number }) => item.y === 0.01)).toBe(true)
})

test('objetos antiguos conservan su altura y libertad al mezclar nuevos y recargar', async ({ page }) => {
  const data = JSON.parse(readFileSync(new URL('./fixtures/persisted-designs/valid-v5.json', import.meta.url), 'utf8'))
  data.furniture = [
    { id: 'old-rug', kind: 'rug', name: 'Alfombra antigua', x: -1.5, y: 0.75, z: 0, width: 2, depth: 1.5, height: 0.05, rotation: 0, color: '#b97862' },
    { id: 'old-ceiling', kind: 'ceilingLamp', name: 'Lámpara antigua', x: 1.5, y: 1, z: 0, width: 0.75, depth: 0.75, height: 0.6, rotation: 0, color: '#d3a755' },
  ]
  for (const layout of data.layouts) layout.furniture = structuredClone(data.furniture)
  const saved = [{ id: 'mixed', name: 'Antiguo y nuevo', savedAt: '2026-11-03T10:00:00.000Z', data }]
  await page.addInitScript((entries) => {
    if (!localStorage.getItem('room-builder:v0.1:designs')) localStorage.setItem('room-builder:v0.1:designs', JSON.stringify(entries))
  }, saved)
  await page.goto('/')
  await expandAllCatalogCategories(page)
  const load = async () => {
    await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
    await page.getByRole('button', { name: 'Antiguo y nuevo', exact: true }).click()
  }
  await load()
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('room-builder:v0.1:designs')!))
  expect(stored).toEqual(saved)
  const oldRug = page.locator('.element-select').filter({ hasText: 'Alfombra antigua' })
  const y = page.getByRole('slider', { name: 'Posición Y', exact: true })
  await oldRug.click()
  await expect(y).toHaveValue('0.77')
  await y.focus()
  await y.press('ArrowRight')
  await expect(y).toHaveValue('0.78')
  await page.getByRole('button', { name: 'Alfombra ＋ Añadir', exact: true }).click()
  await expect(y).toBeDisabled()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.reload()
  await load()
  const newRug = page.locator('.element-select').filter({ hasText: 'Alfombra' }).filter({ hasNotText: 'antigua' })
  await newRug.click()
  await expect(y).toBeDisabled()
  await oldRug.click()
  await expect(y).toHaveValue('0.78')
})

test('la selección mixta bloquea el eje Y y conserva el movimiento horizontal', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: 'Alfombra ＋ Añadir', exact: true }).click()
  await page.getByRole('button', { name: 'Lámpara de mesa ＋ Añadir', exact: true }).click()
  await page.locator('.element-select').filter({ hasText: 'Alfombra' }).click({ modifiers: ['Control'] })
  await expect(page.getByRole('slider', { name: 'Posición Y del conjunto', exact: true })).toBeDisabled()
  const z = page.getByRole('slider', { name: 'Posición Z del conjunto', exact: true })
  const initial = await z.inputValue()
  await z.focus()
  await z.press('ArrowRight')
  await expect(z).not.toHaveValue(initial)
})
