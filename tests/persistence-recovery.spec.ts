import { expect, test } from '@playwright/test'

const key = 'room-builder:v0.1:designs'

test('guarda y recupera tras recargar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('Diseño guardado')
  const saved = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)
  expect(saved).not.toBeNull()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Seleccionar diseño guardado' })).toContainText('Diseño 1')
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(saved)
})

test('importa y abre las cuatro muestras antiguas', async ({ page }) => {
  await page.goto('/')
  for (const version of [2, 3, 4, 5]) {
    await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
    await page.locator('input[type=file]').setInputFiles(`tests/fixtures/persisted-designs/valid-v${version}.json`)
    const dialog = page.getByRole('dialog', { name: `Importar «valid-v${version}»` })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Confirmar importación' }).click()
    await expect(page.getByRole('button', { name: 'Seleccionar diseño guardado' })).toContainText(`valid-v${version}`)
    // El menú queda abierto tras importar.
    await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  }
  await page.reload()
  const saved = await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!), key)
  expect(saved.map((entry: { name: string }) => entry.name)).toEqual(['valid-v2', 'valid-v3', 'valid-v4', 'valid-v5'])
})

test('una biblioteca dañada permanece intacta al intentar guardar', async ({ page }) => {
  await page.addInitScript((storageKey) => localStorage.setItem(storageKey, '{'), key)
  await page.goto('/')
  await expect(page.locator('.toast')).toContainText('No se pudo leer la biblioteca')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('No se ha sobrescrito')
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe('{')
})

test('una biblioteca dañada o inaccesible no se modifica si falla la lectura', async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, 'datos conservados')
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = function (name) {
      if (name === storageKey) throw new DOMException('Acceso denegado', 'SecurityError')
      return original.call(this, name)
    }
  }, key)
  await page.goto('/')
  await expect(page.locator('.toast')).toContainText('No se pudo leer la biblioteca')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('No se pudo acceder al almacenamiento local')
  expect(await page.evaluate((storageKey) => localStorage[storageKey], key)).toBe('datos conservados')
})
