import { expect, test } from '@playwright/test'

test('perder el foco de la ventana cierra el arrastre del inspector antes de editar con teclado', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  const position = page.locator('.selection-section--inspector').getByLabel('Posición X', { exact: true })
  const initial = await position.inputValue()
  await position.scrollIntoViewIfNeeded()
  const bounds = await position.boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el deslizador')
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height / 2, { steps: 4 })
  await expect(position).not.toHaveValue(initial)
  const dragged = await position.inputValue()
  // Reproduce the blur event without relying on OS focus changes in headless Chromium.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(position).toHaveValue(dragged)
  await position.press('ArrowRight')
  await expect(position).not.toHaveValue(dragged)
  const edited = await position.inputValue()
  await page.mouse.up()
  const select = page.locator('.element-select').filter({ hasText: 'Sillón' })
  for (const value of [dragged, initial]) {
    await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
    await select.click()
    await expect(position).toHaveValue(value)
  }
  for (const value of [dragged, edited]) {
    await page.getByRole('button', { name: 'Rehacer el último cambio deshecho' }).click()
    await select.click()
    await expect(position).toHaveValue(value)
  }
})

for (const finish of ['ratón', 'cancelación táctil'] as const) {
  test(`una ventana conserva un solo undo y el último desplazamiento: ${finish}`, async ({ page, context }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const orientation = page.getByRole('button', { name: 'Ver en isométrica las paredes A y B', includeHidden: true })
    await orientation.focus()
    await orientation.press('Enter')
    await page.getByRole('button', { name: 'Frontal', exact: true }).click()
    const select = page.getByRole('button', { name: /Ventana 1 Apertura/ })
    await select.click()
    const offset = page.locator('.selection-section--inspector').getByLabel('Posición lateral', { exact: true })
    const initial = await offset.inputValue()
    const bounds = await page.locator('.scene-panel canvas').first().boundingBox()
    if (!bounds) throw new Error('No se pudo localizar el canvas')
    const x = bounds.x + bounds.width / 2 + 35
    const y = bounds.y + bounds.height * 0.475
    if (finish === 'ratón') {
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.waitForTimeout(150)
      await page.mouse.move(x + 90, y, { steps: 8 })
      await page.mouse.up()
    } else {
      const client = await context.newCDPSession(page)
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      await page.waitForTimeout(150)
      for (let step = 1; step <= 8; step++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 90 * step / 8, y }] })
        await page.waitForTimeout(20)
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
      await client.detach()
    }
    await expect(offset).not.toHaveValue(initial)
    const moved = await offset.inputValue()
    await offset.focus()
    await offset.press('ArrowRight')
    await expect(offset).not.toHaveValue(moved)
    await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
    await select.click()
    await expect(offset).toHaveValue(moved)
    await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
    await select.click()
    await expect(offset).toHaveValue(initial)
    await page.getByRole('button', { name: 'Rehacer el último cambio deshecho' }).click()
    await select.click()
    await expect(offset).toHaveValue(moved)
    expect(errors).toEqual([])
  })
}

test('perder captura cierra el gesto de superficie y separa la siguiente edición', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
  await page.getByRole('button', { name: 'Encima', exact: true }).click()
  await page.getByRole('button', { name: /Suelo · Editar/ }).click()
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  const bounds = await page.locator('.scene-panel canvas').first().boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas')
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  const position = page.locator('.selection-section--inspector').getByLabel('Desplazamiento X', { exact: true })
  const initial = await position.inputValue()
  await page.mouse.move(x + 26, y)
  await page.mouse.down()
  await page.waitForTimeout(150)
  await page.mouse.move(x + 86, y, { steps: 8 })
  await expect(position).not.toHaveValue(initial)
  const moved = await position.inputValue()
  await page.evaluate(() => {
    const canvas = document.querySelector('.scene-panel canvas')!
    canvas.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1 }))
  })
  await page.mouse.up()
  await position.focus()
  await position.press('ArrowRight')
  await expect(position).not.toHaveValue(moved)
  await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
  await page.getByRole('button', { name: /Suelo Superficie de construcción/ }).click()
  await expect(position).toHaveValue(moved)
  await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
  await page.getByRole('button', { name: /Suelo Superficie de construcción/ }).click()
  await expect(position).toHaveValue(initial)
  expect(errors).toEqual([])
})

test('un giro continuo desde el inspector se deshace y rehace en un paso', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  const dial = page.getByRole('slider', { name: 'Giro del mueble' })
  await dial.scrollIntoViewIfNeeded()
  const bounds = await dial.boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el dial')
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x, bounds.y + 5)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width - 5, y, { steps: 5 })
  await page.mouse.move(x, bounds.y + bounds.height - 5, { steps: 5 })
  await page.mouse.up()
  const rotation = page.getByRole('spinbutton', { name: 'Giro' })
  await expect(rotation).not.toHaveValue('0')
  const final = await rotation.inputValue()
  await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
  await page.locator('.element-select').filter({ hasText: 'Sillón' }).click()
  await expect(rotation).toHaveValue('0')
  await page.getByRole('button', { name: 'Rehacer el último cambio deshecho' }).click()
  await page.locator('.element-select').filter({ hasText: 'Sillón' }).click()
  await expect(rotation).toHaveValue(final)
})

test('borrar durante un arrastre desmonta el gesto y mantiene separados sus dos undo', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  const position = page.locator('.selection-section--inspector').getByLabel('Posición X', { exact: true })
  const initial = await position.inputValue()
  const bounds = await page.locator('.scene-panel canvas').first().boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas')
  const x = bounds.x + bounds.width / 2 + 12
  const y = bounds.y + bounds.height / 2 + 12
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(150)
  await page.mouse.move(x + 65, y + 15, { steps: 8 })
  await expect(position).not.toHaveValue(initial)
  const moved = await position.inputValue()
  await page.keyboard.press('Delete')
  await expect(page.locator('.element-select').filter({ hasText: 'Sillón' })).toHaveCount(0)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
  await page.locator('.element-select').filter({ hasText: 'Sillón' }).click()
  await expect(position).toHaveValue(moved)
  await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
  await page.locator('.element-select').filter({ hasText: 'Sillón' }).click()
  await expect(position).toHaveValue(initial)
  expect(errors).toEqual([])
})
