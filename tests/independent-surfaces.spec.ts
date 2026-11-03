import { expect, test } from '@playwright/test'

test('muestra una advertencia visual al crear una pared que atraviesa un mueble', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await page.getByRole('button', { name: /Pared.*Objeto independiente/ }).click()
  await expect(page.getByRole('heading', { name: 'Pared independiente' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('advertencia.png') })
})

test('un mueble puede cruzar las paredes y el suelo y conservar su posición al soltar', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  const x = page.getByRole('textbox', { name: 'Introducir X en metros' })
  const y = page.getByRole('textbox', { name: 'Introducir Y en metros' })
  await x.fill('4')
  await x.press('Enter')
  await page.screenshot({ path: testInfo.outputPath('fuera.png') })
  await y.fill('-1')
  await y.press('Enter')
  await expect(x).toHaveValue('4.00')
  await expect(y).toHaveValue('-1.00')
  await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
  await page.getByRole('button', { name: /Silla Asientos/ }).click()
  await expect(y).toHaveValue('0.00')
})

test('el suelo del plano desplaza la cámara y el botón restablece posición y zoom', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  const canvas = page.locator('.scene-panel canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas no disponible')
  await page.waitForTimeout(500)
  const initial = await canvas.screenshot()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 8 })
  await page.mouse.up()
  const panned = await canvas.screenshot()
  expect(initial.equals(panned)).toBe(false)
  await page.mouse.wheel(0, -120)
  await page.getByRole('button', { name: 'Restablecer posición y zoom del plano' }).click()
  await expect(page.getByRole('status')).toContainText('100%')
  await page.mouse.move(0, 0)
  await page.waitForTimeout(500)
  const reset = await canvas.screenshot()
  expect(initial.equals(reset)).toBe(true)
})

test('el aro de giro de una pared tiene prioridad sobre un suelo que lo tapa', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: /Suelo.*Objeto independiente/ }).click()
  await page.getByRole('button', { name: /Pared.*Objeto independiente/ }).click()
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  const canvas = await page.locator('.scene-panel canvas').first().boundingBox()
  if (!canvas) throw new Error('Canvas no disponible')
  const zoom = Math.max(36, Math.min(canvas.width / 7.7, canvas.height / 6.7))
  const x = canvas.x + canvas.width / 2 + 1.6 * zoom
  const y = canvas.y + canvas.height / 2
  const rotation = page.locator('.selection-section--inspector').getByRole('slider', { name: /Giro/ })
  await expect(rotation).toHaveValue('0')
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 15, y + 65, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => Number(await rotation.inputValue())).toBeLessThan(0)
  await expect(page.getByRole('heading', { name: 'Pared independiente' })).toBeVisible()
})

for (const kind of ['Suelo', 'Pared']) {
  test(`${kind}: permite escribir dimensiones y restaura valores fuera de rango`, async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: new RegExp(`${kind}.*Objeto independiente`) }).click()
    const width = page.getByRole('textbox', { name: 'Introducir Anchura en metros' })
    const thickness = page.getByRole('textbox', { name: 'Introducir Grosor en metros' })
    await expect(thickness).toHaveValue('0.125')
    await thickness.fill('0,25')
    await thickness.press('Enter')
    await expect(thickness).toHaveValue('0.25')
    await thickness.fill('0,126')
    await thickness.press('Enter')
    await expect(thickness).toHaveValue('0.125')
    await width.fill('2.75')
    await width.press('Enter')
    await expect(width).toHaveValue('2.75')
    await width.fill('15')
    await width.press('Enter')
    await expect(width).toHaveValue('2.75')
    await page.getByRole('button', { name: /Deshacer el último cambio/ }).click()
    await page.getByRole('button', { name: new RegExp(`${kind} 1 · ${kind} independiente Superficie de construcción`) }).click()
    await expect(width).not.toHaveValue('2.75')
    await expect(thickness).toHaveValue('0.125')
  })
}

for (const view of ['Isométrica', 'Libre', 'Plano', 'Frontal']) {
  for (const kind of ['Suelo', 'Pared']) {
    test(`${kind}: crear, reseleccionar y mover en ${view}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')
      await page.getByRole('button', { name: view, exact: true }).click()
      await page.getByRole('button', { name: new RegExp(`${kind}.*Objeto independiente`) }).click()
      const inspector = page.locator('.selection-section--inspector')
      const heading = inspector.getByRole('heading', { name: `${kind} independiente` })
      await expect(heading).toBeVisible()
      const x = inspector.getByLabel('Desplazamiento X')
      const initial = await x.inputValue()
      await x.focus()
      await x.press('ArrowRight')
      await expect(x).not.toHaveValue(initial)
      await page.getByRole('button', { name: /Puerta Seleccionar/ }).click()
      const box = await page.locator('.scene-panel canvas').first().boundingBox()
      if (!box) throw new Error('Canvas no disponible')
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5)
      await expect(heading).toBeVisible()
      await expect(x).not.toHaveValue(initial)
    })
  }
}

for (const kind of ['Suelo', 'Pared']) {
  test(`${kind}: arrastre del eje X en plano y deshacer`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.getByRole('button', { name: kind === 'Suelo' ? /Suelo.*Objeto independiente/ : /Pared.*Objeto independiente/ }).click()
    await page.getByRole('button', { name: 'Plano', exact: true }).click()
    const box = await page.locator('.scene-panel canvas').first().boundingBox()
    if (!box) throw new Error('Canvas no disponible')
    const x = box.x + box.width * 0.5
    const y = box.y + box.height * 0.5
    const position = page.locator('.selection-section--inspector').getByLabel('Desplazamiento X')
    const initial = await position.inputValue()
    await page.mouse.move(x + 26, y)
    await page.mouse.down()
    await page.mouse.move(x + 86, y, { steps: 8 })
    await page.mouse.up()
    await expect(position).not.toHaveValue(initial)
    await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
    await page.getByRole('button', { name: new RegExp(`${kind} 1 · ${kind} independiente Superficie de construcción`) }).click()
    await expect(position).toHaveValue(initial)
  })

  test(`${kind}: arrastre del eje Z en plano`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.getByRole('button', { name: new RegExp(`${kind}.*Objeto independiente`) }).click()
    await page.getByRole('button', { name: 'Plano', exact: true }).click()
    const box = await page.locator('.scene-panel canvas').first().boundingBox()
    if (!box) throw new Error('Canvas no disponible')
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const position = page.locator('.selection-section--inspector').getByLabel('Desplazamiento Z')
    const initial = await position.inputValue()
    await page.mouse.move(x, y + 26)
    await page.mouse.down()
    await page.mouse.move(x, y + 86, { steps: 8 })
    await page.mouse.up()
    await expect(position).not.toHaveValue(initial)
  })
}

for (const kind of ['Suelo', 'Pared']) {
  test(`${kind}: reselección táctil en isométrica`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.getByRole('button', { name: new RegExp(`${kind}.*Objeto independiente`) }).click()
    await page.getByRole('button', { name: /Puerta Seleccionar/ }).click()
    const box = await page.locator('.scene-panel canvas').first().boundingBox()
    if (!box) throw new Error('Canvas no disponible')
    const client = await page.context().newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.locator('.selection-section--inspector').getByRole('heading', { name: `${kind} independiente` })).toBeVisible()
  })
}

for (const kind of ['Suelo', 'Pared']) {
  test(`${kind}: cuadrícula independiente visible y conmutable`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.getByRole('button', { name: new RegExp(`${kind}.*Objeto independiente`) }).click()
    const toggle = page.getByRole('switch', { name: `Mostrar cuadrícula de ${kind} 1`, exact: true })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    const canvas = page.locator('.scene-panel canvas').first()
    const visible = await canvas.screenshot()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    const hidden = await canvas.screenshot()
    expect(visible.equals(hidden)).toBe(false)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
  })
}
