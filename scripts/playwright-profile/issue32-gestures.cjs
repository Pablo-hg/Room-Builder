// #32: mide órbita y arrastre con 1/15/50 sillas, sin limitar y con CPU ×4.
// Uso: build + `npx vite preview --port 4318`, y `node scripts/playwright-profile/issue32-gestures.cjs <etiqueta> [url]`.
// Usa un navegador aislado y un diseño desechable; nunca toca datos personales.
const { createRequire } = require('module')
const req = createRequire(require('path').join(__dirname, '../../package.json'))
const { chromium } = req('@playwright/test')

const label = process.argv[2] ?? 'run'
const url = process.argv[3] ?? 'http://localhost:4318/'
const COUNTS = [1, 15, 50]
const THROTTLES = [1, 4]
const REPS = 3

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null }

async function frameProbeStart(page) {
  await page.evaluate(() => {
    window.__perf = { active: true, frames: [], last: 0 }
    const tick = (t) => { const p = window.__perf; if (!p.active) return; if (p.last) p.frames.push(t - p.last); p.last = t; requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
}
async function frameProbeStop(page) {
  return page.evaluate(() => { const p = window.__perf; p.active = false; return p.frames })
}
async function metrics(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]))
}

async function measure(page, cdp, gesture) {
  await page.waitForTimeout(300)
  const before = await metrics(cdp)
  await frameProbeStart(page)
  const start = Date.now()
  await gesture()
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const elapsedMs = Date.now() - start
  const frames = (await frameProbeStop(page)).sort((a, b) => a - b)
  const after = await metrics(cdp)
  return {
    elapsedMs,
    frames: frames.length,
    medianFrameMs: +median(frames).toFixed(1),
    p95FrameMs: +frames[Math.floor(frames.length * 0.95)].toFixed(1),
    maxFrameMs: +frames[frames.length - 1].toFixed(1),
    over50: frames.filter((f) => f > 50).length,
    scriptMs: Math.round((after.ScriptDuration - before.ScriptDuration) * 1000),
    taskMs: Math.round((after.TaskDuration - before.TaskDuration) * 1000),
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  await page.goto(url)
  await page.locator('.scene-panel canvas').first().waitFor()
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'desconocido'
  })
  // Diseño desechable en esta sesión aislada.
  await page.evaluate(async () => {
    for (let pass = 0; pass < 6; pass += 1) {
      const toggles = [...document.querySelectorAll('#catalog-content .catalog-family__toggle[aria-expanded="false"]')]
      for (const t of toggles) t.click()
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      if (!toggles.length) break
    }
  })
  await page.getByRole('button', { name: 'Silla ＋ Añadir', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()

  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  const results = []
  for (const count of COUNTS) {
    await page.evaluate((count) => {
      const key = 'room-builder:v0.1:designs'
      const designs = JSON.parse(localStorage.getItem(key))
      const design = designs[0].data
      const chair = design.furniture.find((item) => item.kind === 'chair')
      design.furniture = Array.from({ length: count }, (_, i) => ({ ...chair, id: 'bench-' + i, x: i === 0 ? 0 : (i % 10 - 4.5) * 0.52, z: i === 0 ? 0 : (Math.floor(i / 10) - 2) * 0.52 + 0.26 }))
      design.elementFolderAssignments = Object.fromEntries(Object.entries(design.elementFolderAssignments ?? {}).filter(([id]) => !id.startsWith('chair-') && !id.startsWith('bench-')))
      for (const item of design.furniture) design.elementFolderAssignments[item.id] = 'room-root'
      localStorage.setItem(key, JSON.stringify(designs))
    }, count)
    await page.reload()
    await page.locator('.scene-panel canvas').first().waitFor()
    await page.getByRole('button', { name: 'Isométrica', exact: true }).click()
    await page.waitForTimeout(1200)
    const rows = await page.locator('.element-select').count()
    const box = await page.locator('.scene-panel canvas').first().boundingBox()
    // Localiza la silla central: clic hasta que el inspector muestre «Silla».
    const inspector = page.getByRole('complementary', { name: 'Inspector y configuración detallada' })
    let grab = null
    for (const [dx, dy] of [[0, 0], [0, 20], [0, -20], [20, 0], [-20, 0], [0, 40], [0, 60]]) {
      const p = { x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy }
      await page.keyboard.press('Escape')
      await page.mouse.click(p.x, p.y)
      if (await inspector.getByRole('heading', { name: 'Silla', exact: true }).isVisible().catch(() => false)) { grab = p; break }
    }
    for (const throttle of THROTTLES) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
      for (let rep = 1; rep <= REPS; rep += 1) {
        const orbit = await measure(page, cdp, async () => {
          for (let i = 0; i < 2; i += 1) for (const dir of [1, -1]) {
            const x = box.x + box.width * 0.65 + (dir < 0 ? 120 : 0), y = box.y + box.height * 0.3
            await page.mouse.move(x, y)
            await page.mouse.down({ button: 'middle' })
            await page.mouse.move(x + dir * 120, y, { steps: 30 })
            await page.mouse.up({ button: 'middle' })
          }
        })
        results.push({ count, rows, throttle, rep, gesture: 'orbita', ...orbit })
        if (grab) {
          const drag = await measure(page, cdp, async () => {
            for (const dir of [1, -1]) {
              const x = grab.x + (dir < 0 ? 100 : 0)
              await page.mouse.move(x, grab.y)
              await page.mouse.down()
              await page.mouse.move(x + dir * 100, grab.y + dir * 10, { steps: 30 })
              await page.mouse.up()
            }
          })
          results.push({ count, rows, throttle, rep, gesture: 'arrastre', ...drag })
        }
      }
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  }
  await browser.close()
  const summary = []
  for (const count of COUNTS) for (const throttle of THROTTLES) for (const gesture of ['orbita', 'arrastre']) {
    const rs = results.filter((r) => r.count === count && r.throttle === throttle && r.gesture === gesture)
    if (!rs.length) { summary.push({ count, throttle, gesture, nota: 'sin silla bajo el puntero' }); continue }
    summary.push({ count, throttle, gesture, elapsedMs: median(rs.map((r) => r.elapsedMs)), frames: median(rs.map((r) => r.frames)), medianFrameMs: median(rs.map((r) => r.medianFrameMs)), p95FrameMs: median(rs.map((r) => r.p95FrameMs)), maxFrameMs: median(rs.map((r) => r.maxFrameMs)), over50: median(rs.map((r) => r.over50)), scriptMs: median(rs.map((r) => r.scriptMs)) })
  }
  const out = { label, renderer, date: new Date().toISOString(), summary }
  require('fs').writeFileSync(require('path').join(require('os').tmpdir(), `room-builder-perf-${label}.json`), JSON.stringify({ ...out, results }, null, 2))
  console.log(JSON.stringify(out, null, 1))
}
main().catch((error) => { console.error(error); process.exit(1) })
