import { expect, test } from '@playwright/test'

test('explica construir, añadir, editar y ver sin ocultar herramientas avanzadas', async ({ page }) => {
  await page.goto('/')
  const catalog = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })

  await expect(catalog.getByText('Diseño', { exact: true })).toBeVisible()
  await expect(catalog.getByRole('heading', { name: 'Construye y amuebla' })).toBeVisible()
  await expect(catalog.getByRole('button', { name: 'Catálogo', exact: true })).toBeVisible()
  const catalogGroup = catalog.locator('#catalog-items-list')
  await expect(catalogGroup.getByRole('button', { name: 'Construcción', exact: true })).toBeVisible()
  await expect(catalog.getByText('Añadir objetos', { exact: true })).toHaveCount(0)
  await expect(catalog.getByText('La habitación inicial ya está creada.', { exact: false })).toHaveCount(0)
  await expect(inspector.getByRole('heading', { name: 'Nada seleccionado' })).toBeVisible()
  await expect(inspector.getByText('Para las medidas generales', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Frontal', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Libre', exact: true })).toBeVisible()
  await expect(catalogGroup.getByRole('button', { name: /Nueva habitación vacía/ })).toBeVisible()
})

test('el botón alterna entre Guardar y Guardado y el estado se muestra solo en la barra inferior', async ({ page }) => {
  await page.goto('/')
  const footerStatus = page.locator('.statusbar__save')
  const save = page.getByRole('button', { name: 'Guardar', exact: true })

  await expect(save).toBeEnabled()
  await expect(save).toHaveClass(/primary-button--ready/)
  await expect(save.locator('.save-button__icon')).toHaveText('▣')
  await expect(page.locator('.save-state')).toHaveCount(0)
  await expect(footerStatus).toContainText('Diseño sin guardar · pulsa Guardar')
  await expect(footerStatus).toHaveCSS('font-weight', '650')

  await save.click()
  const saved = page.getByRole('button', { name: 'Guardado', exact: true })
  await expect(saved).toBeDisabled()
  await expect(saved).toHaveClass(/primary-button--saved/)
  await expect(saved.locator('.save-button__icon')).toHaveText('✓')
  await expect(page.locator('.save-state')).toHaveCount(0)
  await expect(footerStatus).toContainText('Diseño guardado en este navegador')

  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  const changed = page.getByRole('button', { name: 'Guardar', exact: true })
  await expect(changed).toBeEnabled()
  await expect(changed).toHaveClass(/primary-button--ready/)
  await expect(page.locator('.save-state')).toHaveCount(0)
  await expect(footerStatus).toContainText('Cambios sin guardar · pulsa Guardar')

  await changed.click()
  await expect(page.getByRole('button', { name: 'Guardado', exact: true })).toBeDisabled()
  await expect(footerStatus).toContainText('Diseño guardado en este navegador')
})


test('volver a seleccionar el diseño actual no provoca confirmación ni descarta cambios', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeEnabled()
  const selector = page.getByRole('button', { name: 'Seleccionar diseño guardado' })
  await selector.click()
  await page.getByRole('button', { name: 'Diseño 1', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '¿Descartar los cambios sin guardar?' })).toHaveCount(0)
  await expect(selector).toContainText('Diseño 1')
  await expect(selector).not.toContainText(/Guardado|Cambios sin guardar/)
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeEnabled()
  await expect(page.locator('.element-row').filter({ hasText: 'Silla' })).toHaveCount(1)
})

test('permite abrir y navegar los diseños guardados con el teclado', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Guardar' }).click()
  const selector = page.getByRole('button', { name: 'Seleccionar diseño guardado' })
  await selector.focus()
  await page.keyboard.press('ArrowDown')
  const menu = page.getByRole('dialog', { name: 'Diseños guardados' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Diseño 1', exact: true })).toBeFocused()
  await page.keyboard.press('End')
  await expect(menu.getByRole('button', { name: /Importar diseño/ })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(menu.getByRole('button', { name: 'Diseño 1', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(selector).toBeFocused()
})

test('crear un diseño exige un nombre y mantiene el formulario abierto para corregirlo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  const menu = page.getByRole('dialog', { name: 'Diseños guardados' })
  await menu.getByRole('button', { name: /Crear diseño/ }).click()
  await menu.getByRole('button', { name: 'Crear en blanco' }).click()
  await expect(menu.getByRole('alert')).toContainText('Introduce un nombre')
  await expect(menu.getByLabel('Nombre del diseño')).toBeVisible()
  await menu.getByLabel('Nombre del diseño').fill('Mi habitación')
  await menu.getByRole('button', { name: 'Crear en blanco' }).click()
  await expect(page.getByRole('button', { name: 'Seleccionar diseño guardado' })).toContainText('Mi habitación')
})

test('aviso de cambios pendientes visible en móvil mediante la barra inferior', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await expect(page.locator('.statusbar__save')).toContainText('Cambios sin guardar')
  await expect(page.locator('.statusbar__save')).toBeVisible()
})


test('flujo básico sin tutorial: medidas, apertura, mueble, guardar y volver a abrir', async ({ page }) => {
  await page.goto('/')
  // No es necesario ejecutar el tutorial para completar las operaciones.
  await page.getByRole('button', { name: 'Ahora no' }).click()
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  const width = inspector.getByRole('textbox', { name: 'Introducir anchura en metros' })
  await width.fill('6.25')
  await width.press('Enter')
  await expect(width).toHaveValue('6.25')

  const catalog = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  await catalog.locator('#catalog-grid-openings .catalog-card').nth(1).click()
  await catalog.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.locator('.statusbar__save')).toContainText('Diseño guardado')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('room-builder:v0.1:designs')!))
  expect(saved).toHaveLength(1)
  expect(saved[0].data.room.width).toBe(6.25)
  expect(saved[0].data.room.windows.length).toBeGreaterThan(1)
  expect(saved[0].data.furniture.some((item: { kind: string }) => item.kind === 'chair')).toBe(true)

  await page.reload()
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await page.getByRole('button', { name: 'Diseño 1', exact: true }).click()
  await expect(page.locator('.statusbar__save')).toContainText('Diseño guardado')
  const roomWidth = inspector.getByRole('textbox', { name: 'Introducir anchura en metros' })
  await expect(roomWidth).toHaveValue('6.25')
  await expect(catalog.locator('.element-row').filter({ hasText: 'Silla' })).toHaveCount(1)
})


test('fijar a pared solo deja un eje lateral y la altura; despegar recupera XYZ', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  const fixation = inspector.getByRole('checkbox', { name: 'Fijar a pared' })
  await expect(fixation).toBeEnabled()
  await expect(inspector.locator('.wall-attachment-controls input[type="checkbox"]')).toHaveCount(1)
  await fixation.check()
  await expect(fixation).toBeChecked()
  await expect(inspector.getByText('Bloquear movimiento lateral')).toHaveCount(0)
  await expect(inspector.getByText('Mantener altura')).toHaveCount(0)
  const x = inspector.getByRole('textbox', { name: 'Introducir X en metros' })
  const y = inspector.getByRole('textbox', { name: 'Introducir Y en metros' })
  const z = inspector.getByRole('textbox', { name: 'Introducir Z en metros' })
  await expect(y).toBeEnabled()
  const enabledHorizontal = Number(await x.isEnabled()) + Number(await z.isEnabled())
  expect(enabledHorizontal).toBe(1)
  await expect(inspector.locator('.axis-position-lock')).toHaveCount(0)
  await y.fill('0.25')
  await y.press('Enter')
  await expect(y).toHaveValue('0.25')
  await fixation.uncheck()
  await expect(x).toBeEnabled()
  await expect(z).toBeEnabled()
  await expect(y).toBeEnabled()
})


test('los textos habituales son legibles sin reintroducir el encabezado del menú de vistas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const measures = await page.evaluate(() => ({
    body: Number.parseFloat(getComputedStyle(document.body).fontSize),
    catalog: Number.parseFloat(getComputedStyle(document.querySelector('.section-copy')!).fontSize),
    view: Number.parseFloat(getComputedStyle(document.querySelector('.view-switcher button')!).fontSize),
  }))
  expect(measures.body).toBeGreaterThanOrEqual(14)
  expect(measures.catalog).toBeGreaterThanOrEqual(14)
  expect(measures.view).toBeGreaterThanOrEqual(14)
  await expect(page.locator('.view-switcher__heading')).toHaveCount(0)
})


test('al agrandar la tipografía no aparece desbordamiento horizontal en móvil', async ({ page }) => {
  await page.goto('/')
  for (const width of [320, 390, 580]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('Construcción forma parte de Catálogo y conserva sus desplegables', async ({ page }) => {
  await page.goto('/')
  const sidebar = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  const catalog = sidebar.getByRole('button', { name: 'Catálogo', exact: true })
  const catalogGroup = sidebar.locator('#catalog-items-list')
  const construction = catalogGroup.getByRole('button', { name: 'Construcción', exact: true })

  await expect(catalog).toHaveAttribute('aria-expanded', 'true')
  await expect(construction).toHaveAttribute('aria-expanded', 'true')
  await expect(catalogGroup.getByRole('button', { name: /Nueva habitación vacía/ })).toBeVisible()
  await expect(catalogGroup.getByRole('button', { name: /Suelo.*Objeto independiente/ })).toBeVisible()
  await expect(catalogGroup.getByRole('button', { name: /Pared.*Objeto independiente/ })).toBeVisible()
  await expect(catalogGroup.getByRole('button', { name: 'Aperturas', exact: true })).toBeVisible()
  await expect(catalogGroup.getByRole('button', { name: 'Asientos', exact: true })).toBeVisible()

  await construction.click()
  await expect(construction).toHaveAttribute('aria-expanded', 'false')
  await expect(catalogGroup.getByRole('button', { name: /Nueva habitación vacía/ })).toHaveCount(0)
  await expect(catalogGroup.getByRole('button', { name: 'Aperturas', exact: true })).toBeVisible()
  await construction.click()
  await expect(catalogGroup.getByRole('button', { name: /Nueva habitación vacía/ })).toBeVisible()

  await catalog.click()
  await expect(catalog).toHaveAttribute('aria-expanded', 'false')
  await expect(sidebar.locator('#catalog-items-list')).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: /Nueva habitación vacía/ })).toHaveCount(0)
  await catalog.click()
  const expandedGroup = sidebar.locator('#catalog-items-list')
  await expect(expandedGroup.getByRole('button', { name: 'Asientos', exact: true })).toBeVisible()
  await expandedGroup.getByRole('button', { name: 'Asientos', exact: true }).click()
  await expect(expandedGroup.getByRole('button', { name: 'Silla ＋ Añadir', exact: true })).toHaveCount(0)
  await expandedGroup.getByRole('button', { name: 'Asientos', exact: true }).click()
  await expect(expandedGroup.getByRole('button', { name: 'Silla ＋ Añadir', exact: true })).toBeVisible()
})

test('Escena puede minimizarse y desplegarse sin perder elementos ni controles', async ({ page }) => {
  await page.goto('/')
  const sidebar = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  const scene = sidebar.getByRole('button', { name: 'Minimizar escena' })
  await expect(sidebar.getByRole('heading', { name: 'Elementos en la habitación' })).toBeVisible()
  await expect(sidebar.getByText('Nivel principal', { exact: true })).toBeVisible()
  await expect(sidebar.getByText('Sin carpeta', { exact: false })).toHaveCount(0)
  await scene.click()
  const expand = sidebar.getByRole('button', { name: 'Mostrar escena' })
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  await expect(sidebar.getByRole('heading', { name: 'Elementos en la habitación' })).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: 'Crear carpeta de elementos' })).toHaveCount(0)
  await expand.click()
  await expect(sidebar.getByRole('button', { name: 'Crear carpeta de elementos' })).toBeVisible()
  await expect(sidebar.getByText('Nivel principal', { exact: true })).toBeVisible()
})

