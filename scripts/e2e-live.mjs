/**
 * Smoke EN VIVO (T15): la build servida por vite preview contra la
 * API REAL de Eurostat, sin interceptar nada. Abre el enlace M1 y
 * comprueba que el panel se reconstruye con datos de verdad (los
 * valores pueden haber sido revisados por Eurostat: se verifica la
 * estructura y se imprime lo leído, no una cifra congelada).
 *
 * Uso: npm run build && node scripts/e2e-live.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const ROOT = new URL('..', import.meta.url).pathname
const PORT = 4321
const BASE = `http://127.0.0.1:${PORT}`
const M1_PARAM =
  'v1.eyJ2IjoxLCJkIjoibmFtYV8xMF9wYyIsImYiOnsidW5pdCI6WyJDUF9QUFNfRVUyN18yMDIwX0hBQiJdLCJuYV9pdGVtIjpbIkIxR1EiXSwiZ2VvIjpbIkVTIiwiRlIiLCJERSIsIkVVMjdfMjAyMCJdfSwidCI6eyJtb2RlIjoibGFzdCIsIm4iOjEwfSwiciI6WyJnZW8iXSwiYyI6WyJ0aW1lIl19'

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/')
      if (r.ok) return
    } catch {
      /* aún no */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('vite preview no arrancó')
}

function findChromium() {
  const candidates = [
    join(homedir(), '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'),
    join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux/chrome'),
    '/opt/meta-chromium/chrome',
  ]
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error('No se encontró Chromium')
  return found
}

const server = spawn(
  'npx',
  ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, stdio: 'ignore', detached: true },
)
try {
  await waitForServer()
  // En esta VM el navegador sale por el proxy del entorno (env); sin
  // él, el túnel rechaza ec.europa.eu. Se lee de env en tiempo de
  // ejecución: ninguna credencial queda en el repo.
  const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY
  let proxy
  if (proxyUrl) {
    const u = new URL(proxyUrl)
    proxy = {
      server: `${u.protocol}//${u.host}`,
      bypass: '127.0.0.1,localhost',
      ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
      ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    }
  }
  const browser = await chromium.launch({ executablePath: findChromium(), ...(proxy ? { proxy } : {}) })
  try {
    const page = await browser.newPage()
    await page.goto(`${BASE}/?p=${M1_PARAM}`)
    // La frase-resumen solo aparece con datos reales ya parseados.
    await page.getByText(/registró|recorded/).first().waitFor({ timeout: 90000 })
    const text = await page.evaluate(() => document.body.innerText)
    const hasCountries = ['España', 'Francia', 'Alemania'].every((c) => text.includes(c))
    const hasEu = text.includes('Unión Europea')
    const hasUpdated = /Actualizado/.test(text)
    const numberPattern = /\d{2}\.\d{3},\d/.test(text)
    console.log(`países ES/FR/DE visibles: ${hasCountries}`)
    console.log(`agregado UE visible: ${hasEu}`)
    console.log(`contexto «Actualizado» (RF-31): ${hasUpdated}`)
    console.log(`cifras con formato ES (##.###,#): ${numberPattern}`)
    const sentence = text.split('\n').find((l) => /registró/.test(l))
    console.log(`frase-resumen leída: ${sentence ?? '(sin frase)'}`)
    const ok = hasCountries && hasEu && hasUpdated && numberPattern
    console.log(ok ? 'SMOKE EN VIVO: PASS' : 'SMOKE EN VIVO: FAIL')
    process.exitCode = ok ? 0 : 1
  } finally {
    await browser.close()
  }
} finally {
  try {
    process.kill(-server.pid, 'SIGKILL')
  } catch {
    server.kill('SIGKILL')
  }
}
