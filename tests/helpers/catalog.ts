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
  const collapsed = content.locator('.catalog-family__toggle[aria-expanded="false"]')
  while (await collapsed.count() > 0) await collapsed.first().click()
}
