import { expect, test } from '@playwright/test'

test('la flecha X del control de ejes compartidos inicia el arrastre de ese eje', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  const position = async () => page.evaluate(async () => {
    const path = '/src/state/useRoomStore.ts'
    const { useRoomStore } = await import(/* @vite-ignore */ path)
    const state = useRoomStore.getState()
    const item = state.furniture.find((candidate: { id: string }) => candidate.id === state.selectedId)!
    return { x: item.x, y: item.y, z: item.z }
  })
  const before = await position()
  const canvas = await page.locator('.scene-panel canvas').first().boundingBox()
  if (!canvas) throw new Error('Canvas no disponible')
  const x = canvas.x + canvas.width / 2 + 26
  const y = canvas.y + canvas.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 60, y + 60, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await position()).x).not.toBe(before.x)
  const after = await position()
  expect(after.y).toBe(before.y)
  expect(after.z).toBe(before.z)
})

for (const target of ['cuerpo', 'eje X'] as const) {
  for (const gesture of ['ratón', 'táctil', 'cancelación táctil'] as const) {
    test(`agrupa el arrastre de mobiliario en un paso de historial: ${target}, ${gesture}`, async ({ page, context }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')
      await page.getByRole('button', { name: 'Plano', exact: true }).click()
      await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
      const position = page.locator('.selection-section--inspector').getByLabel('Posición X', { exact: true })
      const initial = await position.inputValue()
      const readState = (id?: string) => page.evaluate(async (id) => {
        const path = '/src/state/useRoomStore.ts'
        const { useRoomStore } = await import(/* @vite-ignore */ path)
        const state = useRoomStore.getState()
        const item = state.furniture.find((candidate: { id: string }) => candidate.id === (id ?? state.selectedId))!
        return { id: item.id, x: item.x, selectedId: state.selectedId, undoCount: state.undoCount, redoCount: state.redoCount }
      }, id)
      const initialState = await readState()
      const bounds = await page.locator('.scene-panel canvas').first().boundingBox()
      if (!bounds) throw new Error('No se pudo localizar el canvas')
      // El centro exacto contiene el eje Y del gizmo, visto de punta en planta.
      const x = bounds.x + bounds.width / 2 + (target === 'cuerpo' ? 12 : 20)
      const y = bounds.y + bounds.height / 2 + (target === 'cuerpo' ? 12 : 0)

      if (gesture === 'ratón') {
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.waitForTimeout(100)
        await page.mouse.move(x + 65, y + 15, { steps: 8 })
        await page.mouse.up()
      } else {
        const client = await context.newCDPSession(page)
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        await page.waitForTimeout(100)
        for (let step = 1; step <= 8; step++) {
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: [{ x: x + 65 * step / 8, y: y + 15 * step / 8 }],
          })
          await page.waitForTimeout(20)
        }
        await client.send('Input.dispatchTouchEvent', {
          type: gesture === 'táctil' ? 'touchEnd' : 'touchCancel', touchPoints: [],
        })
        await client.detach()
      }

      await expect(position).not.toHaveValue(initial)
      const moved = await position.inputValue()
      expect((await readState(initialState.id)).undoCount).toBe(initialState.undoCount + 1)
      // Una edición posterior debe quedar fuera del gesto, también tras cancelarlo.
      await position.focus()
      await position.press('ArrowRight')
      await expect(position).not.toHaveValue(moved)
      await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
      await expect.poll(() => readState(initialState.id)).toMatchObject({ x: Number(moved), selectedId: null, undoCount: initialState.undoCount + 1 })
      await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
      await expect.poll(() => readState(initialState.id)).toMatchObject({ x: Number(initial), selectedId: null, undoCount: initialState.undoCount })
      await page.getByRole('button', { name: 'Rehacer el último cambio deshecho' }).click()
      await expect.poll(() => readState(initialState.id)).toMatchObject({ x: Number(moved), selectedId: null, undoCount: initialState.undoCount + 1 })
      // Recover the inspector once; undo intentionally clears selection. Reading
      // actual positions above avoids three costly reselections on software WebGL in CI.
      await page.locator('.element-select').filter({ hasText: 'Sillón' }).click()
      await expect(position).toHaveValue(moved)
    })
  }
}
