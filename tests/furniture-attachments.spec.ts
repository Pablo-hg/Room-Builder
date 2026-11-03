import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('los nuevos anclajes ocultan Y y las lámparas libres mantienen la edición vertical', async ({ page }, testInfo) => {
  await page.goto('/')
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  for (const name of ['Alfombra', 'Alfombra circular', 'Lámpara de techo']) {
    await page.getByRole('button', { name: `${name} ＋ Añadir`, exact: true }).click()
    await expect(inspector.getByRole('slider', { name: 'Posición Y', exact: true })).toHaveCount(0)
    for (const view of ['Frontal', 'Plano', 'Isométrica']) {
      await page.getByRole('button', { name: view, exact: true }).click()
      await expect(inspector.getByRole('slider', { name: 'Posición Y', exact: true })).toHaveCount(0)
    }
  }
  await page.screenshot({ path: testInfo.outputPath('lampara-fijada.png') })
  for (const name of ['Lámpara', 'Lámpara de mesa']) {
    await page.getByRole('button', { name: `${name} ＋ Añadir`, exact: true }).click()
    const y = inspector.getByRole('slider', { name: 'Posición Y', exact: true })
    await expect(y).toBeVisible()
    await y.focus()
    await y.press('ArrowRight')
    await expect(y).toHaveValue('0.125')
  }
  await page.getByRole('button', { name: 'Guardar como', exact: true }).click()
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('room-builder:v0.1:designs')!)[0].data)
  expect(data.furniture.every((item: { attachmentPolicy?: string }) => item.attachmentPolicy === 'by-type')).toBe(true)
  for (const item of data.furniture) {
    expect(item.y).toBe(item.kind === 'ceilingLamp' ? data.room.height - item.height : item.kind === 'rug' || item.kind === 'circularRug' ? 0 : 0.125)
  }
})

test('objetos antiguos conservan su altura y libertad al mezclar nuevos y recargar', async ({ page }) => {
  const data = JSON.parse(readFileSync(new URL('./fixtures/layout-variants/valid-v5.json', import.meta.url), 'utf8'))
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
  await expect(y).toHaveValue('0.75')
  await y.focus()
  await y.press('ArrowRight')
  await expect(y).toHaveValue('0.875')
  await page.getByRole('button', { name: 'Alfombra ＋ Añadir', exact: true }).click()
  await expect(y).toHaveCount(0)
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await page.reload()
  await load()
  const newRug = page.locator('.element-select').filter({ hasText: 'Alfombra' }).filter({ hasNotText: 'antigua' })
  await newRug.click()
  await expect(y).toHaveCount(0)
  await oldRug.click()
  await expect(y).toHaveValue('0.875')
})

test('la selección mixta bloquea el eje Y y conserva el movimiento horizontal', async ({ page }) => {
  await page.goto('/')
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
