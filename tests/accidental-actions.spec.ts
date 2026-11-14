import { expect, test, type Page } from '@playwright/test'
import { expandAllCatalogCategories } from './helpers/catalog'

const counts = (page: Page) => page.evaluate(async () => {
  const path = '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ path)
  const state = useRoomStore.getState()
  return { furniture: state.furniture.length, packs: state.structurePacks.length }
})

async function addChair(page: Page) {
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await expect.poll(async () => (await counts(page)).furniture).toBe(1)
}

test('Supr elimina el objeto seleccionado y Deshacer lo recupera', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await addChair(page)
  await page.keyboard.press('Delete')
  await expect.poll(async () => (await counts(page)).furniture).toBe(0)
  await expect(page.getByRole('status').filter({ hasText: /./ }).first()).toBeVisible()
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await counts(page)).furniture).toBe(1)
})

test('Retroceso mientras se escribe en un campo no borra el objeto seleccionado', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await addChair(page)
  const width = page.getByRole('textbox', { name: 'Introducir anchura del objeto en metros' })
  await width.click()
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Delete')
  expect((await counts(page)).furniture).toBe(1)
})

test('el botón Eliminar del inspector se puede deshacer con el botón de la cabecera', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await addChair(page)
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  await inspector.getByRole('button', { name: 'Eliminar' }).click()
  await expect.poll(async () => (await counts(page)).furniture).toBe(0)
  await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
  await expect.poll(async () => (await counts(page)).furniture).toBe(1)
})

test('eliminar una habitación completa se puede deshacer', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  const before = await counts(page)
  await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
  await page.getByRole('button', { name: 'Encima', exact: true }).click()
  await expect.poll(async () => (await counts(page)).packs).toBe(before.packs + 1)
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  const remove = inspector.getByRole('button', { name: 'Eliminar habitación completa' })
  await expect(remove).toBeVisible()
  await remove.click()
  await expect.poll(async () => (await counts(page)).packs).toBe(before.packs)
  await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
  await expect.poll(async () => (await counts(page)).packs).toBe(before.packs + 1)
})

test('Frontal, Libre y POV siguen accesibles con el teclado y cambian de vista', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  for (const view of ['Frontal', 'Libre', 'POV', 'Plano', 'Isométrica']) {
    const button = page.getByRole('button', { name: view, exact: true })
    await expect(button).toBeVisible()
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  }
})

test('los packs de habitación y las aperturas siguen disponibles en el catálogo plegado', async ({ page }) => {
  await page.goto('/')
  const content = page.locator('#catalog-content')
  await expect(content.locator('#catalog-grid-structure')).toHaveCount(0)
  await content.getByRole('button', { name: 'Construcción', exact: true }).click()
  await expect(content.getByRole('button', { name: /Nueva habitación vacía/ })).toBeVisible()
  await expect(content.getByRole('button', { name: /Suelo.*Objeto independiente/ })).toBeVisible()
  await expect(content.getByRole('button', { name: /Pared.*Objeto independiente/ })).toBeVisible()
  await content.getByRole('button', { name: 'Aperturas', exact: true }).click()
  await expect(content.getByRole('button', { name: /Puerta.*Añadir/ })).toBeVisible()
  await expect(content.getByRole('button', { name: /Ventana.*Añadir/ }).first()).toBeVisible()
})
