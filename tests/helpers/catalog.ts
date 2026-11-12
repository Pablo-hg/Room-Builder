import type { Page } from '@playwright/test'

export async function expandCatalogCategories(page: Page, categories: string[]) {
  for (const category of categories) {
    const toggle = page.getByRole('button', { name: category, exact: true })
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
  }
}
