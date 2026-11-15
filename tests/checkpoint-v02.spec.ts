import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { expandAllCatalogCategories } from './helpers/catalog'

// Recorrido de aceptación del checkpoint v0.2 (#33): una habitación de principio a fin.
// Es largo a propósito (más de ~10 gestos), así que no lleva @smoke: se ejecuta en la
// suite completa y es el «E2E de habitación completa» que exige el gate.

const KEY = 'room-builder:v0.1:designs'
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
const catalog = (page: Page) => page.getByRole('complementary', { name: 'Catálogo de objetos' })
const savedDesigns = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), KEY)

async function setMeasure(page: Page, name: string, value: string) {
  const field = page.getByRole('textbox', { name, exact: true })
  await field.fill(value)
  await field.press('Enter')
}

test('recorrido completo de una habitación: crear, amueblar, editar, vistas, guardar, exportar, reimportar y GLB', async ({ page, browser }) => {
  test.setTimeout(180_000)
  // 1 · Navegador limpio y habitación con medidas propias.
  await page.goto('/')
  await expect(page.locator('.scene-panel canvas').first()).toBeVisible()
  expect(await savedDesigns(page)).toEqual([])
  await setMeasure(page, 'Introducir anchura en metros', '4,2')
  await setMeasure(page, 'Introducir profundidad en metros', '3,6')
  await expect(page.getByText('4.2 × 3.6 m')).toBeVisible()

  // 2 · Puerta, ventana, mobiliario y decoración; se redimensiona una ventana.
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: 'Ventana ＋ Añadir', exact: true }).click()
  await setMeasure(page, 'Introducir anchura del objeto en metros', '1,2')
  await page.getByRole('button', { name: 'Puerta ＋ Añadir', exact: true }).click()
  for (const name of ['Cama doble', 'Escritorio', 'Silla', 'Armario de ropa', 'Planta']) {
    await page.getByRole('button', { name: `${name} ＋ Añadir`, exact: true }).click()
  }
  const row = (name: string) => catalog(page).locator('.element-row').filter({ hasText: name })
  for (const name of ['Cama doble', 'Escritorio', 'Silla', 'Armario de ropa', 'Planta']) await expect(row(name)).toHaveCount(1)

  // 3 · Un solape de muebles avisa sin bloquear: la silla se coloca sobre el escritorio.
  await row('Escritorio').locator('.element-select').click()
  const x = await inspector(page).getByLabel('Posición X', { exact: true }).inputValue()
  const z = await inspector(page).getByLabel('Posición Z', { exact: true }).inputValue()
  await row('Silla').locator('.element-select').click()
  await inspector(page).getByLabel('Posición X', { exact: true }).fill(x)
  await inspector(page).getByLabel('Posición Z', { exact: true }).fill(z)
  const incidents = page.getByRole('complementary', { name: 'Incidencias en la escena' })
  await expect(incidents).toContainText('Silla')
  await expect(incidents).toContainText('Escritorio')
  await expect(row('Silla')).toHaveCount(1) // el aviso no impide el movimiento

  // 4 · Renombrar, duplicar, bloquear, carpeta y deshacer/rehacer.
  await row('Planta').locator('.element-select').click()
  await page.keyboard.press('F2')
  const rename = page.getByRole('textbox', { name: 'Nuevo nombre para Planta' })
  await rename.fill('Helecho')
  await rename.press('Enter')
  await expect(row('Helecho')).toHaveCount(1)
  await page.keyboard.press('Control+d')
  await expect(catalog(page).locator('.element-row').filter({ hasText: 'Helecho' })).toHaveCount(2)
  await page.keyboard.press('Control+z')
  await expect(catalog(page).locator('.element-row').filter({ hasText: 'Helecho' })).toHaveCount(1)
  await page.keyboard.press('Control+Shift+z')
  await expect(catalog(page).locator('.element-row').filter({ hasText: 'Helecho' })).toHaveCount(2)
  await row('Armario de ropa').getByRole('button', { name: 'Bloquear Armario de ropa' }).click({ force: true })
  await expect(row('Armario de ropa')).toHaveClass(/element-row--locked/)
  await catalog(page).getByRole('button', { name: 'Crear carpeta de elementos' }).click()
  await expect(catalog(page).locator('.element-folder').filter({ hasText: 'Carpeta 1' })).toBeVisible()

  // 5 · Plano, cuatro diagonales isométricas y POV: los datos no cambian.
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Guardado', exact: true })).toBeDisabled()
  const before = JSON.stringify((await savedDesigns(page))[0].data)
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Plano', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Isométrica', exact: true }).click()
  for (let turn = 0; turn < 4; turn += 1) await page.getByRole('button', { name: 'Girar a la derecha' }).click()
  await page.getByRole('button', { name: 'POV', exact: true }).click()
  await expect(page.getByRole('button', { name: 'POV', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Guardado', exact: true })).toBeDisabled() // ninguna vista modifica el diseño
  await page.getByRole('button', { name: 'Isométrica', exact: true }).click()

  // 6 · Recargar conserva el diseño; exportar JSON.
  await page.reload()
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await page.getByRole('button', { name: 'Diseño 1', exact: true }).click()
  await expect(row('Cama doble')).toHaveCount(1)
  expect(JSON.stringify((await savedDesigns(page))[0].data)).toBe(before)
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await page.getByRole('button', { name: 'Más opciones de Diseño 1' }).click()
  const exporting = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Exportar diseño/ }).click()
  const exported = await readFile((await (await exporting).path())!)

  // 7 · GLB adicional.
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click({ button: 'right' })
  const glb = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Descargar 3D/ }).click()
  const glbData = await readFile((await (await glb).path())!)
  expect(glbData.toString('ascii', 0, 4)).toBe('glTF')

  // 8 · Navegador limpio (almacenamiento nuevo): reimportar la copia y seguir editando.
  const clean = await browser.newContext()
  const fresh = await clean.newPage()
  await fresh.goto('/')
  expect(await savedDesigns(fresh)).toEqual([])
  await fresh.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await fresh.locator('input[type=file]').setInputFiles({ name: 'habitacion.json', mimeType: 'application/json', buffer: exported })
  const modal = fresh.getByRole('dialog', { name: /Importar/ })
  await modal.getByRole('button', { name: 'Confirmar importación' }).click()
  const imported = await savedDesigns(fresh)
  expect(imported).toHaveLength(1)
  expect(imported[0].data.room.width).toBe(4.2)
  expect(imported[0].data.furniture.map((item: { name: string }) => item.name).sort()).toEqual(
    ['Armario de ropa', 'Cama doble', 'Escritorio', 'Helecho', 'Helecho', 'Silla'])
  await expandAllCatalogCategories(fresh)
  await fresh.getByRole('button', { name: 'Mesa ＋ Añadir', exact: true }).click()
  await expect(fresh.getByRole('button', { name: 'Guardar', exact: true })).toBeEnabled()
  await clean.close()
})
