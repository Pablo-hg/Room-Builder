import { expect, test, type Locator, type Page } from '@playwright/test'

async function dragToRoot(page: Page, source: Locator, target: Locator) {
  await source.hover()
  await page.mouse.down()
  const start = await source.boundingBox()
  if (!start) throw new Error('Elemento de origen no disponible')
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2, { steps: 3 })
  await target.scrollIntoViewIfNeeded()
  const destination = await target.boundingBox()
  if (!destination) throw new Error('Destino no disponible')
  const x = destination.x + destination.width / 2
  const y = destination.y + destination.height / 2
  await page.mouse.move(x, y, { steps: 8 })
  // HTML5 necesita un dragover posterior al desplazamiento del panel antes del drop.
  await page.mouse.move(x + 1, y)
  await page.mouse.up()
}

test('permite cambiar vistas, añadir un objeto y guardar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Room Builder', { exact: true })).toBeVisible()
  await expect(page.getByText('La habitación está lista')).toBeVisible()
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Plano', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Sillón/ }).click()
  await expect(page.getByText('La habitación está lista')).toHaveCount(0)
  await expect(page.getByText('Sillón', { exact: true }).last()).toBeVisible()
  const chairVisibility = page.getByRole('button', { name: 'Ocultar Sillón' })
  await expect(chairVisibility).toHaveAttribute('aria-pressed', 'true')
  await chairVisibility.click()
  const hiddenChairVisibility = page.getByRole('button', { name: 'Mostrar Sillón' })
  await expect(hiddenChairVisibility).toHaveAttribute('aria-pressed', 'false')
  await hiddenChairVisibility.click()
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

test('permite minimizar la sección Tu habitación del inspector', async ({ page }) => {
  await page.goto('/')
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  const toggle = inspector.getByRole('button', { name: 'Tu habitación' })
  const content = inspector.locator('#room-section-content')

  await expect(content).toBeVisible()
  await expect(content).toContainText('Anchura')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(content).toBeHidden()
  await toggle.click()
  await expect(content).toBeVisible()
})

test('alterna la visibilidad y el candado de un elemento desde la lista', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  const catalog = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  const row = catalog.locator('.element-row').filter({ hasText: 'Silla' })
  const visibility = row.getByRole('button', { name: 'Ocultar Silla' })
  const lock = row.getByRole('button', { name: 'Bloquear Silla' })
  const actions = row.locator('.element-actions')

  await expect(actions).toHaveCSS('opacity', '0')
  await row.hover()
  await expect(actions).toHaveCSS('opacity', '1')
  await visibility.focus()
  await expect(actions).toHaveCSS('opacity', '1')
  await expect(visibility).toBeVisible()
  await lock.click()
  await expect(row).toHaveClass(/element-row--locked/)
  await expect(row.getByRole('button', { name: 'Desbloquear Silla' })).toHaveAttribute('aria-pressed', 'true')
  await expect(inspector.getByLabel('Posición X', { exact: true })).toBeDisabled()
  await row.getByRole('button', { name: 'Desbloquear Silla' }).click()
  await expect(inspector.getByLabel('Posición X', { exact: true })).toBeEnabled()

  await visibility.click()
  await expect(row).toHaveClass(/element-row--hidden/)
  await expect(row.getByRole('button', { name: 'Mostrar Silla' })).toBeVisible()
})

test('crea carpetas, mueve elementos y las renombra o elimina', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await page.getByRole('button', { name: 'Planta ＋ Añadir', exact: true }).click()
  const catalog = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  const chairRow = catalog.locator('.element-row').filter({ hasText: 'Silla' })

  await catalog.getByRole('button', { name: 'Crear carpeta de elementos' }).click()
  const folder = catalog.locator('.element-folder').filter({ hasText: 'Carpeta 1' })
  await expect(folder).toBeVisible()
  await expect(folder).toContainText('Carpeta vacía')

  await chairRow.hover()
  await chairRow.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Mover a', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Carpeta 1' }).click()
  await expect(folder.locator('.element-row').filter({ hasText: 'Silla' })).toBeVisible()
  await expect(folder.locator('.element-folder__select')).toContainText('1')

  await folder.locator('.element-folder__heading').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Renombrar' }).click()
  await catalog.getByLabel('Nuevo nombre para Carpeta 1').fill('Asientos')
  await catalog.getByLabel('Nuevo nombre para Carpeta 1').press('Enter')
  const renamed = catalog.locator('.element-folder').filter({ hasText: 'Asientos' })
  await expect(renamed.locator('.element-folder__select')).toContainText('Asientos')

  await renamed.locator('.element-folder__collapse').click()
  await expect(renamed.locator('.element-list')).toBeHidden()
  await renamed.locator('.element-folder__collapse').click()
  await expect(renamed.locator('.element-list')).toBeVisible()

  await renamed.locator('.element-folder__heading').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Borrar' }).click()
  await expect(catalog.getByRole('button', { name: 'Carpeta Asientos', exact: true })).toHaveCount(0)
  await expect(catalog.getByRole('button', { name: 'Carpeta Raíz', exact: true })).toBeVisible()
  await expect(catalog.locator('.element-row').filter({ hasText: 'Silla' })).toBeVisible()
  await expect(catalog.locator('.element-row').filter({ hasText: 'Planta' })).toBeVisible()
})

test('permite elevar un mueble desde el inspector', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()

  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  const elevation = inspector.getByLabel('Posición Y', { exact: true })
  await expect(elevation).toHaveValue('0')
  await elevation.focus()
  await elevation.press('ArrowRight')
  await expect(elevation).toHaveValue('0.01')
})

test('permite mover un mueble lateralmente y en altura en vista frontal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  await page.getByRole('button', { name: 'Frontal' }).click()

  const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  const selectedItem = inspector.getByRole('heading', { name: 'Sillón', exact: true })
  await expect(selectedItem).toBeVisible()
  const initialPosition = await inspector.locator('.selected-heading p').innerText()
  const elevation = inspector.getByLabel('Posición Y', { exact: true })
  await expect(elevation).toBeVisible()

  const canvas = page.locator('.scene-panel canvas').first()
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas de la vista frontal')
  // El centro contiene el eje Y; el cuerpo permite desplazar lateralmente y en altura.
  const objectX = bounds.x + bounds.width / 2 + 20
  const objectY = bounds.y + bounds.height * 0.61
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
    await expect(inspector.getByLabel('Posición X', { exact: true })).toBeVisible()
    await expect(inspector.getByLabel('Posición Z', { exact: true })).toBeVisible()
    await inspector.getByRole('button', { name: 'Eliminar' }).click()
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
    await inspector.getByRole('button', { name: 'Eliminar' }).click()
  }

  await page.getByRole('button', { name: 'Aplique de pared ＋ Añadir', exact: true }).click()
  await expect(inspector.getByRole('heading', { name: 'Aplique de pared', exact: true })).toBeVisible()
  await expect(inspector.getByText('Elemento montado en pared')).toBeVisible()
})

test('lista puerta y ventanas y conserva su visibilidad al recuperar', async ({ page }) => {
  await page.goto('/')
  const doorVisibility = page.getByRole('button', { name: /Mostrar Puerta$|Ocultar Puerta$/ })
  const windowVisibility = page.getByRole('button', { name: /Mostrar Ventana 1$|Ocultar Ventana 1$/ })
  await expect(doorVisibility).toHaveAttribute('aria-pressed', 'true')
  await expect(windowVisibility).toHaveAttribute('aria-pressed', 'true')
  await windowVisibility.click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.getByRole('button', { name: 'Mostrar Ventana 1' }).click()
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await page.getByRole('button', { name: /^Diseño 1/ }).click()
  await expect(page.getByRole('button', { name: 'Mostrar Ventana 1' })).toHaveAttribute('aria-pressed', 'false')
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

  const visibility = page.getByRole('button', { name: 'Ocultar Sillón' })
  await expect(visibility).toHaveAttribute('aria-pressed', 'true')
  await visibility.click()
  await expect(page.getByRole('button', { name: 'Mostrar Sillón' })).toHaveAttribute('aria-pressed', 'false')

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
  await expect(page.getByRole('button', { name: 'Ocultar Ventana 2' })).toHaveAttribute('aria-pressed', 'true')
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
  await page.getByRole('button', { name: 'Crear en blanco' }).click()
  await page.getByRole('button', { name: 'Más opciones de Salar' }).click()
  await page.getByRole('menuitem', { name: 'Renombrar' }).click()
  await page.getByRole('textbox', { name: 'Nuevo nombre para Salar' }).fill('Salón')
  await page.getByRole('button', { name: 'Guardar nombre' }).click()
  await expect(page.locator('.saved-design-choice').filter({ hasText: 'Salón' })).toBeVisible()
  await page.getByRole('button', { name: 'Más opciones de Salón' }).click()
  await page.getByRole('menuitem', { name: 'Copiar diseño' }).click()
  await expect(page.locator('.saved-design-choice').filter({ hasText: 'Copia de Salón' })).toBeVisible()
  await page.getByRole('button', { name: 'Más opciones de Copia de Salón' }).click()
  await page.getByRole('menuitem', { name: 'Borrar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar diseño' }).click()
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await expect(page.locator('.saved-design-choice').filter({ hasText: 'Copia de Salón' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Seleccionar diseño guardado' })).toBeFocused()
})

test('permite seleccionar un pack y editar una de sus superficies', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Nueva habitación vacía/ }).click()
  await page.getByRole('button', { name: 'Encima', exact: true }).click()
  await expect(page.getByText('Pack de construcción', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Suelo · Editar/ }).click()
  await expect(page.getByText('Superficie de construcción', { exact: true }).first()).toBeVisible()
  await expect(page.getByLabel('Desplazamiento X', { exact: true })).toBeVisible()
})

test('arrastra elementos entre carpetas anidadas y sin carpeta', async ({ page }) => {
  await page.goto('/')
  const catalog = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await catalog.getByRole('button', { name: 'Crear carpeta de elementos' }).click()
  const parent = catalog.locator('.element-folder').filter({ has: page.getByRole('button', { name: 'Carpeta Carpeta 1', exact: true }) }).first()
  await parent.locator('.element-folder__heading').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Crear subcarpeta' }).click()
  const child = parent.locator('.element-folder').filter({ has: page.getByRole('button', { name: 'Carpeta Carpeta 2', exact: true }) })
  await expect(child).toBeVisible()
  const chair = catalog.locator('.element-row').filter({ hasText: 'Silla' })
  await chair.dragTo(child.locator('.element-folder__heading').first())
  await expect(child.locator('.element-row').filter({ hasText: 'Silla' })).toBeVisible()
  await dragToRoot(page, child.locator('.element-row').filter({ hasText: 'Silla' }), catalog.getByText('Sin carpeta', { exact: false }))
  await expect(child.locator('.element-row').filter({ hasText: 'Silla' })).toHaveCount(0)
  await expect(catalog.locator('.element-row').filter({ hasText: 'Silla' })).toBeVisible()
})

test('mueve carpetas con el ratón y mediante el inspector', async ({ page }) => {
  await page.goto('/')
  const catalog = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  await catalog.getByRole('button', { name: 'Crear carpeta de elementos' }).click()
  await catalog.getByRole('button', { name: 'Crear carpeta de elementos' }).click()
  const folder = (name: string) => catalog.locator('.element-folder').filter({ has: page.getByRole('button', { name: `Carpeta ${name}`, exact: true }) })
  await folder('Carpeta 1').locator('.element-folder__heading').first().dragTo(folder('Carpeta 2').locator('.element-folder__heading').first())
  await expect(folder('Carpeta 2').locator('.element-folder').getByRole('button', { name: 'Carpeta Carpeta 1', exact: true })).toBeVisible()
  await dragToRoot(page, folder('Carpeta 2').locator('.element-folder').locator('.element-folder__heading').first(), catalog.getByText('Sin carpeta', { exact: false }))
  await expect(folder('Carpeta 2').locator('.element-folder').getByRole('button', { name: 'Carpeta Carpeta 1', exact: true })).toHaveCount(0)
  await catalog.getByRole('button', { name: 'Carpeta Carpeta 1', exact: true }).click()
  const location = page.getByLabel('Ubicación de la carpeta')
  await location.selectOption({ label: 'Carpeta 2' })
  await expect(folder('Carpeta 2').locator('.element-folder').getByRole('button', { name: 'Carpeta Carpeta 1', exact: true })).toBeVisible()
  await location.selectOption({ label: 'Nivel principal' })
  await expect(folder('Carpeta 2').locator('.element-folder').getByRole('button', { name: 'Carpeta Carpeta 1', exact: true })).toHaveCount(0)
})

test('distingue gráficamente los niveles de carpetas y elementos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const catalog = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  await catalog.getByRole('button', { name: 'Crear carpeta de elementos' }).click()
  const parent = catalog.locator('.element-folder').filter({ has: page.getByRole('button', { name: 'Carpeta Carpeta 1', exact: true }) }).first()
  await parent.locator('.element-folder__heading').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Crear subcarpeta' }).click()
  const child = parent.locator('.element-folder').filter({ has: page.getByRole('button', { name: 'Carpeta Carpeta 2', exact: true }) })
  const door = catalog.locator('.element-row').filter({ hasText: 'Puerta' })
  await door.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Mover a', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Carpeta 2', exact: true }).click()
  const parentHeading = (await parent.locator('.element-folder__heading').first().boundingBox())!
  const childHeading = (await child.locator('.element-folder__heading').first().boundingBox())!
  const childDoor = (await child.locator('.element-row').filter({ hasText: 'Puerta' }).boundingBox())!
  expect(childHeading.x).toBeGreaterThan(parentHeading.x)
  expect(childDoor.x).toBeGreaterThan(childHeading.x)
  await catalog.screenshot({ path: '/tmp/room-builder-folder-hierarchy.png' })
})

test('reordena objetos sin carpeta y dentro de una carpeta', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 2000 })
  await page.goto('/')
  const catalog = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await catalog.getByRole('button', { name: 'Minimizar catálogo completo' }).click()
  const row = (name: string) => catalog.locator('.element-row').filter({ has: page.locator('.element-select strong', { hasText: name }) })
  const chair = row('Silla')
  const door = row('Puerta')
  const target = (await door.boundingBox())!
  await chair.dragTo(door, { sourcePosition: { x: 12, y: 12 }, targetPosition: { x: target.width / 2, y: 4 } })
  await expect.poll(async () => (await chair.boundingBox())!.y < (await door.boundingBox())!.y).toBe(true)
  await chair.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Mover abajo' }).click()
  await expect.poll(async () => (await chair.boundingBox())!.y > (await door.boundingBox())!.y).toBe(true)
  await catalog.getByRole('button', { name: 'Crear carpeta de elementos' }).click()
  for (const name of ['Silla', 'Puerta']) {
    await row(name).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Mover a', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Carpeta 1', exact: true }).click()
  }
  const box = (await door.boundingBox())!
  await chair.dragTo(door, { sourcePosition: { x: 12, y: 12 }, targetPosition: { x: box.width / 2, y: 4 } })
  await expect.poll(async () => (await chair.boundingBox())!.y < (await door.boundingBox())!.y).toBe(true)
})

test('intercala carpetas y objetos hermanos sin cambiar su pertenencia', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 2000 })
  await page.goto('/')
  const catalog = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await catalog.getByRole('button', { name: 'Crear carpeta de elementos' }).click()
  const parent = catalog.locator('.element-folder').filter({ has: page.getByRole('button', { name: 'Carpeta Carpeta 1', exact: true }) }).first()
  await parent.locator('.element-folder__heading').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Crear subcarpeta' }).click()
  await parent.locator('.element-folder__heading').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Crear subcarpeta' }).click()
  await catalog.getByRole('button', { name: 'Minimizar catálogo completo' }).click()
  const row = (name: string) => catalog.locator('.element-row').filter({ has: page.locator('.element-select strong', { hasText: name }) })
  for (const name of ['Silla', 'Puerta']) {
    await row(name).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Mover a', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Carpeta 1', exact: true }).click()
  }
  const child = (name: string) => parent.locator('.element-folder').filter({ has: page.getByRole('button', { name: `Carpeta ${name}`, exact: true }) })
  const first = child('Carpeta 2').locator('.element-folder__heading').first()
  const second = child('Carpeta 3').locator('.element-folder__heading').first()
  await row('Silla').dragTo(first, { sourcePosition: { x: 12, y: 12 }, targetPosition: { x: 30, y: 2 } })
  await expect.poll(async () => (await row('Silla').boundingBox())!.y < (await first.boundingBox())!.y).toBe(true)
  await second.dragTo(row('Puerta'), { targetPosition: { x: 40, y: 3 } })
  await expect.poll(async () => (await second.boundingBox())!.y < (await row('Puerta').boundingBox())!.y).toBe(true)
  await expect(parent.locator('.element-row').filter({ hasText: 'Silla' })).toHaveCount(1)
  await first.getByRole('button', { name: 'Carpeta Carpeta 2', exact: true }).click()
  await page.getByRole('button', { name: 'Subir carpeta' }).click()
  await expect.poll(async () => (await first.boundingBox())!.y < (await row('Silla').boundingBox())!.y).toBe(true)
})

test('abre el menú contextual de objetos y carpetas con ratón y teclado', async ({ page }) => {
  await page.goto('/')
  const catalog = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  const chair = catalog.locator('.element-row').filter({ hasText: 'Silla' })
  await expect(chair.locator('.element-actions button')).toHaveCount(2)
  await chair.click({ button: 'right' })
  const menu = page.getByRole('menu', { name: 'Acciones de Silla' })
  await expect(menu).toBeVisible()
  await page.screenshot({ path: '/tmp/room-builder-context-menu.png' })
  await expect(menu.getByRole('menuitem', { name: /Copiar/ })).toContainText('Ctrl / ⌘ C')
  await expect(menu.getByRole('menuitem', { name: /Duplicar/ })).toContainText('Ctrl / ⌘ D')
  await menu.getByRole('menuitem', { name: 'Renombrar' }).click()
  await expect(page.getByRole('textbox', { name: 'Nuevo nombre para Silla' })).toBeFocused()
  await page.keyboard.press('Escape')
  await chair.getByRole('button', { name: /Silla Asientos/ }).focus()
  await page.keyboard.press('Shift+F10')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await catalog.getByRole('button', { name: 'Crear carpeta de elementos' }).click()
  const folder = catalog.locator('.element-folder').filter({ has: page.getByRole('button', { name: 'Carpeta Carpeta 1', exact: true }) })
  await expect(folder.locator('.element-folder__actions button')).toHaveCount(2)
  await folder.locator('.element-folder__heading').first().click({ button: 'right' })
  const folderMenu = page.getByRole('menu', { name: 'Acciones de Carpeta 1' })
  await expect(folderMenu.getByRole('menuitem', { name: /Copiar/ })).toBeDisabled()
  await folderMenu.getByRole('menuitem', { name: 'Crear subcarpeta' }).click()
  await expect(folder.getByRole('button', { name: 'Carpeta Carpeta 2', exact: true })).toBeVisible()
})

test('abre acciones con pulsación táctil prolongada y permite duplicar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  const row = page.locator('.element-row').filter({ hasText: 'Silla' })
  await row.scrollIntoViewIfNeeded()
  const box = (await row.boundingBox())!
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 15, y: box.y + box.height / 2 }] })
  await page.waitForTimeout(700)
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const menu = page.getByRole('menu', { name: 'Acciones de Silla' })
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: /Duplicar/ }).click()
  await expect(page.locator('.element-row').filter({ hasText: 'Silla' })).toHaveCount(2)
})

test('cierra el menú contextual al pulsar fuera, incluso sobre la escena', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  const chair = page.locator('.element-row').filter({ hasText: 'Silla' })
  const menu = page.getByRole('menu', { name: 'Acciones de Silla' })
  await chair.click({ button: 'right' })
  await expect(menu).toBeVisible()
  const canvas = page.locator('.scene-panel canvas').first()
  const box = (await canvas.boundingBox())!
  await page.mouse.click(box.x + 15, box.y + 15)
  await expect(menu).toHaveCount(0)
  await chair.click({ button: 'right' })
  await expect(menu).toBeVisible()
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await expect(menu).toHaveCount(0)
})

test('los atajos del menú renombran, ordenan, crean y borran sin interferir al escribir', async ({ page }) => {
  await page.goto('/')
  const catalog = page.getByRole('complementary', { name: 'Catálogo de objetos' })
  await page.getByRole('button', { name: 'Mesa ＋ Añadir', exact: true }).click()
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  const chair = catalog.locator('.element-row').filter({ hasText: 'Silla' })
  await chair.click({ button: 'right' })
  const menu = page.getByRole('menu', { name: 'Acciones de Silla' })
  await expect(menu.getByRole('menuitem', { name: 'Renombrar', exact: true })).toHaveAttribute('aria-keyshortcuts', 'F2')
  await expect(menu.getByRole('menuitem', { name: 'Mover arriba', exact: true })).toContainText('Alt + Mayús + ↑')
  await page.keyboard.press('F2')
  const input = page.getByRole('textbox', { name: 'Nuevo nombre para Silla' })
  await expect(input).toBeFocused()
  await input.fill('Asiento')
  await page.keyboard.press('Delete')
  await expect(input).toHaveValue('Asiento')
  await expect(catalog.locator('.element-row.selected')).toHaveCount(1)
  await input.press('Enter')
  const renamed = catalog.locator('.element-row').filter({ hasText: 'Asiento' })
  await expect(renamed).toBeVisible()
  await page.keyboard.press('Alt+Shift+ArrowUp')
  await expect.poll(async () => {
    const names = await catalog.locator('.element-select').allTextContents()
    return names.findIndex((name) => name.includes('Asiento')) < names.findIndex((name) => name.includes('Mesa'))
  }).toBe(true)
  await catalog.getByRole('button', { name: 'Crear carpeta de elementos' }).click()
  await catalog.getByRole('button', { name: 'Carpeta Carpeta 1', exact: true }).click()
  await page.keyboard.press('Alt+Shift+n')
  await expect(catalog.getByRole('button', { name: 'Carpeta Carpeta 2', exact: true })).toBeVisible()
  await catalog.getByRole('button', { name: 'Carpeta Carpeta 2', exact: true }).click()
  await page.keyboard.press('Delete')
  await expect(catalog.getByRole('button', { name: 'Carpeta Carpeta 2', exact: true })).toHaveCount(0)
})
