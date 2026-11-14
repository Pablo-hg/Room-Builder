import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { expandAllCatalogCategories } from './helpers/catalog'

test('development receiver validates envelopes and acknowledges retries with the same identity', async ({ request }) => {
  const endpoint = '/__room-builder/interaction-log'
  expect((await request.get(endpoint)).status()).toBe(405)
  expect((await request.post(endpoint, { data: [{ schemaVersion: 99 }] })).status()).toBe(400)
  const sessionId = `s-test-${Date.now()}`
  const event = { schemaVersion: 1, sessionId, eventId: `${sessionId}:1`, seq: 1, timestamp: new Date().toISOString(), category: 'system', level: 'info', action: 'test.receiver', phase: 'observed', objectIds: [], data: {} }
  for (let index = 0; index < 2; index++) {
    const response = await request.post(endpoint, { data: [event] })
    expect(response.status()).toBe(200)
    expect((await response.json()).eventIds).toEqual([event.eventId])
  }
})

test('browser diagnostics persist offline and export without developer controls or sharing', async ({ page, context }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  await expect(page.getByRole('button', { name: 'Diagnósticos · desarrollo' })).toHaveCount(0)
  await page.evaluate(async () => {
    const runtimePath = '/src/diagnostics/runtime.ts'
    const enginePath = '/src/diagnostics/engine.ts'
    const runtime = await import(/* @vite-ignore */ runtimePath)
    const { diagnostics } = await import(/* @vite-ignore */ enginePath)
    diagnostics.emit({ action: 'test.offline', result: 'completed', data: { reason: 'test' } })
    await runtime.flushDiagnostics()
  })
  await context.setOffline(true)
  await page.evaluate(async () => {
    const runtimePath = '/src/diagnostics/runtime.ts'
    const enginePath = '/src/diagnostics/engine.ts'
    const runtime = await import(/* @vite-ignore */ runtimePath)
    const { diagnostics } = await import(/* @vite-ignore */ enginePath)
    diagnostics.emit({ action: 'test.offline-stored', result: 'completed' })
    await runtime.flushDiagnostics()
    if (!(await runtime.readDiagnostics()).some((event: { action: string }) => event.action === 'test.offline-stored')) throw new Error('offline event missing')
  })
  await expect(page.getByText('Ayuda', { exact: true })).toHaveCount(0)
  const settings = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
  await settings.getByRole('button', { name: 'Atajos de teclado', exact: true }).click()
  await expect(settings.getByRole('button', { name: 'Exportar diagnóstico', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Compartir diagnóstico', exact: true })).toHaveCount(0)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar diagnóstico', exact: true }).click()
  const file = await download
  const path = await file.path()
  expect(path).toBeTruthy()
  const source = await readFile(path!, 'utf8')
  const report = JSON.parse(source)
  expect(report.format).toBe('room-builder-diagnostics')
  expect(report.events.some((event: { action: string }) => event.action === 'test.offline-stored')).toBe(true)
  await context.setOffline(false)
})

test('IndexedDB retention, duplicate IDs and recovery use real browser transactions', async ({ page }) => {
  await page.goto('/')
  await expandAllCatalogCategories(page)
  const result = await page.evaluate(async () => {
    const repositoryPath = '/src/diagnostics/indexedDb.ts', enginePath = '/src/diagnostics/engine.ts'
    const { DiagnosticRepository } = await import(/* @vite-ignore */ repositoryPath)
    const { DiagnosticEngine } = await import(/* @vite-ignore */ enginePath)
    let fail = true
    const factory = { open: (...args: [string, number]) => { if (fail) throw new DOMException('denied', 'SecurityError'); return indexedDB.open(...args) } }
    const repository = new DiagnosticRepository(factory, { days: 7, maxBytes: 65536 }, `test-diagnostics-${Date.now()}`)
    const engine = new DiagnosticEngine()
    const old = { ...engine.emit({ action: 'old' }), timestamp: '2000-01-01T00:00:00.000Z' }
    const warning = engine.emit({ action: 'important', level: 'error' })
    let denied = false
    try { await repository.append([warning]) } catch { denied = true }
    fail = false
    await repository.append([old, warning, warning])
    // Misma carga de 400 eventos en ocho transacciones, no en 400.
    for (let index = 0; index < 8; index++) {
      await repository.append(Array.from({ length: 50 }, () => engine.emit({ action: 'detail', level: 'debug' })))
    }
    const events = await repository.read()
    return { denied, old: events.some((event: { action: string }) => event.action === 'old'), important: events.filter((event: { action: string }) => event.action === 'important').length, count: events.length }
  })
  expect(result.old).toBe(false)
  expect(result.denied).toBe(true)
  expect(result.important).toBe(1)
  expect(result.count).toBeLessThan(401)
})
