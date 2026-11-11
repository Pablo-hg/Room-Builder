import { expect, test } from '@playwright/test'

// #26 · Cotas del perímetro en Plano bajo «Mostrar detalles».
test('«Mostrar detalles» alterna Plano normal y detallado sin cambiar cámara, selección ni historial', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
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

  const canvas = page.locator('.scene-panel canvas').first()
  const undo = page.getByRole('button', { name: 'Deshacer el último cambio', exact: true })
  const undoEnabled = await undo.isEnabled()
  const normal = await canvas.screenshot()
  await page.screenshot({ path: testInfo.outputPath('plano-normal.png') })

  await toggle.check()
  await expect(summary).toHaveText(/^Cotas: .+ — Pared A: 4,00 m; Pared B: 3,00 m; Pared C: 4,00 m; Pared D: 3,00 m\.$/)
  await expect(page.getByRole('button', { name: 'Plano', exact: true })).toBeVisible()
  expect(await undo.isEnabled()).toBe(undoEnabled)
  const detailed = await canvas.screenshot()
  expect(detailed.equals(normal)).toBe(false)
  await page.screenshot({ path: testInfo.outputPath('plano-detallado.png') })

  // Las etiquetas se actualizan al editar con precisión centimétrica, sin recargar.
  await width.fill('4,37')
  await width.press('Enter')
  await expect(summary).toContainText('Pared A: 4,37 m')
  await expect(summary).toContainText('Pared C: 4,37 m')

  await toggle.uncheck()
  await expect(summary).toHaveText('')
  await width.fill('4')
  await width.press('Enter')
  await expect.poll(async () => (await canvas.screenshot()).equals(normal)).toBe(true)
})

test('la capa de detalles no se ve fuera de Plano y se conserva al volver', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
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
  await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
  await page.getByRole('button', { name: 'Encima', exact: true }).click()
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await page.getByLabel('Cámara enfocada en…').selectOption({ index: 1 })

  const toggle = page.getByRole('checkbox', { name: 'Mostrar detalles', exact: true })
  await toggle.check()
  await expect(page.locator('#plan-details-summary')).toContainText('Habitación 2 — Pared A:')

  // Arrastrar el suelo de la habitación adicional desplaza la cámara del Plano.
  const canvas = page.locator('.scene-panel canvas').first()
  const box = (await canvas.boundingBox())!
  // Primero un clic: selecciona el suelo y así la captura no depende del resaltado.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(300)
  const before = await canvas.screenshot()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false)
})

test('en Plano se puede desplazar arrastrando fuera de las habitaciones', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  const canvas = page.locator('.scene-panel canvas').first()
  const box = (await canvas.boundingBox())!
  // Lateral del lienzo: fuera de la habitación y de su plataforma.
  const start = { x: box.x + 70, y: box.y + box.height / 2 }
  await page.mouse.click(start.x, start.y)
  await page.waitForTimeout(300)
  const before = await canvas.screenshot()
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 150, start.y + 40, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false)
  await page.getByRole('button', { name: 'Restablecer posición y zoom del plano' }).click()
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(true)
})
