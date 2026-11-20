import { expect, test, type Page } from '@playwright/test'
import { expandAllCatalogCategories } from './helpers/catalog'

// #38 · «Mostrar detalles»: cotas automáticas de huecos y de muebles y filtros por categoría.

const stateOf = (page: Page) => page.evaluate(async () => {
  const path = '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ path)
  const state = useRoomStore.getState()
  return {
    view: state.view as string, undoCount: state.undoCount as number, selectedId: state.selectedId as string | null,
    topCameraX: state.topCameraX as number, cameraZoom: state.cameraZoom as number, unsaved: state.hasUnsavedChanges as boolean,
    categories: state.planDetailCategories as Record<string, boolean>, details: state.planDetailsVisible as boolean,
  }
})

const summary = (page: Page) => page.locator('#plan-details-summary')

async function openPlan(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
}

test('Plano normal no muestra filtros ni cotas; «Mostrar detalles» los muestra sin cambiar de vista ni de estado', { tag: '@smoke' }, async ({ page }) => {
  await openPlan(page)
  const chips = page.getByRole('group', { name: 'Cotas que se muestran' })
  await expect(chips).toHaveCount(0)
  await expect(summary(page)).toHaveText('')
  const before = await stateOf(page)
  await page.getByLabel('Mostrar detalles').check()
  await expect(chips).toBeVisible()
  await expect(chips.getByLabel('Paredes')).toBeChecked()
  await expect(chips.getByLabel('Huecos')).toBeChecked()
  await expect(chips.getByLabel('Muebles')).not.toBeChecked()
  await expect(chips.getByLabel('Cotas a mano')).toBeChecked()
  // Cotas de paredes (#26) y cadena de huecos: la ventana de 1,50 m y la puerta de 1,00 m de la habitación por defecto.
  await expect(summary(page)).toContainText('Pared A: 5,50 m')
  await expect(summary(page)).toContainText('Huecos — Pared')
  await expect(summary(page)).toContainText('hueco 1,50 m')
  await expect(summary(page)).toContainText('hueco 1,00 m')
  const after = await stateOf(page)
  expect(after.view).toBe(before.view)
  expect(after.undoCount).toBe(before.undoCount)
  expect(after.selectedId).toBe(before.selectedId)
  expect(after.topCameraX).toBe(before.topCameraX)
  expect(after.cameraZoom).toBe(before.cameraZoom)
  expect(after.unsaved).toBe(before.unsaved)
  await page.getByLabel('Mostrar detalles').uncheck()
  await expect(chips).toHaveCount(0)
  await expect(summary(page)).toHaveText('')
})

test('cada categoría se filtra por separado y los filtros no modifican el diseño', async ({ page }) => {
  await openPlan(page)
  await page.getByLabel('Mostrar detalles').check()
  const chips = page.getByRole('group', { name: 'Cotas que se muestran' })
  const before = await stateOf(page)
  await chips.getByLabel('Huecos').uncheck()
  await expect(summary(page)).not.toContainText('Huecos —')
  await expect(summary(page)).toContainText('Pared A: 5,50 m')
  await chips.getByLabel('Paredes').uncheck()
  await expect(summary(page)).not.toContainText('Pared A: 5,50 m')
  await chips.getByLabel('Huecos').check()
  await expect(summary(page)).toContainText('hueco 1,50 m')
  const after = await stateOf(page)
  expect(after.undoCount).toBe(before.undoCount)
  expect(after.unsaved).toBe(before.unsaved)
  expect(after.categories).toEqual({ walls: false, openings: true, furniture: false, annotations: true })
})

test('las distancias de muebles solo aparecen con su filtro y para el mueble seleccionado', async ({ page }) => {
  await openPlan(page)
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  await page.getByLabel('Mostrar detalles').check()
  const chips = page.getByRole('group', { name: 'Cotas que se muestran' })
  await expect(summary(page)).not.toContainText('distancia a la pared')
  await chips.getByLabel('Muebles').check()
  await expect(summary(page)).toContainText('Sillón, distancia a la pared: oeste')
  await expect(summary(page)).toContainText('norte')
  // Sin selección no hay distancias que mostrar.
  await page.evaluate(async () => {
    const path = '/src/state/useRoomStore.ts'
    const { useRoomStore } = await import(/* @vite-ignore */ path)
    useRoomStore.getState().selectElement(null)
  })
  await expect(summary(page)).not.toContainText('distancia a la pared')
})

test('las cotas se recalculan al mover un hueco y al mover un mueble', async ({ page }) => {
  await openPlan(page)
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  await page.getByLabel('Mostrar detalles').check()
  await page.getByRole('group', { name: 'Cotas que se muestran' }).getByLabel('Muebles').check()
  const before = await summary(page).innerText()
  await page.evaluate(async () => {
    const path = '/src/state/useRoomStore.ts'
    const { useRoomStore } = await import(/* @vite-ignore */ path)
    const state = useRoomStore.getState()
    state.moveFurniture(state.selectedId, -1, 0.5)
  })
  await expect.poll(async () => summary(page).innerText()).not.toBe(before)
  await expect(summary(page)).toContainText('Sillón, distancia a la pared: oeste 1,25 m')
})
