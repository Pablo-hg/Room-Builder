import { expect, test } from '@playwright/test'
import { expandAllCatalogCategories } from './helpers/catalog'

// Prepared only: execution and screenshot review are reserved for main.
for (const width of [1200, 1199, 1024, 1000, 950, 850, 640, 430]) {
  test(`brújula proporcional a ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expandAllCatalogCategories(page)
    const compass = page.locator('.compass')
    const canvas = compass.locator('canvas')
    await expect(canvas).toBeVisible()
    const bounds = await compass.boundingBox()
    const inner = await canvas.boundingBox()
    expect(bounds).not.toBeNull()
    expect(inner).not.toBeNull()
    expect(Math.abs(inner!.width - inner!.height)).toBeLessThan(1)
    expect(inner!.x).toBeGreaterThan(bounds!.x)
    expect(inner!.y).toBeGreaterThan(bounds!.y)
    expect(inner!.x + inner!.width).toBeLessThan(bounds!.x + bounds!.width)
    expect(inner!.y + inner!.height).toBeLessThan(bounds!.y + bounds!.height)
    const zoom = await page.locator('.zoom-indicator').boundingBox()
    if (zoom) {
      const intersects = bounds!.x < zoom.x + zoom.width && zoom.x < bounds!.x + bounds!.width
        && bounds!.y < zoom.y + zoom.height && zoom.y < bounds!.y + bounds!.height
      expect(intersects).toBe(false)
    }
    // Canvas bounds do not prove that WebGL labels fit: review these captures too.
    await compass.screenshot({ path: testInfo.outputPath(`brujula-${width}.png`) })
    await page.screenshot({ path: testInfo.outputPath(`controles-${width}.png`) })
    await page.getByRole('button', { name: 'Libre', exact: true }).click()
    await expect(canvas).toBeVisible()
    await compass.screenshot({ path: testInfo.outputPath(`brujula-libre-${width}.png`) })
  })
}
