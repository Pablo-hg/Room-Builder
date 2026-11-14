import { expect, test, type Page } from '@playwright/test'
import { expandAllCatalogCategories, expandCatalogCategories } from './helpers/catalog'

// F1-05 (#29): regresión de cámaras y controles de orientación. Las comprobaciones de
// datos leen el store de la propia aplicación; las de interacción usan los controles.

async function openWithChair(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await expandCatalogCategories(page, ['Asientos'])
  await page.getByRole('button', { name: 'Sillón ＋ Añadir', exact: true }).click()
}

const snapshot = (page: Page) => page.evaluate(async () => {
  // Windows: la app importa el store como /@fs/...; /src/... sería otra instancia.
  const appSource = await (await fetch('/src/App.tsx')).text()
  const storePath = appSource.match(/from\s*["']([^"']*useRoomStore[^"']*)["']/)?.[1] ?? '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ storePath)
  const state = useRoomStore.getState()
  return {
    furniture: JSON.stringify(state.furniture),
    room: JSON.stringify(state.room),
    undoCount: state.undoCount,
    view: state.view,
    isoOrientation: state.isoOrientation,
    wallView: state.wallView,
    povYaw: state.povYaw,
  }
})

const VIEW_NAMES = ['Plano', 'Frontal', 'POV', 'Libre', 'Isométrica'] as const

for (const touch of [false, true]) {
  test.describe(touch ? 'pantalla táctil' : 'ratón', () => {
    test.use({ hasTouch: touch })

    const press = (page: Page, name: string | RegExp) => {
      const target = page.getByRole('button', { name, exact: typeof name === 'string' })
      return touch ? target.tap() : target.click()
    }

    test('cambiar de vista y orientar la cámara no altera el mobiliario ni el historial', async ({ page }) => {
      await openWithChair(page)
      const before = await snapshot(page)
      for (const name of VIEW_NAMES) {
        await press(page, name)
        await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
        const now = await snapshot(page)
        expect(now.furniture, name).toBe(before.furniture)
        expect(now.room, name).toBe(before.room)
        expect(now.undoCount, name).toBe(before.undoCount)
      }
      await press(page, 'Frontal')
      for (let step = 0; step < 4; step += 1) await press(page, 'Ver la pared siguiente')
      await press(page, 'POV')
      await press(page, 'Girar a la derecha')
      await press(page, 'Girar a la izquierda')
      await press(page, 'Isométrica')
      for (let step = 0; step < 4; step += 1) await press(page, 'Girar a la izquierda')
      const after = await snapshot(page)
      expect(after.furniture).toBe(before.furniture)
      expect(after.room).toBe(before.room)
      expect(after.undoCount).toBe(before.undoCount)
    })

    test('Isométrica recorre las cuatro diagonales y vuelve a la inicial', async ({ page }) => {
      await openWithChair(page)
      await press(page, 'Isométrica')
      const start = (await snapshot(page)).isoOrientation
      const seen = new Set<number>([start])
      for (let step = 0; step < 4; step += 1) {
        await press(page, 'Girar a la izquierda')
        seen.add((await snapshot(page)).isoOrientation)
      }
      expect(seen.size).toBe(4)
      expect((await snapshot(page)).isoOrientation).toBe(start)
    })

    test('POV gira con tope y no mueve el mobiliario', async ({ page }) => {
      await openWithChair(page)
      const before = await snapshot(page)
      await press(page, 'POV')
      for (let step = 0; step < 6; step += 1) await press(page, 'Girar a la izquierda')
      expect((await snapshot(page)).povYaw).toBe(55)
      for (let step = 0; step < 12; step += 1) await press(page, 'Girar a la derecha')
      const after = await snapshot(page)
      expect(after.povYaw).toBe(-55)
      expect(after.furniture).toBe(before.furniture)
    })

    test('el zoom y el cambio de vista no bloquean la edición posterior', async ({ page }) => {
      await openWithChair(page)
      for (const name of ['Frontal', 'Libre', 'Plano', 'Isométrica'] as const) {
        await press(page, name)
        const zoom = page.getByRole('slider', { name: 'Zoom de la cámara', exact: true })
        await zoom.focus()
        await zoom.press('ArrowRight')
      }
      const before = JSON.parse((await snapshot(page)).furniture).length
      await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
      await expect.poll(async () => JSON.parse((await snapshot(page)).furniture).length).toBe(before + 1)
      await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
      await expect.poll(async () => JSON.parse((await snapshot(page)).furniture).length).toBe(before)
    })
  })
}

test('POV se puede centrar y la leyenda indica el giro', async ({ page }) => {
  await openWithChair(page)
  await page.getByRole('button', { name: 'POV', exact: true }).click()
  await page.getByRole('button', { name: 'Girar a la izquierda' }).click()
  await expect(page.locator('.visible-walls-badge')).toContainText('15° a la izquierda')
  await page.getByRole('button', { name: 'Mirar al frente' }).click()
  await expect(page.locator('.visible-walls-badge')).toContainText('mirando al frente')
})

test('mantiene la misma escena visible en las cinco vistas', async ({ page }) => {
  await openWithChair(page)
  const canvas = page.locator('.scene-panel canvas').first()
  const shots: Buffer[] = []
  for (const name of VIEW_NAMES) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.waitForTimeout(150)
    shots.push(await canvas.screenshot())
  }
  // Cinco puntos de vista distintos producen cinco imágenes distintas.
  for (let first = 0; first < shots.length; first += 1) {
    for (let second = first + 1; second < shots.length; second += 1) {
      expect(shots[first].equals(shots[second]), `${VIEW_NAMES[first]} y ${VIEW_NAMES[second]} no deberían coincidir`).toBe(false)
    }
  }
})
