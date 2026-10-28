import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

test('mide renders con el mismo fixture y diez actualizaciones por recorrido', async ({ page, context }) => {
  const fixture = JSON.parse(readFileSync(new URL('../../tests/fixtures/persistence-v1/valid-complete.json', import.meta.url), 'utf8'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript((data) => {
    localStorage.setItem('room-builder:v0.1:designs', JSON.stringify([{ id: 'profile', name: 'Medición', savedAt: '2026-10-28', data }]))
  }, fixture)
  await page.goto('/')
  await page.getByRole('button', { name: 'Seleccionar diseño guardado' }).click()
  await page.getByRole('button', { name: 'Medición', exact: true }).click()
  await page.evaluate(async () => {
    // Import the same Vite module used by the app; this fixture bypasses pointer hit testing.
    const { useRoomStore } = await import('/src/state/useRoomStore.ts')
    useRoomStore.getState().selectElement('fixture-plant')
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
  })
  const client = await context.newCDPSession(page)
  await client.send('Profiler.enable')
  await client.send('Profiler.startPreciseCoverage', { callCount: true, detailed: false })
  const measurements: Record<string, Record<string, number>> = {}
  for (const scenario of ['camera', 'furnitureMove'] as const) {
    await client.send('Profiler.takePreciseCoverage')
    await page.evaluate(async (scenario) => {
      const { useRoomStore } = await import('/src/state/useRoomStore.ts')
      if (scenario === 'furnitureMove') useRoomStore.getState().beginFurnitureMove()
      for (let step = 0; step < 10; step++) {
        if (scenario === 'camera') useRoomStore.getState().setIsoAngle(Math.PI / 4 + (step + 1) * 0.01)
        else useRoomStore.getState().moveFurniture('fixture-plant', 1 + step * 0.125, 1.75)
        await new Promise(requestAnimationFrame)
        await new Promise(requestAnimationFrame)
      }
      if (scenario === 'furnitureMove') useRoomStore.getState().endFurnitureMove()
    }, scenario)
    const coverage = await client.send('Profiler.takePreciseCoverage')
    const counts: Record<string, number> = { App: 0, EditorScene: 0, EditorHeader: 0, SettingsPanel: 0, ObjectsPanel: 0 }
    for (const script of coverage.result) {
      if (!script.url.includes('/src/')) continue
      for (const entry of script.functions) {
        if (Object.hasOwn(counts, entry.functionName)) counts[entry.functionName] += entry.ranges[0]?.count ?? 0
      }
    }
    measurements[scenario] = counts
  }
  await client.send('Profiler.stopPreciseCoverage')
  await client.detach()
  expect(measurements.furnitureMove.ObjectsPanel).toBeGreaterThan(0)
  const result = { fixture: 'valid-complete.json', updatesPerScenario: 10, mode: 'Vite development + React StrictMode', method: 'CDP precise function call coverage', measurements }
  writeFileSync('/tmp/room-r3-render-profile.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
})
