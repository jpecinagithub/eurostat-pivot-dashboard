// @vitest-environment jsdom
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { useAppStore } from '../store/dashboardStore'
import { _resetQueuesForTests } from '../services/eurostatClient'
import { _resetGeoCacheForTests } from '../services/geoService'
import { DASHBOARD_STORAGE_KEY } from './dashboardPersistence'
import { buildDashboardUrl } from './panelUrlCodec'
import type { PivotSpec } from '../core/types'
import namaFixture from '../services/__fixtures__/nama_10_gdp.b1gq_cpmeur.2023-2025.json'
import demoFixture from '../services/__fixtures__/demo_r_d3dens.country.2020-2024.json'

/**
 * Aceptación de T11 en «navegador limpio»: una URL `?d=` con paneles
 * de DOS datasets distintos reconstruye el dashboard entero (tablas
 * con datos de ambas fixtures reales) y queda persistido en
 * localStorage. Sin URL, el dashboard persistido se restaura solo.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const NAMA_SPEC: PivotSpec = {
  dataset: 'nama_10_gdp',
  lang: 'EN',
  filters: { unit: ['CP_MEUR'], na_item: ['B1GQ'], geo: ['DE', 'ES', 'FR'] },
  time: { mode: 'values', values: ['2023', '2024', '2025'] },
  rows: ['geo'],
  columns: ['time'],
}

const DEMO_SPEC: PivotSpec = {
  dataset: 'demo_r_d3dens',
  lang: 'EN',
  filters: { unit: ['PER_KM2'] },
  geoLevel: 'country',
  time: { mode: 'values', values: ['2020', '2021', '2022', '2023', '2024'] },
  rows: ['geo'],
  columns: ['time'],
}

let container: HTMLDivElement | null = null

beforeEach(() => {
  _resetQueuesForTests()
  _resetGeoCacheForTests()
  localStorage.clear()
  useAppStore.setState({ dashboard: null, builderSpec: null, selectedDataset: null })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url)
      const body = u.includes('demo_r_d3dens')
        ? demoFixture
        : u.includes('nama_10_gdp')
          ? namaFixture
          : null
      return {
        ok: true,
        status: 200,
        text: async () => (body ? JSON.stringify(body) : '{}'),
        json: async () => ({}),
      }
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  container?.remove()
  container = null
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  useAppStore.setState({ dashboard: null, builderSpec: null, selectedDataset: null })
})

describe('Arranque con enlace de dashboard (T11)', () => {
  it('reconstruye dos paneles de datasets distintos y los persiste', async () => {
    window.history.replaceState(
      null,
      '',
      buildDashboardUrl(window.location.href, 'Panel de Jon', [NAMA_SPEC, DEMO_SPEC]),
    )
    container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(createElement(App))

    // Dato dorado del panel de PIB (ES 2025) y del de densidad (ES 2024).
    await vi.waitFor(() => expect(container!.textContent).toContain('1.690.012'), {
      timeout: 20000,
      interval: 100,
    })
    await vi.waitFor(() => expect(container!.textContent).toContain('97,2'), {
      timeout: 20000,
      interval: 100,
    })
    // El nombre del dashboard llega de la URL y queda persistido.
    const nameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Mi dashboard"]',
    )
    expect(nameInput?.value).toBe('Panel de Jon')
    const saved = JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY)!)
    expect(saved.panels).toHaveLength(2)
    expect(saved.panels.map((p: { spec: { dataset: string } }) => p.spec.dataset)).toEqual([
      'nama_10_gdp',
      'demo_r_d3dens',
    ])
    root.unmount()
  }, 40000)
})
