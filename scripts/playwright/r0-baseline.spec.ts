import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const savedDesignsKey = 'room-builder:v0.1:designs'
const outputDirectory = resolve(process.cwd(), 'output', 'playwright', 'r0-baseline')
const referenceDesign = JSON.parse(readFileSync(
  resolve(process.cwd(), 'tests', 'fixtures', 'persistence-v1', 'valid-complete.json'),
  'utf8',
)) as unknown

test('captura las cinco vistas y las cuatro orientaciones isometricas de R0', async ({ page }) => {
  mkdirSync(outputDirectory, { recursive: true })
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value)
  }, {
    key: savedDesignsKey,
    value: JSON.stringify([{
      id: 'r0-reference-design',
      name: 'Referencia R0',
      savedAt: '2026-10-26T12:00:00.000Z',
      data: referenceDesign,
    }]),
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Seleccionar dise\u00f1o guardado' }).click()
  await page.getByRole('button', { name: 'Referencia R0', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Mostrar Cama doble' })).toBeChecked()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(200)

  const scene = page.locator('.scene-panel')
  const capture = async (name: string) => {
    await scene.screenshot({
      path: resolve(outputDirectory, `${name}.png`),
      animations: 'disabled',
    })
  }

  const views = [
    ['Isom\u00e9trica', 'view-isometric'],
    ['Plano', 'view-top'],
    ['Frontal', 'view-front'],
    ['POV', 'view-pov'],
    ['Libre', 'view-free'],
  ] as const

  for (const [label, fileName] of views) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(100)
    await capture(fileName)
  }

  const orientations = [
    { id: 0, buttonWalls: 'D y A', visibleWalls: 'A y D' },
    { id: 1, buttonWalls: 'A y B', visibleWalls: 'A y B' },
    { id: 2, buttonWalls: 'B y C', visibleWalls: 'B y C' },
    { id: 3, buttonWalls: 'C y D', visibleWalls: 'C y D' },
  ] as const

  await page.getByRole('button', { name: 'Isom\u00e9trica', exact: true }).click()
  for (const { id, buttonWalls, visibleWalls } of orientations) {
    const orientationControl = page.getByRole('button', {
      name: `Ver en isom\u00e9trica las paredes ${buttonWalls}`,
      includeHidden: true,
    })
    await orientationControl.focus()
    await orientationControl.press('Enter')
    await expect(page.getByLabel(`Vista diagonal \u00b7 paredes visibles ${visibleWalls}`)).toBeVisible()
    await page.waitForTimeout(100)
    await capture(`isometric-${id}-walls-${visibleWalls.replaceAll(' ', '-').toLowerCase()}`)
  }
})
