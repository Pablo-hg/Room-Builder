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

async function addByCoordinates(page: Page, name: string, a: [string, string], b: [string, string]) {
  const section = page.locator('.measure-section')
  if (!(await section.locator('details.measure-add').evaluate((element) => (element as HTMLDetailsElement).open))) await section.getByText('Añadir por coordenadas').click()
  await section.getByLabel('Nombre (opcional)').fill(name)
  const fields = section.locator('.measure-add input[id^="add-measure-"]')
  await section.locator('#add-measure-x1').fill(a[0]); await section.locator('#add-measure-z1').fill(a[1])
  await section.locator('#add-measure-x2').fill(b[0]); await section.locator('#add-measure-z2').fill(b[1])
  void fields
  await section.getByRole('button', { name: 'Guardar cota', exact: true }).click()
}

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

test('guardar dos cotas por coordenadas: diagonal 4 × 3 = 5 m; editar, ocultar y eliminar', { tag: '@smoke' }, async ({ page }) => {
  await openPlan(page)
  await addByCoordinates(page, 'Diagonal', ['0', '0'], ['4', '3'])
  await addByCoordinates(page, 'Pasillo', ['1', '1'], ['1', '3,5'])
  const rows = page.getByTestId('measure-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Diagonal · 5,00 m (4,00 m × 3,00 m)')
  await expect(rows.nth(1)).toContainText('Pasillo · 2,50 m')
  await rows.nth(1).getByRole('button', { name: 'Editar Pasillo' }).click()
  await rows.nth(1).locator('input[id$="-z2"]').fill('4')
  await rows.nth(1).getByRole('button', { name: 'Aplicar cambios' }).click()
  await expect(rows.nth(1)).toContainText('3,00 m')
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
  await addByCoordinates(page, 'Diagonal', ['0', '0'], ['4', '3'])
  await addByCoordinates(page, 'Lado', ['0', '0'], ['0', '2'])
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
  await call(page, 'moveFurniture', chair.id, chair.x + 1, chair.z)
  await expect(row).toContainText('2,00 m')
  await call(page, 'selectElement', chair.id)
  await call(page, 'removeFurniture')
  await expect(row.getByRole('alert')).toContainText('Un referente desapareció')
  await expect(row).toContainText('2,00 m')
  await row.getByRole('button', { name: 'Aceptar' }).click()
  await expect(row.getByRole('alert')).toHaveCount(0)
})
