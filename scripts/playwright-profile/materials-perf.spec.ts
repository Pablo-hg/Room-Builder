import { test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

/**
 * Rendimiento de los acabados (#39) con el mismo diseño con y sin materiales.
 * La diferencia entre ambas variantes aísla el coste de los materiales; la cifra absoluta depende de la GPU
 * (se registra el renderizador: SwiftShader/software falsea los fotogramas).
 */
const FIXTURE = new URL('../../tests/fixtures/materials/casa-muestrario-materiales.json', import.meta.url)
const REPETITIONS = 3
const MATERIAL_KEYS = new Set(['material', 'floorMaterial', 'wallMaterials'])

function stripMaterials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripMaterials)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !MATERIAL_KEYS.has(key)).map(([key, entry]) => [key, stripMaterials(entry)]))
  }
  return value
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
}
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0
}
const round = (value: number) => Math.round(value * 10) / 10

type Run = Record<string, number | string>

test('compara el diseño muestrario con y sin acabados', async ({ browser }) => {
  const file = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { design: { id: string; name: string; savedAt: string; data: unknown } }
  const variants = {
    con: file.design.data,
    sin: stripMaterials(file.design.data),
  } as const
  const runs: Array<{ variant: keyof typeof variants } & Run> = []
  let renderer = ''

  for (let repetition = 0; repetition < REPETITIONS; repetition++) {
    for (const variant of ['con', 'sin'] as const) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      await context.addInitScript(({ design }) => {
        localStorage.setItem('room-builder:v0.1:designs', JSON.stringify([design]))
        const w = window as unknown as Record<string, unknown>
        // Contadores de llamadas de dibujo y de renders (cada render limpia el búfer) en el contexto WebGL.
        const counters = { draws: 0, clears: 0 }
        w.__perf = counters
        for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
          for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
            const original = (proto as unknown as Record<string, (...args: unknown[]) => void>)[name]
            if (!original) continue
            ;(proto as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) { counters.draws++; return original.apply(this, args) }
          }
          const clear = (proto as unknown as Record<string, (...args: unknown[]) => void>).clear
          ;(proto as unknown as Record<string, unknown>).clear = function (this: unknown, ...args: unknown[]) { counters.clears++; return clear.apply(this, args) }
        }
        // Registro continuo de fotogramas.
        const frames: number[] = []
        w.__frames = frames
        const tick = (time: number) => { frames.push(time); requestAnimationFrame(tick) }
        requestAnimationFrame(tick)
      }, { design: { id: 'perf', name: 'Muestrario', savedAt: file.design.savedAt, data: variants[variant] } })

      const page = await context.newPage()
      const client = await context.newCDPSession(page)
      await client.send('Performance.enable')

      const started = Date.now()
      await page.goto('/')
      await page.waitForFunction(() => document.querySelectorAll('.room-name-label').length >= 6, undefined, { timeout: 60_000 })
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const loadMs = Date.now() - started
      await page.waitForTimeout(1500)

      if (!renderer) {
        renderer = await page.evaluate(() => {
          const gl = document.createElement('canvas').getContext('webgl2')
          const info = gl?.getExtension('WEBGL_debug_renderer_info')
          return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'desconocido'
        })
      }
      const heap = async () => ((await client.send('Performance.getMetrics')).metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? 0) / 1048576

      // Mide un tramo: fotogramas, renders y llamadas de dibujo entre dos marcas.
      const measure = async (action: () => Promise<void>) => {
        const before = await page.evaluate(() => {
          const w = window as unknown as { __frames: number[]; __perf: { draws: number; clears: number } }
          return { frames: w.__frames.length, draws: w.__perf.draws, clears: w.__perf.clears }
        })
        await action()
        return page.evaluate((from) => {
          const w = window as unknown as { __frames: number[]; __perf: { draws: number; clears: number } }
          const times = w.__frames.slice(from.frames)
          const deltas = times.slice(1).map((time, index) => time - times[index])
          return { deltas, seconds: (times[times.length - 1] - times[0]) / 1000, draws: w.__perf.draws - from.draws, clears: w.__perf.clears - from.clears }
        }, before)
      }

      const idle = await measure(() => page.waitForTimeout(2000))
      const canvas = await page.locator('canvas').first().boundingBox()
      const startX = (canvas?.x ?? 0) + 40, startY = (canvas?.y ?? 0) + 40
      const orbit = await measure(async () => {
        await page.mouse.move(startX, startY)
        await page.mouse.down()
        for (let step = 0; step < 120; step++) {
          await page.mouse.move(startX + step * 4, startY + Math.sin(step / 10) * 20)
          await page.waitForTimeout(16)
        }
        await page.mouse.up()
      })

      const viewSwitch: number[] = []
      for (const label of ['Plano', 'Isométrica', 'Libre', 'Isométrica']) {
        const ms = await page.evaluate(() => performance.now())
        await page.locator('.view-switcher').getByRole('button', { name: new RegExp(label) }).click()
        const done = await page.evaluate(() => new Promise<number>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now())))))
        viewSwitch.push(done - ms)
        await page.waitForTimeout(400)
      }

      const orbitFps = orbit.deltas.length / Math.max(orbit.seconds, 0.001)
      runs.push({
        variant,
        loadMs,
        heapMB: round(await heap()),
        idleFps: round(idle.deltas.length / Math.max(idle.seconds, 0.001)),
        idleRendersPerSec: round(idle.clears / 2),
        orbitFps: round(orbitFps),
        orbitMedianMs: round(median(orbit.deltas)),
        orbitP95Ms: round(percentile(orbit.deltas, 0.95)),
        orbitMaxMs: round(Math.max(...orbit.deltas, 0)),
        orbitFramesOver50ms: orbit.deltas.filter((delta) => delta > 50).length,
        drawCallsPerRender: round(orbit.draws / Math.max(orbit.clears, 1)),
        viewSwitchMedianMs: round(median(viewSwitch)),
        viewSwitchMaxMs: round(Math.max(...viewSwitch)),
      })
      await context.close()
    }
  }

  const summary = (variant: 'con' | 'sin') => {
    const rows = runs.filter((run) => run.variant === variant)
    const keys = Object.keys(rows[0]).filter((key) => key !== 'variant')
    return Object.fromEntries(keys.map((key) => {
      const values = rows.map((row) => Number(row[key]))
      return [key, { mediana: round(median(values)), min: round(Math.min(...values)), max: round(Math.max(...values)) }]
    }))
  }
  const result = { renderer, viewport: '1280x720', repeticiones: REPETITIONS, con: summary('con'), sin: summary('sin'), runs }
  mkdirSync('test-results', { recursive: true })
  writeFileSync('test-results/materials-perf.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ renderer, con: result.con, sin: result.sin }, null, 2))
})
