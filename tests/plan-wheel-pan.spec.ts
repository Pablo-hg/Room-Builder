import { expect, test, type Page } from '@playwright/test'
import { expandAllCatalogCategories } from './helpers/catalog'

// Desplazar el Plano manteniendo pulsada la rueda del ratón (botón central), desde cualquier punto.

const stateOf = (page: Page) => page.evaluate(async () => {
  const path = '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ path)
  const state = useRoomStore.getState()
  return {
    view: state.view as string, x: state.topCameraX as number, z: state.topCameraZ as number, undoCount: state.undoCount as number,
    selectedId: state.selectedId as string | null, draft: state.measureDraft as unknown, furniture: state.furniture.map((item: { x: number; z: number }) => [item.x, item.z]),
  }
})

async function canvasCentre(page: Page) {
  const bounds = await page.locator('.scene-panel canvas').first().boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas')
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

test('la rueda pulsada desplaza el Plano sobre un mueble sin seleccionar ni mover nada', { tag: '@smoke' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  await page.keyboard.press('Escape')
  const before = await stateOf(page)
  const c = await canvasCentre(page)
  // El centro del lienzo es el mueble: la rueda debe desplazar igualmente, sin arrastrarlo.
  await page.mouse.move(c.x + 12, c.y + 12)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(c.x + 112, c.y + 62, { steps: 6 })
  const during = await stateOf(page)
  await page.mouse.up({ button: 'middle' })
  const after = await stateOf(page)
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.3)
  expect(during.x).not.toBe(before.x)
  expect(after.view).toBe('top')
  expect(after.undoCount).toBe(before.undoCount)
  expect(after.selectedId).toBe(before.selectedId)
  expect(after.furniture).toEqual(before.furniture)
  // Soltar la rueda termina el gesto: mover el ratón ya no desplaza.
  await page.mouse.move(c.x + 200, c.y + 150, { steps: 3 })
  expect((await stateOf(page)).x).toBe(after.x)
})

test('con la herramienta Medir activa la rueda desplaza y el clic izquierdo sigue midiendo', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await page.getByRole('button', { name: 'Medir', exact: true }).click()
  const c = await canvasCentre(page)
  await page.mouse.move(c.x, c.y)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(c.x - 90, c.y + 40, { steps: 5 })
  await page.mouse.up({ button: 'middle' })
  const panned = await stateOf(page)
  expect(Math.hypot(panned.x, panned.z)).toBeGreaterThan(0.3)
  expect(panned.draft).toBeNull()
  await page.mouse.click(c.x + 40, c.y + 40)
  expect((await stateOf(page)).draft).not.toBeNull()
})

test('fuera de Plano la rueda no desplaza la cámara del Plano', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const before = await stateOf(page)
  const c = await canvasCentre(page)
  await page.mouse.move(c.x, c.y)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(c.x + 80, c.y + 40, { steps: 4 })
  await page.mouse.up({ button: 'middle' })
  const after = await stateOf(page)
  expect([after.x, after.z]).toEqual([before.x, before.z])
})

// ── Girar el Plano en cuatro lados ─────────────────────────────────────────────────────────────

test('el Plano gira en los cuatro lados con los botones y vuelve al inicio; no toca el diseño', { tag: '@smoke' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  const readout = page.locator('.plan-rotate output')
  const before = await stateOf(page)
  const seen: string[] = [await readout.innerText()]
  for (let step = 0; step < 3; step++) {
    await page.getByRole('button', { name: 'Girar el plano a la izquierda' }).click()
    seen.push(await readout.innerText())
  }
  expect(new Set(seen).size).toBe(4)
  await page.getByRole('button', { name: 'Girar el plano a la izquierda' }).click()
  await expect(readout).toHaveText(seen[0])
  await page.getByRole('button', { name: 'Girar el plano a la derecha' }).click()
  await expect(readout).toHaveText(seen[3])
  const after = await stateOf(page)
  expect(after.view).toBe('top')
  expect(after.undoCount).toBe(before.undoCount)
})

test('con el Plano girado, «Horizontal» sigue la pantalla y la rueda sigue desplazando', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await page.getByRole('button', { name: 'Girar el plano a la izquierda' }).click()
  await page.getByRole('button', { name: 'Medir', exact: true }).click()
  await page.getByRole('button', { name: 'Horizontal', exact: true }).click()
  const c = await canvasCentre(page)
  await page.mouse.click(c.x - 80, c.y - 40)
  await page.mouse.click(c.x + 90, c.y + 60)
  const draft = (await stateOf(page)).draft as { start: { x: number; z: number }; end: { x: number; z: number } }
  const dx = Math.abs(draft.end.x - draft.start.x), dz = Math.abs(draft.end.z - draft.start.z)
  // Girado un cuarto de vuelta, lo horizontal de la pantalla es un solo eje del mundo.
  expect(Math.min(dx, dz)).toBeLessThan(0.01)
  expect(Math.max(dx, dz)).toBeGreaterThan(0.5)
  await page.keyboard.press('Escape')
  await page.mouse.move(c.x, c.y)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(c.x - 90, c.y + 40, { steps: 5 })
  await page.mouse.up({ button: 'middle' })
  const panned = await stateOf(page)
  expect(Math.hypot(panned.x, panned.z)).toBeGreaterThan(0.3)
})
