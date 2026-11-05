/**
 * E2E en navegador REAL (T15) contra la build de producción servida
 * por `vite preview`. Las respuestas de Eurostat se interceptan con
 * fixtures reales/fabricadas (determinista, sin red); el smoke contra
 * la API de verdad vive en scripts/e2e-live.mjs.
 *
 * Cubre: arranque desde enlace M1, constructor completo, conteo de
 * peticiones RF-08 (transponer/ocultar = 0 nuevas; ampliar = 1) y los
 * estados de error RF-10 por separado (413 demasiado grande, 413 en
 * preparación asíncrona, fault 100 sin datos).
 *
 * Uso: npm run build && node scripts/e2e.mjs
 */
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const ROOT = new URL('..', import.meta.url).pathname
const PORT = 4319
const BASE = `http://127.0.0.1:${PORT}`
const M1_PARAM =
  'v1.eyJ2IjoxLCJkIjoibmFtYV8xMF9wYyIsImYiOnsidW5pdCI6WyJDUF9QUFNfRVUyN18yMDIwX0hBQiJdLCJuYV9pdGVtIjpbIkIxR1EiXSwiZ2VvIjpbIkVTIiwiRlIiLCJERSIsIkVVMjdfMjAyMCJdfSwidCI6eyJtb2RlIjoibGFzdCIsIm4iOjEwfSwiciI6WyJnZW8iXSwiYyI6WyJ0aW1lIl19'

const fixture = (name) =>
  readFileSync(join(ROOT, 'src/services/__fixtures__', name), 'utf8')

function fabricatedM1() {
  const GEOS = ['ES', 'FR', 'DE', 'EU27_2020']
  const TIMES = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025']
  const LAST = { ES: 33000, FR: 36500, DE: 42000, EU27_2020: 38600 }
  const value = {}
  GEOS.forEach((geo, gi) => {
    TIMES.forEach((_, ti) => {
      value[String(gi * TIMES.length + ti)] = LAST[geo] - (9 - ti) * 100
    })
  })
  return JSON.stringify({
    version: '2.0',
    class: 'dataset',
    label: 'GDP per capita (fabricated for e2e)',
    source: 'ESTAT',
    updated: '2026-10-22T23:00:00+0200',
    id: ['freq', 'unit', 'na_item', 'geo', 'time'],
    size: [1, 1, 1, 4, 10],
    dimension: {
      freq: { category: { index: { A: 0 } } },
      unit: { category: { index: { CP_PPS_EU27_2020_HAB: 0 } } },
      na_item: { category: { index: { B1GQ: 0 } } },
      geo: { category: { index: Object.fromEntries(GEOS.map((g, i) => [g, i])) } },
      time: { category: { index: Object.fromEntries(TIMES.map((t, i) => [t, i])) } },
    },
    value,
    extension: { status: { label: {} } },
  })
}

const TINY_GEOJSON = JSON.stringify({
  type: 'FeatureCollection',
  features: ['ES', 'FR', 'DE', 'IT', 'PT'].map((id, i) => ({
    type: 'Feature',
    properties: { NUTS_ID: id, NAME_LATN: id, LEVL_CODE: 0 },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [i * 10 - 10, 35],
          [i * 10, 35],
          [i * 10, 45],
          [i * 10 - 10, 45],
          [i * 10 - 10, 35],
        ],
      ],
    },
  })),
})

const results = []
function check(name, ok, extra = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
}

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
  if (!found) throw new Error('No se encontró Chromium para el E2E')
  return found
}

/** Instala rutas interceptadas; `stats` decide la respuesta de datos. */
async function installRoutes(page, stats, counter) {
  // El service worker (PWA) se bloquea a nivel de contexto
  // (serviceWorkers: 'block' en newContext): desde la ronda QA
  // 2026-11-05 cachea la API en runtime (NetworkFirst) y los fetches
  // internos de un SW no pasan por page.route en esta versión de
  // Playwright. El E2E prueba la lógica de la app; el SW se verifica
  // por su contenido generado (dist/sw.js).
  await page.route('**/api/dissemination/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/statistics/')) {
      counter.count++
      return stats(route)
    }
    if (url.includes('/datastructure/')) {
      return route.fulfill({ status: 200, contentType: 'text/xml', body: fixture('nama_10_gdp.datastructure.xml') })
    }
    if (url.includes('/contentconstraint/')) {
      return route.fulfill({ status: 200, contentType: 'text/xml', body: fixture('nama_10_gdp.contentconstraint.xml') })
    }
    if (url.includes('/codelist/')) {
      const body = url.includes('UNIT')
        ? fixture('codelist_unit.sample.xml')
        : url.includes('NA_ITEM')
          ? fixture('codelist_na_item.sample.xml')
          : url.includes('GEO')
            ? fixture('codelist_geo.sample.xml')
            : '<xml/>'
      return route.fulfill({ status: 200, contentType: 'text/xml', body })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**gisco-services**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: TINY_GEOJSON }),
  )
}

const jsonStats = (body) => (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body })

async function main() {
  const server = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: 'ignore', detached: true },
  )
  try {
    await waitForServer()
    const browser = await chromium.launch({ executablePath: findChromium() })
    try {
      // ——— A) Arranque M1 + RF-08 (transponer = 0 peticiones nuevas) ———
      {
        const counter = { count: 0 }
        const ctx = await browser.newContext({ serviceWorkers: 'block' })
        const page = await ctx.newPage()
        await installRoutes(page, jsonStats(fabricatedM1()), counter)
        await page.goto(`${BASE}/?p=${M1_PARAM}`)
        await page.getByText('38.600').first().waitFor({ timeout: 20000 })
        check('A1 M1: el enlace reconstruye el panel con el agregado oficial', true)
        check('A2 M1: la media simple va rotulada (RF-28)', await page.getByText(/Media simple calculada por EUROPIVOT/).first().isVisible())
        check('A3 RF-08: una sola extracción al abrir', counter.count === 1, `count=${counter.count}`)
        await page.getByRole('button', { name: /Transponer/ }).click()
        await page.waitForTimeout(800)
        check('A4 RF-08: transponer (subconjunto local) = 0 peticiones nuevas', counter.count === 1, `count=${counter.count}`)
        await ctx.close()
      }

      // ——— B) Constructor completo + ampliar = +1 extracción ———
      {
        const counter = { count: 0 }
        const ctx = await browser.newContext({ serviceWorkers: 'block' })
        const page = await ctx.newPage()
        await installRoutes(page, jsonStats(fixture('nama_10_gdp.b1gq_cpmeur.2023-2025.json')), counter)
        await page.goto(BASE + '/')
        await page
          .locator('li')
          .filter({ hasText: 'nama_10_gdp' })
          .first()
          .getByRole('button')
          .click()
        await page.getByText('Producto interior bruto (PIB)').first().waitFor({ timeout: 20000 })
        check('B1 Constructor: esquema real cargado y etiqueta ES (T14)', true)
        await page.getByRole('button', { name: 'España y vecinos' }).click()
        await page.getByRole('button', { name: 'Usar esta configuración' }).click()
        await page.getByText('1.690.012').first().waitFor({ timeout: 20000 })
        check('B2 Constructor→panel: dato dorado ES 2025 en pantalla', true)
        check('B3 RF-08: aplicar = exactamente 1 extracción', counter.count === 1, `count=${counter.count}`)
        const builder = page.locator('section[aria-label="Constructor"]')
        await builder.getByText('Italia', { exact: true }).first().click()
        await page.getByRole('button', { name: 'Usar esta configuración' }).click()
        await page.waitForTimeout(1500)
        check('B4 RF-08: ampliar la selección = +1 extracción (ni 0 ni batería)', counter.count === 2, `count=${counter.count}`)
        // Fijar al dashboard y recargar: persistencia real en el navegador.
        await page.getByRole('button', { name: 'Fijar en el dashboard' }).click()
        const nameInput = page.locator('input[aria-label="Mi dashboard"]')
        await nameInput.waitFor({ timeout: 10000 })
        check('B5a Dashboard: el panel fijado crea el dashboard', (await nameInput.inputValue()) === 'Mi dashboard')
        await page.reload()
        await page.getByText('1.690.012').first().waitFor({ timeout: 20000 })
        check('B5 Dashboard: fijar + recargar reconstruye el panel persistido', true)
        await ctx.close()
      }

      // ——— C) RF-10 estado 1: extracción demasiado grande (413) ———
      {
        const counter = { count: 0 }
        const ctx = await browser.newContext({ serviceWorkers: 'block' })
        const page = await ctx.newPage()
        await installRoutes(
          page,
          (route) =>
            route.fulfill({
              status: 413,
              contentType: 'application/json',
              body: JSON.stringify({ error: { fault: 413, label: 'EXTRACTION_TOO_BIG' } }),
            }),
          counter,
        )
        await page.goto(`${BASE}/?p=${M1_PARAM}`)
        await page.getByText('La extracción supera el máximo de Eurostat').waitFor({ timeout: 20000 })
        check('C1 RF-10: 413 EXTRACTION_TOO_BIG → mensaje «demasiado grande»', true)
        await ctx.close()
      }

      // ——— D) RF-10 estado 2: extracción en preparación (asíncrona) ———
      {
        const counter = { count: 0 }
        const ctx = await browser.newContext({ serviceWorkers: 'block' })
        const page = await ctx.newPage()
        await installRoutes(
          page,
          (route) =>
            route.fulfill({
              status: 413,
              contentType: 'application/json',
              body: JSON.stringify({
                error: {
                  fault: 413,
                  label: 'ASYNCHRONOUS_RESPONSE',
                  message: 'key 123e4567-e89b-12d3-a456-426614174000',
                },
              }),
            }),
          counter,
        )
        await page.goto(`${BASE}/?p=${M1_PARAM}`)
        await page.getByText('está preparando esta extracción en segundo plano').waitFor({ timeout: 20000 })
        check('D1 RF-10: 413 ASYNCHRONOUS_RESPONSE → mensaje «en preparación», distinto del C1', true)
        await ctx.close()
      }

      // ——— E) Fault 100: sin datos ———
      {
        const counter = { count: 0 }
        const ctx = await browser.newContext({ serviceWorkers: 'block' })
        const page = await ctx.newPage()
        await installRoutes(
          page,
          (route) =>
            route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({ error: { fault: 100, label: 'No data' } }),
            }),
          counter,
        )
        await page.goto(`${BASE}/?p=${M1_PARAM}`)
        await page.getByText('Eurostat no tiene datos para esta selección').waitFor({ timeout: 20000 })
        check('E1 Errores: fault 100 → «sin datos», no un fallo genérico', true)
        await ctx.close()
      }
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
  const failed = results.filter((r) => !r.ok)
  console.log(`\nE2E: ${results.length - failed.length}/${results.length} PASS`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('E2E ERROR', e)
  process.exit(1)
})
