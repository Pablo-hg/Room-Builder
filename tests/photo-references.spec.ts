import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { strFromU8, unzipSync } from 'fflate'

function pngSize(png: Uint8Array) {
  const bytes = Buffer.from(png)
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
}

test('descarga referencias del diseño abierto con el encuadre y la resolución elegidos', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const photoButton = page.getByRole('button', { name: 'Fotografía', exact: true })
  await photoButton.press('Enter')
  await expect(page.getByRole('button', { name: 'Volver al editor' })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Selección por área' })).toBeHidden()

  await page.getByLabel('Vista', { exact: true }).selectOption('top')
  await page.getByLabel('Proporción').selectOption('9:16')
  await page.getByLabel('Resolución').selectOption('1280')
  const packageDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar paquete para IA' }).click()
  const files = unzipSync(await readFile(await (await packageDownload).path()))
  expect(Object.keys(files).sort()).toEqual(['diseno.json', 'guia-y-prompt.txt', 'referencia.png'])
  expect(pngSize(files['referencia.png'])).toEqual([720, 1280])
  expect(JSON.parse(strFromU8(files['diseno.json']))).toMatchObject({
    format: 'room-builder-design',
    design: { data: { room: { width: expect.any(Number) } } },
  })
  expect(strFromU8(files['guia-y-prompt.txt'])).toContain('Plano, 720 × 1280 px')

  await page.getByLabel('Vista', { exact: true }).selectOption('pov')
  await page.getByLabel('Proporción').selectOption('16:9')
  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar PNG' }).click()
  expect(pngSize(await readFile(await (await pngDownload).path()))).toEqual([1280, 720])
  await page.keyboard.press('Escape')
  await expect(photoButton).toBeFocused()
})
