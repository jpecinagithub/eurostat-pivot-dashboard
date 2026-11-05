// @vitest-environment jsdom
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { useAppStore } from '../store/dashboardStore'
import { _resetQueuesForTests } from '../services/eurostatClient'
import { M1_SPEC, buildPanelUrl } from './panelUrlCodec'

/**
 * Prueba M1 de «navegador limpio» (T09b): la app arranca SOLO con la
 * URL compartida en la barra de direcciones (sin estado previo) y el
 * panel se reconstruye entero: mismos países, misma unidad, mismos
 * periodos y la referencia oficial UE presente y etiquetada.
 *
 * Los datos son una respuesta JSON-stat FABRICADA para el test (la
 * verificación con cifras reales de la API se hizo aparte, en vivo).
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const GEOS = ['ES', 'FR', 'DE', 'EU27_2020']
const TIMES = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025']
const LAST_VALUES: Record<string, number> = { ES: 33000, FR: 36500, DE: 42000, EU27_2020: 38600 }

function fabricatedJsonStat(): string {
  const value: Record<string, number> = {}
  GEOS.forEach((geo, gi) => {
    TIMES.forEach((_, ti) => {
      value[String(gi * TIMES.length + ti)] = LAST_VALUES[geo] - (9 - ti) * 100
    })
  })
  return JSON.stringify({
    version: '2.0',
    class: 'dataset',
    label: 'GDP per capita (fabricated for test)',
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

let container: HTMLDivElement | null = null

beforeEach(() => {
  _resetQueuesForTests()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => (url.includes('/statistics/') ? fabricatedJsonStat() : '{}'),
    })),
  )
  useAppStore.setState({ selectedDataset: null, builderSpec: null })
  // El «navegador limpio»: solo existe la URL con el panel compartido.
  window.history.replaceState(null, '', buildPanelUrl(window.location.href, M1_SPEC))
})

afterEach(() => {
  vi.unstubAllGlobals()
  container?.remove()
  container = null
  window.history.replaceState(null, '', '/')
  useAppStore.setState({ selectedDataset: null, builderSpec: null })
})

describe('M1 — arranque desde enlace en navegador limpio', () => {
  it('reconstruye el panel: países, unidad, 10 periodos y referencia UE', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(createElement(App))

    // El panel aparece sin tocar nada: la spec vino de la URL.
    await vi.waitFor(() => expect(container!.textContent).toContain('33.000'), {
      timeout: 20000,
      interval: 100,
    })
    expect(useAppStore.getState().builderSpec).toEqual(M1_SPEC)

    const text = container.textContent ?? ''
    // Unidad común y periodos completos.
    expect(text).toContain('CP_PPS_EU27_2020_HAB')
    expect(text).toContain('2016')
    expect(text).toContain('2025')
    // Los tres países + la referencia oficial, etiquetada como tal.
    expect(text).toContain('Agregado oficial de la UE (2025)')
    expect(text).toContain('38.600')
    // Y la media simple, con su etiqueta de calculada (RF-28).
    expect(text).toContain('Media simple calculada por EUROPIVOT (sin ponderar)')
    expect(text).toContain('37.166,7') // (33000+36500+42000)/3

    // Ejes del gráfico presentes: etiquetas SVG con periodos (X) y
    // valores (Y) — el gráfico «pobre, sin ejes» quedó atrás.
    const svgTexts = [...container!.querySelectorAll('svg text')].map((el) => el.textContent)
    expect(svgTexts).toContain('2016')
    expect(svgTexts.some((txt) => txt !== null && /^[\d.]+$/.test(txt ?? ''))).toBe(true)

    root.unmount()
  }, 40000)
})
