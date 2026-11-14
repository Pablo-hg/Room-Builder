import type { Page } from '@playwright/test'

export async function expandCatalogCategories(page: Page, categories: string[]) {
  for (const category of categories) {
    const toggle = page.getByRole('button', { name: category, exact: true })
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
  }
}

/** El catálogo arranca plegado: despliega Construcción, Aperturas y todas las familias. */
export async function expandAllCatalogCategories(page: Page) {
  const content = page.locator('#catalog-content')
  await content.waitFor({ state: 'attached', timeout: 10_000 }).catch(() => undefined)
  // Una sola operación por pasada en el navegador: un clic de Playwright por familia
  // costaba ~1 s cada uno y agotaba el presupuesto de 30 s en los runners lentos.
  // Las familias anidadas aparecen al desplegar su padre, de ahí las pasadas.
  for (let pass = 0; pass < 6; pass += 1) {
    const clicked = await page.evaluate(async () => {
      const toggles = [...document.querySelectorAll<HTMLElement>('#catalog-content .catalog-family__toggle[aria-expanded="false"]')]
      for (const toggle of toggles) toggle.click()
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      return toggles.length
    })
    if (clicked === 0) break
  }
}
