import { expect, test, type Page } from '@playwright/test'
import { expandAllCatalogCategories } from './helpers/catalog'

// #38 · Regla de medición y cotas guardables. Cada prueba mantiene pocos gestos reales de interfaz.

const stateOf = (page: Page) => page.evaluate(async () => {
  const path = '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ path)
  const state = useRoomStore.getState()
  return {
    view: state.view, undoCount: state.undoCount, selectedId: state.selectedId, measureToolActive: state.measureToolActive as boolean,
    measurements: state.measurements as Array<{ id: string; name?: string; hidden?: boolean; stale?: boolean; start: { x: number; z: number; anchor?: unknown }; end: { x: number; z: number; anchor?: unknown } }>,
    draft: state.measureDraft as { start: { x: number; z: number }; end: { x: number; z: number } | null } | null,
    planDetailsVisible: state.planDetailsVisible as boolean, topCameraX: state.topCameraX as number, cameraZoom: state.cameraZoom as number,
    unsaved: state.hasUnsavedChanges as boolean,
  }
})

const call = (page: Page, action: string, ...args: unknown[]) => page.evaluate(async ({ action, args }) => {
  const path = '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ path)
  return useRoomStore.getState()[action](...args)
}, { action, args })

async function openPlan(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
}

/** Las cotas se crean con «Medir»; para preparar el estado de una prueba se da de alta directamente. */
async function addMeasure(page: Page, name: string, a: [string, string], b: [string, string]) {
  const n = (value: string) => Number(value.replace(',', '.'))
  await call(page, 'addMeasure', { x: n(a[0]), z: n(a[1]) }, { x: n(b[0]), z: n(b[1]) }, name)
}

/** Editor de la cota en edición: está en el panel de edición de la selección, no en la lista. */
const measureEditor = (page: Page) => page.getByRole('region', { name: 'Cota en edición' })

test('medir en Plano: dos clics dan la distancia real y la herramienta no cambia vista, cámara ni selección', { tag: '@smoke' }, async ({ page }) => {
  await openPlan(page)
  const before = await stateOf(page)
  await page.getByRole('button', { name: 'Medir', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Herramienta Medir' })).toBeVisible()
  await expect(page.getByTestId('measure-reading')).toHaveText('Marca el primer punto en el plano.')
  const bounds = await page.locator('.scene-panel canvas').first().boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas')
  const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2
  await page.mouse.click(cx - 120, cy + 60)
  await expect(page.getByTestId('measure-reading')).toHaveText('Marca el segundo punto.')
  await page.mouse.click(cx + 100, cy + 60)
  const after = await stateOf(page)
  expect(after.draft?.end).not.toBeNull()
  // Misma línea horizontal: la distancia es la diferencia en X y se muestra con dos decimales.
  const length = Math.abs(after.draft!.end!.x - after.draft!.start.x)
  expect(length).toBeGreaterThan(0.5)
  await expect(page.getByTestId('measure-reading')).toHaveText(`Distancia: ${length.toFixed(2).replace('.', ',')} m`)
  expect(after.view).toBe(before.view)
  expect(after.undoCount).toBe(before.undoCount)
  expect(after.selectedId).toBe(before.selectedId)
  expect(after.topCameraX).toBe(before.topCameraX)
  expect(after.cameraZoom).toBe(before.cameraZoom)
  expect(after.measurements).toHaveLength(0)
})

test('Escape descarta la medida en curso, sale de la herramienta y salir de Plano la desactiva', async ({ page }) => {
  await openPlan(page)
  await page.getByRole('button', { name: 'Medir', exact: true }).click()
  const bounds = await page.locator('.scene-panel canvas').first().boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas')
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  expect((await stateOf(page)).draft).not.toBeNull()
  await page.keyboard.press('Escape')
  expect((await stateOf(page)).draft).toBeNull()
  expect((await stateOf(page)).measureToolActive).toBe(true)
  await page.keyboard.press('Escape')
  expect((await stateOf(page)).measureToolActive).toBe(false)
  await page.getByRole('button', { name: 'Medir', exact: true }).click()
  await page.getByRole('button', { name: 'Isométrica', exact: true }).click()
  expect((await stateOf(page)).measureToolActive).toBe(false)
})

test('alta por coordenadas: la diagonal 4 × 3 mide 5 m', async ({ page }) => {
  await openPlan(page)
  await addMeasure(page, 'Diagonal', ['0', '0'], ['4', '3'])
  await expect(page.getByTestId('measure-row')).toHaveCount(1)
  await expect(page.getByTestId('measure-row').first()).toContainText('Diagonal · 5,00 m (4,00 m × 3,00 m)')
})

test('dos cotas guardadas: editar, ocultar, eliminar y deshacer', { tag: '@smoke' }, async ({ page }) => {
  await openPlan(page)
  await call(page, 'addMeasure', { x: 0, z: 0 }, { x: 4, z: 3 }, 'Diagonal')
  await call(page, 'addMeasure', { x: 1, z: 1 }, { x: 1, z: 3.5 }, 'Pasillo')
  const rows = page.getByTestId('measure-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Diagonal · 5,00 m (4,00 m × 3,00 m)')
  await expect(rows.nth(1)).toContainText('Pasillo · 2,50 m')
  await rows.nth(1).getByRole('button', { name: 'Editar Pasillo' }).click()
  // Ajuste fino con teclado: Mayús + clic mueve el punto B 10 cm hacia +Z (2,50 → 2,60 m).
  await measureEditor(page).getByRole('button', { name: /Mover el punto B 1 cm hacia \+Z/ }).click({ modifiers: ['Shift'] })
  await expect(rows.nth(1)).toContainText('2,60 m')
  await measureEditor(page).getByRole('button', { name: 'Cerrar la edición de Pasillo' }).click()
  await rows.nth(1).getByRole('button', { name: 'Ocultar Pasillo' }).click()
  await expect(rows.nth(1)).toContainText('Oculta')
  expect((await stateOf(page)).measurements[1].hidden).toBe(true)
  await rows.nth(0).getByRole('button', { name: 'Eliminar Diagonal' }).click()
  await expect(rows).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(rows).toHaveCount(2)
})

test('las cotas sobreviven a guardar, recargar y al JSON; el formato se valida al importar', async ({ page }) => {
  await openPlan(page)
  await addMeasure(page, 'Diagonal', ['0', '0'], ['4', '3'])
  await addMeasure(page, 'Lado', ['0', '0'], ['0', '2'])
  await call(page, 'updateMeasure', (await stateOf(page)).measurements[1].id, { hidden: true })
  await call(page, 'saveDesign')
  const json = await page.evaluate(async () => {
    const a = '/src/persistence/designFile.ts', b = '/src/domain/designV1.ts', c = '/src/state/useRoomStore.ts'
    const { serializeDesignFile } = await import(/* @vite-ignore */ a)
    const { persistedDesign } = await import(/* @vite-ignore */ b)
    const { useRoomStore } = await import(/* @vite-ignore */ c)
    const state = useRoomStore.getState()
    return serializeDesignFile({ id: 'e2e', name: 'E2E', savedAt: new Date().toISOString(), data: persistedDesign(state) })
  })
  const parsed = JSON.parse(json)
  expect(parsed.design.data.version).toBe(13)
  expect(parsed.design.data.measurements).toHaveLength(2)
  await page.reload()
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  const reloaded = await stateOf(page)
  expect(reloaded.measurements.map((item) => item.name)).toEqual(['Diagonal', 'Lado'])
  expect(reloaded.measurements[1].hidden).toBe(true)
  await expect(page.getByTestId('measure-row')).toHaveCount(2)
  parsed.design.data.measurements[0].end = { x: 'cuatro', z: 3 }
  const rejected = await page.evaluate(async (text) => {
    const path = '/src/persistence/designFile.ts'
    const { parseDesignFile } = await import(/* @vite-ignore */ path)
    try { parseDesignFile(text); return '' } catch (error) { return (error as Error).message }
  }, JSON.stringify(parsed))
  expect(rejected).toMatch(/extremos no válidos|cotas/)
})

test('al mover o borrar el referente la cota se actualiza o avisa, nunca miente', async ({ page }) => {
  await openPlan(page)
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  const chair = await page.evaluate(async () => {
    const path = '/src/state/useRoomStore.ts'
    const { useRoomStore } = await import(/* @vite-ignore */ path)
    const state = useRoomStore.getState()
    const item = state.furniture.find((candidate: { id: string }) => candidate.id === state.selectedId)
    state.addMeasure({ x: item.x, z: item.z, anchor: { kind: 'furniture', id: item.id, point: 'center' } }, { x: item.x + 3, z: item.z })
    return { id: item.id, x: item.x, z: item.z }
  })
  const row = page.getByTestId('measure-row').first()
  await expect(row).toContainText('3,00 m')
  await expect(row).toContainText('sigue a su referente')
  // Editar solo el nombre no desancla la cota: el panel de edición avisa de qué sigue cada punto.
  await row.getByRole('button', { name: /^Editar/ }).click()
  await expect(measureEditor(page)).toContainText('Punto A · sigue a el centro de «Sillón»')
  await expect(measureEditor(page)).toContainText('Punto B')
  await expect(measureEditor(page)).not.toContainText('Punto B · sigue a')
  await measureEditor(page).getByLabel('Nombre (opcional)').fill('Al borde')
  await measureEditor(page).getByLabel('Nombre (opcional)').press('Enter')
  await measureEditor(page).getByRole('button', { name: /^Cerrar la edición/ }).click()
  await expect(row).toContainText('Al borde')
  await expect(row).toContainText('sigue a su referente')
  await call(page, 'moveFurniture', chair.id, chair.x + 1, chair.z)
  await expect(row).toContainText('2,00 m')
  await call(page, 'selectElement', chair.id)
  await call(page, 'removeFurniture')
  await expect(row.getByRole('alert')).toContainText('Un referente desapareció')
  await expect(row).toContainText('2,00 m')
  await row.getByRole('button', { name: 'Aceptar' }).click()
  await expect(row.getByRole('alert')).toHaveCount(0)
})

// ── Mover los puntos de una cota guardada directamente en el plano ─────────────────────────────

/** Calibra la correspondencia pantalla ↔ mundo con la propia herramienta Medir (sin imán). */
async function calibrate(page: Page) {
  await call(page, 'setMeasureSnap', false)
  await call(page, 'setMeasureToolActive', true)
  const bounds = await page.locator('.scene-panel canvas').first().boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas')
  const c = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  await page.mouse.click(c.x, c.y)
  await page.mouse.click(c.x + 100, c.y + 60)
  const { draft } = await stateOf(page)
  await call(page, 'setMeasureToolActive', false)
  const w0 = draft!.start, w1 = draft!.end!
  const kx = 100 / (w1.x - w0.x), kz = 60 / (w1.z - w0.z)
  return { screenOf: (x: number, z: number) => ({ x: c.x + (x - w0.x) * kx, y: c.y + (z - w0.z) * kz }), worldOf: (sx: number, sy: number) => ({ x: w0.x + (sx - c.x) / kx, z: w0.z + (sy - c.y) / kz }) }
}

test('arrastrar un punto de una cota guardada la mueve en un solo paso de historial; Esc cancela', { tag: '@smoke' }, async ({ page }) => {
  await openPlan(page)
  const map = await calibrate(page)
  await call(page, 'addMeasure', { x: -1, z: 1 }, { x: 1, z: 1 }, 'Pasillo')
  const added = await stateOf(page)
  const row = page.getByTestId('measure-row').first()
  await row.getByRole('button', { name: 'Editar Pasillo' }).click()
  await expect(measureEditor(page)).toContainText('Arrastra los puntos')
  const a = map.screenOf(-1, 1)
  const target = { x: a.x - 40, y: a.y + 50 }
  // Esc a mitad de arrastre descarta el cambio.
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 5 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect((await stateOf(page)).measurements[0].start).toEqual({ x: -1, z: 1 })
  expect((await stateOf(page)).undoCount).toBe(added.undoCount)
  // Arrastre completo: A se mueve; B no.
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 5 })
  await page.mouse.up()
  const moved = await stateOf(page)
  const expected = map.worldOf(target.x, target.y)
  expect(moved.measurements[0].start.x).toBeCloseTo(expected.x, 1)
  expect(moved.measurements[0].start.z).toBeCloseTo(expected.z, 1)
  expect(moved.measurements[0].end).toEqual({ x: 1, z: 1 })
  expect(moved.undoCount).toBe(added.undoCount + 1)
  await page.keyboard.press('Control+z')
  expect((await stateOf(page)).measurements[0].start).toEqual({ x: -1, z: 1 })
})

test('un punto arrastrado sobre una esquina de mueble se ancla y sigue al mueble', async ({ page }) => {
  await openPlan(page)
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
  const chair = await page.evaluate(async () => {
    const path = '/src/state/useRoomStore.ts'
    const { useRoomStore } = await import(/* @vite-ignore */ path)
    const state = useRoomStore.getState()
    const item = state.furniture.find((candidate: { id: string }) => candidate.id === state.selectedId)
    state.selectElement(null)
    return { id: item.id, x: item.x, z: item.z, width: item.width, depth: item.depth }
  })
  const map = await calibrate(page)
  await call(page, 'setMeasureSnap', true)
  const corner = { x: chair.x + chair.width / 2, z: chair.z + chair.depth / 2 }
  // Lejos del mueble y dentro de la habitación, a la vista y sin controles encima.
  const far = { x: corner.x - 2.2, z: corner.z - 1.8 }
  await call(page, 'addMeasure', far, { x: far.x, z: far.z + 1 })
  const row = page.getByTestId('measure-row').first()
  await row.getByRole('button', { name: 'Editar Cota 1' }).click()
  const from = map.screenOf(far.x, far.z), near = map.screenOf(corner.x, corner.z)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(near.x + 4, near.y + 3, { steps: 6 })
  await page.mouse.up()
  const anchored = (await stateOf(page)).measurements[0]
  expect(anchored.start.anchor).toMatchObject({ kind: 'furniture', id: chair.id })
  await expect(measureEditor(page)).toContainText('Punto A · sigue a')
  await call(page, 'moveFurniture', chair.id, chair.x + 1, chair.z)
  const followed = (await stateOf(page)).measurements[0]
  expect(followed.start.x).toBeCloseTo(corner.x + 1, 2)
})
