import { expect, test } from '@playwright/test'

test('permite cambiar vistas, añadir un objeto y guardar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Room Builder', { exact: true })).toBeVisible()
  await expect(page.getByText('La habitación está lista')).toBeVisible()
  await page.getByRole('button', { name: 'Plano' }).click()
  await expect(page.getByRole('button', { name: 'Plano' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Sillón/ }).click()
  await expect(page.getByText('La habitación está lista')).toHaveCount(0)
  await expect(page.getByText('Sillón', { exact: true }).last()).toBeVisible()
  const chairVisibility = page.getByRole('checkbox', { name: 'Mostrar Sillón' })
  await expect(chairVisibility).toBeChecked()
  await chairVisibility.click()
  await expect(chairVisibility).not.toBeChecked()
  await chairVisibility.click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.locator('.toast')).toContainText('Diseño guardado')
})

test('mantiene la cabecera y el documento dentro del viewport en tamaños responsive', async ({ page }) => {
  await page.goto('/')

  for (const width of [1440, 1400, 1351, 1197, 1024, 851, 850, 820, 800, 771, 770, 700, 641, 640, 580, 430, 375, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(250)
    const layout = await page.evaluate(() => {
      const rect = (selector: string) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect()
        if (!bounds) throw new Error(`No se encontró ${selector}`)
        return bounds
      }
      const brand = rect('.brand')
      const viewSwitcher = rect('.view-switcher')
      const saveActions = rect('.save-actions')
      const cameraControls = rect('.camera-controls')
      const zoomIndicator = rect('.zoom-indicator')
      const compass = rect('.compass')
      const overlaps = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

      return {
        hasHeaderOverlap: overlaps(brand, viewSwitcher) || overlaps(brand, saveActions) || overlaps(viewSwitcher, saveActions),
        hasSceneControlOverlap: overlaps(cameraControls, compass) || overlaps(zoomIndicator, compass),
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      }
    })

    expect(layout.hasHeaderOverlap, `la cabecera se solapa a ${width}px`).toBe(false)
    expect(layout.hasSceneControlOverlap, `los controles de cámara se solapan a ${width}px`).toBe(false)
    expect(layout.hasHorizontalOverflow, `hay desbordamiento horizontal a ${width}px`).toBe(false)
  }
})

test('usa atajos para copiar, pegar, deshacer y rehacer objetos', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  const armchairs = page.locator('.element-row').filter({ hasText: 'Sillón' })
  await expect(armchairs).toHaveCount(1)

  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(armchairs).toHaveCount(2)
  await page.keyboard.press('Control+z')
  await expect(armchairs).toHaveCount(1)
  await page.keyboard.press('Control+Shift+z')
  await expect(armchairs).toHaveCount(2)
})

test('muestra la guía de atajos del inspector y permite minimizarla', async ({ page }) => {
  await page.goto('/')
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  const toggle = inspector.getByRole('button', { name: 'Atajos de teclado' })
  const shortcuts = inspector.locator('#shortcut-guide-list')

  await expect(shortcuts).toBeVisible()
  await expect(shortcuts).toContainText('Deshacer')
  await expect(shortcuts).toContainText('Ctrl')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(shortcuts).toBeHidden()
  await toggle.click()
  await expect(shortcuts).toBeVisible()
})

test('permite elevar un mueble desde el inspector', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()

  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  const elevation = inspector.getByLabel(/Posición Y/)
  await expect(elevation).toHaveValue('0')
  await elevation.focus()
  await elevation.press('ArrowRight')
  await expect(elevation).toHaveValue('0.125')
})

test('permite mover un mueble lateralmente y en altura en vista frontal', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  await page.getByRole('button', { name: 'Frontal' }).click()

  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  const selectedItem = inspector.getByRole('heading', { name: 'Sillón', exact: true })
  await expect(selectedItem).toBeVisible()
  const initialPosition = await inspector.locator('.selected-heading p').innerText()
  const elevation = inspector.getByLabel(/Posición Y/)
  await expect(elevation).toBeVisible()

  const canvas = page.locator('.scene-panel canvas').first()
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas de la vista frontal')
  const objectX = bounds.x + bounds.width / 2
  const objectY = bounds.y + bounds.height * 0.65
  await page.mouse.move(objectX, objectY)
  await page.mouse.down()
  await page.mouse.move(objectX + 40, objectY - 35, { steps: 4 })
  await page.mouse.up()

  await expect(inspector.locator('.selected-heading p')).not.toHaveText(initialPosition)
  await expect(elevation).not.toHaveValue('0')
})

test('mantiene ambas alfombras sobre el suelo y oculta el control vertical', async ({ page }) => {
  await page.goto('/')
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })

  for (const name of ['Alfombra', 'Alfombra circular']) {
    await page.getByRole('button', { name: `${name} ＋ Añadir`, exact: true }).click()
    await expect(inspector.getByRole('heading', { name, exact: true })).toBeVisible()
    await expect(inspector.getByText('Posición Y', { exact: true })).toHaveCount(0)
    await expect(inspector.getByLabel('Posición X')).toBeVisible()
    await expect(inspector.getByLabel('Posición Z')).toBeVisible()
    await page.getByRole('button', { name: 'Eliminar' }).click()
  }
})

test('añade los nuevos objetos decorativos e iluminación', async ({ page }) => {
  await page.goto('/')
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })

  for (const name of ['Jarrón', 'Lámpara de mesa', 'Lámpara de techo']) {
    await page.getByRole('button', { name: `${name} ＋ Añadir`, exact: true }).click()
    await expect(inspector.getByRole('heading', { name, exact: true })).toBeVisible()
    if (name === 'Lámpara de techo') {
      await expect(inspector.getByText('Posición Y', { exact: true })).toHaveCount(0)
    }
    await page.getByRole('button', { name: 'Eliminar' }).click()
  }

  await page.getByRole('button', { name: 'Aplique de pared ＋ Añadir', exact: true }).click()
  await expect(inspector.getByRole('heading', { name: 'Aplique de pared', exact: true })).toBeVisible()
  await expect(inspector.getByText('Elemento montado en pared')).toBeVisible()
})

test('lista puerta y ventanas y conserva su visibilidad al recuperar', async ({ page }) => {
  await page.goto('/')
  const doorVisibility = page.getByRole('checkbox', { name: 'Mostrar Puerta' })
  const windowVisibility = page.getByRole('checkbox', { name: 'Mostrar Ventana 1' })
  await expect(doorVisibility).toBeChecked()
  await expect(windowVisibility).toBeChecked()
  await windowVisibility.click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await windowVisibility.click()
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await page.getByRole('button', { name: /^Diseño 1/ }).click()
  await expect(windowVisibility).not.toBeChecked()
})

test('permite cambiar el color de cada pared y del suelo', async ({ page }) => {
  await page.goto('/')
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  const sharedColor = inspector.getByLabel('Todas las paredes')
  const northWallColor = inspector.getByLabel('Pared A')
  const eastWallColor = inspector.getByLabel('Pared B')
  const floorColor = inspector.getByLabel('Suelo')
  const wallColorsToggle = inspector.getByRole('button', { name: 'Minimizar controles de color de las paredes' })

  await wallColorsToggle.click()
  await expect(inspector.getByLabel('Pared A')).toBeHidden()
  await inspector.getByRole('button', { name: 'Mostrar controles de color de las paredes' }).click()
  await expect(northWallColor).toBeVisible()

  await sharedColor.fill('#aabbcc')
  await expect(northWallColor).toHaveValue('#aabbcc')
  await expect(eastWallColor).toHaveValue('#aabbcc')
  await northWallColor.fill('#112233')
  await floorColor.fill('#334455')
  await expect(northWallColor).toHaveValue('#112233')
  await expect(eastWallColor).toHaveValue('#aabbcc')
  await expect(floorColor).toHaveValue('#334455')

  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await page.getByRole('button', { name: /^Diseño 1/ }).click()
  await expect(northWallColor).toHaveValue('#112233')
  await expect(floorColor).toHaveValue('#334455')
})

test('ofrece las cuatro orientaciones isométricas sin mover los datos', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mesa ＋ Añadir', exact: true }).click()
  const coordinates = page.getByRole('complementary', { name: 'Inspector y configuración detallada' }).locator('.selected-heading p')
  const initialCoordinates = await coordinates.innerText()
  await expect(page.getByLabel('Vista diagonal · paredes visibles A y D')).toBeVisible()
  const right = page.getByRole('button', { name: 'Girar a la derecha' })
  await right.click()
  await expect(page.getByLabel('Vista diagonal · paredes visibles C y D')).toBeVisible()
  await right.click()
  await expect(page.getByLabel('Vista diagonal · paredes visibles B y C')).toBeVisible()
  await right.click()
  await expect(page.getByLabel('Vista diagonal · paredes visibles A y B')).toBeVisible()
  await right.click()
  await expect(page.getByLabel('Vista diagonal · paredes visibles A y D')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Isométrica', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.locator('.element-select').filter({ hasText: 'Mesa' }).first().click()
  await expect(coordinates).toHaveText(initialCoordinates)
})

test('al cambiar de orientación isométrica a frontal conserva la pared correspondiente', async ({ page }) => {
  await page.goto('/')
  const rotateRight = page.getByRole('button', { name: 'Girar a la derecha' })
  await rotateRight.click()
  await rotateRight.click()
  await page.getByRole('button', { name: 'Plano' }).click()
  await page.getByRole('button', { name: 'Frontal' }).click()
  await expect(page.locator('.visible-walls-badge')).toContainText('Frente: B')
})

test('invierte el sentido de giro de los controles isométricos', async ({ page }) => {
  await page.goto('/')
  const visibleWalls = page.locator('.visible-walls-badge')
  await expect(visibleWalls).toContainText('Paredes visibles: A y D')

  await page.getByRole('button', { name: 'Girar a la izquierda' }).click()
  await expect(visibleWalls).toContainText('Paredes visibles: A y B')

  await page.reload()
  await page.getByRole('button', { name: 'Girar a la derecha' }).click()
  await expect(visibleWalls).toContainText('Paredes visibles: C y D')

  await page.reload()
  const orbitControl = page.getByRole('button', { name: 'Mantener pulsado y arrastrar horizontalmente para girar la habitación' })
  const bounds = await orbitControl.boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el control de órbita isométrica')
  const startX = bounds.x + bounds.width / 2
  const startY = bounds.y + bounds.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 200, startY, { steps: 4 })
  await page.mouse.up()
  await expect(visibleWalls).toContainText('Paredes visibles: A y B')
})

test('orbita desde un objeto con el botón central y lo deselecciona sin moverlo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  await expect(inspector.getByRole('heading', { name: 'Sillón', exact: true })).toBeVisible()
  const originalPosition = await inspector.locator('.selected-heading p').innerText()

  const scene = page.locator('.scene-panel')
  const canvas = scene.locator('canvas').first()
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas de la habitación')
  const startX = bounds.x + bounds.width / 2
  const startY = bounds.y + bounds.height * 0.51
  const visibleWalls = page.locator('.visible-walls-badge')
  const initialWalls = await visibleWalls.innerText()

  await page.mouse.move(startX, startY)
  await page.mouse.down({ button: 'middle' })
  await expect(scene).toHaveClass(/scene-panel--orbit-dragging/)
  await expect(inspector.getByRole('heading', { name: 'Nada seleccionado' })).toBeVisible()
  await page.mouse.move(startX - 120, startY, { steps: 4 })
  await page.mouse.up({ button: 'middle' })

  await expect(visibleWalls).not.toHaveText(initialWalls)
  await page.locator('.element-select').filter({ hasText: 'Sillón' }).first().click()
  await expect(inspector.getByRole('heading', { name: 'Sillón', exact: true })).toBeVisible()
  await expect(inspector.locator('.selected-heading p')).toHaveText(originalPosition)
})

test('orbita la vista isométrica desde el suelo, las paredes y el exterior', async ({ page }) => {
  await page.goto('/')
  const scene = page.locator('.scene-panel')
  const canvas = scene.locator('canvas').first()
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas de la habitación')

  await expect(canvas).toHaveCSS('cursor', 'grab')
  await expect(page.locator('.camera-orbit-mouse-icon')).toBeVisible()
  const blankOrientation = await page.locator('.visible-walls-badge').innerText()
  const exteriorCandidates = [
    [0.03, 0.72],
    [0.97, 0.18],
    [0.97, 0.62],
    [0.03, 0.18],
  ] as const
  let blankPoint: { x: number; y: number } | null = null
  for (const [xRatio, yRatio] of exteriorCandidates) {
    const x = bounds.x + bounds.width * xRatio
    const y = bounds.y + bounds.height * yRatio
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.waitForTimeout(50)
    if (await scene.evaluate((element) => element.classList.contains('scene-panel--orbit-dragging'))) {
      blankPoint = { x, y }
      break
    }
    await page.mouse.up()
  }
  expect(blankPoint, 'debe existir una zona exterior del canvas desde la que orbitar').not.toBeNull()
  const { x: blankX, y: blankY } = blankPoint!
  await expect(scene).toHaveClass(/scene-panel--orbit-dragging/)
  await expect(page.locator('.camera-orbit-mouse-icon')).toHaveCount(0)
  await expect(canvas).toHaveCSS('cursor', 'grabbing')
  await page.mouse.move(blankX - 100, blankY, { steps: 4 })
  await page.mouse.up()
  await expect(page.locator('.visible-walls-badge')).not.toHaveText(blankOrientation)
  await expect(scene).not.toHaveClass(/scene-panel--orbit-dragging/)
  await expect(canvas).toHaveCSS('cursor', 'grab')

  const wallOrientation = await page.locator('.visible-walls-badge').innerText()
  const wallX = bounds.x + bounds.width * 0.5
  const wallY = bounds.y + bounds.height * 0.4
  await page.mouse.move(wallX, wallY)
  await page.mouse.down()
  await expect(scene).toHaveClass(/scene-panel--orbit-dragging/)
  await page.mouse.move(wallX + 110, wallY, { steps: 4 })
  await page.mouse.up()
  await expect(page.locator('.visible-walls-badge')).not.toHaveText(wallOrientation)

  const floorOrientation = await page.locator('.visible-walls-badge').innerText()
  const floorX = bounds.x + bounds.width * 0.5
  const floorY = bounds.y + bounds.height * 0.73
  await page.mouse.move(floorX, floorY)
  await page.mouse.down()
  await expect(scene).toHaveClass(/scene-panel--orbit-dragging/)
  await page.mouse.move(floorX - 110, floorY, { steps: 4 })
  await page.mouse.up()
  await expect(page.locator('.visible-walls-badge')).not.toHaveText(floorOrientation)

  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  await expect(page.getByText('Inspector del elemento')).toBeVisible()
  await page.mouse.move(blankX, blankY)
  await page.mouse.down()
  await expect(scene).toHaveClass(/scene-panel--orbit-dragging/)
  await expect(page.getByRole('heading', { name: 'Nada seleccionado' })).toBeVisible()
  await page.mouse.move(blankX - 80, blankY, { steps: 3 })
  await page.mouse.up()
})

test('la vista libre orbita en dos ejes y mantiene la edición desde los paneles', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Libre' }).click()
  await expect(page.getByRole('button', { name: 'Libre' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()

  const visibility = page.getByRole('checkbox', { name: 'Mostrar Sillón' })
  await expect(visibility).toBeChecked()
  await visibility.click()
  await expect(visibility).not.toBeChecked()

  const compass = page.getByRole('group', { name: /Brújula XYZ/ })
  const initialOrientation = await compass.getAttribute('aria-label')
  const scene = page.locator('.scene-panel')
  const canvas = scene.locator('.room-scene-canvas--orbit')
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas de la habitación')

  const startX = bounds.x + bounds.width / 2
  const startY = bounds.y + bounds.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(startX - 80, startY - 40, { steps: 4 })
  await page.mouse.up({ button: 'middle' })

  await expect(compass).not.toHaveAttribute('aria-label', initialOrientation ?? '')
  await expect(scene).not.toHaveClass(/scene-panel--orbit-dragging/)

  const blankAreaOrientation = await compass.getAttribute('aria-label')
  await page.mouse.move(bounds.x + bounds.width - 18, bounds.y + 18)
  await page.mouse.down()
  await expect(scene).toHaveClass(/scene-panel--orbit-dragging/)
  await page.mouse.move(bounds.x + bounds.width - 72, bounds.y + 54, { steps: 4 })
  await page.mouse.up()
  await expect(compass).not.toHaveAttribute('aria-label', blankAreaOrientation ?? '')
  await expect(scene).not.toHaveClass(/scene-panel--orbit-dragging/)

  const wallOrientation = await compass.getAttribute('aria-label')
  const wallX = bounds.x + bounds.width * 0.5
  const wallY = bounds.y + bounds.height * 0.4
  await page.mouse.move(wallX, wallY)
  await page.mouse.down()
  await expect(scene).toHaveClass(/scene-panel--orbit-dragging/)
  await page.mouse.move(wallX + 35, wallY + 20, { steps: 3 })
  await page.mouse.up()
  await expect(compass).not.toHaveAttribute('aria-label', wallOrientation ?? '')
  await expect(scene).not.toHaveClass(/scene-panel--orbit-dragging/)

  const floorOrientation = await compass.getAttribute('aria-label')
  const floorX = bounds.x + bounds.width * 0.5
  const floorY = bounds.y + bounds.height * 0.73
  await page.mouse.move(floorX, floorY)
  await page.mouse.down()
  await expect(scene).toHaveClass(/scene-panel--orbit-dragging/)
  await page.mouse.move(floorX - 32, floorY + 16, { steps: 3 })
  await page.mouse.up()
  await expect(compass).not.toHaveAttribute('aria-label', floorOrientation ?? '')
  await expect(scene).not.toHaveClass(/scene-panel--orbit-dragging/)

  const toolbar = page.getByRole('button', { name: 'Mantener pulsado y arrastrar en cualquier dirección para orbitar' })
  const toolbarBounds = await toolbar.boundingBox()
  if (!toolbarBounds) throw new Error('No se pudo localizar el control de órbita libre')
  const toolbarOrientation = await compass.getAttribute('aria-label')
  await page.mouse.move(toolbarBounds.x + toolbarBounds.width / 2, toolbarBounds.y + toolbarBounds.height / 2)
  await page.mouse.down()
  await expect(toolbar).toHaveClass(/dragging/)
  await page.mouse.move(toolbarBounds.x + toolbarBounds.width / 2 - 25, toolbarBounds.y + toolbarBounds.height / 2 - 18, { steps: 3 })
  await page.mouse.up()
  await expect(compass).not.toHaveAttribute('aria-label', toolbarOrientation ?? '')

  const positiveXAxis = page.getByRole('button', { name: 'Alinear cámara con Eje X positivo' })
  await positiveXAxis.focus()
  await positiveXAxis.press('Enter')
  await expect(compass).toHaveAttribute('aria-label', /azimut 0° · elevación 0°/)
})

test('permite volver a seleccionar un mueble después de pulsar fuera', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()

  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  await expect(inspector.getByRole('heading', { name: 'Sillón' })).toBeVisible()

  const canvas = page.locator('.scene-panel canvas').first()
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas de la habitación')

  const outsideCandidates = [
    [0.03, 0.72],
    [0.97, 0.18],
    [0.97, 0.62],
    [0.03, 0.18],
  ] as const
  const nothingSelected = inspector.getByRole('heading', { name: 'Nada seleccionado' })
  let deselected = false
  for (const [xRatio, yRatio] of outsideCandidates) {
    await page.mouse.click(bounds.x + bounds.width * xRatio, bounds.y + bounds.height * yRatio)
    try {
      await expect(nothingSelected).toBeVisible({ timeout: 500 })
      deselected = true
      break
    } catch {
      // Prueba el siguiente punto exterior: la composición 3D cambia con el viewport.
    }
  }
  expect(deselected, 'debe existir una zona exterior que deseleccione el mueble').toBe(true)
  await expect(nothingSelected).toBeVisible()

  const chairSelected = inspector.getByRole('heading', { name: 'Sillón' })
  const chairCandidates = [
    [0.5, 0.51],
    [0.5, 0.55],
    [0.48, 0.52],
    [0.52, 0.52],
    [0.5, 0.47],
    [0.46, 0.54],
    [0.54, 0.54],
  ] as const
  let reselected = false
  for (const [xRatio, yRatio] of chairCandidates) {
    await page.mouse.click(bounds.x + bounds.width * xRatio, bounds.y + bounds.height * yRatio)
    try {
      await expect(chairSelected).toBeVisible({ timeout: 500 })
      reselected = true
      break
    } catch {
      // La proyección exacta del modelo varía unos píxeles según el viewport.
    }
  }
  expect(reselected, 'el sillón debe poder reseleccionarse desde el canvas').toBe(true)
  await expect(chairSelected).toBeVisible()
})

test('coloca los muebles nuevos en sectores libres', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mesa ＋ Añadir', exact: true }).click()
  await expect(page.getByText('0.00, 0.00 m', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Sillón/ }).click()
  await expect(page.getByText('0.00, 0.00 m', { exact: true })).not.toBeVisible()
  await expect(page.locator('.toast')).toContainText('Sillón añadido')
})

test('incluye puerta y ventana en el catálogo y abre sus propiedades a la izquierda', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.catalog-card')).toHaveCount(36)
  for (const name of ['Sofá', 'Silla', 'Cama doble', 'Estantería', 'Lámpara', 'Mesa de centro', 'Escritorio', 'Silla de escritorio', 'Mueble de TV', 'Televisor', 'Alfombra', 'Alfombra circular', 'Planta', 'Espejo rectangular', 'Espejo circular']) {
    await expect(page.locator('.catalog-card').getByText(name, { exact: true })).toBeVisible()
  }
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  await page.getByRole('button', { name: /Planta.*Añadir/ }).click()
  await expect(inspector.getByRole('heading', { name: 'Planta' })).toBeVisible()

  await page.getByRole('button', { name: /Puerta Seleccionar/ }).click()
  await expect(inspector.getByRole('heading', { name: 'Puerta' })).toBeVisible()
  await expect(inspector.getByText('Posición lateral')).toBeVisible()
  await expect(inspector.getByText('1.00 m', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Ventana ＋ Añadir', exact: true }).click()
  await expect(inspector.getByRole('heading', { name: 'Ventana' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Mostrar Ventana 2' })).toBeChecked()
  await expect(page.locator('.toast')).toContainText('Ventana añadida')
  await page.getByRole('button', { name: /Espejo rectangular.*Añadir/ }).click()
  await expect(inspector.getByRole('heading', { name: 'Espejo rectangular' })).toBeVisible()
  await expect(inspector.getByText('Elemento montado en pared')).toBeVisible()
  await page.getByRole('button', { name: /Espejo circular.*Añadir/ }).click()
  await expect(inspector.getByRole('heading', { name: 'Espejo circular' })).toBeVisible()
})

test('administra diseños guardados y respeta el foco del formulario', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await page.getByRole('button', { name: 'Crear diseño' }).click()
  const name = page.getByLabel('Nombre del diseño')
  await name.fill('Sala')
  await name.press('r')
  await expect(name).toHaveValue('Salar')
  await page.getByRole('button', { name: 'Lienzo en blanco' }).click()
  await page.getByRole('button', { name: 'Cambiar nombre de Salar' }).click()
  await page.getByRole('textbox', { name: 'Nuevo nombre para Salar' }).fill('Salón')
  await page.getByRole('button', { name: 'Guardar nombre' }).click()
  await expect(page.locator('.saved-design-choice').filter({ hasText: 'Salón' })).toBeVisible()
  await page.getByRole('button', { name: 'Crear diseño' }).click()
  await name.fill('Copia')
  await page.getByRole('button', { name: 'Copiar diseño actual' }).click()
  await expect(page.locator('.saved-design-choice').filter({ hasText: 'Copia' })).toBeVisible()
  await page.getByRole('button', { name: 'Eliminar Copia' }).click()
  await expect(page.locator('.saved-design-choice').filter({ hasText: 'Copia' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Seleccionar diseño guardado' })).toBeFocused()
})

test('permite seleccionar un pack y editar una de sus superficies', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Nuevo piso vacío/ }).click()
  await expect(page.getByText('Pack de construcción', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Suelo · Editar/ }).click()
  await expect(page.getByText('Superficie de construcción', { exact: true }).first()).toBeVisible()
  await expect(page.getByLabel('Desplazamiento X')).toBeVisible()
})
