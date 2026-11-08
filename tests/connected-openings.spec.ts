import { expect, test } from '@playwright/test'
import { cloneRoom } from '../src/state/defaults'
import { createStructureSurface } from '../src/domain/structureRules'
import { anchorWallOpenings } from '../src/domain/wallConnections'
import { initialRoomFolder } from '../src/domain/elementFolders'
import type { StructurePack } from '../src/domain/types'

for (const width of [375, 1280]) for (const kind of ['window', 'door'] as const) {
  test(`apertura compartida única, recorrido, vistas y recarga: ${kind}, ${width}px`, async ({ page }) => {
    test.setTimeout(90_000) // Cinco vistas, deshacer/rehacer y recarga en navegador real.
    const room = { ...cloneRoom(), windows: [] }
    const pack = (id: string, name: string, length: number): StructurePack => ({ id, name, x: 0, y: 0, z: 0,
      surfaces: [{ ...createStructureSurface(room, 'wall-north'), width: length, height: 3,
        y: (3 - room.height) / 2, z: -1 + room.depth / 2 }] })
    const small = pack('wall-object-short', 'Tramo corto', 3), large = pack('wall-object-long', 'Tramo largo', 8)
    const name = kind === 'window' ? 'Ventana de prueba' : 'Paso de prueba'
    if (kind === 'window') small.windows = [{ id: 'connected', name, shape: 'circular', wall: 'north', offset: 0, width: 1, height: 1, sill: 1, rotation: 0, color: '#c88f58' }]
    else small.doors = [{ id: 'connected', name, wall: 'north', offset: 0, width: 1, height: 2.1, rotation: 0, color: '#ac704b' }]
    const folders = initialRoomFolder(room)
    const saved = { id: 'connected-test', name: 'Paredes conectadas', savedAt: '2026-11-08T12:00:00Z', data: {
      version: 10, ...anchorWallOpenings({ room, structurePacks: [small, large] }), furniture: [], gridSnap: true,
      ...folders, elementFolderAssignments: { ...folders.elementFolderAssignments, [small.id]: 'room-root', [large.id]: 'room-root', connected: 'room-root' },
    } }
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript((saved) => {
      if (!localStorage.getItem('room-builder:v0.1:designs')) localStorage.setItem('room-builder:v0.1:designs', JSON.stringify([saved]))
    }, saved)
    await page.goto('/')
    const load = async () => {
      await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
      await page.getByRole('button', { name: 'Paredes conectadas', exact: true }).click()
    }
    await load()
    // La fila mural describe también la pared; la puerta mantiene la categoría exacta.
    const entry = page.getByRole('button', { name: kind === 'window' ? new RegExp(`^${name} Apertura`) : `${name} Apertura`, exact: kind === 'door' })
    await expect(entry).toHaveCount(1)
    await entry.click()
    const inspector = page.locator('.selection-section--inspector')
    const x = inspector.getByRole('textbox', { name: 'Introducir X en metros', exact: true })
    await x.fill('3')
    await x.press('Enter')
    await expect(x).toHaveValue('3.00')
    await expect(page.locator('.scene-collision-panel')).not.toContainText(/sin soporte|no tiene soporte/)
    if (kind === 'door') await expect(inspector.getByRole('textbox', { name: 'Introducir Y en metros', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Deshacer el último cambio' }).click()
    // Deshacer/rehacer limpian la selección por diseño: reseleccionamos la apertura.
    await entry.click()
    await expect(x).toHaveValue('0.00')
    await page.getByRole('button', { name: 'Rehacer el último cambio deshecho' }).click()
    await entry.click()
    await expect(x).toHaveValue('3.00')
    await x.fill('1.5')
    await x.press('Enter')
    for (const view of ['Plano', 'Isométrica', 'Frontal', 'POV', 'Libre']) {
      await page.getByRole('button', { name: view, exact: true }).click()
      await expect(entry).toHaveCount(1)
      // Playwright ya captura automáticamente la escena al fallar; cinco
      // capturas por variante añadían esperas de canvas sin aserción funcional.
    }
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await page.reload()
    await load()
    await entry.click()
    await expect(x).toHaveValue('1.50')
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('room-builder:v0.1:designs')!)[0].data)
    expect(stored.version).toBe(10)
    const objects = [...stored.room.windows, ...(stored.room.extraDoors ?? []), ...stored.structurePacks.flatMap((pack: { windows?: unknown[]; doors?: unknown[] }) => [...(pack.windows ?? []), ...(pack.doors ?? [])])]
    expect(objects.filter((object: { id: string }) => object.id === 'connected')).toHaveLength(1)
  })
}
