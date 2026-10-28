import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FURNITURE_CATALOG, isWallPictureKind } from '../../src/domain/objectCatalog'
import type { FurnitureKind, PersistedDesign } from '../../src/domain/types'

const reference = JSON.parse(readFileSync(resolve('tests/fixtures/persistence-v1/valid-complete.json'), 'utf8')) as PersistedDesign
const outputDirectory = resolve(process.env.R2_CAPTURE_DIR ?? 'output/playwright/r2-catalog')

test('registra cada objeto del catálogo en isométrica, planta y frontal', async ({ browser, baseURL }) => {
  mkdirSync(outputDirectory, { recursive: true })
  const kinds = Object.keys(FURNITURE_CATALOG) as FurnitureKind[]
  // La aplicación admite cinco diseños locales: cada lote usa su propio contexto.
  for (let start = 0; start < kinds.length; start += 5) {
    const batch = kinds.slice(start, start + 5)
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    })
    try {
      await context.addInitScript((designs) => {
        localStorage.setItem('room-builder:v0.1:designs', JSON.stringify(designs))
      }, batch.map((kind) => {
        const base = FURNITURE_CATALOG[kind].base
        const picture = isWallPictureKind(kind)
        return {
          id: `catalog-${kind}`, name: `Referencia ${kind}`, savedAt: '2026-10-27T12:00:00.000Z',
          data: {
            ...reference,
            room: { ...reference.room, windows: picture ? [{
              id: `item-${kind}`, shape: kind, wall: 'north', offset: 0,
              width: base.width, height: base.height, sill: 1.25, rotation: 0, color: base.color,
            }] : [] },
            furniture: picture ? [] : [{
              ...base, id: `item-${kind}`, x: 0, z: 0,
              y: kind === 'ceilingLamp' ? reference.room.height - base.height : 0, rotation: 0,
            }],
            structurePacks: [], hiddenElementIds: [],
          },
        }
      }))
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(baseURL!)
      await page.evaluate(() => document.fonts.ready)
      for (const kind of batch) {
        await test.step(kind, async () => {
          await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
          await page.getByRole('button', { name: `Referencia ${kind}`, exact: true }).click()
          const name = FURNITURE_CATALOG[kind].base.name + (isWallPictureKind(kind) ? ' 1' : '')
          await expect(page.getByRole('checkbox', { name: `Mostrar ${name}`, exact: true })).toBeChecked()
          const orientation = page.getByRole('button', { name: 'Ver en isométrica las paredes A y B', includeHidden: true })
          await orientation.focus()
          await orientation.press('Enter')
          for (const [label, suffix] of [['Isométrica', 'iso'], ['Plano', 'top'], ['Frontal', 'front']] as const) {
            await page.getByRole('button', { name: label, exact: true }).click()
            await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
            await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
            await page.locator('.scene-panel').screenshot({ path: resolve(outputDirectory, `${kind}-${suffix}.png`), animations: 'disabled' })
          }
          expect(errors).toEqual([])
        })
      }
    } finally {
      await context.close()
    }
  }
})
