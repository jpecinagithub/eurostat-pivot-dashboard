/**
 * EUROPIVOT — Prueba decisiva del modo OFFLINE (con el service worker
 * ACTIVO y red real). Pendiente señalada en la revisión del traspaso
 * (2026-11-05): el E2E ordinario bloquea el SW por contexto, así que
 * la recuperación offline solo estaba verificada por el contenido de
 * dist/sw.js, no por comportamiento.
 *
 * Qué hace:
 *   1. Abre el panel M1 en producción CON red y espera la cifra real.
 *   2. Espera a que el SW controle la página y RECARGA con red (esa
 *      pasada sí atraviesa el SW: la respuesta queda en la caché
 *      NetworkFirst «europivot-data»).
 *   3. Corta la red del contexto (setOffline) y RECARGA: el panel
 *      debe reconstruirse desde la caché, con su cifra y su contexto.
 *
 * Requisitos: un entorno cuyo Chromium SÍ alcance ec.europa.eu (la VM
 * del agente no puede: su Chromium no tiene salida a Eurostat, por
 * eso esta prueba no forma parte de `npm run test:e2e`).
 *
 * Uso:
 *   npm install --no-save playwright@1.64.1   (o la del entorno QA)
 *   npx playwright install chromium
 *   node scripts/e2e-offline-live.mjs
 * Variables: EUROPIVOT_URL (def. la producción pública),
 *            PLAYWRIGHT_CHROMIUM (ruta a un Chromium/Chrome propio).
 */
import { chromium } from 'playwright-core'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = (process.env.EUROPIVOT_URL ?? 'https://eurostat-pivot-dashboard.vercel.app').replace(/\/$/, '')
const M1_PARAM =
  'v1.eyJ2IjoxLCJkIjoibmFtYV8xMF9wYyIsImYiOnsidW5pdCI6WyJDUF9QUFNfRVUyN18yMDIwX0hBQiJdLCJuYV9pdGVtIjpbIkIxR1EiXSwiZ2VvIjpbIkVTIiwiRlIiLCJERSIsIkVVMjdfMjAyMCJdfSwidCI6eyJtb2RlIjoibGFzdCIsIm4iOjEwfSwiciI6WyJnZW8iXSwiYyI6WyJ0aW1lIl19'
const GOLDEN = /38\.161,7/ // España 2025, PIB per cápita PPA (M1)

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM
  const home = homedir()
  const direct = [
    join(home, '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'),
    join(home, '.cache/ms-playwright/chromium-1248/chrome-linux/chrome'),
    join(home, 'Library/Caches/ms-playwright/chromium-1248/chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
  ]
  for (const c of direct) if (existsSync(c)) return c
  // Windows / instalaciones con otra revisión: primer chrome del
  // directorio ms-playwright que exista.
  const roots = [
    join(process.env.LOCALAPPDATA ?? join(home, 'AppData/Local'), 'ms-playwright'),
    join(home, '.cache/ms-playwright'),
    join(home, 'Library/Caches/ms-playwright'),
  ]
  for (const root of roots) {
    try {
      for (const dir of readdirSync(root)) {
        if (!dir.startsWith('chromium')) continue
        for (const rel of ['chrome-win/chrome.exe', 'chrome-win64/chrome.exe', 'chrome-linux/chrome', 'chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
          const exe = join(root, dir, rel)
          if (existsSync(exe)) return exe
        }
      }
    } catch { /* raíz inexistente: sigue */ }
  }
  return undefined
}

const executablePath = findChromium()
console.log('BASE:', BASE)
console.log('Chromium:', executablePath ?? '(por defecto de playwright-core)')

const browser = await chromium.launch(executablePath ? { executablePath } : {})
try {
  const ctx = await browser.newContext() // SW PERMITIDO a propósito
  const page = await ctx.newPage()

  // 1) Con red: el panel M1 carga la cifra real.
  await page.goto(`${BASE}/?p=${M1_PARAM}`, { waitUntil: 'load' })
  await page.getByText(GOLDEN).first().waitFor({ timeout: 30000 })
  console.log('PASS  1/3 panel M1 con red: cifra real en pantalla')

  // 2) SW controlando + recarga con red (la respuesta queda cacheada).
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 20000 })
  await page.reload({ waitUntil: 'load' })
  await page.getByText(GOLDEN).first().waitFor({ timeout: 30000 })
  const cacheNames = await page.evaluate(() => caches.keys())
  console.log('PASS  2/3 SW activo; cachés presentes:', cacheNames.join(', ') || '(ninguna)')
  if (!cacheNames.includes('europivot-data')) {
    throw new Error('La caché europivot-data no existe tras la recarga con red: la respuesta no quedó guardada.')
  }

  // 3) Sin red: recargar debe reconstruir el panel desde la caché.
  await ctx.setOffline(true)
  await page.reload({ waitUntil: 'load' })
  await page.getByText(GOLDEN).first().waitFor({ timeout: 20000 })
  const bodyText = await page.locator('body').innerText()
  if (!/Eurostat/.test(bodyText)) throw new Error('El panel offline no muestra la atribución a Eurostat.')
  console.log('PASS  3/3 OFFLINE: el panel se reconstruye desde la caché, con cifra y contexto')
  console.log('OFFLINE LIVE: PASS')
} catch (e) {
  console.error('OFFLINE LIVE: FAIL —', e instanceof Error ? e.message : e)
  process.exitCode = 1
} finally {
  await browser.close()
}
