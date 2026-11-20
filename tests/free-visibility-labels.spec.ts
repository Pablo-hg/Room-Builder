import { expect, test } from '@playwright/test'
import { expandCatalogCategories } from './helpers/catalog'

test('Libre agrupa superficies de ambas habitaciones y permite ocultar sus etiquetas', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  await expandCatalogCategories(page, ['Construcción'])
  await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
  await page.getByRole('button', { name: 'Pared B', exact: true }).click()
  await page.getByRole('button', { name: 'Libre', exact: true }).click()
  await page.locator('.free-visibility summary').click()
  const panel = page.locator('.free-visibility')
  await expect(panel.locator('fieldset')).toHaveCount(2)
  await expect(panel.locator('.free-visibility__row .material-swatch')).toHaveCount(10)
  const names = page.locator('.scene-panel .room-name-label')
  await expect(names).toHaveCount(2)
  await panel.getByLabel('Mostrar nombres y letras').uncheck()
  await expect(names).toHaveCount(0)
  await panel.getByLabel('Mostrar nombres y letras').check()
  await expect(names).toHaveCount(2)
})

test('la rueda desplaza el menú y WASD sigue moviendo la cámara tras usar un check', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 500 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ahora no' }).click()
  await page.getByRole('button', { name: 'Libre', exact: true }).click()
  await page.locator('.free-visibility summary').click()
  const menu = page.locator('.free-visibility__content')
  const cameraState = () => page.evaluate(async () => {
    const appSource = await (await fetch('/src/App.tsx')).text()
    const path = appSource.match(/from\s*["']([^"']*useRoomStore[^"']*)["']/)?.[1] ?? '/src/state/useRoomStore.ts'
    const { useRoomStore } = await import(/* @vite-ignore */ path)
    const state = useRoomStore.getState()
    return { zoom: state.freeCameraZoom, offset: { ...state.freeCameraOffset } }
  })
  const initial = await cameraState()
  await menu.hover()
  await page.mouse.wheel(0, 250)
  await expect.poll(() => menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect((await cameraState()).zoom).toBe(initial.zoom)

  const checkbox = menu.getByLabel('Mostrar nombres y letras')
  await checkbox.uncheck()
  const beforeMove = await cameraState()
  await page.keyboard.down('w')
  await expect.poll(async () => (await cameraState()).offset, { timeout: 3000 }).not.toEqual(beforeMove.offset)
  await page.keyboard.up('w')
  await expect(checkbox).toBeFocused()
})
