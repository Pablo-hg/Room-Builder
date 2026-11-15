// Capturas comparativas del catálogo: cada objeto (muebles y objetos de pared) en
// Isométrica, Plano y Frontal. No forma parte de la CI; se lanza a mano:
//   npx playwright test -c playwright.catalog.config.ts
// Salida: output/playwright/r2-catalog (o R2_CAPTURE_DIR).
import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FURNITURE_CATALOG, OPENING_CATALOG, STANDALONE_OPENING_MENU, isWallPictureKind, openingShapeForKind } from '../../src/domain/objectCatalog'
import type { FurnitureKind, PersistedDesign } from '../../src/domain/types'

const reference = JSON.parse(readFileSync(resolve('tests/fixtures/persistence-v1/valid-complete.json'), 'utf8')) as PersistedDesign
const outputDirectory = resolve(process.env.R2_CAPTURE_DIR ?? 'output/playwright/r2-catalog')

type CatalogCapture = { key: string; data: PersistedDesign }

/** Un diseño por objeto: habitación de referencia sin muebles ni ventanas, más el objeto. */
function captures(): CatalogCapture[] {
  const empty = { ...reference, furniture: [], structurePacks: [], hiddenElementIds: [], room: { ...reference.room, windows: [] } }
  const wallObject = (key: string, shape: string, width: number, height: number, sill: number, color: string): CatalogCapture => ({
    key, data: { ...empty, room: { ...empty.room, windows: [{ id: `item-${key}`, shape, wall: 'north', offset: 0, width, height, sill, rotation: 0, color }] } } as PersistedDesign,
  })
  const furniture = (Object.keys(FURNITURE_CATALOG) as FurnitureKind[]).map((kind): CatalogCapture => {
    const base = FURNITURE_CATALOG[kind].base
    if (isWallPictureKind(kind)) return wallObject(kind, kind, base.width, base.height, 1.25, base.color)
    return { key: kind, data: { ...empty, furniture: [{ ...base, id: `item-${kind}`, x: 0, z: 0, rotation: 0, attachmentPolicy: 'by-type',
      y: kind === 'ceilingLamp' ? reference.room.height - base.height : 0 }] } as PersistedDesign }
  })
  const walls = STANDALONE_OPENING_MENU.filter(({ kind }) => kind !== 'door').map(({ kind }) => {
    const definition = OPENING_CATALOG[kind]
    const color = kind.startsWith('mirror') ? '#9a8067' : kind === 'wallSconce' ? '#d3a755' : '#c88f58'
    return wallObject(kind, openingShapeForKind(kind as Exclude<typeof kind, 'door'>), definition.width, definition.height, definition.defaultBottom, color)
  })
  return [...furniture, ...walls]
}

test('registra cada objeto del catálogo en isométrica, planta y frontal', async ({ browser, baseURL }) => {
  test.setTimeout(600_000)
  mkdirSync(outputDirectory, { recursive: true })
  const all = captures()
  // La aplicación admite cinco diseños locales: cada lote usa su propio contexto.
  for (let start = 0; start < all.length; start += 5) {
    const batch = all.slice(start, start + 5)
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' })
    try {
      await context.addInitScript((designs) => localStorage.setItem('room-builder:v0.1:designs', JSON.stringify(designs)),
        batch.map(({ key, data }) => ({ id: `catalog-${key}`, name: `Referencia ${key}`, savedAt: '2026-11-15T12:00:00.000Z', data })))
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(baseURL!)
      for (const { key } of batch) {
        await test.step(key, async () => {
          await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
          await page.getByRole('button', { name: `Referencia ${key}`, exact: true }).click()
          for (const [label, suffix] of [['Isométrica', 'iso'], ['Plano', 'top'], ['Frontal', 'front']] as const) {
            await page.getByRole('button', { name: label, exact: true }).click()
            await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
            await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
            await page.waitForTimeout(400)
            await page.locator('.scene-panel').screenshot({ path: resolve(outputDirectory, `${key}-${suffix}.png`), animations: 'disabled' })
          }
          expect(errors).toEqual([])
        })
      }
    } finally {
      await context.close()
    }
  }
})
