import { expect, test, type Page } from '@playwright/test'
import { expandAllCatalogCategories } from './helpers/catalog'

// #37 · Guías y magnetismo. Se calibra la escala del arrastre en el propio navegador (metros por
// gesto) para no depender del tamaño de la ventana: el resultado esperado se deduce de esa medida.

// Cada prueba hace dos arrastres (calibrado + medida): en equipos lentos se acerca al límite de 30 s.
test.setTimeout(60_000)

const readState = (page: Page, id?: string) => page.evaluate(async (id) => {
  const path = '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ path)
  const state = useRoomStore.getState()
  const moving = state.furniture.find((item: { id: string }) => item.id === (id ?? state.selectedId))
  return { id: moving?.id as string, x: moving?.x as number, z: moving?.z as number, guides: state.activeGuides.length as number, undoCount: state.undoCount as number,
    magnetism: state.magnetismEnabled as boolean, gridSnap: state.gridSnap as boolean, unsaved: state.hasUnsavedChanges as boolean }
}, id)

/** Silla seleccionada en el centro de la escena, en Plano. */
async function addChair(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await page.getByRole('button', { name: /Sillón.*Añadir/ }).click()
}

const edit = (page: Page, patch: { moving?: Record<string, number>; fixed?: Record<string, number> | null }) => page.evaluate(async ({ patch }) => {
  const path = '/src/state/useRoomStore.ts'
  const { useRoomStore } = await import(/* @vite-ignore */ path)
  const state = useRoomStore.getState()
  const moving = state.furniture.find((item: { id: string }) => item.id === state.selectedId)
  const others = state.furniture.filter((item: { id: string }) => item.id !== moving.id && item.id !== 'fixed-chair')
  const fixed = patch.fixed ? { ...moving, id: 'fixed-chair', name: 'Fija', width: 0.4, depth: 0.4, ...patch.fixed } : null
  useRoomStore.setState({ furniture: [...others, { ...moving, width: 0.4, depth: 0.4, ...patch.moving }, ...(fixed ? [fixed] : [])] })
}, { patch })

async function drag(page: Page, options: { hold?: () => Promise<void>; release?: () => Promise<void>; sample?: () => Promise<void> } = {}) {
  const bounds = await page.locator('.scene-panel canvas').first().boundingBox()
  if (!bounds) throw new Error('No se pudo localizar el canvas')
  // El centro exacto contiene el eje Y del gizmo visto de punta: se agarra el cuerpo con un pequeño desplazamiento.
  const x = bounds.x + bounds.width / 2 + 12, y = bounds.y + bounds.height / 2 + 12
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(80)
  await options.hold?.()
  await page.mouse.move(x + 200, y, { steps: 6 })
  await options.sample?.()
  await page.mouse.up()
  await options.release?.()
}

/** Metros que recorre el centro de la silla con ese gesto, sin ninguna ayuda activa. */
async function calibrate(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/state/useRoomStore.ts'
    const { useRoomStore } = await import(/* @vite-ignore */ path)
    useRoomStore.getState().setMagnetism(false)
    useRoomStore.getState().setGuides(false)
  })
  await edit(page, { moving: { x: 0, z: 0 }, fixed: null })
  await drag(page)
  const { x } = await readState(page)
  expect(x).toBeGreaterThan(0.5)
  await edit(page, { moving: { x: 0, z: 0 }, fixed: null })
  await page.evaluate(async () => {
    const path = '/src/state/useRoomStore.ts'
    const { useRoomStore } = await import(/* @vite-ignore */ path)
    useRoomStore.getState().setMagnetism(true)
    useRoomStore.getState().setGuides(true)
  })
  return x
}

test('alinear dos muebles en Plano: el borde se atrae, hay guía y desaparece al soltar', { tag: '@smoke' }, async ({ page }) => {
  await addChair(page)
  const reach = await calibrate(page)
  // La silla fija queda 3 cm más allá del punto de llegada del gesto, en otra fila.
  await edit(page, { fixed: { x: reach + 0.43, z: 1.2 } })
  let during = 0
  await drag(page, { sample: async () => { during = (await readState(page)).guides } })
  expect(during).toBeGreaterThan(0)
  const after = await readState(page)
  expect(after.x).toBeCloseTo(reach + 0.03, 2) // borde derecho contra borde izquierdo de la silla fija
  expect(after.guides).toBe(0)
})

test('Alt suspende el magnetismo mientras se pulsa y no deja salto al soltar', async ({ page }) => {
  await addChair(page)
  const reach = await calibrate(page)
  await edit(page, { fixed: { x: reach + 0.43, z: 1.2 } })
  await drag(page, { hold: () => page.keyboard.down('Alt'), release: () => page.keyboard.up('Alt') })
  const after = await readState(page)
  expect(after.x).toBeCloseTo(reach, 2)
  expect(after.guides).toBe(0)
})

test('guías sin magnetismo no cambian el destino; el indicador refleja el estado', async ({ page }) => {
  await addChair(page)
  const reach = await calibrate(page)
  await page.getByRole('switch', { name: 'Magnetismo', exact: true }).click()
  await expect(page.getByTestId('movement-status')).toContainText('Magnetismo: no')
  expect((await readState(page)).magnetism).toBe(false)
  await edit(page, { fixed: { x: reach + 0.43, z: 1.2 } })
  await drag(page)
  expect((await readState(page)).x).toBeCloseTo(reach, 2)
})

test('un gesto con guías es un solo paso de historial y se deshace entero', async ({ page }) => {
  await addChair(page)
  const reach = await calibrate(page)
  await edit(page, { moving: { x: 0, z: 0 }, fixed: { x: reach + 0.43, z: 1.2 } })
  const before = await readState(page)
  await drag(page)
  const after = await readState(page)
  expect(after.undoCount).toBe(before.undoCount + 1)
  await page.keyboard.press('Control+z')
  expect((await readState(page, before.id)).x).toBeCloseTo(0, 2)
})

test('el ajuste a 5 cm es independiente y no cuenta como cambio nuevo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('movement-status')).toContainText('movimiento: 5 cm')
  await expect(page.getByText('Cambios sin guardar')).toHaveCount(0)
  await page.getByRole('switch', { name: 'Ajuste a 5 cm', exact: true }).click()
  await expect(page.getByTestId('movement-status')).toContainText('movimiento: 1 cm')
  await expect(page.getByTestId('movement-status')).toContainText('Magnetismo: sí')
  await expect(page.getByText('Cambios sin guardar')).toHaveCount(0)
  await page.getByRole('switch', { name: 'Ajuste a 5 cm', exact: true }).click()
  await expect(page.getByTestId('movement-status')).toContainText('movimiento: 5 cm')
})

test('la medida de la habitación se muestra como anchura x fondo = superficie', async ({ page }) => {
  await page.goto('/')
  // La superficie solo se muestra en Plano.
  await expect(page.getByTestId('room-size')).toHaveCount(0)
  await page.getByRole('button', { name: 'Plano', exact: true }).click()
  await expect(page.getByTestId('room-size')).toHaveText(/5\.5 x 4\.5 = 24\.75 m²/)
})
