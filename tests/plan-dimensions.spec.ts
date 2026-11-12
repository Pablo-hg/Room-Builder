import { expect, test } from '@playwright/test'
import { readPlanScene } from './helpers/planScene'
import { expandAllCatalogCategories } from './helpers/catalog'

// #26 · Cotas del perímetro en Plano bajo «Mostrar detalles».
test('«Mostrar detalles» alterna Plano normal y detallado sin cambiar cámara, selección ni historial', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expandAllCatalogCategories(page)
  const width = page.getByRole('textbox', { name: 'Introducir anchura en metros', exact: true })
  const depth = page.getByRole('textbox', { name: 'Introducir profundidad en metros', exact: true })
  await width.fill('4')
  await width.press('Enter')
  await depth.fill('3')
  await depth.press('Enter')
  await page.getByRole('button', { name: 'Plano', exact: true }).click()

  const toggle = page.getByRole('checkbox', { name: 'Mostrar detalles', exact: true })
  await expect(toggle).toBeVisible()
  await expect(toggle).not.toBeChecked()
  const summary = page.locator('#plan-details-summary')
  await expect(summary).toHaveText('')

  const undo = page.getByRole('button', { name: 'Deshacer el último cambio', exact: true })
  const undoEnabled = await undo.isEnabled()
  await expect.poll(async () => (await readPlanScene(page)).viewportReady).toBe(true)
  const normal = await readPlanScene(page)
  expect(normal.dimensions).toHaveLength(0)
  await page.screenshot({ path: testInfo.outputPath('plano-normal.png') })

  await toggle.check()
  await expect(summary).toHaveText(/^Cotas: .+ — Pared A: 4,00 m; Pared B: 3,00 m; Pared C: 4,00 m; Pared D: 3,00 m\.$/)
  await expect(page.getByRole('button', { name: 'Plano', exact: true })).toBeVisible()
  expect(await undo.isEnabled()).toBe(undoEnabled)
  await expect.poll(async () => (await readPlanScene(page)).dimensions.length).toBe(4)
  const detailed = await readPlanScene(page)
  expect(detailed.camera).toEqual(normal.camera)
  expect(detailed.selectedIds).toEqual(normal.selectedIds)
  expect(detailed.selectedId).toBe(normal.selectedId)
  expect([detailed.undoCount, detailed.redoCount]).toEqual([normal.undoCount, normal.redoCount])
  expect(detailed.dimensions.map((dimension) => dimension.length).sort()).toEqual([3, 3, 4, 4])
  await page.screenshot({ path: testInfo.outputPath('plano-detallado.png') })

  // Las etiquetas se actualizan al editar con precisión centimétrica, sin recargar.
  await width.fill('4,37')
  await width.press('Enter')
  await expect(summary).toContainText('Pared A: 4,37 m')
  await expect(summary).toContainText('Pared C: 4,37 m')
  await expect.poll(async () => (await readPlanScene(page)).dimensions.map((dimension) => dimension.length).sort()).toEqual([3, 3, 4.37, 4.37])

  await toggle.uncheck()
  await expect(summary).toHaveText('')
  await width.fill('4')
  await width.press('Enter')
  await expect.poll(async () => (await readPlanScene(page)).dimensions.length).toBe(0)
  const restored = await readPlanScene(page)
  expect(restored.camera).toEqual(normal.camera)
  expect([restored.width, restored.depth]).toEqual([4, 3])
  expect([restored.topCameraX, restored.topCameraZ, restored.cameraZoom]).toEqual([normal.topCameraX, normal.topCameraZ, normal.cameraZoom])
  expect(restored.selectedIds).toEqual(normal.selectedIds)
  expect(restored.undoCount).toBe(normal.undoCount + 2)
})

test('la capa de detalles no se ve fuera de Plano y se conserva al volver', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Mostrar detalles', exact: true }).check()
  await page.getByRole('button', { name: 'Isométrica', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Mostrar detalles', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Mostrar detalles', exact: true })).toBeChecked()
})

test('el conmutador sigue accesible en pantalla estrecha', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  const toggle = page.getByRole('checkbox', { name: 'Mostrar detalles', exact: true })
  await toggle.scrollIntoViewIfNeeded()
  await expect(toggle).toBeVisible()
  await toggle.check()
  await expect(toggle).toBeChecked()
})

test('las cotas y el arrastre del plano funcionan en una habitación adicional', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
  await page.getByRole('button', { name: 'Encima', exact: true }).click()
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await page.getByLabel('Cámara enfocada en…').selectOption({ index: 1 })

  const toggle = page.getByRole('checkbox', { name: 'Mostrar detalles', exact: true })
  await toggle.check()
  await expect(page.locator('#plan-details-summary')).toContainText('Habitación 2 — Pared A:')

  // Arrastrar el suelo de la habitación adicional desplaza la cámara del Plano.
  await expect.poll(async () => (await readPlanScene(page)).viewportReady).toBe(true)
  const point = (await readPlanScene(page)).floorPoint
  await page.mouse.click(point.x, point.y)
  const before = await readPlanScene(page)
  expect(before.activeRoomId).toBeTruthy()
  expect(before.floorHits[0]?.pannable).toBe(true)
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x + 120, point.y + 60, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => {
    const after = await readPlanScene(page)
    return Math.hypot(after.topCameraX - before.topCameraX, after.topCameraZ - before.topCameraZ)
  }).toBeGreaterThan(0.1)
  const after = await readPlanScene(page)
  expect(after.camera.position).not.toEqual(before.camera.position)
  expect(after.camera.quaternion).toEqual(before.camera.quaternion)
  expect(after.camera.zoom).toBe(before.camera.zoom)
  expect(after.structurePacks).toEqual(before.structurePacks)
  expect(after.selectedId).toBe(before.selectedId)
  expect([after.undoCount, after.redoCount]).toEqual([before.undoCount, before.redoCount])
})

test('en Plano se puede desplazar arrastrando fuera de las habitaciones', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  const canvas = page.locator('.scene-panel canvas').first()
  const box = (await canvas.boundingBox())!
  // Lateral del lienzo: fuera de la habitación y de su plataforma.
  const start = { x: box.x + 70, y: box.y + box.height / 2 }
  await page.mouse.click(start.x, start.y)
  const before = await readPlanScene(page)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 150, start.y + 40, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => {
    const after = await readPlanScene(page)
    return Math.hypot(after.topCameraX - before.topCameraX, after.topCameraZ - before.topCameraZ)
  }).toBeGreaterThan(0.1)
  const moved = await readPlanScene(page)
  expect(moved.camera.position).not.toEqual(before.camera.position)
  expect(moved.room).toEqual(before.room)
  expect([moved.undoCount, moved.redoCount]).toEqual([before.undoCount, before.redoCount])
  await page.getByRole('button', { name: 'Restablecer posición y zoom del plano' }).click()
  await expect.poll(async () => {
    const reset = await readPlanScene(page)
    return [reset.topCameraX, reset.topCameraZ, reset.cameraZoom]
  }).toEqual([0, 0, 1])
  expect((await readPlanScene(page)).camera).toEqual(before.camera)
})
