import { expect, test, type Page } from '@playwright/test'

/** Pintar y Cuentagotas (#39): se manejan con teclado y con el dedo, sin depender del ratón. */

const call = (page: Page, action: string, ...args: unknown[]) => page.evaluate(async ({ action, args }) => {
  const path = '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ path)
  return useRoomStore.getState()[action](...args)
}, { action, args })

const stateOf = (page: Page) => page.evaluate(async () => {
  const path = '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ path)
  const state = useRoomStore.getState()
  return {
    floorMaterial: state.room.floorMaterial as { id: string } | undefined,
    sofa: state.furniture[0]?.material as { id: string } | undefined,
    selectedId: state.selectedId as string | null,
    paintTool: state.paintTool as { mode: string; finish: { id: string; scale: number } } | null,
  }
})

/** Lienzo de la vista 3D: el mayor de la escena (el panel de Pintar y la brújula tienen lienzos propios más pequeños). */
async function sceneCanvas(page: Page) {
  const boxes = await page.locator('.scene-panel canvas').evaluateAll((canvases) => canvases.map((canvas) => { const r = canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))
  return boxes.sort((a, b) => b.width * b.height - a.width * a.height)[0]
}

async function openEditor(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('room-builder:first-use-guide:v1', 'seen') } catch { /* sin almacenamiento */ } })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
}

test('con teclado: activar, construir el material, ver la muestra, pintar el seleccionado y terminar con Esc', async ({ page }) => {
  await openEditor(page)
  await call(page, 'addFurniture', 'sofa')

  const toggle = page.getByRole('button', { name: 'Pintar', exact: true })
  await toggle.focus()
  await page.keyboard.press('Enter')
  const panel = page.getByRole('region', { name: 'Herramienta Pintar' })
  await expect(panel).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  // Mismos campos que el inspector, con nombre propio para no confundirse con él.
  await panel.getByLabel('Familia del pincel', { exact: true }).selectOption('wood')
  await panel.getByLabel('Escala del acabado del pincel', { exact: true }).fill('2')
  await expect.poll(async () => (await stateOf(page)).paintTool?.finish.scale).toBe(2)
  await expect(panel.getByRole('img', { name: /^Muestra de .* con escala 2\.0/ })).toBeVisible()
  const brush = (await stateOf(page)).paintTool!.finish.id

  await panel.getByRole('button', { name: /^Pintar «/ }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await stateOf(page)).sofa?.id).toBe(brush)

  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
})

test('el cuentagotas copia el material del elemento seleccionado y vuelve al pincel', async ({ page }) => {
  await openEditor(page)
  await call(page, 'addFurniture', 'sofa')
  await call(page, 'setMaterialFinish', (await stateOf(page)).selectedId, { id: 'oak', color: '#c9a06c', scale: 1, rotation: 0 })
  await page.getByRole('button', { name: 'Pintar', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Herramienta Pintar' })
  await panel.getByRole('button', { name: 'Cuentagotas' }).click()
  await panel.getByRole('button', { name: 'Copiar del seleccionado' }).click()
  await expect.poll(async () => (await stateOf(page)).paintTool?.finish.id).toBe('oak')
  await expect(panel.getByRole('button', { name: 'Cuentagotas' })).toHaveAttribute('aria-pressed', 'false')
})

test.describe('táctil', () => {
  test.use({ hasTouch: true, viewport: { width: 1000, height: 760 } })

  test('un toque sobre el suelo lo pinta con el material del pincel', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'Plano', exact: true }).tap()
    await page.getByRole('button', { name: 'Pintar', exact: true }).tap()
    const panel = page.getByRole('region', { name: 'Herramienta Pintar' })
    await expect(panel).toBeVisible()
    await panel.getByLabel('Familia del pincel', { exact: true }).selectOption('ceramic')
    const canvas = await sceneCanvas(page)
    await page.touchscreen.tap(canvas!.x + canvas!.width / 2, canvas!.y + canvas!.height / 2)
    await expect.poll(async () => (await stateOf(page)).floorMaterial?.id).toBeTruthy()
  })
})
