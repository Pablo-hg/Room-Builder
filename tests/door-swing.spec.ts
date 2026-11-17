import { expect, test, type Page } from '@playwright/test'

// #38 · Giro de las puertas en el Plano: bisagra y lado hacia el que se abre.

const stateOf = (page: Page) => page.evaluate(async () => {
  const path = '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ path)
  const state = useRoomStore.getState()
  return { swing: state.room.door.swing as { hinge: string; side: string } | undefined, undoCount: state.undoCount as number, view: state.view as string }
})

const call = (page: Page, action: string, ...args: unknown[]) => page.evaluate(async ({ action, args }) => {
  const path = '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ path)
  return useRoomStore.getState()[action](...args)
}, { action, args })

async function selectDoorInPlan(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await call(page, 'selectElement', 'door')
  await expect(page.getByRole('group', { name: 'Se abre' })).toBeVisible()
}

test('elegir bisagra y lado de la puerta en el inspector; se deshace y no cambia de vista', { tag: '@smoke' }, async ({ page }) => {
  await selectDoorInPlan(page)
  const before = await stateOf(page)
  expect(before.swing).toBeUndefined()
  // Por defecto: bisagra izquierda, hacia dentro.
  await expect(page.getByRole('button', { name: 'Izquierda', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Hacia dentro', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Derecha', exact: true }).click()
  await page.getByRole('button', { name: 'Hacia fuera', exact: true }).click()
  const after = await stateOf(page)
  expect(after.swing).toEqual({ hinge: 'right', side: 'outside' })
  expect(after.undoCount).toBe(before.undoCount + 2)
  expect(after.view).toBe('top')
  await expect(page.getByRole('img', { name: 'Puerta con bisagra a la derecha, abre hacia fuera' })).toBeVisible()
  await page.keyboard.press('Control+z')
  expect((await stateOf(page)).swing).toEqual({ hinge: 'right', side: 'inside' })
})

test('el giro de la puerta se conserva al guardar, recargar y en el JSON (v14)', async ({ page }) => {
  await selectDoorInPlan(page)
  await page.getByRole('button', { name: 'Derecha', exact: true }).click()
  await call(page, 'saveDesign')
  const json = await page.evaluate(async () => {
    const a = '/src/persistence/designFile.ts', b = '/src/domain/designV1.ts', c = '/src/state/useRoomStore.ts'
    const { serializeDesignFile } = await import(/* @vite-ignore */ a)
    const { persistedDesign } = await import(/* @vite-ignore */ b)
    const { useRoomStore } = await import(/* @vite-ignore */ c)
    return serializeDesignFile({ id: 'e2e', name: 'E2E', savedAt: new Date().toISOString(), data: persistedDesign(useRoomStore.getState()) })
  })
  const parsed = JSON.parse(json)
  expect(parsed.design.data.version).toBe(14)
  expect(parsed.design.data.room.door.swing).toEqual({ hinge: 'right', side: 'inside' })
  await page.reload()
  expect((await stateOf(page)).swing).toEqual({ hinge: 'right', side: 'inside' })
})

test('una puerta bloqueada no permite cambiar el giro', async ({ page }) => {
  await selectDoorInPlan(page)
  await call(page, 'toggleElementLock', 'door')
  await expect(page.getByRole('button', { name: 'Derecha', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Hacia fuera', exact: true })).toBeDisabled()
  expect((await stateOf(page)).swing).toBeUndefined()
})
